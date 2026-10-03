import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadCultureLib } from "../scripts/culture-lib-loader.mjs";
import { parseIcs, parseJsonFeed } from "../lib/culture/feeds.mjs";
import { runSync, memoryStore, validateSource } from "../lib/culture/sync.mjs";
import { renderPage, renderSitemap, isIndexable, validateEvent } from "../scripts/build-culture-pages.mjs";

const lib = loadCultureLib();
const data = JSON.parse(readFileSync(new URL("../public/data/culture/events.json", import.meta.url), "utf8"));
const published = data.events;

test("published events are valid and unique", () => {
  const errors = published.flatMap(validateEvent);
  assert.deepEqual(errors, []);
  assert.equal(new Set(published.map((e) => e.slug)).size, published.length);
});

test("carousel shows the displayed month's published events in date order", () => {
  const v = lib.eventsForDisplay(published, "2026-10-03");
  assert.equal(v.year, 2026); assert.equal(v.month, 10);
  assert.deepEqual(v.events.map((e) => e.slug), ["frieze-london-2026", "asia-now-paris-2026", "art-basel-paris-2026"]);
  assert.equal(lib.monthLabel(v.year, v.month), "October 2026");
});

test("the month is dynamic, not hard-coded", () => {
  // In September the next month with events is shown, and the label follows the data.
  const v = lib.eventsForDisplay(published, "2026-09-15");
  assert.equal(lib.monthLabel(v.year, v.month), "October 2026");
  const none = lib.eventsForDisplay(published, "2028-01-01");
  assert.equal(none.events.length, 0);
});

test("pending, cancelled and postponed events never reach the carousel", () => {
  const base = published[0];
  const mix = [
    { ...base, id: "a", slug: "a", publication: "pending_review" },
    { ...base, id: "b", slug: "b", status: "cancelled" },
    { ...base, id: "c", slug: "c", status: "postponed" },
    { ...base, id: "d", slug: "d" },
  ];
  assert.deepEqual(lib.eventsForDisplay(mix, "2026-10-03").events.map((e) => e.slug), ["d"]);
});

test("date formatting", () => {
  assert.equal(lib.shortRange("2026-10-14", "2026-10-18"), "14–18 OCT");
  assert.equal(lib.shortRange("2026-10-29", "2026-11-02"), "29 OCT – 2 NOV");
  assert.equal(lib.shortRange("2026-10-23", "2026-10-23"), "23 OCT");
  assert.equal(lib.longRange("2026-10-14", "2026-10-18"), "14–18 October 2026");
});

test("unreviewed pages are noindex, have no structured data and stay out of the sitemap", () => {
  const e = published[0];
  assert.equal(isIndexable(e), false);
  const html = renderPage(e);
  assert.match(html, /<meta name="robots" content="noindex, follow">/);
  assert.doesNotMatch(html, /application\/ld\+json/);
  assert.match(html, /<link rel="canonical" href="https:\/\/jettsetglobal\.com\/culture\/events\/frieze-london-2026\/">/);
  assert.match(html, /Dates last checked/);
  assert.match(html, /not affiliated with/);
  assert.match(html, /href="\/#culture-calendar"/);
  assert.match(html, /Plan Your Journey/);
  assert.doesNotMatch(renderSitemap(published), /<loc>/);
});

test("reviewed pages are indexable with consistent Event structured data and a sitemap entry", () => {
  const e = { ...published[0], editorial: { ...published[0].editorial, reviewed: { by: "Editor", on: "2026-10-04" } } };
  assert.equal(isIndexable(e), true);
  const html = renderPage(e);
  assert.match(html, /<meta name="robots" content="index, follow">/);
  const ld = JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(html)[1]);
  assert.equal(ld["@type"], "Event");
  assert.equal(ld.startDate, "2026-10-14");
  assert.equal(ld.endDate, "2026-10-18");
  assert.equal(ld.location.address.addressCountry, "GB");
  assert.equal(ld.name, "Frieze London 2026");
  assert.ok(html.includes("14–18 October 2026"), "visible dates match the structured data");
  assert.match(renderSitemap([e]), /<loc>https:\/\/jettsetglobal\.com\/culture\/events\/frieze-london-2026\/<\/loc>/);
});

