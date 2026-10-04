// Runs the REAL repository code (lib/culture/repo-db.ts) and the REAL migrations against an actual
// PostgreSQL engine (PGlite = Postgres compiled to WASM, in-process). This is NOT Neon: the Neon HTTP
// driver and its db.batch() are the only parts it cannot exercise (see docs/culture-calendar.md).
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test, { before, after } from "node:test";
import { build } from "esbuild";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { runCultureSync } from "../lib/culture/sync.mjs";
import { applyDecision, ReviewError, cal, publicEvents, sitemapEvents } from "../lib/culture/domain.mjs";
import { assertStaff } from "../lib/culture/access.mjs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const watchlist = JSON.parse(read("../netlify/config/culture-watchlist.json")).watchlist;
const sources = JSON.parse(read("../netlify/config/culture-sources.json")).sources;
const NOW = new Date("2026-10-05T05:17:00Z"), TODAY = "2026-10-05";
const MIGRATIONS = ["0000_partner_hub", "0001_guest_relationship_tools", "0002_culture_calendar"];

let tmpDir, pg, db, makeRepo, repo, staff, partner;
const atomic = (d) => (stmts) => d.transaction(async (tx) => { for (const s of stmts) await s(tx); });

before(async () => {
  const dir = tmpDir = mkdtempSync(join(process.cwd(), "node_modules", ".culture-repo-"));
  await build({ entryPoints: [new URL("../lib/culture/repo-db.ts", import.meta.url).pathname], bundle: true, platform: "node", format: "esm", outfile: join(dir, "repo.mjs"), packages: "external", logLevel: "silent" });
  ({ makeRepo } = await import(pathToFileURL(join(dir, "repo.mjs")).href));
  pg = new PGlite();
  for (const m of MIGRATIONS) await pg.exec(read(`../drizzle/${m}.sql`).replaceAll("--> statement-breakpoint", ""));
  db = drizzle(pg);
  repo = makeRepo(db, atomic(db));
  const ins = async (email, role) => (await pg.query(`insert into partner_users(email, role, status) values ($1, $2, 'active') returning id`, [email, role])).rows[0].id;
  staff = await ins("staff@example.test", "admin");
  partner = await ins("partner@example.test", "partner");
});

after(() => rmSync(tmpDir, { recursive: true, force: true }));
const count = async (t) => Number((await pg.query(`select count(*)::int n from ${t}`)).rows[0].n);

test("migration 0002: seeds 3 events, is safe to re-run, and leaves them unsigned", async () => {
  assert.equal(await count("culture_events"), 3);
  const sqlText = read("../drizzle/0002_culture_calendar.sql").replaceAll("--> statement-breakpoint", "");
  await pg.exec(sqlText); await pg.exec(sqlText);                                   // re-run twice: no error, no duplicates
  assert.equal(await count("culture_events"), 3);
  assert.equal((await pg.query(`select count(*)::int n from pg_constraint where conname like 'culture_%_fk'`)).rows[0].n, 5);
  assert.equal((await pg.query(`select count(*)::int n from culture_events where editorial_reviewed_by is not null`)).rows[0].n, 0);
});

test("migration 0002: a failure part-way leaves nothing behind (single transaction)", async () => {
  const p = new PGlite();
  await p.exec("create table partner_users(id uuid primary key)");                  // deliberately incomplete baseline
  const broken = read("../drizzle/0002_culture_calendar.sql").replaceAll("--> statement-breakpoint", "").replace('ON CONFLICT ("slug") DO NOTHING;', 'INSERT INTO nonexistent VALUES (1);');
  await assert.rejects(p.exec(broken));
  assert.equal((await p.query(`select count(*)::int n from information_schema.tables where table_name like 'culture_%'`)).rows[0].n, 0);
});

test("sync with the current config: no feeds enabled -> status no_feeds, manual-verification candidates only", async () => {
  assert.equal(sources.filter((s) => s.enabled).length, 0);
  const run = await runCultureSync({ repo, sources, watchlist, now: NOW, trigger: "schedule" });
  assert.equal(run.status, "no_feeds");
  assert.match(run.headline, /no .*feed/i);
  const cands = await repo.listCandidates();
  assert.ok(cands.length > 0, "watchlist should raise manual verification items");
  assert.ok(cands.every((c) => c.kind === "manual_verification" || c.kind === "recheck"), "only manual/recheck kinds: " + [...new Set(cands.map((c) => c.kind))]);
  assert.ok(cands.every((c) => ["watchlist", "recheck"].includes(c.sourceId)), "nothing was retrieved from a feed");
  assert.equal(await count("culture_events"), 3, "sync never adds events");
  const before = (await repo.listEvents()).map((e) => [e.slug, e.startDate, e.venue, e.status].join("|")).sort();
  const run2 = await runCultureSync({ repo, sources, watchlist, now: NOW });        // idempotent
  assert.equal(run2.created, 0);
  assert.equal(await count("culture_candidates"), cands.length);
  assert.deepEqual((await repo.listEvents()).map((e) => [e.slug, e.startDate, e.venue, e.status].join("|")).sort(), before, "public fields untouched");
  assert.equal((await repo.listRuns(5)).length, 2);
});

