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

## Sources and coverage (honest status)
- **No machine-readable feed is enabled.** Probes of F1, Art Basel, Venice Biennale, Salone del Mobile, Edinburgh Fringe and Wimbledon found no usable official feed (404/410). `netlify/config/culture-sources.json` is therefore `sources: []`. A source needs id, type (`ics`|`json`), https URL on an allow-listed host and a `verifiedOn` date before it will run.
- Coverage is a curated **watchlist** (`netlify/config/culture-watchlist.json`, 44 recurring events). Each week it raises *manual verification* candidates for watchlist events that fall in the window and have no approved event. 38 reference links were checked on 2026-10-04; 6 were blocked or unverified and are flagged in the file. Watchlist entries carry no dates.
- Published events are re-checked (every 28 days, every 14 when within 14 days of the start) as manual-verification items.
- This is **not** complete global coverage. Gaps: anything not on the watchlist, one-off events, and anything without a verifiable official source. Add entries to the watchlist after verifying a source.

## Weekly schedule
`netlify.toml`: `[functions."culture-events-sync"] schedule = "17 5 * * 1"` — Mondays 05:17 **UTC**. Netlify cron has no DST handling, so this is 05:17 GMT in winter and 06:17 BST in summer.

## Manual setup before release
1. Apply `drizzle/0002_culture_calendar.sql` to the production Neon database (migrations here are hand-applied). It creates the tables and seeds the 3 existing events as published but not signed off.
2. `DATABASE_URL` must be set for the Netlify site (functions + Next). Existing NextAuth/Resend variables are unchanged. No new secrets are required and none are committed.
3. After deploy, sign in as staff → Culture Calendar → **Run sync now**. This is the check that the deployed function environment can reach the database; the scheduled run itself appears under sync history after the next Monday.
4. Sign off editorial for the three seeded events once reviewed (Frieze London / Art Basel Paris venue facts still want human reconfirmation).

## Not verifiable outside production
Previews use a placeholder DB URL, so the DB-backed Hub workflow, deployed scheduler, and secrets access could not be exercised there. The workflow logic is covered by `npm run test:culture` against an in-memory repository (24 tests); the preview shows the public calendar in snapshot-fallback mode.

## Tests
`npm run test:culture`, `node --test tests/i18n.test.mjs`, `npx next build`.