test("ICS parsing: all-day end dates are exclusive, UTC is converted, cancellations flagged", () => {
  const ics = [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT", "UID:a1", "SUMMARY:Test Fair", "DTSTART;VALUE=DATE:20261014", "DTEND;VALUE=DATE:20261019", "URL:https://example.org/fair", "END:VEVENT",
    "BEGIN:VEVENT", "UID:b2", "SUMMARY:Late\\, Night", "DTSTART:20261020T230000Z", "DTEND:20261021T020000Z", "STATUS:CANCELLED", "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const [a, b] = parseIcs(ics, { timeZone: "Europe/Paris" });
  assert.deepEqual([a.startDate, a.endDate], ["2026-10-14", "2026-10-18"]);
  assert.equal(b.name, "Late, Night");
  assert.equal(b.startDate, "2026-10-21");   // 23:00Z is 01:00 the next day in Paris
  assert.equal(b.status, "cancelled");
});

test("JSON feed adapter maps configured fields only", () => {
  const out = parseJsonFeed({ data: [{ id: 1, title: "X", start: "2026-11-02T10:00:00Z", end: "2026-11-04", status: "Cancelled" }, { id: 2, title: "no date" }] },
    { itemsPath: "data", uid: "id", name: "title", start: "start", end: "end", status: "status" });
  assert.equal(out.length, 1);
  assert.deepEqual([out[0].startDate, out[0].endDate, out[0].status], ["2026-11-02", "2026-11-04", "cancelled"]);
});

const source = { id: "official-ics", enabled: true, type: "ics", url: "https://events.example.org/cal.ics", allowedHosts: ["events.example.org"], timezone: "Europe/London" };
const feedFor = (...vevents) => ["BEGIN:VCALENDAR", ...vevents.flatMap((v) => ["BEGIN:VEVENT", ...v, "END:VEVENT"]), "END:VCALENDAR"].join("\r\n");
const ok = (body) => async () => ({ ok: true, status: 200, text: async () => body });
const now = new Date("2026-10-03T05:17:00Z");

test("sync: no enabled sources fetches nothing and says so", async () => {
  const store = memoryStore();
  let called = 0;
  const run = await runSync({ sources: [], published, store, now, fetchImpl: async () => { called++; } });
  assert.equal(called, 0);
  assert.match(run.note, /No enabled sources/);
});

test("sync: unchanged events only refresh the last-checked record", async () => {
  const store = memoryStore();
  const f = feedFor(["UID:f1", "SUMMARY:Frieze London", "DTSTART;VALUE=DATE:20261014", "DTEND;VALUE=DATE:20261019", "URL:https://www.frieze.com/fairs/frieze-london-frieze-masters"]);
  const run = await runSync({ sources: [source], published, store, now, fetchImpl: ok(f) });
  assert.equal(run.unchanged, 1); assert.equal(run.newPending, 0);
  assert.ok(await store.get("checked/frieze-london-2026"));
  assert.equal((await store.list("pending/")).length, 0);
});

test("sync: new and changed events become pending review, never published; reruns do not duplicate", async () => {
  const store = memoryStore();
  const f = feedFor(
    ["UID:f1", "SUMMARY:Frieze London", "DTSTART;VALUE=DATE:20261015", "DTEND;VALUE=DATE:20261019", "URL:https://www.frieze.com/fairs/frieze-london-frieze-masters"],
    ["UID:n1", "SUMMARY:Brand New Fair", "DTSTART;VALUE=DATE:20261105", "DTEND;VALUE=DATE:20261107"],
  );
  const before = JSON.stringify(published);
  const run1 = await runSync({ sources: [source], published, store, now, fetchImpl: ok(f) });
  assert.equal(run1.newPending, 1); assert.equal(run1.changedPending, 1);
  const keys = await store.list("pending/");
  assert.equal(keys.length, 2);
  const change = (await Promise.all(keys.map((k) => store.get(k)))).find((p) => p.kind === "change");
  assert.deepEqual(change.diff.startDate, { from: "2026-10-14", to: "2026-10-15" });
  assert.equal(change.status, "pending_review");
  await runSync({ sources: [source], published, store, now, fetchImpl: ok(f) });
  assert.equal((await store.list("pending/")).length, 2);
  assert.equal(JSON.stringify(published), before, "published data is never modified");
});

test("sync: a confirmed cancellation is flagged for review, not auto-removed", async () => {
  const store = memoryStore();
  const f = feedFor(["UID:f1", "SUMMARY:Frieze London", "STATUS:CANCELLED", "DTSTART;VALUE=DATE:20261014", "DTEND;VALUE=DATE:20261019", "URL:https://www.frieze.com/fairs/frieze-london-frieze-masters"]);
  await runSync({ sources: [source], published, store, now, fetchImpl: ok(f) });
  const [k] = await store.list("pending/");
  assert.equal((await store.get(k)).kind, "cancellation");
  assert.equal(published[0].status, "confirmed");
});

test("sync: a failing feed keeps everything already stored and records the failure", async () => {
  const store = memoryStore();
  await store.set("pending/official-ics/seed", { key: "pending/official-ics/seed", status: "pending_review" });
  const run = await runSync({ sources: [source], published, store, now, fetchImpl: async () => ({ ok: false, status: 503, text: async () => "" }) });
  assert.equal(run.failures, 1);
  assert.ok(await store.get("pending/official-ics/seed"), "earlier pending item retained");
  assert.match((await store.get("sources/official-ics")).lastError.message, /503/);
  const empty = await runSync({ sources: [source], published, store, now, fetchImpl: ok("not a calendar") });
  assert.equal(empty.failures, 0); assert.equal(empty.newPending, 0);   // an empty/garbage feed adds nothing and removes nothing
  assert.ok(await store.get("pending/official-ics/seed"));
});

test("sync: sources must be https and on their own allowlisted host", () => {
  assert.deepEqual(validateSource(source), []);
  assert.ok(validateSource({ ...source, url: "http://events.example.org/cal.ics" }).length);
  assert.ok(validateSource({ ...source, url: "https://evil.example.net/cal.ics" }).some((m) => /allowedHosts/.test(m)));
  assert.ok(validateSource({ ...source, type: "html" }).length);
});

test("sync: disabled sources are skipped", async () => {
  let called = 0;
  await runSync({ sources: [{ ...source, enabled: false }], published, store: memoryStore(), now, fetchImpl: async () => { called++; } });
  assert.equal(called, 0);
});
