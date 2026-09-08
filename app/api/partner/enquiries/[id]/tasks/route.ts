import { and, asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { enquiries, partnerTasks } from "@/db/schema";
import { getPartnerRequestContext } from "@/lib/partner-api";

const taskSchema = z.object({
  body: z.string().trim().min(1).max(500),
  due_date: z.union([z.string().date(), z.literal("")]).optional(),
});

async function ownsEnquiry(id: string, partnerId: string) {
  return (await getDb().select({ id: enquiries.id }).from(enquiries)
    .where(and(eq(enquiries.id, id), eq(enquiries.partnerId, partnerId))).limit(1))[0];
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getPartnerRequestContext();
  if (!context) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { id } = await params;
  if (!await ownsEnquiry(id, context.partnerId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const tasks = await getDb().select().from(partnerTasks)
    .where(and(eq(partnerTasks.enquiryId, id), eq(partnerTasks.partnerId, context.partnerId)))
    .orderBy(asc(partnerTasks.done), sql`${partnerTasks.dueDate} asc nulls last`, asc(partnerTasks.createdAt));
  return NextResponse.json({ tasks });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getPartnerRequestContext();
  if (!context) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { id } = await params;
  if (!await ownsEnquiry(id, context.partnerId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = taskSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Please enter a task of up to 500 characters" }, { status: 400 });
  const [task] = await getDb().insert(partnerTasks).values({
    enquiryId: id,
    partnerId: context.partnerId,
    authorId: context.user.id,
    body: parsed.data.body,
    dueDate: parsed.data.due_date || null,
  }).returning();
  return NextResponse.json({ task }, { status: 201 });
}
