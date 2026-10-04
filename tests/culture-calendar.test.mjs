import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { cal, buildCandidates, applyDecision, ReviewError, toPublic, publicEvents, sitemapEvents, isIndexable, validateEventFields, slugFor } from "../lib/culture/domain.mjs";
import { runCultureSync, validateSource } from "../lib/culture/sync.mjs";
import { memoryRepo } from "../lib/culture/repo-memory.mjs";
import { assertStaff } from "../lib/culture/access.mjs";
import { parseIcs } from "../lib/culture/feeds.mjs";

const watchlist = JSON.parse(readFileSync(new URL("../netlify/config/culture-watchlist.json", import.meta.url), "utf8")).watchlist;
const sources = JSON.parse(readFileSync(new URL("../netlify/config/culture-sources.json", import.meta.url), "utf8")).sources;
const NOW = new Date("2026-10-05T05:17:00Z");              // a Monday, 06:17 in London (BST)
const TODAY = "2026-10-05";

const frieze = () => ({
  id: "e-frieze", slug: "frieze-london-2026", name: "Frieze London", category: "art-design-architecture", city: "London", country: "United Kingdom", countryCode: "GB",
  venue: "The Regent's Park", startDate: "2026-10-14", endDate: "2026-10-18", timezone: "Europe/London", status: "published", sourceRef: "ics-a:u1", watchKey: "frieze-london",
  lastVerifiedOn: "2026-10-03", editorial: { lede: "A Jettset guide.", context: ["x".repeat(130)], guidance: [], airports: [] }, editorialReviewedBy: "u-staff",
});
const ics = (...ev) => ["BEGIN:VCALENDAR", ...ev.flatMap((v) => ["BEGIN:VEVENT", ...v, "END:VEVENT"]), "END:VCALENDAR"].join("\r\n");
const ok = (body) => async () => ({ ok: true, status: 200, text: async () => body });
const feed = { id: "ics-a", name: "Official A", enabled: true, type: "ics", url: "https://events.example.org/a.ics", allowedHosts: ["events.example.org"], timezone: "Europe/London", verifiedOn: "2026-10-04" };

// ---------------- rolling window ----------------
test("window: current month + 11, from the Europe/London date", () => {
  const m = cal.rollingMonths("2026-10-05");
  assert.equal(m.length, 12);
  assert.equal(cal.rangeLabel(m), "October 2026 – September 2027");
  assert.equal(m[0].start, "2026-10-01"); assert.equal(m[11].end, "2027-09-30");
});
test("window: London date is used across the daylight-saving changes", () => {
  assert.equal(cal.londonToday(new Date("2026-10-24T23:30:00Z")), "2026-10-25");   // BST still: 00:30 on the 25th
  assert.equal(cal.londonToday(new Date("2026-10-25T23:30:00Z")), "2026-10-25");   // GMT: 23:30 on the 25th
  assert.equal(cal.londonToday(new Date("2027-03-27T23:30:00Z")), "2027-03-27");   // GMT before spring-forward
  assert.equal(cal.londonToday(new Date("2027-03-28T23:30:00Z")), "2027-03-29");   // BST: already the 29th
  assert.equal(cal.rollingMonths("2026-12-31")[1].label, "January 2027");
});
test("scheduled run time: 05:17 UTC is 05:17 in winter and 06:17 in summer (UK)", () => {
  const hhmm = (d) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" }).format(d);
  assert.equal(hhmm(new Date("2027-01-04T05:17:00Z")), "05:17");
  assert.equal(hhmm(new Date("2026-10-05T05:17:00Z")), "06:17");
});
test("events are grouped once by start month; ended, cancelled and unapproved events are excluded", () => {
  const evs = [toPublic(frieze()), toPublic({ ...frieze(), id: "x", slug: "past", startDate: "2026-09-01", endDate: "2026-09-04" }),
    toPublic({ ...frieze(), id: "y", slug: "cancelled", status: "cancelled" }), toPublic({ ...frieze(), id: "z", slug: "later", startDate: "2027-02-10", endDate: "2027-02-12" })];
  const g = cal.eventsByMonth(evs.filter(cal.isPublic), "2026-10-05");
  assert.equal(g.reduce((n, x) => n + x.events.length, 0), 2);
  assert.deepEqual(g[0].events.map((e) => e.slug), ["frieze-london-2026"]);
  assert.equal(g[4].events[0].slug, "later");
  assert.equal(g[1].events.length, 0);
});
test("carousel position: events in order, then months with events, skipping empty months, wrapping", () => {
  const mk = (slug, s) => ({ slug, name: slug, city: "X", startDate: s, endDate: s, publication: "published", status: "confirmed" });
  const g = cal.eventsByMonth([mk("a", "2026-10-14"), mk("b", "2026-10-20"), mk("c", "2027-02-10")], "2026-10-05");
  let p = cal.firstPosition(g);
  const seq = [];
  for (let i = 0; i < 4; i++) { seq.push(g[p.mi].events[p.ei].slug); p = cal.nextPosition(g, p); }
  assert.deepEqual(seq, ["a", "b", "c", "a"]);
  assert.deepEqual(cal.prevPosition(g, { mi: 0, ei: 0 }), { mi: 4, ei: 0 });
  const one = cal.eventsByMonth([mk("only", "2026-10-14")], "2026-10-05");
  assert.deepEqual(cal.nextPosition(one, { mi: 0, ei: 0 }), { mi: 0, ei: 0 });
});