test("approve a new event (atomic): event + candidate + review + audit all written; becomes public after sign-off", async () => {
  const cand = (await repo.listCandidates({ status: ["pending"] })).find((c) => c.kind === "manual_verification");
  const events = await repo.listEvents();
  const result = applyDecision({ candidate: cand, decision: "approve", notes: "Checked organiser page", reviewer: staff, today: TODAY, events, now: NOW,
    edits: { name: cand.proposed.name, startDate: "2027-03-10", endDate: "2027-03-14", venue: "Official Venue", city: cand.proposed.city, country: cand.proposed.country, category: cand.proposed.category, timezone: cand.proposed.timezone || "Europe/London" },
    editorial: { lede: "A Jettset guide to planning your journey.", context: "x".repeat(140) } });
  await repo.commitDecision({ candidate: cand, result, audit: { actorId: staff, action: "culture.approve", entityType: "culture_candidate", entityId: cand.id } });
  assert.equal(await count("culture_events"), 4);
  const after = await repo.getCandidate(cand.id);
  assert.equal(after.status, "approved"); assert.equal(after.decidedBy, staff); assert.ok(after.eventId);
  assert.equal(await count("culture_reviews"), 1);
  assert.equal((await pg.query(`select count(*)::int n from audit_log where action='culture.approve'`)).rows[0].n, 1);
  const evs = await repo.listEvents();
  assert.ok(publicEvents(evs, TODAY).some((e) => e.id === after.eventId));
  assert.ok(sitemapEvents(evs, TODAY).some((e) => e.id === after.eventId), "signed off at approval -> indexable");
});

test("atomicity: if the review write fails, the event, candidate and audit are all rolled back", async () => {
  const cand = (await repo.listCandidates({ status: ["pending"] })).find((c) => c.kind === "manual_verification");
  const events = await repo.listEvents();
  const good = applyDecision({ candidate: cand, decision: "approve", reviewer: staff, today: TODAY, events, now: NOW,
    edits: { name: cand.proposed.name, startDate: "2027-05-10", endDate: "2027-05-12", venue: "V", city: cand.proposed.city, country: cand.proposed.country, category: cand.proposed.category, timezone: "Europe/London" },
    editorial: { lede: "A Jettset guide to planning your journey.", context: "y".repeat(140) } });
  const bad = { ...good, review: { ...good.review, reviewerId: "00000000-0000-0000-0000-000000000000" } };   // violates the reviewer FK
  const e0 = await count("culture_events"), r0 = await count("culture_reviews"), a0 = await count("audit_log");
  await assert.rejects(repo.commitDecision({ candidate: cand, result: bad, audit: { actorId: staff, action: "culture.approve", entityType: "culture_candidate", entityId: cand.id } }));
  assert.equal(await count("culture_events"), e0); assert.equal(await count("culture_reviews"), r0); assert.equal(await count("audit_log"), a0);
  assert.equal((await repo.getCandidate(cand.id)).status, "pending", "candidate still pending, nothing published");
});

test("reject: recorded, not public, and the same watchlist item is not re-raised", async () => {
  const cand = (await repo.listCandidates({ status: ["pending"] })).find((c) => c.kind === "manual_verification");
  const result = applyDecision({ candidate: cand, decision: "reject", notes: "Not worth travelling for", reviewer: staff, today: TODAY, events: await repo.listEvents(), now: NOW });
  await repo.commitDecision({ candidate: cand, result, audit: { actorId: staff, action: "culture.reject", entityType: "culture_candidate", entityId: cand.id } });
  assert.equal((await repo.getCandidate(cand.id)).status, "rejected");
  const events = await repo.listEvents();
  assert.ok(!publicEvents(events, TODAY).some((e) => e.name === cand.proposed.name && e.id !== undefined && e.startDate === cand.proposed.startDate));
  const n = await count("culture_candidates");
  await runCultureSync({ repo, sources, watchlist, now: new Date("2026-10-12T05:17:00Z") });
  assert.equal((await repo.listCandidates()).filter((c) => c.fingerprint === cand.fingerprint).length, 1, "no duplicate of the rejected item");
  assert.ok(await count("culture_candidates") >= n);
});

