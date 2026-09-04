import { getStore } from "@netlify/blobs";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { documents, partnerUsers } from "@/db/schema";
import { writeAudit } from "@/lib/audit";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const CHUNK_SIZE = 2 * 1024 * 1024;
const allowedTypes = new Set(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/png", "image/jpeg", "image/svg+xml"]);
const allowedCategories = new Set(["agreement", "compliance", "brand_asset", "sales_collateral", "guideline", "other"]);
type DocumentCategory = (typeof documents.$inferInsert)["category"];
type UploadManifest = { id: string; userId: string; fileName: string; fileSize: number; mimeType: string; visibility: "private" | "shared"; partnerId: string | null; category: DocumentCategory; chunkCount: number };

async function requireUploader() {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Unauthorised" }, { status: 401 }) };
  const [user] = await getDb().select().from(partnerUsers).where(eq(partnerUsers.id, session.user.id)).limit(1);
  if (!user || (user.role !== "admin" && user.role !== "executive")) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user };
}

function uploadPrefix(userId: string, uploadId: string) { return `_uploads/${userId}/${uploadId}`; }

async function readManifest(userId: string, uploadId: string) {
  const value = await getStore({ name: "partner-resources", consistency: "strong" }).get(`${uploadPrefix(userId, uploadId)}/manifest.json`);
  if (!value) return null;
  try { return JSON.parse(value) as UploadManifest; } catch { return null; }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireUploader();
    if ("error" in authResult) return authResult.error;
    const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!payload) return NextResponse.json({ error: "Invalid upload request" }, { status: 400 });

    if (payload.action === "init") {
      const fileName = String(payload.file_name || "").trim();
      const fileSize = Number(payload.file_size);
      const mimeType = String(payload.mime_type || "");
      const visibility = payload.visibility === "private" ? "private" : "shared";
      const partnerId = visibility === "private" ? String(payload.partner_id || "") : null;
      const categoryValue = String(payload.category || "other");
      if (!fileName || !Number.isSafeInteger(fileSize) || fileSize < 1 || fileSize > MAX_FILE_SIZE || !allowedTypes.has(mimeType)) return NextResponse.json({ error: "Unsupported file. Use PDF, Word, PNG, JPG or SVG files up to 25 MB." }, { status: 400 });
      if (visibility === "private" && !partnerId) return NextResponse.json({ error: "Select a partner organisation." }, { status: 400 });
      if (!allowedCategories.has(categoryValue)) return NextResponse.json({ error: "Invalid document type." }, { status: 400 });

      const id = crypto.randomUUID();
      const manifest: UploadManifest = { id, userId: authResult.user.id, fileName, fileSize, mimeType, visibility, partnerId, category: categoryValue as DocumentCategory, chunkCount: Math.ceil(fileSize / CHUNK_SIZE) };
      await getStore({ name: "partner-resources", consistency: "strong" }).set(`${uploadPrefix(authResult.user.id, id)}/manifest.json`, JSON.stringify(manifest));
      return NextResponse.json({ upload_id: id, chunk_size: CHUNK_SIZE, chunk_count: manifest.chunkCount });
    }

    if (payload.action === "finalize") {
      const uploadId = String(payload.upload_id || "");
      const manifest = await readManifest(authResult.user.id, uploadId);
      if (!manifest || manifest.userId !== authResult.user.id) return NextResponse.json({ error: "Upload session expired. Please try again." }, { status: 404 });
      const store = getStore({ name: "partner-resources", consistency: "strong" });
      const chunks = await Promise.all(Array.from({ length: manifest.chunkCount }, (_, index) => store.get(`${uploadPrefix(authResult.user.id, uploadId)}/chunk-${index}`, { type: "arrayBuffer" })));
      if (chunks.some((chunk) => !chunk)) return NextResponse.json({ error: "The upload was interrupted. Please try again." }, { status: 400 });

      const completeFile = new Uint8Array(manifest.fileSize);
      let offset = 0;
      for (const chunk of chunks) { const bytes = new Uint8Array(chunk as ArrayBuffer); completeFile.set(bytes, offset); offset += bytes.byteLength; }
      if (offset !== manifest.fileSize) return NextResponse.json({ error: "The uploaded file was incomplete. Please try again." }, { status: 400 });

      const safeName = manifest.fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
      const fileKey = `${manifest.visibility}/${manifest.partnerId ?? "library"}/${crypto.randomUUID()}-${safeName}`;
      await store.set(fileKey, completeFile, { metadata: { contentType: manifest.mimeType } });
      const [record] = await getDb().insert(documents).values({ partnerId: manifest.partnerId, category: manifest.category, fileKey, fileName: manifest.fileName, fileSize: manifest.fileSize, mimeType: manifest.mimeType, uploadedBy: authResult.user.id, visibility: manifest.visibility }).returning();
      await writeAudit({ actorId: authResult.user.id, action: "document.uploaded", entityType: "document", entityId: record.id, after: { fileName: manifest.fileName, visibility: manifest.visibility, partnerId: manifest.partnerId } });
      await Promise.all([...Array.from({ length: manifest.chunkCount }, (_, index) => store.delete(`${uploadPrefix(authResult.user.id, uploadId)}/chunk-${index}`)), store.delete(`${uploadPrefix(authResult.user.id, uploadId)}/manifest.json`)]);
      return NextResponse.json({ ok: true, id: record.id });
    }

    return NextResponse.json({ error: "Invalid upload action" }, { status: 400 });
  } catch (error) {
    console.error("Partner document upload failed", error);
    return NextResponse.json({ error: "The document could not be uploaded. Please try again." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const authResult = await requireUploader();
    if ("error" in authResult) return authResult.error;
    const url = new URL(request.url);
    const uploadId = url.searchParams.get("upload_id") || "";
    const chunkIndex = Number(url.searchParams.get("index"));
    const manifest = await readManifest(authResult.user.id, uploadId);
    if (!manifest || manifest.userId !== authResult.user.id) return NextResponse.json({ error: "Upload session expired. Please try again." }, { status: 404 });
    if (!Number.isSafeInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= manifest.chunkCount) return NextResponse.json({ error: "Invalid upload chunk." }, { status: 400 });
    const chunk = await request.arrayBuffer();
    const expectedSize = Math.min(CHUNK_SIZE, manifest.fileSize - chunkIndex * CHUNK_SIZE);
    if (chunk.byteLength !== expectedSize) return NextResponse.json({ error: "The upload was interrupted. Please try again." }, { status: 400 });
    await getStore({ name: "partner-resources", consistency: "strong" }).set(`${uploadPrefix(authResult.user.id, uploadId)}/chunk-${chunkIndex}`, chunk);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Partner document chunk upload failed", error);
    return NextResponse.json({ error: "The document could not be uploaded. Please try again." }, { status: 500 });
  }
}