// ---------------- watchlist / candidates ----------------
test("watchlist: manual-verification items only for editions inside the window; none invent dates", () => {
  const out = buildCandidates({ today: TODAY, now: NOW, watchlist });
  assert.ok(out.create.length > 10);
  for (const c of out.create) {
    assert.equal(c.kind, "manual_verification"); assert.equal(c.proposed.startDate, null); assert.equal(c.proposed.endDate, null);
    assert.match(c.uncertainty, /NOT confirmed/);
  }
  const names = out.create.map((c) => c.proposed.name);
  assert.ok(names.includes("Cannes Film Festival 2027"));
  assert.ok(names.includes("Art Basel Miami Beach 2026"));
  assert.ok(!names.includes("Art Basel Miami Beach 2027"), "Dec 2027 is outside the window");
  assert.ok(names.includes("Venice Art Biennale 2026") || names.includes("Venice Architecture Biennale 2027"));
  assert.ok(!names.some((n) => /Venice Architecture Biennale 2026/.test(n)), "biennale cadence respected");
});
test("watchlist: an already-published edition is not raised again, and a rejected one stays rejected", () => {
  const events = [frieze()];
  const first = buildCandidates({ today: TODAY, now: NOW, watchlist, events });
  assert.ok(!first.create.some((c) => c.watchKey === "frieze-london" && c.fingerprint.endsWith(":2026")));
  const rejected = first.create.slice(0, 3).map((c, i) => ({ ...c, id: "r" + i, status: "rejected" }));
  const again = buildCandidates({ today: TODAY, now: NOW, watchlist, events, candidates: rejected });
  for (const r of rejected) assert.ok(!again.create.some((c) => c.fingerprint === r.fingerprint));
  assert.ok(again.stats.suppressed >= 3);
});
test("feed: a new official event becomes a pending candidate, a changed date becomes a proposed change", () => {
  const items = [
    { sourceId: "ics-a", sourceName: "Official A", sourceUrl: "https://a.example/", uid: "u1", name: "Frieze London", startDate: "2026-10-15", endDate: "2026-10-19", status: "confirmed" },
    { sourceId: "ics-a", sourceName: "Official A", sourceUrl: "https://a.example/", uid: "u9", name: "New Fair", startDate: "2027-01-20", endDate: "2027-01-22", city: "Paris", status: "confirmed" },
  ];
  const out = buildCandidates({ today: TODAY, now: NOW, feedItems: items, feedSourceIds: new Set(["ics-a"]), events: [frieze()] });
  const change = out.create.find((c) => c.kind === "change");
  assert.deepEqual(change.proposed.startDate, "2026-10-15");
  assert.equal(change.current.startDate, "2026-10-14");
  assert.ok(out.create.some((c) => c.kind === "new" && c.proposed.name === "New Fair"));
});
test("feed: cancellation and venue changes to a published event are proposals, never edits", () => {
  const cancelled = [{ sourceId: "ics-a", sourceName: "A", sourceUrl: "x", uid: "u1", name: "Frieze London", startDate: "2026-10-14", endDate: "2026-10-18", status: "cancelled" }];
  const c1 = buildCandidates({ today: TODAY, now: NOW, feedItems: cancelled, events: [frieze()] });
  assert.equal(c1.create[0].kind, "cancellation");
  const moved = [{ sourceId: "ics-a", sourceName: "A", sourceUrl: "x", uid: "u1", name: "Frieze London", startDate: "2026-10-14", endDate: "2026-10-18", venue: "Somewhere Else", status: "confirmed" }];
  const c2 = buildCandidates({ today: TODAY, now: NOW, feedItems: moved, events: [frieze()] });
  assert.equal(c2.create[0].proposed.venue, "Somewhere Else"); assert.equal(c2.create[0].current.venue, "The Regent's Park");
});
test("recheck: published events without a feed are re-raised for staff when verification is stale", () => {
  const stale = { ...frieze(), sourceRef: null, lastVerifiedOn: "2026-08-01" };
  const out = buildCandidates({ today: TODAY, now: NOW, events: [stale] });
  assert.equal(out.create.filter((c) => c.kind === "recheck").length, 1);
  const fresh = buildCandidates({ today: TODAY, now: NOW, events: [{ ...stale, lastVerifiedOn: "2026-10-01" }] });
  assert.equal(fresh.create.filter((c) => c.kind === "recheck").length, 0);
});