test("needs verification: stays in the queue with the note; nothing published", async () => {
  const cand = (await repo.listCandidates({ status: ["pending"] }))[0];
  const e0 = await count("culture_events");
  assert.throws(() => applyDecision({ candidate: cand, decision: "needs_verification", notes: "", reviewer: staff, today: TODAY, events: [], now: NOW }), ReviewError);
  const result = applyDecision({ candidate: cand, decision: "needs_verification", notes: "Confirm 2027 dates with organiser", reviewer: staff, today: TODAY, events: await repo.listEvents(), now: NOW });
  await repo.commitDecision({ candidate: cand, result, audit: { actorId: staff, action: "culture.needs_verification", entityType: "culture_candidate", entityId: cand.id } });
  const c = await repo.getCandidate(cand.id);
  assert.equal(c.status, "needs_verification"); assert.equal(c.verificationNotes, "Confirm 2027 dates with organiser");
  assert.equal(await count("culture_events"), e0);
  assert.throws(() => applyDecision({ candidate: { ...c, status: "approved" }, decision: "reject", reviewer: staff, today: TODAY, events: [], now: NOW }), /already been decided/);
});

test("changed date/venue/cancellation on a published event arrives as a proposed change; public data changes only on approval", async () => {
  const frieze = (await repo.listEvents()).find((e) => e.slug === "frieze-london-2026");
  const feed = { id: "t-feed", name: "Official test feed", enabled: true, type: "ics", url: "https://events.example.org/a.ics", allowedHosts: ["events.example.org"], timezone: "Europe/London", verifiedOn: "2026-10-04", defaultCategory: "art-design-architecture" };
  await repo.updateEvent(frieze.id, { sourceRef: "t-feed:frieze-1" });
  const body = ["BEGIN:VCALENDAR", "BEGIN:VEVENT", "UID:frieze-1", "SUMMARY:Frieze London", "DTSTART;VALUE=DATE:20261015", "DTEND;VALUE=DATE:20261020", "LOCATION:Somewhere Else, London", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const run = await runCultureSync({ repo, sources: [feed], watchlist: [], now: NOW, fetchImpl: async () => ({ ok: true, status: 200, text: async () => body }) });
  assert.equal(run.status === "failed", false);
  const change = (await repo.listCandidates({ status: ["pending"] })).find((c) => c.eventId === frieze.id);
  assert.ok(change, "proposed change raised"); assert.ok(change.current && change.proposed, "before/after present");
  const stillPublic = await repo.getEvent(frieze.id);
  assert.equal(stillPublic.startDate, "2026-10-14"); assert.equal(stillPublic.venue, "The Regent's Park");
  const result = applyDecision({ candidate: change, decision: "approve", reviewer: staff, today: TODAY, events: await repo.listEvents(), now: NOW });
  await repo.commitDecision({ candidate: change, result, audit: { actorId: staff, action: "culture.approve", entityType: "culture_candidate", entityId: change.id } });
  assert.equal((await repo.getEvent(frieze.id)).startDate, "2026-10-15");
});

test("failure handling: failed feed is reported (not silent success); storage failure is reported", async () => {
  const feed = { id: "bad-feed", name: "Broken", enabled: true, type: "ics", url: "https://events.example.org/x.ics", allowedHosts: ["events.example.org"], timezone: "UTC", verifiedOn: "2026-10-04" };
  const failed = await runCultureSync({ repo, sources: [feed], watchlist: [], now: NOW, fetchImpl: async () => ({ ok: false, status: 503, text: async () => "" }) });
  assert.equal(failed.status, "failed");
  const st = (await repo.listSourceStates()).find((s) => s.id === "bad-feed");
  assert.match(st.lastError, /503/); assert.equal(st.lastSuccess, null);
  const broken = { ...repo, listEvents: async () => { throw new Error("db down"); } };
  const aborted = await runCultureSync({ repo: broken, sources: [], watchlist, now: NOW });
  assert.equal(aborted.status, "failed"); assert.match(aborted.headline, /db down/);
});

test("staff-only access guard: partners and inactive users are refused", () => {
  assert.doesNotThrow(() => assertStaff({ id: staff, role: "admin", status: "active" }));
  assert.doesNotThrow(() => assertStaff({ id: staff, role: "executive", status: "active" }));
  assert.throws(() => assertStaff({ id: partner, role: "partner", status: "active" }));
  assert.throws(() => assertStaff({ id: staff, role: "admin", status: "inactive" }));
  assert.throws(() => assertStaff(null));
});
