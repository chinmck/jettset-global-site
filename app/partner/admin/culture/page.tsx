import { inArray } from "drizzle-orm";
import { HubNav } from "@/components/partner/hub-nav";
import { requirePartner } from "@/lib/partner-auth";
import { getDb } from "@/db";
import { partnerUsers } from "@/db/schema";
import { dbRepo } from "@/lib/culture/repo-db";
import { cultureSources, cultureWatchlist } from "@/lib/culture/config";
import { CATEGORIES, categoryLabel, cal, COMPARE_FIELDS } from "@/lib/culture";
import { decideCandidate, runSyncNow, signOffEditorial } from "./actions";

/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = "force-dynamic";
export const metadata = { title: "Culture Calendar Review | Partner Hub", robots: { index: false, follow: false } };

const KIND: Record<string, string> = { new: "New event", change: "Proposed change", cancellation: "Proposed cancellation", manual_verification: "Manual verification", recheck: "Recheck of a published event" };
const FIELD_LABEL: Record<string, string> = { name: "Name", category: "Category", city: "City", country: "Country", venue: "Venue", startDate: "Start date", endDate: "End date", status: "Status", timezone: "Timezone" };
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" }) : "—");
const show = (f: string, v: any) => (v == null || v === "" ? "—" : f === "category" ? categoryLabel(v) : f.endsWith("Date") ? cal.longDate(v) : String(v));
const rank = (c: any) => ({ cancellation: 0, change: 1, recheck: 2, new: 3, manual_verification: 4 } as Record<string, number>)[c.kind] ?? 9;

