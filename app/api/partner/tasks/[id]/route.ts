import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { partnerTasks } from "@/db/schema";
import { getPartnerRequestContext } from "@/lib/partner-api";

const patchSchema = z.object({
  done: z.boolean().optional(),
  due_date: z.union([z.string().date(), z.literal(""), z.null()]).optional(),
}).refine((value) => value.done !== undefined || value.due_date !== undefined);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getPartnerRequestContext();
  if (!context) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid task update" }, { status: 400 });
  const { id } = await params;
  const [task] = await getDb().update(partnerTasks).set({
    ...(parsed.data.done !== undefined ? { done: parsed.data.done } : {}),
    ...(parsed.data.due_date !== undefined ? { dueDate: parsed.data.due_date || null } : {}),
    updatedAt: new Date(),
  }).where(and(eq(partnerTasks.id, id), eq(partnerTasks.partnerId, context.partnerId))).returning();
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ task });
}