// ---------------- staff decisions ----------------
const newCandidate = () => ({ id: "c1", kind: "manual_verification", status: "pending", eventId: null, watchKey: "wimbledon", fingerprint: "watch:wimbledon:2027", proposed: { name: "The Championships, Wimbledon 2027", category: "sport", city: "London", country: "United Kingdom", venue: null, startDate: null, endDate: null, timezone: "Europe/London", status: "published" }, current: null, sourceName: "Wimbledon", sourceUrl: "https://www.wimbledon.com", sourceRef: null });
const editorial = { lede: "A Jettset guide to the Championships.", context: ["Wimbledon fortnight reshapes London in early summer, and the travel around it rewards early planning of dates, arrival airport and ground transport. ".repeat(2)] };
const good = { venue: "All England Club", startDate: "2027-06-28", endDate: "2027-07-11" };

test("approve: new event needs verified details and Jettset editorial; staff identity and time are recorded", () => {
  assert.throws(() => applyDecision({ candidate: newCandidate(), decision: "approve", reviewer: "u1", today: TODAY, edits: {}, editorial }), (e) => e instanceof ReviewError && /start date/.test(e.message));
  assert.throws(() => applyDecision({ candidate: newCandidate(), decision: "approve", reviewer: "u1", today: TODAY, edits: good, editorial: { lede: "short", context: ["x"] } }), /editorial/);
  const r = applyDecision({ candidate: newCandidate(), decision: "approve", reviewer: "u-staff", notes: "Checked on wimbledon.com", edits: good, editorial, today: TODAY, now: NOW });
  assert.equal(r.event.type, "insert"); assert.equal(r.event.record.status, "published");
  assert.equal(r.event.record.slug, "the-championships-wimbledon-2027");   // slug derived from the name; the year is not repeated
  assert.equal(r.review.reviewerId, "u-staff"); assert.equal(r.review.decidedAt, NOW.toISOString()); assert.equal(r.review.notes, "Checked on wimbledon.com");
  assert.equal(r.event.record.editorialReviewedBy, "u-staff");
});
test("approve: dates outside the window or already ended are refused", () => {
  assert.throws(() => applyDecision({ candidate: newCandidate(), decision: "approve", reviewer: "u", today: TODAY, edits: { ...good, startDate: "2028-06-28", endDate: "2028-07-11" }, editorial }), /calendar window/);
  assert.throws(() => applyDecision({ candidate: newCandidate(), decision: "approve", reviewer: "u", today: TODAY, edits: { ...good, startDate: "2026-09-01", endDate: "2026-09-03" }, editorial }), /already ended/);
  assert.deepEqual(validateEventFields({ name: "n", category: "sport", city: "c", country: "x", venue: "v", startDate: "2026-10-06", endDate: "2026-10-05", timezone: "Europe/London" }, TODAY).length, 1);
});
test("reject records the decision and creates no event; needs-verification keeps it pending with the note", () => {
  const rej = applyDecision({ candidate: newCandidate(), decision: "reject", reviewer: "u", notes: "Not significant", today: TODAY, now: NOW });
  assert.equal(rej.candidatePatch.status, "rejected"); assert.equal(rej.event, null); assert.equal(rej.review.decision, "reject");
  assert.throws(() => applyDecision({ candidate: newCandidate(), decision: "needs_verification", reviewer: "u", notes: "", today: TODAY }), /what needs to be checked/);
  const nv = applyDecision({ candidate: newCandidate(), decision: "needs_verification", reviewer: "u", notes: "Waiting for the 2027 dates", today: TODAY });
  assert.equal(nv.candidatePatch.status, "needs_verification"); assert.equal(nv.candidatePatch.verificationNotes, "Waiting for the 2027 dates"); assert.equal(nv.event, null);
  assert.throws(() => applyDecision({ candidate: { ...newCandidate(), status: "approved" }, decision: "reject", reviewer: "u", today: TODAY }), /already been decided/);
});
test("approving a proposed change updates the published event; a cancellation withdraws it", () => {
  const ev = frieze();
  const change = { id: "c2", kind: "change", status: "pending", eventId: ev.id, proposed: { ...ev, startDate: "2026-10-15", endDate: "2026-10-19" }, current: ev };
  const r = applyDecision({ candidate: change, decision: "approve", reviewer: "u", today: TODAY, events: [ev], now: NOW });
  assert.deepEqual([r.event.patch.startDate, r.event.patch.endDate], ["2026-10-15", "2026-10-19"]); assert.equal(r.event.patch.lastVerifiedOn, TODAY);
  const cancel = { id: "c3", kind: "cancellation", status: "pending", eventId: ev.id, proposed: { ...ev, status: "cancelled" }, current: ev };
  const c = applyDecision({ candidate: cancel, decision: "approve", reviewer: "u", today: TODAY, events: [ev] });
  assert.equal(c.event.patch.status, "cancelled");
});
test("staff-only: partners, inactive users and anonymous callers are refused", () => {
  assert.doesNotThrow(() => assertStaff({ role: "admin", status: "active" }));
  assert.doesNotThrow(() => assertStaff({ role: "executive", status: "active" }));
  for (const u of [null, { role: "partner", status: "active" }, { role: "admin", status: "inactive" }, { role: "admin", status: "pending" }]) assert.throws(() => assertStaff(u), /Staff access/);
});

