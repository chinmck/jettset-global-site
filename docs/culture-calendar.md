# The Global Culture Calendar

Homepage feature (the colonnade plate in the Jettset House section) plus one page per event.

## How it fits together
| Piece | Where |
|---|---|
| Published, reviewed events (single source of truth) | `public/data/culture/events.json` |
| Homepage carousel | `public/culture/culture-calendar.{js,css}`, markup in `public/homepage.html` + `index.html` (`#cultureCalendar`) |
| Shared date/month logic | `public/culture/culture-lib.js` |
| Event pages + sitemap generator | `scripts/build-culture-pages.mjs` → `public/culture/events/<slug>/index.html`, `public/sitemap-culture.xml` |
| Daily sync (server-side) | `netlify/functions/culture-events-sync.mts`, logic in `lib/culture/` |
| Review report | `netlify/functions/culture-review.mts` |
| Source allowlist | `netlify/config/culture-sources.json` |
| Tests | `npm run test:culture` |

Hosting is Netlify (`@netlify/plugin-nextjs`; static pages in `public/`). There is no CMS. The existing Postgres (Neon/Drizzle) holds the partner hub only, so **pending candidates are stored in Netlify Blobs** (no credentials needed on Netlify; store name `culture-events`).

## What the carousel shows
Events from `events.json` with `publication: "published"` and `status: "confirmed"` whose dates overlap the **current month** (visitor's date, computed in the browser; "October 2026" is not hard-coded). If the current month has none, the next month that has events is shown and the month label follows. Cancelled, postponed and pending events never show. It advances every 6.5 s with a soft crossfade and loops; it pauses on hover, focus, when off-screen or the tab is hidden, and via a pause button. It supports prev/next, timeline clicks, ←/→ keys and touch swipe, and does not auto-advance under `prefers-reduced-motion`.

## Adding or changing an event (the review step)
1. Edit `public/data/culture/events.json` (ISO dates in the event's timezone, official URL, source, `status`, `publication`, `lastChecked`) and write original Jettset `editorial` copy (lede, context, guidance, airports from `private-jet-airports.json`). Do not copy organiser text.
2. `npm run culture:build` regenerates pages and sitemap; `npm run culture:check` and `npm run test:culture` verify.
3. A page is **noindex and absent from the sitemap** until `editorial.reviewed` is set to `{ "by": "<name>", "on": "YYYY-MM-DD" }` by a person who has reviewed the copy. Setting it also switches on `index, follow` and the `Event` JSON-LD (name, dates, venue/city/country code, organiser, description — all visible on the page). Do not set it for thin pages.
4. Merge through a pull request: that is the publication approval.

## Daily sync
`culture-events-sync` runs daily at 05:17 UTC (`netlify.toml`). It fetches only sources in `culture-sources.json` with `"enabled": true` (https, host in `allowedHosts`), compares them with `events.json`, and writes **pending review** items (`new`, `change`, `cancellation`) to Blobs. It never edits `events.json`. On any failure (HTTP error, timeout, bad feed, storage error) it logs, records the error against the source and leaves everything stored unchanged; the public calendar is unaffected because the browser reads only the reviewed file.

Review report: `GET /.netlify/functions/culture-review` with header `Authorization: Bearer $CULTURE_REVIEW_TOKEN` returns pending items, the last run and source health. `POST {"key":"pending/…","action":"dismiss"}` clears an item. It cannot publish.

### Still required for live automated updates (not configured)
1. **Feed URLs.** `sources` is empty: no official ICS/RSS/API feed URLs were supplied or verified, and no single worldwide feed exists. Add one entry per official feed, e.g.

```json
{
  "id": "example-official-ics",
  "enabled": true,
  "type": "ics",
  "url": "https://events.example.org/calendar.ics",
  "allowedHosts": ["events.example.org"],
  "timezone": "Europe/London"
}
```
JSON APIs use `"type": "json"` plus `"mapping": { "itemsPath": "data.events", "uid": "id", "name": "title", "start": "start", "end": "end", "city": "venue.city", "country": "venue.country", "url": "url", "status": "status" }`.
So the sync recognises a published event, set `source.id` and `source.uid` on it in `events.json` (otherwise it matches by identical official URL, or identical name + year).
2. **Environment variable** `CULTURE_REVIEW_TOKEN` (a long random string) in Netlify to use the review endpoint. No other credentials are needed. A feed that needs an API key would need a small code change (`lib/culture/sync.mjs`) plus an env var; never put keys in the repo or browser.
3. **Netlify Blobs** are automatic on Netlify. After enabling a source, run the function once (Netlify → Functions → culture-events-sync → Run now) and check the log line `culture sync finished …` shows `failures: 0` and no `note`.
