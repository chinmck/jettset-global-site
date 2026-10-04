# The Global Culture Calendar

A curated, rolling 12-month calendar (current Europe/London month + the next 11), with a staff approval
workflow in the Partner Hub. **Nothing reaches the public site except through a staff decision.**

## How it fits together

| Piece | Where |
|---|---|
| Date/window helpers (single source) | `lib/culture/calendar.cjs` (browser copy `public/culture/culture-lib.js` is generated: `npm run culture:lib`) |
| Domain rules (candidates, decisions, indexing) | `lib/culture/domain.mjs` |
| Weekly sync | `lib/culture/sync.mjs`, run by `netlify/functions/culture-events-sync.mts` |
| Storage | Neon Postgres via Drizzle: `culture_events`, `culture_candidates`, `culture_reviews`, `culture_sync_runs`, `culture_source_states` |
| Staff review UI | Partner Hub → **Culture Calendar** (`/partner/admin/culture`), roles `admin`/`executive` only |
| Public data | `/api/culture/events` (approved only), falls back to `public/data/culture/events.json` if the DB is unreachable |
| Event pages | `/culture/events/<slug>` (dynamic; 404 unknown, 410 cancelled) |
| Sitemap | `/sitemap-culture.xml` (approved **and** editorially signed-off events only) |

## Rules enforced in code (and tested)
- The sync writes only review **candidates**, source health, run history and a private `lastSourceCheckAt`. It never edits, publishes or removes a public event.
- Date, venue and cancellation changes to a published event appear as *proposed changes* with before/after; they apply only when staff approve.
- Approving a **new** event needs staff-written Jettset editorial (lede ≥ 20 chars, context ≥ 120 chars), so no thin pages.
- An event page is indexable/in the sitemap only when published **and** signed off in the Hub. The three seeded events stay `noindex` until someone signs them off.
- Pending/rejected/needs-verification items have no public page. Public pages contain no external links; the CTA is the internal enquiry journey.
- Every decision records reviewer, time and notes (`culture_reviews`) plus the Hub audit log.
- **Atomic decisions:** approve/reject/needs-verification write the event (insert/update), the candidate update, the review record and the audit entry in one `db.batch()` (Neon runs a batch as a single transaction). Either all four apply or none do. Editorial sign-off (event update + audit) is atomic the same way.

## What the weekly sync does with today's configuration
**It does not automatically retrieve any event dates.** No feed is enabled (`culture-sources.json` has `sources: []`), so the run status is `no_feeds`. Each Monday it:
1. **Generates manual verification tasks** from the curated watchlist: for every watchlist event expected inside the 12-month window with no approved event, a Hub item says "usually held in <months>; dates and venue are NOT confirmed — check the organiser page". Watchlist entries contain no dates. (First run against the current data created 45 such items; the queue is the main workload.)
2. **Raises recheck tasks** for published events not checked recently (28 days; 14 when the start is within 14 days). These are prompts for a person to re-confirm; they compare nothing automatically.
3. Records the run and source health, reporting `no_feeds`, `failed`, `partial` or `empty` honestly.

It does **not** fetch dates, venues or cancellations from the web, and it cannot detect that a published event changed. Date/venue/cancellation *change detection* only works for an enabled, verified feed (the code path is implemented and tested with simulated feeds, but no real feed uses it). The public calendar therefore reflects what staff have approved, not live data.

## Sources and coverage
- Probes of F1, Art Basel, Venice Biennale, Salone del Mobile, Edinburgh Fringe and Wimbledon found no usable official feed (404/410). A source must have id, type (`ics`|`json`), https URL on an allow-listed host and a `verifiedOn` date before it runs.
- The watchlist (`netlify/config/culture-watchlist.json`, 44 recurring events) is a reference list. 38 links were checked on 2026-10-04; 6 were blocked or unverified and are flagged in the file.
- **Coverage gaps:** anything not on the watchlist, one-off events, and anything without a verifiable official source. This is not global coverage. To add automation, verify an official feed URL, add it to `culture-sources.json` with `verifiedOn`, and test it.

## Weekly schedule
`netlify.toml`: `[functions."culture-events-sync"] schedule = "17 5 * * 1"` — Mondays 05:17 **UTC** (05:17 GMT in winter, 06:17 BST in summer; Netlify cron has no DST handling).

## Deployment targets and checks
- **Production is Netlify** (`jettsetglobal.com` is served by Netlify; `main` deploys it). The check that matters for release is the Netlify deploy preview / build (`netlify/jettset-global/deploy-preview`, Header/Redirect rules).
- A **Cloudflare Pages** project (`jettset-global-site`) is still connected to the repo and its check fails on every commit, including `main`, since at least 2026-09-14 (it last passed on the 2026-07-22 baseline commit). It is a leftover from the original starter template (`vite.config.ts`, `worker/`, `wrangler`), not a production target: the domain's A record points at Netlify and `package.json` builds with `next build` for Netlify. `jettset-global-site.pages.dev` still serves an old, stale copy of the homepage. Recommended: disconnect or disable the Pages project in the Cloudflare dashboard (needs account access; not done from the repo). Its failure is not a required check (`main` has no branch protection or required status checks).

## Migration: exact order
Use a **non-production Neon branch first**, then production. Migrations here are hand-applied (the Drizzle journal is informational).
1. Prerequisite: `0000_partner_hub.sql` and `0001_guest_relationship_tools.sql` are already applied (needs `partner_users`). PostgreSQL 13+.
2. Take a Neon point-in-time restore point/branch of production.
3. Apply `drizzle/0002_culture_calendar.sql` as a single script, e.g. `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f drizzle/0002_culture_calendar.sql`, or paste into the Neon SQL editor. The file is wrapped in `BEGIN; … COMMIT;`, only **adds** `culture_*` tables, never alters existing ones, and is safe to re-run (tables/indexes `IF NOT EXISTS`, foreign keys guarded, seed `ON CONFLICT DO NOTHING`).
4. Verify: `select count(*) from culture_events;` → 3 (and `editorial_reviewed_by` is null on all).
5. Deploy the code. 6. Hub → Culture Calendar → **Run sync now** → expect status `no_feeds` and ~45 manual items.

## Environment
`DATABASE_URL` (Neon) must be set for the Netlify site (Next + functions). Existing NextAuth/Resend variables are unchanged. No new secrets; none committed.

## Test status — what was and was not verified
- `npm run test:culture` (39 tests) and `npx next build` pass.
- **Verified against a real PostgreSQL engine (PGlite, in-process Postgres — not Neon):** migrations 0000→0001→0002 apply; 0002 re-runs twice without error or duplicates; a mid-script failure leaves nothing behind; the real repository code runs the sync (no_feeds), candidate creation/idempotency, approve (new + update + cancellation path), reject (not re-raised), needs-verification, changed-date proposal vs untouched public data, failed-feed and storage-failure reporting, and the rollback of a decision when one write fails.
- **Not verified (no staging Neon credentials were available):** the Neon HTTP driver and `db.batch()` transactional behaviour against real Neon; NextAuth sign-in and the Hub pages/server actions under a real staff vs partner session (the staff guard is unit-tested only); the deployed Netlify scheduled function, its env/secrets, and the live Hub "Run sync now". Run steps 1–6 above on a Neon branch first to close these.
