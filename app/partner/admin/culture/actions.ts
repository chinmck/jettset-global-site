"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePartner } from "@/lib/partner-auth";
import { writeAudit } from "@/lib/audit";
import { dbRepo } from "@/lib/culture/repo-db";
import { cultureSources, cultureWatchlist } from "@/lib/culture/config";
import { applyDecision, ReviewError, cal, assertStaff, runCultureSync } from "@/lib/culture";

/* eslint-disable @typescript-eslint/no-explicit-any */
// Every action here re-checks staff access itself: server actions are reachable by POST, so the
// admin layout alone is not enough. Partners, inactive users and anonymous callers are refused.
const BASE = "/partner/admin/culture";
const back = (kind: "ok" | "error", message: string): never => redirect(`${BASE}?${kind}=${encodeURIComponent(message)}`);
const str = (f: FormData, k: string) => { const v = f.get(k); return typeof v === "string" ? v.trim() : ""; };

async function staff() {
  const { user } = await requirePartner({ roles: ["admin", "executive"] });
  try { assertStaff(user); } catch { return redirect("/partner/dashboard?access=denied"); }
  return user;
}

export async function decideCandidate(formData: FormData) {
  const user = await staff();
  const repo = dbRepo();
  const id = str(formData, "candidateId");
  const decision = str(formData, "decision") as "approve" | "reject" | "needs_verification";
  let message = "";
  try {
    const candidate = await repo.getCandidate(id);
    if (!candidate) throw new ReviewError("missing", "That review item no longer exists.");
    const events = await repo.listEvents();
    const edits: Record<string, string> = {};
    for (const k of ["name", "category", "city", "country", "venue", "startDate", "endDate", "timezone", "countryCode"]) { const v = str(formData, k); if (v) edits[k] = v; }
    const editorial = str(formData, "lede") || str(formData, "context")
      ? { lede: str(formData, "lede"), context: str(formData, "context") }
      : null;
    const today = cal.londonToday();
    const result = applyDecision({ candidate, decision, notes: str(formData, "notes"), edits, editorial, reviewer: user.id, today, events });
    // Persist: event first (so a failed write never leaves an approved-but-missing event), then the decision record.
    if (result.event?.type === "insert") await repo.insertEvent(result.event.record);
    else if (result.event?.type === "update") await repo.updateEvent(result.event.id, result.event.patch);
    await repo.updateCandidate(candidate.id, result.candidatePatch);
    await repo.insertReview(result.review);
    await writeAudit({ actorId: user.id, action: `culture.${decision}`, entityType: "culture_candidate", entityId: candidate.id, before: candidate.current ?? null, after: result.review.after ?? null });
    revalidatePath(BASE);
    message = decision === "approve" ? "Approved: the public calendar will show it within a few minutes." : decision === "reject" ? "Rejected and recorded." : "Kept pending: verification note recorded.";
  } catch (error) {
    if (error instanceof ReviewError) return back("error", error.message);
    return back("error", "The decision could not be saved. Nothing was published. Check that the culture tables exist (see docs/culture-calendar.md).");
  }
  return back("ok", message);
}

export async function signOffEditorial(formData: FormData) {
  const user = await staff();
  const id = str(formData, "eventId");
  try {
    const repo = dbRepo();
    const e = await repo.getEvent(id);
    if (!e) return back("error", "Event not found.");
    const ed = e.editorial ?? {};
    if (!ed.lede || (ed.context ?? []).join(" ").length < 120) return back("error", "Add a Jettset lede and editorial context before signing off.");
    await repo.updateEvent(id, { editorialReviewedBy: user.id, editorialReviewedAt: new Date().toISOString(), lastVerifiedOn: cal.londonToday() });
    await writeAudit({ actorId: user.id, action: "culture.editorial_signoff", entityType: "culture_event", entityId: id });
    revalidatePath(BASE);
  } catch { return back("error", "Could not record the sign-off."); }
  return back("ok", "Editorial signed off: the page can now be indexed.");
}

export async function runSyncNow() {
  const user = await staff();
  const run = await runCultureSync({ repo: dbRepo() as any, sources: cultureSources as any, watchlist: cultureWatchlist as any, trigger: "manual" });
  await writeAudit({ actorId: user.id, action: "culture.sync_manual", entityType: "culture_sync", after: { status: run.status, created: run.created ?? 0 } });
  revalidatePath(BASE);
  return back(run.status === "failed" ? "error" : "ok", `Sync ${run.status}: ${run.headline}${run.created != null ? ` (${run.created} new review item${run.created === 1 ? "" : "s"})` : ""}`);
}
