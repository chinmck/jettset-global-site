import { createHash } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { enquiries, partners, partnerUsers } from "@/db/schema";
import { writeAudit } from "@/lib/audit";

const schema = z
  .object({
    first_name: z.string().trim().min(1),
    last_name: z.string().trim().min(1),
    email: z.string().email(),
    phone: z.string().trim().min(4),
    product: z.enum(["jet_card", "club_membership", "charter", "access_partners", "general"]),
    channel: z.string().min(1),
  })
  .passthrough();

async function resolvePartnerId(user: typeof partnerUsers.$inferSelect) {
  if (user.partnerId) return user.partnerId;
  if (user.role !== "admin" && user.role !== "executive") return null;

  const db = getDb();
  const [internalPartner] = await db
    .insert(partners)
    .values({
      name: "Jettset Global",
      org: "Internal",
      email: "partner-hub@jettsetglobal.com",
      status: "active",
    })
    .onConflictDoUpdate({
      target: partners.email,
      set: { name: "Jettset Global", org: "Internal", status: "active", updatedAt: new Date() },
    })
    .returning({ id: partners.id });

  await db
    .update(partnerUsers)
    .set({ partnerId: internalPartner.id, updatedAt: new Date() })
    .where(eq(partnerUsers.id, user.id));

  return internalPartner.id;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const db = getDb();
  const [user] = await db.select().from(partnerUsers).where(eq(partnerUsers.id, session.user.id)).limit(1);
  if (!user || user.status !== "active" || !user.aupAcceptedAt) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const partnerId = await resolvePartnerId(user);
  if (!partnerId) return NextResponse.json({ error: "No partner organisation is assigned" }, { status: 403 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Please review the required information" }, { status: 400 });
  }

  const canonical = JSON.stringify(parsed.data, Object.keys(parsed.data).sort());
  const fingerprint = createHash("sha256").update(`${partnerId}:${canonical}`).digest("hex");
  const since = new Date(Date.now() - 2 * 60 * 1000);
  const duplicate = await db
    .select({ id: enquiries.id, correlationId: enquiries.correlationId })
    .from(enquiries)
    .where(
      and(
        eq(enquiries.partnerId, partnerId),
        gt(enquiries.submittedAt, since),
        sql`${enquiries.payload}->>'submission_hash'=${fingerprint}`,
      ),
    )
    .limit(1);

  if (duplicate[0]) {
    return NextResponse.json({
      id: duplicate[0].id,
      correlation_id: duplicate[0].correlationId,
      status: "pending",
      duplicate: true,
    });
  }

  const payload = {
    ...parsed.data,
    submission_hash: fingerprint,
    partner_id: partnerId,
    partner_user_id: user.id,
    lead_source: "Partner Portal",
    submission_timestamp: new Date().toISOString(),
  };
  const [created] = await db
    .insert(enquiries)
    .values({ partnerId, submittedBy: user.id, product: parsed.data.product, payload })
    .returning();

  await writeAudit({
    actorId: user.id,
    action: "enquiry.created",
    entityType: "enquiry",
    entityId: created.id,
    after: { correlationId: created.correlationId, product: created.product, status: "pending" },
  });

  const origin = new URL(request.url).origin;
  try {
    await fetch(`${origin}/.netlify/functions/partner-ghl-sync-background`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        correlation_id: created.correlationId,
        partner_id: partnerId,
        product: created.product,
        enquiry: payload,
      }),
      signal: AbortSignal.timeout(2000),
    });
  } catch {}

  return NextResponse.json(
    { id: created.id, correlation_id: created.correlationId, status: "pending" },
    { status: 202 },
  );
}
