// Daily Global Culture Calendar sync.
//
// Reads ONLY the sources listed (and enabled) in netlify/config/culture-sources.json, compares what
// they publish with the reviewed events in public/data/culture/events.json, and records differences
// as PENDING REVIEW items in a store (Netlify Blobs in production). It never edits published
// events, never invents dates, and on any failure leaves everything already stored untouched.
import { parseIcs, parseJsonFeed } from './feeds.mjs';

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 15000;
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const addDaysIso = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };

export function validateSource(src) {
  const errors = [];
  if (!src.id || !/^[a-z0-9-]+$/.test(src.id)) errors.push('id must be lowercase-hyphenated');
  if (!['ics', 'json'].includes(src.type)) errors.push('type must be "ics" or "json"');
  let url;
  try { url = new URL(src.url); } catch { errors.push('url is not a valid URL'); }
  if (url && url.protocol !== 'https:') errors.push('url must be https');
  if (url && !(src.allowedHosts || []).includes(url.hostname)) errors.push(`host ${url.hostname} is not in allowedHosts`);
  if (src.type === 'json' && !(src.mapping && src.mapping.uid && src.mapping.name && src.mapping.start)) errors.push('json sources need mapping.uid, mapping.name and mapping.start');
  return errors;
}

export function matchPublished(candidate, source, published) {
  const byRef = published.find((e) => e.source && e.source.id === source.id && e.source.uid && e.source.uid === candidate.uid);
  if (byRef) return byRef;
  if (candidate.url) {
    const u = candidate.url.replace(/\/+$/, '');
    const byUrl = published.find((e) => e.officialUrl && e.officialUrl.replace(/\/+$/, '') === u);
    if (byUrl) return byUrl;
  }
  return published.find((e) => norm(e.name) === norm(candidate.name) && e.startDate.slice(0, 4) === candidate.startDate.slice(0, 4));
}

export function classify(candidate, event) {
  if (!event) return { kind: 'new' };
  const diff = {};
  if (candidate.startDate !== event.startDate) diff.startDate = { from: event.startDate, to: candidate.startDate };
  if (candidate.endDate !== event.endDate) diff.endDate = { from: event.endDate, to: candidate.endDate };
  if (candidate.status === 'cancelled' && event.status !== 'cancelled') diff.status = { from: event.status, to: 'cancelled' };
  if (!Object.keys(diff).length) return { kind: 'unchanged' };
  return { kind: diff.status ? 'cancellation' : 'change', diff };
}

async function fetchSource(src, fetchImpl) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(src.url, { signal: ctrl.signal, headers: { 'user-agent': 'JettsetCultureCalendarSync/1.0 (+https://jettsetglobal.com)', accept: src.type === 'ics' ? 'text/calendar, text/plain' : 'application/json' }, redirect: 'error' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (text.length > MAX_BYTES) throw new Error('feed larger than 2 MB');
    return text;
  } finally { clearTimeout(timer); }
}

// store: { get(key) -> object|null, set(key, object), delete(key), list(prefix) -> keys[] }
export async function runSync({ sources, published, store, fetchImpl = fetch, now = new Date() }) {
  const today = now.toISOString().slice(0, 10);
  const horizon = addDaysIso(today, 400);
  const run = { startedAt: now.toISOString(), sources: [], newPending: 0, changedPending: 0, unchanged: 0, failures: 0 };
  const enabled = (sources || []).filter((s) => s.enabled);
  if (!enabled.length) { run.note = 'No enabled sources in netlify/config/culture-sources.json: nothing fetched.'; }

  for (const src of enabled) {
    const entry = { id: src.id, ok: false };
    try {
      const problems = validateSource(src);
      if (problems.length) throw new Error('invalid source config: ' + problems.join('; '));
      const body = await fetchSource(src, fetchImpl);
      const candidates = src.type === 'ics'
        ? parseIcs(body, { timeZone: src.timezone || 'UTC' })
        : parseJsonFeed(JSON.parse(body), src.mapping);
      // Parse succeeded: from here the writes below are the only changes made.
      const relevant = candidates.filter((c) => c.endDate >= today && c.startDate <= horizon);
      for (const c of relevant) {
        const ev = matchPublished(c, src, published);
        const cls = classify(c, ev);
        if (cls.kind === 'unchanged') {
          run.unchanged++;
          await store.set(`checked/${ev.id}`, { eventId: ev.id, sourceId: src.id, lastChecked: now.toISOString() });
          continue;
        }
        const key = `pending/${src.id}/${hash(c.uid)}`;
        const prior = await store.get(key);
        const sig = hash(JSON.stringify([cls.kind, c.startDate, c.endDate, c.status, c.name]));
        if (prior && prior.signature === sig) { prior.lastSeen = now.toISOString(); await store.set(key, prior); continue; }
        await store.set(key, {
          key, status: 'pending_review', kind: cls.kind, signature: sig,
          sourceId: src.id, eventId: ev ? ev.id : null, diff: cls.diff || null,
          candidate: { uid: c.uid, name: c.name, startDate: c.startDate, endDate: c.endDate, city: c.city, country: c.country, url: c.url, status: c.status, location: c.location },
          firstSeen: prior ? prior.firstSeen : now.toISOString(), lastSeen: now.toISOString()
        });
        if (cls.kind === 'new') run.newPending++; else run.changedPending++;
      }
      entry.ok = true; entry.items = relevant.length;
      await store.set(`sources/${src.id}`, { lastSuccess: now.toISOString(), lastError: null });
    } catch (err) {
      run.failures++;
      entry.error = String(err && err.message ? err.message : err);
      // Keep the last confirmed data; only record that this attempt failed.
      const prev = (await store.get(`sources/${src.id}`)) || {};
      await store.set(`sources/${src.id}`, { ...prev, lastError: { at: now.toISOString(), message: entry.error } });
      console.error('culture sync source failed', src.id, entry.error);
    }
    run.sources.push(entry);
  }
  run.finishedAt = new Date().toISOString();
  await store.set('runs/latest', run);
  const log = (await store.get('runs/log')) || { runs: [] };
  log.runs = [run, ...log.runs].slice(0, 60);
  await store.set('runs/log', log);
  return run;
}

export function memoryStore() {
  const m = new Map();
  return {
    async get(k) { return m.has(k) ? structuredClone(m.get(k)) : null; },
    async set(k, v) { m.set(k, structuredClone(v)); },
    async delete(k) { m.delete(k); },
    async list(prefix) { return [...m.keys()].filter((k) => k.startsWith(prefix)); },
    _map: m
  };
}
