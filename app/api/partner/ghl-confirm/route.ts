import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { enquiries, auditLog } from "@/db/schema";

const bodySchema = z.object({
  correlation_id: z.string().uuid(),
  // GHL's workflow builder has no merge field for the ID of an Opportunity
  // just created in the same workflow, so the confirmation callback can
  // only ever reliably carry correlation_id. Keep this optional rather than
  // required, or every real GHL confirmation fails validation here.
  ghl_opportunity_id: z.string().min(1).optional(),
  ghl_pipeline_id: z.string().optional(),
});

function fieldNames(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.keys(value as Record<string, unknown>).sort()
    : [];
}

export async function POST(request: Request) {
  const expected = process.env.GHL_CONFIRM_SECRET;
  const supplied = request.headers.get("x-ghl-confirm-secret");

  if (!expected || !supplied || supplied !== expected) {
    console.warn("Partner GHL confirmation rejected", {
      reason: !expected
        ? "confirm_secret_not_configured"
        : !supplied
          ? "confirm_secret_missing"
          : "confirm_secret_mismatch",
      secret_header_present: Boolean(supplied),
    });
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    console.warn("Partner GHL confirmation rejected", {
      reason: "invalid_json",
      fields_present: [],
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    console.warn("Partner GHL confirmation rejected", {
      reason: "invalid_payload",
      fields_present: fieldNames(body),
      validation_issues: parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        code: issue.code,
      })),
    });
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const db = getDb();
    const [existing] = await db
      .select()
      .from(enquiries)
      .where(eq(enquiries.correlationId, parsed.data.correlation_id))
      .limit(1);

    if (!existing) {
      console.warn("Partner GHL confirmation rejected", {
        reason: "unknown_correlation",
        correlation_id: parsed.data.correlation_id,
        fields_present: fieldNames(body),
      });
      return NextResponse.json({ error: "Unknown correlation" }, { status: 404 });
    }

    if (existing.status === "synced") {
      console.info("Partner GHL confirmation accepted", {
        correlation_id: parsed.data.correlation_id,
        idempotent: true,
        ghl_opportunity_id_present: Boolean(parsed.data.ghl_opportunity_id),
        ghl_pipeline_id_present: Boolean(parsed.data.ghl_pipeline_id),
      });
      return NextResponse.json({ ok: true, idempotent: true });
    }

    // Note: the Neon HTTP driver (@neondatabase/serverless over neon-http)
    // does not support db.transaction() — each query is its own request, so
    // a transaction() call throws at runtime ("No transactions support in
    // neon-http driver"), which silently kept every enquiry stuck on
    // "pending" even once the payload validated correctly. Do the update
    // and the audit write as two sequential statements instead. The audit
    // write is best-effort logging, not something the confirmation should
    // fail over, so a failure there is caught and logged rather than
    // thrown — the enquiry's status is already updated by that point.
    const now = new Date();
    await db
      .update(enquiries)
      .set({
        status: "synced",
        ghlOpportunityId: parsed.data.ghl_opportunity_id ?? null,
        ghlPipelineId: parsed.data.ghl_pipeline_id ?? null,
        confirmedAt: now,
        updatedAt: now,
      })
      .where(eq(enquiries.id, existing.id));

    try {
      await db.insert(auditLog).values({
        action: "enquiry.crm_confirmed",
        entityType: "enquiry",
        entityId: existing.id,
        before: { status: existing.status },
        after: {
          status: "synced",
          ghlOpportunityId: parsed.data.ghl_opportunity_id ?? null,
        },
      });
    } catch (auditError) {
      console.error("Partner GHL confirmation audit log failed", {
        correlation_id: parsed.data.correlation_id,
        error_name: auditError instanceof Error ? auditError.name : "UnknownError",
        error_message: auditError instanceof Error ? auditError.message : "Unknown error",
      });
    }

    console.info("Partner GHL confirmation accepted", {
      correlation_id: parsed.data.correlation_id,
      idempotent: false,
      ghl_opportunity_id_present: Boolean(parsed.data.ghl_opportunity_id),
      ghl_pipeline_id_present: Boolean(parsed.data.ghl_pipeline_id),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Partner GHL confirmation failed", {
      correlation_id: parsed.data.correlation_id,
      fields_present: fieldNames(body),
      error_name: error instanceof Error ? error.name : "UnknownError",
      error_message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Unable to confirm enquiry" }, { status: 500 });
  }
}
