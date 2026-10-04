// Weekly Global Culture Calendar sync.
//
// What it does: reads the verified machine-readable feeds listed (and enabled) in
// netlify/config/culture-sources.json, raises manual-verification items from the curated
// watchlist, and rechecks published events. Everything becomes a REVIEW CANDIDATE in the Partner
// Hub queue. It never publishes, edits or removes a public event: only staff decisions
// (domain.applyDecision, via the Partner Hub) change public data.
import { parseIcs, parseJsonFeed } from './feeds.mjs';
import { buildCandidates, summariseRun, cal } from './domain.mjs';

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 15000;

export function validateSource(src) {
  const errors = [];
  if (!src.id || !/^[a-z0-9-]+$/.test(src.id)) errors.push('id must be lowercase-hyphenated');
  if (!['ics', 'json'].includes(src.type)) errors.push('type must be "ics" or "json"');
  if (!src.name) errors.push('name is required');
  if (!src.verifiedOn) errors.push('verifiedOn (date the URL was checked) is required before a feed can be enabled');
  let url;
  try { url = new URL(src.url); } catch { errors.push('url is not a valid URL'); }
  if (url && url.protocol !== 'https:') errors.push('url must be https');
  if (url && !(src.allowedHosts || []).includes(url.hostname)) errors.push(`host ${url.hostname} is not in allowedHosts`);
  if (src.type === 'json' && !(src.mapping && src.mapping.uid && src.mapping.name && src.mapping.start)) errors.push('json sources need mapping.uid, mapping.name and mapping.start');
  return errors;
}

async function fetchSource(src, fetchImpl) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(src.url, { signal: ctrl.signal, headers: { 'user-agent': 'JettsetCultureCalendarSync/2.0 (+https://jettsetglobal.com)', accept: src.type === 'ics' ? 'text/calendar, text/plain' : 'application/json' }, redirect: 'error' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (text.length > MAX_BYTES) throw new Error('feed larger than 2 MB');
    return text;
  } finally { clearTimeout(timer); }
}

// repo: see lib/culture/repo-memory.mjs for the interface (the Partner Hub uses repo-db.ts).
export async function runCultureSync({ repo, sources = [], watchlist = [], fetchImpl = fetch, now = new Date(), trigger = 'schedule' }) {
  const startedAt = now.toISOString();
  const today = cal.londonToday(now);
  const enabled = (sources || []).filter((s) => s.enabled);
  const results = [];
  const feedItems = [];
  let run;
  try {
    for (const src of enabled) {
      const entry = { id: src.id, name: src.name, ok: false, items: 0 };
      try {
        const problems = validateSource(src);
        if (problems.length) throw new Error('invalid source config: ' + problems.join('; '));
        const body = await fetchSource(src, fetchImpl);
        const parsed = src.type === 'ics' ? parseIcs(body, { timeZone: src.timezone || 'UTC' }) : parseJsonFeed(JSON.parse(body), src.mapping);
        for (const c of parsed) feedItems.push({ sourceId: src.id, sourceName: src.name, sourceUrl: src.pageUrl || src.url, uid: c.uid, name: c.name, startDate: c.startDate, endDate: c.endDate, city: c.city || null, country: c.country || null, venue: c.location || null, category: src.defaultCategory || null, status: c.status });
        entry.ok = true; entry.items = parsed.length;
        await repo.upsertSourceState({ id: src.id, name: src.name, kind: 'feed', lastAttempt: startedAt, lastSuccess: startedAt, lastError: null, itemsSeen: parsed.length });
      } catch (err) {
        entry.error = String(err && err.message ? err.message : err);
        const prev = (await repo.getSourceState(src.id)) || {};
        await repo.upsertSourceState({ id: src.id, name: src.name, kind: 'feed', lastAttempt: startedAt, lastSuccess: prev.lastSuccess || null, lastError: entry.error, itemsSeen: prev.itemsSeen || 0 });
        console.error('culture sync source failed', src.id, entry.error);
      }
      results.push(entry);
    }

    const [events, candidates] = await Promise.all([repo.listEvents(), repo.listCandidates()]);
    const out = buildCandidates({ today, now, feedItems, feedSourceIds: new Set(enabled.filter((s) => results.find((r) => r.id === s.id && r.ok)).map((s) => s.id)), watchlist, events, candidates });
    for (const c of out.create) await repo.insertCandidate(c);
    for (const t of out.touch) await repo.updateCandidate(t.id, { lastSeen: t.lastSeen });
    for (const id of out.supersede) await repo.updateCandidate(id, { status: 'superseded' });
    for (const id of out.eventsConfirmed) await repo.updateEvent(id, { lastSourceCheckAt: startedAt });   // private field only
    await repo.upsertSourceState({ id: 'watchlist', name: 'Curated watchlist (manual verification)', kind: 'watchlist', lastAttempt: startedAt, lastSuccess: startedAt, lastError: null, itemsSeen: watchlist.length });
    run = summariseRun({ enabledFeeds: enabled.length, results, watchlistCount: watchlist.length, stats: out.stats });
    run.created = out.create.length; run.superseded = out.supersede.length;
  } catch (err) {
    run = summariseRun({ enabledFeeds: enabled.length, results, watchlistCount: watchlist.length, stats: null, error: String(err && err.message ? err.message : err) });
    console.error('culture sync aborted', run.headline);
  }
  const record = { startedAt, finishedAt: new Date().toISOString(), trigger, window: cal.windowBounds(today), today, sources: results, ...run };
  try { await repo.recordRun(record); } catch (e) { console.error('culture sync: could not record run', e && e.message); record.recordError = String(e && e.message); }
  return record;
}
