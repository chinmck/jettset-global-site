import { getStore } from "@netlify/blobs";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { documents, partnerUsers } from "@/db/schema";
import { writeAudit } from "@/lib/audit";

const allowed = new Set(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/png", "image/jpeg", "image/svg+xml"]);
type DocumentCategory = (typeof documents.$inferInsert)["category"];

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const [user] = await getDb().select().from(partnerUsers).where(eq(partnerUsers.id, session.user.id)).limit(1);
  if (!user || (user.role !== "admin" && user.role !== "executive")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size > 25 * 1024 * 1024 || !allowed.has(file.type)) return NextResponse.json({ error: "Unsupported file" }, { status: 400 });
  const visibility = form.get("visibility") === "shared" ? "shared" : "private";
  const partnerId = visibility === "private" ? String(form.get("partner_id") || "") : null;
  if (visibility === "private" && !partnerId) return NextResponse.json({ error: "Partner required" }, { status: 400 });
  const key = `${visibility}/${partnerId ?? "library"}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  await getStore("partner-resources").set(key, await file.arrayBuffer(), { metadata: { contentType: file.type } });
  const category = String(form.get("category") || "other") as DocumentCategory;
  const [record] = await getDb().insert(documents).values({ partnerId, category, fileKey: key, fileName: file.name, fileSize: file.size, mimeType: file.type, uploadedBy: user.id, visibility }).returning();
  await writeAudit({ actorId: user.id, action: "document.uploaded", entityType: "document", entityId: record.id, after: { fileName: file.name, visibility, partnerId } });
  return NextResponse.json({ ok: true, id: record.id });
}
