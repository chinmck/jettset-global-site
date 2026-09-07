import { and, eq, lt } from "drizzle-orm";
import { getDb } from "../../db/index";
import { auditLog, enquiries } from "../../db/schema";

export default async () => {
  if (!process.env.DATABASE_URL) return new Response("Database not configured", { status: 503 });

  const db = getDb();
  const cutoff = new Date(Date.now() - 15 * 60 * 1000);
  const stale = await db
    .select({ id: enquiries.id })
    .from(enquiries)
    .where(and(eq(enquiries.status, "pending"), lt(enquiries.submittedAt, cutoff)));

  if (stale.length) {
    // The Neon HTTP driver (@neondatabase/serverless over neon-http) does
    // not support db.transaction() — it throws at runtime, which silently
    // stopped this sweep from ever marking anything stale. Do the update
    // and the audit writes as sequential statements instead; the audit
    // insert is best-effort logging, so a failure there doesn't block the
    // status update that already happened.
    await db
      .update(enquiries)
      .set({ status: "stale", updatedAt: new Date() })
      .where(and(eq(enquiries.status, "pending"), lt(enquiries.submittedAt, cutoff)));

    try {
      await db.insert(auditLog).values(
        stale.map((e) => ({
          action: "enquiry.sync_stale",
          entityType: "enquiry",
          entityId: e.id,
          after: { status: "stale" },
        })),
      );
    } catch (auditError) {
      console.error("Partner stale-sweep audit log failed", {
        marked_stale: stale.length,
        error_name: auditError instanceof Error ? auditError.name : "UnknownError",
        error_message: auditError instanceof Error ? auditError.message : "Unknown error",
      });
    }
  }

  return Response.json({ marked_stale: stale.length });
};
