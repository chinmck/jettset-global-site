import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../db/index";
import { cultureCandidates, cultureEvents, cultureReviews, cultureSourceStates, cultureSyncRuns } from "../../db/schema";

// Drizzle/Postgres implementation of the repository used by the weekly sync and the Partner Hub
// (same interface as lib/culture/repo-memory.mjs). Timestamps cross the boundary as ISO strings.
/* eslint-disable @typescript-eslint/no-explicit-any */
const toDate = (v: unknown) => (v == null ? null : v instanceof Date ? v : new Date(String(v)));
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : (v as string | null) ?? null);

const EVENT_TS = ["lastSourceCheckAt", "editorialReviewedAt"] as const;
const CAND_TS = ["sourceCheckedAt", "decidedAt", "firstSeen", "lastSeen"] as const;

function outRow<T extends Record<string, any>>(row: T | undefined, tsKeys: readonly string[]) {
  if (!row) return undefined;
  const o: Record<string, any> = { ...row };
  for (const k of tsKeys) o[k] = iso(o[k]);
  for (const k of ["createdAt", "updatedAt"]) if (k in o) o[k] = iso(o[k]);
  return o as any;
}
function inPatch(patch: Record<string, any>, tsKeys: readonly string[]) {
  const o: Record<string, any> = { ...patch };
  for (const k of tsKeys) if (k in o) o[k] = toDate(o[k]);
  return o;
}

export function dbRepo() {
  const db = getDb();
  return {
    async listEvents() { return (await db.select().from(cultureEvents)).map((r) => outRow(r, EVENT_TS)); },
    async getEvent(id: string) { const [r] = await db.select().from(cultureEvents).where(eq(cultureEvents.id, id)).limit(1); return outRow(r, EVENT_TS); },
    async getEventBySlug(slug: string) { const [r] = await db.select().from(cultureEvents).where(eq(cultureEvents.slug, slug)).limit(1); return outRow(r, EVENT_TS); },
    async insertEvent(rec: Record<string, any>) { const [r] = await db.insert(cultureEvents).values(inPatch(rec, EVENT_TS) as any).returning(); return outRow(r, EVENT_TS); },
    async updateEvent(id: string, patch: Record<string, any>) { const [r] = await db.update(cultureEvents).set({ ...inPatch(patch, EVENT_TS), updatedAt: new Date() } as any).where(eq(cultureEvents.id, id)).returning(); return outRow(r, EVENT_TS); },

    async listCandidates(filter?: { status?: string[] }) {
      const q = db.select().from(cultureCandidates);
      const rows = filter?.status?.length ? await q.where(inArray(cultureCandidates.status, filter.status)) : await q;
      return rows.map((r) => outRow(r, CAND_TS));
    },
    async getCandidate(id: string) { const [r] = await db.select().from(cultureCandidates).where(eq(cultureCandidates.id, id)).limit(1); return outRow(r, CAND_TS); },
    async insertCandidate(c: Record<string, any>) {
      const { id: _ignore, ...rest } = c; void _ignore;
      const [r] = await db.insert(cultureCandidates).values(inPatch(rest, CAND_TS) as any).onConflictDoNothing({ target: cultureCandidates.fingerprint }).returning();
      return outRow(r, CAND_TS);
    },
    async updateCandidate(id: string, patch: Record<string, any>) { const [r] = await db.update(cultureCandidates).set(inPatch(patch, CAND_TS) as any).where(eq(cultureCandidates.id, id)).returning(); return outRow(r, CAND_TS); },

    async insertReview(r: Record<string, any>) { await db.insert(cultureReviews).values({ ...r, decidedAt: toDate(r.decidedAt) ?? new Date() } as any); },
    async listReviews(n = 50) { return (await db.select().from(cultureReviews).orderBy(desc(cultureReviews.decidedAt)).limit(n)).map((r) => outRow(r, ["decidedAt"])); },

    async recordRun(r: Record<string, any>) {
      const { startedAt, finishedAt, trigger, status, headline, ...summary } = r;
      await db.insert(cultureSyncRuns).values({ startedAt: toDate(startedAt)!, finishedAt: toDate(finishedAt), trigger, status, headline: headline ?? null, summary } as any);
    },
    async listRuns(n = 20) {
      return (await db.select().from(cultureSyncRuns).orderBy(desc(cultureSyncRuns.startedAt)).limit(n)).map((r) => ({ ...outRow(r, ["startedAt", "finishedAt"]), ...(r.summary as object) }));
    },

    async upsertSourceState(s: Record<string, any>) {
      const v = { id: s.id, name: s.name, kind: s.kind, lastAttempt: toDate(s.lastAttempt), lastSuccess: toDate(s.lastSuccess), lastError: s.lastError ?? null, itemsSeen: s.itemsSeen ?? 0 };
      await db.insert(cultureSourceStates).values(v as any).onConflictDoUpdate({ target: cultureSourceStates.id, set: { name: v.name, kind: v.kind, lastAttempt: v.lastAttempt, lastSuccess: v.lastSuccess, lastError: v.lastError, itemsSeen: v.itemsSeen } as any });
    },
    async getSourceState(id: string) { const [r] = await db.select().from(cultureSourceStates).where(eq(cultureSourceStates.id, id)).limit(1); return outRow(r, ["lastAttempt", "lastSuccess"]); },
    async listSourceStates() { return (await db.select().from(cultureSourceStates)).map((r) => outRow(r, ["lastAttempt", "lastSuccess"])); },
  };
}
export type CultureRepo = ReturnType<typeof dbRepo>;
export { and };