// ---------------- public output ----------------
test("public: only published events appear; no source links or private fields leak; sitemap only indexable", () => {
  const pub = frieze();
  const evs = [pub, { ...pub, id: "w", slug: "withdrawn", status: "cancelled" }, { ...pub, id: "n", slug: "unreviewed", editorialReviewedBy: null }];
  const out = publicEvents(evs, TODAY);
  assert.deepEqual(out.map((e) => e.slug).sort(), ["frieze-london-2026", "unreviewed"]);
  assert.ok(!JSON.stringify(out).match(/sourceUrl|sourceRef|editorial|lastVerified|https?:/i));
  assert.deepEqual(sitemapEvents(evs, TODAY).map((e) => e.slug), ["frieze-london-2026"]);
  assert.equal(isIndexable({ ...pub, status: "cancelled" }), false);
});

// ---------------- weekly sync ----------------
test("sync: with no verified feeds it says so, raises watchlist items, and never touches published events", async () => {
  assert.equal(sources.filter((s) => s.enabled).length, 0, "no unverified feed may be enabled");
  const repo = memoryRepo({ events: [frieze()] });
  const before = JSON.stringify(await repo.listEvents());
  const run = await runCultureSync({ repo, sources, watchlist, now: NOW });
  assert.equal(run.status, "no_feeds"); assert.match(run.headline, /No verified machine-readable feeds/);
  assert.ok(run.created > 10); assert.equal(JSON.stringify(await repo.listEvents()), before);
  assert.equal(run.window.start, "2026-10-01"); assert.equal(run.window.end, "2027-09-30");
  const again = await runCultureSync({ repo, sources, watchlist, now: NOW });
  assert.equal(again.created, 0, "a second run does not duplicate the queue");
  assert.equal((await repo.listRuns()).length, 2);
});
test("sync: feed changes create proposals, the public event is untouched until staff decide", async () => {
  const repo = memoryRepo({ events: [frieze()] });
  const f = ics(["UID:u1", "SUMMARY:Frieze London", "DTSTART;VALUE=DATE:20261015", "DTEND;VALUE=DATE:20261020"], ["UID:u2", "SUMMARY:Brand New Fair", "DTSTART;VALUE=DATE:20270120", "DTEND;VALUE=DATE:20270123"]);
  const run = await runCultureSync({ repo, sources: [feed], watchlist: [], now: NOW, fetchImpl: ok(f) });
  assert.equal(run.status, "ok");
  const cands = await repo.listCandidates();
  assert.deepEqual(cands.map((c) => c.kind).sort(), ["change", "new"]);
  assert.equal((await repo.listEvents())[0].startDate, "2026-10-14", "published date unchanged");
  const chg = cands.find((c) => c.kind === "change");
  const ev = (await repo.listEvents())[0];
  const decision = applyDecision({ candidate: chg, decision: "approve", reviewer: "u", today: TODAY, events: [ev] });
  await repo.updateEvent(ev.id, decision.event.patch);
  assert.equal((await repo.listEvents())[0].startDate, "2026-10-15");
});
test("sync: failed, partial and empty feeds are reported honestly and keep existing data", async () => {
  const repo = memoryRepo({ events: [frieze()] });
  const bad = await runCultureSync({ repo, sources: [feed], watchlist: [], now: NOW, fetchImpl: async () => ({ ok: false, status: 503, text: async () => "" }) });
  assert.equal(bad.status, "failed"); assert.deepEqual(bad.failedFeeds, ["ics-a"]);
  assert.match((await repo.getSourceState("ics-a")).lastError, /503/);
  const empty = await runCultureSync({ repo, sources: [feed], watchlist: [], now: NOW, fetchImpl: ok(ics()) });
  assert.equal(empty.status, "empty");
  assert.equal((await repo.getSourceState("ics-a")).lastError, null);
  const partial = await runCultureSync({ repo, sources: [feed, { ...feed, id: "ics-b", url: "https://events.example.org/b.ics" }], watchlist: [], now: NOW, fetchImpl: async (u) => (u.endsWith("b.ics") ? { ok: false, status: 500, text: async () => "" } : { ok: true, status: 200, text: async () => ics(["UID:q", "SUMMARY:Q", "DTSTART;VALUE=DATE:20270201", "DTEND;VALUE=DATE:20270202"]) }) });
  assert.equal(partial.status, "partial");
  assert.equal((await repo.listEvents()).length, 1);
});
test("sync: storage failure is reported as a failed run, not a silent success", async () => {
  const repo = memoryRepo(); repo.listEvents = async () => { throw new Error("database unreachable"); };
  const run = await runCultureSync({ repo, sources: [], watchlist, now: NOW });
  assert.equal(run.status, "failed"); assert.match(run.headline, /database unreachable/);
});
test("sources: a feed can only be enabled with a verified, allowlisted https URL", () => {
  assert.deepEqual(validateSource(feed), []);
  assert.ok(validateSource({ ...feed, verifiedOn: undefined }).some((m) => /verifiedOn/.test(m)));
  assert.ok(validateSource({ ...feed, url: "http://events.example.org/a.ics" }).length);
  assert.ok(validateSource({ ...feed, url: "https://evil.example.net/a.ics" }).some((m) => /allowedHosts/.test(m)));
});
test("ICS parsing keeps exclusive all-day end dates correct", () => {
  const [e] = parseIcs(ics(["UID:a", "SUMMARY:T", "DTSTART;VALUE=DATE:20261014", "DTEND;VALUE=DATE:20261019"]));
  assert.deepEqual([e.startDate, e.endDate], ["2026-10-14", "2026-10-18"]);
});
test("browser copy of the calendar helpers is in sync with the canonical module", () => {
  const canon = readFileSync(new URL("../lib/culture/calendar.cjs", import.meta.url), "utf8");
  const copy = readFileSync(new URL("../public/culture/culture-lib.js", import.meta.url), "utf8");
  assert.ok(copy.endsWith(canon), "run: npm run culture:lib");
});
test("watchlist is well-formed and never carries dates", () => {
  const keys = new Set();
  for (const w of watchlist) {
    assert.ok(!keys.has(w.key), "duplicate key " + w.key); keys.add(w.key);
    assert.ok(w.name && w.city && w.country && w.sourceName && /^https:\/\//.test(w.sourceUrl) && w.typicalMonths.length);
    assert.ok(!("startDate" in w) && !("endDate" in w));
    assert.ok(["art-design-architecture", "fashion", "film", "music-performing-arts", "food-hospitality", "festivals", "sport"].includes(w.category), w.key);
  }
  assert.ok(watchlist.length >= 30);
});