export default async function CultureReview({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { user } = await requirePartner({ roles: ["admin", "executive"] });
  const sp = await searchParams;
  const repo = dbRepo();
  let data: { events: any[]; open: any[]; reviews: any[]; runs: any[]; states: any[]; names: Map<string, string>; all: any[] } | null = null;
  let loadError = "";
  try {
    const [events, all, reviews, runs, states] = await Promise.all([repo.listEvents(), repo.listCandidates(), repo.listReviews(25), repo.listRuns(12), repo.listSourceStates()]);
    const ids = [...new Set([...reviews.map((r: any) => r.reviewerId), ...events.map((e: any) => e.editorialReviewedBy).filter(Boolean)])] as string[];
    const people = ids.length ? await getDb().select({ id: partnerUsers.id, name: partnerUsers.name, email: partnerUsers.email }).from(partnerUsers).where(inArray(partnerUsers.id, ids)) : [];
    data = { events, all, open: all.filter((c: any) => ["pending", "needs_verification"].includes(c.status)).sort((a: any, b: any) => rank(a) - rank(b) || String(a.proposed?.startDate ?? "9").localeCompare(String(b.proposed?.startDate ?? "9")) || String(a.proposed?.name).localeCompare(String(b.proposed?.name))), reviews, runs, states, names: new Map(people.map((p) => [p.id, p.name || p.email])) };
  } catch (e) { loadError = e instanceof Error ? e.message : String(e); }

  const today = cal.londonToday();
  const months = cal.rollingMonths(today);
  const published = (data?.events ?? []).filter((e: any) => e.status === "published" && e.endDate >= today);
  const lastRun = data?.runs?.[0];
  const candById = new Map((data?.all ?? []).map((c: any) => [c.id, c]));
  const emptyMonths = months.filter((m: any) => !published.some((e: any) => e.startDate.slice(0, 7) === m.key || (e.startDate < months[0].start && m.key === months[0].key)));
  const missingCats = CATEGORIES.filter(([k]: string[]) => !published.some((e: any) => e.category === k));
  const attention = (data?.states ?? []).filter((s: any) => s.kind === "feed" && (s.lastError || !s.lastSuccess));
  const unverifiedLinks = cultureWatchlist.filter((w: any) => !w.sourceUrlVerified).length;

  return <div className="partner-shell"><HubNav role={user.role} /><main className="hub-main">
    <span className="hub-eyebrow">Jettset administration</span>
    <h1 className="hub-title">Culture Calendar Review.</h1>
    <p className="hub-lede">Staff approval for The Global Culture Calendar. Feeds and the weekly sync only raise items here: nothing reaches the public calendar, event pages or sitemap until a staff member approves it.</p>

    {sp.ok && <p className="cul-flash cul-ok" role="status">{sp.ok}</p>}
    {sp.error && <p className="cul-flash cul-err" role="alert">{sp.error}</p>}
    {loadError && <section className="hub-section"><h2>Culture tables unavailable</h2><p className="cul-err">The review data could not be loaded: {loadError}</p><p className="hub-muted">Apply <code>drizzle/0002_culture_calendar.sql</code> to the database (see docs/culture-calendar.md). Until then the public calendar serves its last approved snapshot and the weekly sync cannot record anything.</p></section>}

    {data && <>
      <div className="hub-grid">
        <div className="hub-stat"><span>Awaiting review</span><strong>{data.open.filter((c: any) => c.status === "pending").length}</strong></div>
        <div className="hub-stat"><span>Needs verification</span><strong>{data.open.filter((c: any) => c.status === "needs_verification").length}</strong></div>
        <div className="hub-stat"><span>Approved &amp; upcoming</span><strong>{published.length}</strong></div>
        <div className="hub-stat"><span>Last sync</span><strong className="cul-small">{lastRun ? lastRun.status.replace("_", " ") : "never"}</strong><small className="hub-muted">{lastRun ? fmt(lastRun.startedAt) : "Not run yet"}</small></div>
      </div>

      <section className="hub-section" aria-labelledby="cul-queue"><div className="hub-section-head"><div><span className="hub-eyebrow">Review queue</span><h2 id="cul-queue">Candidates</h2></div></div>
        {data.open.length === 0 ? <div className="hub-empty">Nothing is waiting for review. {lastRun ? "The next weekly sync will add anything new." : "Run the sync to populate the queue."}</div> :
          <div className="cul-list">{data.open.map((c: any) => {
            const p = c.proposed ?? {}; const cur = c.current ?? null;
            const diff = cur ? COMPARE_FIELDS.filter((f: string) => p[f] != null && p[f] !== "" && (cur[f] ?? "") !== p[f]) : [];
            const isNew = !c.eventId;
            return <article className="cul-card" key={c.id} aria-labelledby={`c-${c.id}`}>
              <header className="cul-head"><span className={`cul-badge cul-${c.kind}`}>{KIND[c.kind] ?? c.kind}</span>{c.status === "needs_verification" && <span className="cul-badge cul-nv">Needs verification</span>}
                <h3 id={`c-${c.id}`}>{p.name}</h3></header>
              <dl className="cul-meta">
                <div><dt>Category</dt><dd>{categoryLabel(p.category)}</dd></div>
                <div><dt>Dates</dt><dd>{p.startDate ? `${cal.longRange(p.startDate, p.endDate ?? p.startDate)}` : "Not confirmed"}</dd></div>
                <div><dt>Place</dt><dd>{[p.city, p.country].filter(Boolean).join(", ") || "—"}{p.venue ? ` · ${p.venue}` : ""}</dd></div>
                <div><dt>Source</dt><dd>{c.sourceUrl ? <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer">{c.sourceName ?? c.sourceUrl} ↗</a> : (c.sourceName ?? "—")}</dd></div>
                <div><dt>Source last checked</dt><dd>{c.sourceCheckedAt ? fmt(c.sourceCheckedAt) : "Not machine-checked (no feed)"}</dd></div>
                <div><dt>In the queue since</dt><dd>{fmt(c.firstSeen)}</dd></div>
              </dl>
              {c.uncertainty && <p className="cul-uncertain"><strong>Needs checking:</strong> {c.uncertainty}</p>}
              {c.verificationNotes && <p className="cul-note"><strong>Verification note:</strong> {c.verificationNotes}</p>}
              {diff.length > 0 && <table className="hub-table cul-diff"><caption>Before and after</caption><thead><tr><th>Field</th><th>Published now</th><th>Proposed</th></tr></thead><tbody>{diff.map((f: string) => <tr key={f}><td>{FIELD_LABEL[f]}</td><td>{show(f, cur[f])}</td><td><strong>{show(f, p[f])}</strong></td></tr>)}</tbody></table>}
              <form action={decideCandidate} className="cul-form">
                <input type="hidden" name="candidateId" value={c.id} />
                <fieldset><legend>Verified details {isNew ? "(required to approve)" : "(edit only to correct)"}</legend>
                  <div className="cul-fields">
                    <label>Event name<input name="name" defaultValue={p.name ?? ""} /></label>
                    <label>Category<select name="category" defaultValue={p.category ?? ""}><option value="">Choose…</option>{CATEGORIES.map(([k, l]: string[]) => <option key={k} value={k}>{l}</option>)}</select></label>
                    <label>City<input name="city" defaultValue={p.city ?? ""} /></label>
                    <label>Country<input name="country" defaultValue={p.country ?? ""} /></label>
                    <label>Venue<input name="venue" defaultValue={p.venue ?? ""} /></label>
                    <label>Start date<input type="date" name="startDate" defaultValue={p.startDate ?? ""} /></label>
                    <label>End date<input type="date" name="endDate" defaultValue={p.endDate ?? ""} /></label>
                    <label>Timezone<input name="timezone" defaultValue={p.timezone ?? ""} placeholder="e.g. Europe/Paris" /></label>
                    {isNew && <label>Country code (2 letters)<input name="countryCode" maxLength={2} /></label>}
                  </div>
                </fieldset>
                {isNew && <fieldset><legend>Jettset editorial (public page copy, original wording only)</legend>
                  <label>One-sentence lede<input name="lede" placeholder="A Jettset guide to planning your journey to…" /></label>
                  <label>Context (separate paragraphs with a blank line)<textarea name="context" rows={5} /></label>
                </fieldset>}
                <label>Reviewer notes{" "}<span className="hub-muted">(required for “Needs verification”: say what must be checked)</span><textarea name="notes" rows={2} defaultValue="" /></label>
                <div className="cul-actions">
                  <button type="submit" name="decision" value="approve" className="cul-approve">Approve</button>
                  <button type="submit" name="decision" value="needs_verification">Needs verification</button>
                  <button type="submit" name="decision" value="reject" className="cul-reject">Reject</button>
                </div>
              </form>
            </article>;
          })}</div>}
      </section>

      <section className="hub-section" aria-labelledby="cul-pub"><h2 id="cul-pub">Published events</h2>
        {published.length === 0 ? <div className="hub-empty">No approved upcoming events.</div> : <table className="hub-table"><thead><tr><th>Event</th><th>Dates</th><th>Place</th><th>Page</th><th>Last verified</th></tr></thead><tbody>{published.map((e: any) => <tr key={e.id}>
          <td>{e.name}<br /><small className="hub-muted">{categoryLabel(e.category)}</small></td><td>{cal.longRange(e.startDate, e.endDate)}</td><td>{e.city}, {e.country}</td>
          <td>{e.editorialReviewedBy ? <>Indexable<br /><small className="hub-muted">signed off by {data!.names.get(e.editorialReviewedBy) ?? "staff"}</small></> :
            <form action={signOffEditorial}><input type="hidden" name="eventId" value={e.id} /><span className="hub-muted">noindex until signed off</span><br /><button type="submit">Sign off editorial</button></form>}</td>
          <td>{e.lastVerifiedOn ? cal.longDate(e.lastVerifiedOn) : "—"}</td></tr>)}</tbody></table>}
      </section>

      <section className="hub-section" aria-labelledby="cul-health"><div className="hub-section-head"><div><span className="hub-eyebrow">Weekly sync</span><h2 id="cul-health">Sync history &amp; source health</h2></div>
        <form action={runSyncNow}><button type="submit">Run sync now</button></form></div>
        <p className="hub-muted">Scheduled: Mondays 05:17 UTC (05:17 in winter, 06:17 UK summer time). A manual run uses the same code and database and also publishes nothing.</p>
        {lastRun && <p className={`cul-flash ${["failed", "partial"].includes(lastRun.status) ? "cul-err" : "cul-ok"}`}><strong>Last run {fmt(lastRun.startedAt)} ({lastRun.trigger}): {lastRun.status.replace("_", " ")}.</strong> {lastRun.headline}</p>}
        {!lastRun && <p className="cul-flash cul-err">The weekly sync has not recorded a run yet.</p>}
        <h3>Sources needing attention</h3>
        {attention.length === 0 && cultureSources.filter((s: any) => s.enabled).length > 0 ? <div className="hub-empty">All configured feeds are healthy.</div> :
          cultureSources.filter((s: any) => s.enabled).length === 0 ? <p className="cul-uncertain">No machine-readable feed is enabled: none could be verified as an official source. Coverage comes from the curated watchlist of {cultureWatchlist.length} recurring events (manual verification){unverifiedLinks ? `; ${unverifiedLinks} watchlist reference links could not be machine-checked (sites block automated requests), so open them manually` : ""}.</p> :
          <table className="hub-table"><thead><tr><th>Feed</th><th>Last success</th><th>Problem</th></tr></thead><tbody>{attention.map((s: any) => <tr key={s.id}><td>{s.name}</td><td>{fmt(s.lastSuccess)}</td><td className="cul-err">{s.lastError ?? "Never succeeded"}</td></tr>)}</tbody></table>}
        <h3>Coverage gaps (approved events only)</h3>
        <p className="hub-muted">Months with no approved event: {emptyMonths.length ? emptyMonths.map((m: any) => m.label).join(", ") : "none"}. Categories with none: {missingCats.length ? missingCats.map(([, l]: string[]) => l).join(", ") : "none"}. This is a to-do list for staff, not a quota; leave a month empty if nothing meets the curation test.</p>
        <h3>Recent runs</h3>
        {data.runs.length === 0 ? <div className="hub-empty">No runs recorded.</div> : <table className="hub-table"><thead><tr><th>Started (London)</th><th>Trigger</th><th>Result</th><th>New items</th><th>Detail</th></tr></thead><tbody>{data.runs.map((r: any, i: number) => <tr key={i}><td>{fmt(r.startedAt)}</td><td>{r.trigger}</td><td className="hub-status">{String(r.status).replace("_", " ")}</td><td>{r.created ?? "—"}</td><td>{r.headline}</td></tr>)}</tbody></table>}
        <h3>Sources</h3>
        <table className="hub-table"><thead><tr><th>Source</th><th>Kind</th><th>Last attempt</th><th>Last success</th><th>Last error</th></tr></thead><tbody>{data.states.length === 0 ? <tr><td colSpan={5}>No source has reported yet.</td></tr> : data.states.map((s: any) => <tr key={s.id}><td>{s.name}</td><td>{s.kind}</td><td>{fmt(s.lastAttempt)}</td><td>{fmt(s.lastSuccess)}</td><td>{s.lastError ?? "—"}</td></tr>)}</tbody></table>
      </section>

      <section className="hub-section" aria-labelledby="cul-hist"><h2 id="cul-hist">Decision history</h2>
        {data.reviews.length === 0 ? <div className="hub-empty">No decisions recorded yet.</div> : <table className="hub-table"><thead><tr><th>When (London)</th><th>Reviewer</th><th>Decision</th><th>Item</th><th>Notes</th></tr></thead><tbody>{data.reviews.map((r: any) => <tr key={r.id}><td>{fmt(r.decidedAt)}</td><td>{data!.names.get(r.reviewerId) ?? "Staff"}</td><td className="hub-status">{String(r.decision).replace("_", " ")}</td><td>{(candById.get(r.candidateId) as any)?.proposed?.name ?? "—"}</td><td>{r.notes ?? "—"}</td></tr>)}</tbody></table>}
      </section>
    </>}
  </main></div>;
}
