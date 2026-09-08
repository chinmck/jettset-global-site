import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { enquiries, partnerNotes, partnerUsers } from "@/db/schema";
import { getPartnerRequestContext } from "@/lib/partner-api";

const noteSchema = z.object({ body: z.string().trim().min(1).max(2000) });

async function ownsEnquiry(id: string, partnerId: string) {
  return (await getDb().select({ id: enquiries.id }).from(enquiries)
    .where(and(eq(enquiries.id, id), eq(enquiries.partnerId, partnerId))).limit(1))[0];
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getPartnerRequestContext();
  if (!context) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { id } = await params;
  if (!await ownsEnquiry(id, context.partnerId)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const notes = await getDb().select({
    id: partnerNotes.id,
    body: partnerNotes.body,
    createdAt: partnerNotes.createdAt,
    authorName: partnerUsers.name,
    authorEmail: partnerUsers.email,
  }).from(partnerNotes)
    .innerJoin(partnerUsers, eq(partnerUsers.id, partnerNotes.authorId))
    .where(and(eq(partnerNotes.enquiryId, id), eq(partnerNotes.partnerId, context.partnerId)))
    .orderBy(desc(partnerNotes.createdAt));
  return NextResponse.json({ notes });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getPartnerRequestContext();
  if (!context) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { id } = await params;
  if (!await ownsEnquiry(id, context.partnerId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = noteSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Please enter a note of up to 2,000 characters" }, { status: 400 });

  const [note] = await getDb().insert(partnerNotes).values({
    enquiryId: id,
    partnerId: context.partnerId,
    authorId: context.user.id,
    body: parsed.data.body,
  }).returning();
  return NextResponse.json({ note: { ...note, authorName: context.user.name, authorEmail: context.user.email } }, { status: 201 });
}
