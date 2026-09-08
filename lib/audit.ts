import { headers } from "next/headers";
import { getDb } from "@/db";
import { auditLog } from "@/db/schema";

export async function writeAudit(input: { actorId?: string | null; action: string; entityType: string; entityId?: string | null; before?: unknown; after?: unknown }) {
  const h = await headers();
  await getDb().insert(auditLog).values({ actorId: input.actorId ?? null, action: input.action, entityType: input.entityType, entityId: input.entityId ?? null, before: input.before ?? null, after: input.after ?? null, ipAddress: h.get("x-nf-client-connection-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null });
}
