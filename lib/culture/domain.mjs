// Global Culture Calendar — pure domain logic (no I/O). Used by the weekly sync, the Partner Hub
// review actions and the public API, and unit-tested with an in-memory repository.
//
// Principle: a feed or watchlist result only ever creates / refreshes REVIEW CANDIDATES. Public
// event data changes only through applyDecision(), which is called by an authenticated staff action.
import cal from './calendar.cjs';
export { cal };

export const CATEGORIES = [
  ['art-design-architecture', 'Art, design & architecture'],
  ['fashion', 'Fashion'],
  ['film', 'Film'],
  ['music-performing-arts', 'Music & performing arts'],
  ['food-hospitality', 'Food & hospitality'],
  ['festivals', 'Major cultural festivals'],
  ['sport', 'Major international sporting events'],
];
export const categoryLabel = (k) => (CATEGORIES.find((c) => c[0] === k) || [k, k || '—'])[1];

export const EVENT_FIELDS = ['name', 'category', 'city', 'country', 'venue', 'startDate', 'endDate', 'timezone'];
export const COMPARE_FIELDS = ['name', 'category', 'city', 'country', 'venue', 'startDate', 'endDate', 'status'];
export const RECHECK_DAYS = 28;          // published event with no machine-readable source: reconfirm at least this often
export const RECHECK_NEAR_DAYS = 14;     // …and this often once the event is within 45 days
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
export function slugify(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
export function daysBetween(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000); }
const isIsoDate = (s) => ISO.test(s || '') && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o && o[k] != null ? o[k] : null]));

export function diffFields(current, proposed) {
  const diff = {};
  for (const f of COMPARE_FIELDS) {
    if (proposed[f] == null || proposed[f] === '') continue;           // a feed that omits a field proposes no change to it
    if ((current[f] ?? '') !== proposed[f]) diff[f] = { from: current[f] ?? null, to: proposed[f] };
  }
  return diff;
}

export function eventKeyYear(e) { return e.startDate ? e.startDate.slice(0, 4) : ''; }
export function slugFor(name, startDate, taken = new Set()) {
  const year = (startDate || '').slice(0, 4);
  const stem = slugify(name);
  const base = (stem.endsWith('-' + year) || !year ? stem : `${stem}-${year}`);
  let slug = base, n = 2;
  while (taken.has(slug)) slug = `${base}-${n++}`;
  return slug;
}

// ---------- candidate generation (weekly sync) ----------

// feedItems: [{sourceId, sourceName, sourceUrl, uid, name, startDate, endDate, city?, country?, venue?, category?, status?, url?}]
// watchlist: [{key, name, category, city, country, typicalMonths:[1-12], cadence?, sourceName, sourceUrl, note?}]
export function buildCandidates({ today, now = new Date(), feedItems = [], feedSourceIds = new Set(), watchlist = [], events = [], candidates = [] }) {
  const win = cal.windowBounds(today);
  const months = cal.rollingMonths(today);
  const create = [], touch = new Map(), supersede = [], eventsConfirmed = [];
  const stats = { newFromFeeds: 0, changes: 0, cancellations: 0, confirmedUnchanged: 0, manualVerification: 0, rechecks: 0, suppressed: 0 };
  const nowIso = now.toISOString();
  const byFp = new Map();
  for (const c of candidates) if (c.status !== 'superseded') byFp.set(c.fingerprint, c);
  const live = events.filter((e) => e.status === 'published');
  const inWindow = (s, e) => e >= today && s <= win.end;

  function propose(c) {
    const existing = byFp.get(c.fingerprint);
    if (existing) {
      if (existing.status === 'pending' || existing.status === 'needs_verification') touch.set(existing.id, nowIso);
      else stats.suppressed++;             // already decided (approved/rejected): do not re-raise the same thing
      return false;
    }
    const full = { status: 'pending', verificationNotes: null, firstSeen: nowIso, lastSeen: nowIso, ...c };
    create.push(full); byFp.set(c.fingerprint, full);
    return true;
  }

  // a) machine-readable feeds
  for (const it of feedItems) {
    if (!it.name || !isIsoDate(it.startDate)) continue;
    const endDate = isIsoDate(it.endDate) ? it.endDate : it.startDate;
    if (!inWindow(it.startDate, endDate)) continue;
    const ref = `${it.sourceId}:${it.uid}`;
    const ev = live.find((e) => e.sourceRef === ref) ||
      live.find((e) => slugify(e.name) === slugify(it.name) && eventKeyYear(e) === it.startDate.slice(0, 4));
    const proposed = { name: it.name, category: it.category || null, city: it.city || null, country: it.country || null, venue: it.venue || null, startDate: it.startDate, endDate, timezone: null, status: it.status === 'cancelled' ? 'cancelled' : 'published' };
    const src = { sourceId: it.sourceId, sourceName: it.sourceName, sourceUrl: it.sourceUrl, sourceCheckedAt: nowIso, sourceRef: ref };
    if (!ev) {
      if (proposed.status === 'cancelled') continue;     // a cancelled event we never published needs no review
      if (propose({ kind: 'new', eventId: null, watchKey: null, fingerprint: `new:${hash(ref + it.startDate + endDate + it.name)}`, proposed, current: null, uncertainty: 'Significance and audience fit need staff judgement; the feed only supplies the dates and location.', ...src })) stats.newFromFeeds++;
      continue;
    }
    const diff = diffFields(ev, proposed);
    delete diff.category;                                // a feed's own category labels are not authoritative
    if (!Object.keys(diff).length) { stats.confirmedUnchanged++; eventsConfirmed.push(ev.id); continue; }
    const cancel = diff.status && diff.status.to === 'cancelled';
    const kind = cancel ? 'cancellation' : 'change';
    if (propose({ kind, eventId: ev.id, watchKey: ev.watchKey || null, fingerprint: `${kind}:${ev.id}:${hash(JSON.stringify(diff))}`, proposed: { ...pick(ev, EVENT_FIELDS), ...Object.fromEntries(Object.entries(diff).map(([k, v]) => [k, v.to])) }, current: pick({ ...ev, status: ev.status }, [...EVENT_FIELDS, 'status']), uncertainty: cancel ? 'Cancellation reported by the source: confirm it is official before approving.' : 'Source reports different details from the published event: confirm which is correct.', ...src })) {
      if (cancel) stats.cancellations++; else stats.changes++;
    }
  }

  // b) curated watchlist -> manual verification items (no reliable machine-readable source exists)
  for (const w of watchlist) {
    const anchors = new Set();
    for (const m of months) if ((w.typicalMonths || []).includes(m.month)) anchors.add(m.year);
    for (const year of anchors) {
      if (w.cadence === 'even' && year % 2) continue;
      if (w.cadence === 'odd' && year % 2 === 0) continue;
      const have = events.find((e) => e.watchKey === w.key && eventKeyYear(e) === String(year) && e.status !== 'withdrawn');
      if (have) continue;
      const monthNames = (w.typicalMonths || []).map((m) => cal.MONTHS[m - 1]).join(', ');
      if (propose({ kind: 'manual_verification', eventId: null, watchKey: w.key, fingerprint: `watch:${w.key}:${year}`,
        proposed: { name: `${w.name} ${year}`, category: w.category, city: w.city, country: w.country, venue: w.venue || null, startDate: null, endDate: null, timezone: w.timezone || null, status: 'published' },
        current: null, sourceId: 'watchlist', sourceName: w.sourceName, sourceUrl: w.sourceUrl, sourceCheckedAt: null, sourceRef: null,
        uncertainty: `No reliable machine-readable source. Usually held in ${monthNames}; dates and venue for ${year} are NOT confirmed. Confirm them on the organiser's page, decide whether it still meets the curation test, then approve with the verified details.${w.note ? ' ' + w.note : ''}` })) stats.manualVerification++;
    }
  }
  // watchlist items whose edition has dropped out of the window are retired
  for (const c of candidates) {
    if (c.kind !== 'manual_verification' || !['pending', 'needs_verification'].includes(c.status)) continue;
    const year = +(c.fingerprint.split(':')[2] || 0);
    const w = watchlist.find((x) => x.key === c.watchKey);
    const stillInWindow = w && months.some((m) => m.year === year && (w.typicalMonths || []).includes(m.month));
    if (!stillInWindow) supersede.push(c.id);
  }

  // c) published events: recheck for changes to dates / venue / cancellation
  for (const e of live) {
    if (!inWindow(e.startDate, e.endDate)) continue;
    if (e.sourceRef && feedSourceIds.has(String(e.sourceRef).split(':')[0])) continue;   // a feed covers it
    const near = daysBetween(today, e.startDate) <= 45;
    const age = daysBetween(e.lastVerifiedOn || '1970-01-01', today);
    if (age < (near ? RECHECK_NEAR_DAYS : RECHECK_DAYS)) continue;
    if (propose({ kind: 'recheck', eventId: e.id, watchKey: e.watchKey || null, fingerprint: `recheck:${e.id}:${e.lastVerifiedOn || 'never'}`,
      proposed: pick(e, EVENT_FIELDS), current: pick(e, [...EVENT_FIELDS, 'status']), sourceId: 'recheck', sourceName: e.sourceName || 'Organiser', sourceUrl: e.sourceUrl || null, sourceCheckedAt: null, sourceRef: null,
      uncertainty: `No machine-readable source is configured for this event. Last verified ${e.lastVerifiedOn || 'never'}: reconfirm dates, venue and that it has not been cancelled.` })) stats.rechecks++;
  }
  return { create, touch: [...touch].map(([id, at]) => ({ id, lastSeen: at })), supersede, eventsConfirmed, stats, window: win };
}

// ---------- staff decisions ----------

export class ReviewError extends Error { constructor(code, message) { super(message); this.code = code; } }

export function validateEventFields(f, today) {
  const errors = [];
  for (const k of ['name', 'city', 'country', 'venue', 'timezone']) if (!f[k] || !String(f[k]).trim()) errors.push(`${k} is required`);
  if (!CATEGORIES.some((c) => c[0] === f.category)) errors.push('choose a category');
  if (!isIsoDate(f.startDate)) errors.push('start date must be a valid date');
  if (!isIsoDate(f.endDate)) errors.push('end date must be a valid date');
  if (isIsoDate(f.startDate) && isIsoDate(f.endDate)) {
    if (f.startDate > f.endDate) errors.push('start date is after the end date');
    const win = cal.windowBounds(today);
    if (f.endDate < today) errors.push('the event has already ended');
    if (f.startDate > win.end) errors.push(`the event starts after the calendar window (${win.end}); wait until it is inside the 12 months`);
  }
  if (f.timezone) { try { new Intl.DateTimeFormat('en', { timeZone: f.timezone }); } catch { errors.push('timezone must be a valid IANA zone, e.g. Europe/Paris'); } }
  return errors;
}

export function validateEditorial(ed) {
  const errors = [];
  const lede = (ed && ed.lede || '').trim();
  const ctx = ((ed && ed.context) || []).map((s) => String(s).trim()).filter(Boolean);
  if (lede.length < 20) errors.push('add a one-sentence Jettset lede (20+ characters)');
  if (ctx.join(' ').length < 120) errors.push('add original Jettset editorial context (120+ characters); pages without it would be thin');
  return errors;
}

// Returns the changes to persist. Throws ReviewError for invalid decisions. Never performs I/O.
export function applyDecision({ candidate, decision, notes = '', edits = {}, editorial = null, reviewer, now = new Date(), today, events = [] }) {
  if (!reviewer) throw new ReviewError('no_reviewer', 'A signed-in staff reviewer is required.');
  if (!['approve', 'reject', 'needs_verification'].includes(decision)) throw new ReviewError('bad_decision', 'Unknown decision.');
  if (!['pending', 'needs_verification'].includes(candidate.status)) throw new ReviewError('already_decided', 'This item has already been decided.');
  const nowIso = now.toISOString();
  const trimmed = String(notes || '').trim();
  const base = { candidatePatch: { status: null, verificationNotes: candidate.verificationNotes || null, decidedBy: reviewer, decidedAt: nowIso, decisionNotes: trimmed || null }, review: { candidateId: candidate.id, reviewerId: reviewer, decision, notes: trimmed || null, decidedAt: nowIso, before: candidate.current || null, after: null }, event: null };

  if (decision === 'reject') { base.candidatePatch.status = 'rejected'; return base; }
  if (decision === 'needs_verification') {
    if (trimmed.length < 3) throw new ReviewError('notes_required', 'Say what needs to be checked.');
    base.candidatePatch = { status: 'needs_verification', verificationNotes: trimmed, decidedBy: null, decidedAt: null, decisionNotes: null };
    base.review.after = { verification: trimmed };
    return base;
  }

  // approve
  const merged = { ...pick(candidate.proposed, [...EVENT_FIELDS, 'status']), ...Object.fromEntries(Object.entries(edits).filter(([, v]) => v != null && v !== '')) };
  const existing = candidate.eventId ? events.find((e) => e.id === candidate.eventId) : null;

  if (candidate.kind === 'cancellation' || merged.status === 'cancelled') {
    if (!existing) throw new ReviewError('no_event', 'The event to cancel could not be found.');
    base.event = { type: 'update', id: existing.id, patch: { status: 'cancelled', lastVerifiedOn: today } };
    base.review.after = { status: 'cancelled' }; base.candidatePatch.status = 'approved';
    return base;
  }

  const errors = validateEventFields({ ...merged }, today);
  if (errors.length) throw new ReviewError('invalid', `Cannot approve: ${errors.join('; ')}.`);

  if (existing) {                                      // change / recheck of a published event
    const patch = {};
    for (const f of EVENT_FIELDS) if (merged[f] !== existing[f]) patch[f] = merged[f];
    patch.lastVerifiedOn = today;
    if (editorial) {
      const ee = validateEditorial(editorial); if (ee.length) throw new ReviewError('invalid', `Cannot approve: ${ee.join('; ')}.`);
      patch.editorial = { ...(existing.editorial || {}), ...cleanEditorial(editorial) }; patch.editorialReviewedBy = reviewer; patch.editorialReviewedAt = nowIso;
    }
    base.event = { type: 'update', id: existing.id, patch };
    base.review.after = pick({ ...existing, ...patch }, [...EVENT_FIELDS, 'status']);
    base.candidatePatch.status = 'approved';
    return base;
  }

  // new event (feed item or manual-verification item)
  const ee = validateEditorial(editorial); if (ee.length) throw new ReviewError('invalid', `Cannot approve: ${ee.join('; ')}.`);
  const slug = slugFor(merged.name, merged.startDate, new Set(events.map((e) => e.slug)));
  const record = {
    slug, name: merged.name.trim(), category: merged.category, city: merged.city.trim(), country: merged.country.trim(), countryCode: (edits.countryCode || '').toUpperCase() || null,
    venue: merged.venue.trim(), startDate: merged.startDate, endDate: merged.endDate, timezone: merged.timezone, status: 'published',
    organiser: null, sourceName: candidate.sourceName || null, sourceUrl: candidate.sourceUrl || null, sourceRef: candidate.sourceRef || null, watchKey: candidate.watchKey || null,
    lastVerifiedOn: today, lastSourceCheckAt: candidate.sourceCheckedAt || null, editorial: cleanEditorial(editorial), editorialReviewedBy: reviewer, editorialReviewedAt: nowIso,
  };
  base.event = { type: 'insert', record };
  base.review.after = pick(record, [...EVENT_FIELDS, 'status']);
  base.candidatePatch.status = 'approved';
  return base;
}

export function cleanEditorial(ed) {
  const lines = (v) => (Array.isArray(v) ? v : String(v || '').split(/\n{2,}|\r\n\r\n/)).map((s) => String(s).trim()).filter(Boolean);
  const out = { lede: String(ed.lede || '').trim(), context: lines(ed.context), guidance: Array.isArray(ed.guidance) ? ed.guidance : [], airports: Array.isArray(ed.airports) ? ed.airports : [] };
  return out;
}

// ---------- public view ----------

// DB/repo event -> the public JSON shape (no source URLs, no private fields).
export function toPublic(e) {
  return { id: e.id, slug: e.slug, name: e.name, category: e.category, city: e.city, country: e.country, venue: e.venue, startDate: e.startDate, endDate: e.endDate, timezone: e.timezone, status: e.status === 'published' ? 'confirmed' : e.status, publication: e.status === 'published' ? 'published' : 'withdrawn' };
}
export function publicEvents(events, today) {
  return events.filter((e) => e.status === 'published').map(toPublic).filter(cal.isPublic).filter((e) => e.endDate >= today);
}
export function isIndexable(e) { return e.status === 'published' && !!e.editorialReviewedBy; }
export function sitemapEvents(events, today) {
  return events.filter((e) => isIndexable(e) && e.endDate >= addDays(today, -30));
}
function addDays(iso, n) { return new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10); }

// ---------- sync run reporting ----------
export function summariseRun({ enabledFeeds, results, watchlistCount, stats, error }) {
  const failed = results.filter((r) => !r.ok);
  let status, headline;
  if (error) { status = 'failed'; headline = `Sync failed: ${error}`; }
  else if (!enabledFeeds) { status = 'no_feeds'; headline = 'No verified machine-readable feeds are configured. This run only raised manual verification items from the curated watchlist and rechecks of published events.'; }
  else if (failed.length === enabledFeeds) { status = 'failed'; headline = `All ${enabledFeeds} configured feed(s) failed.`; }
  else if (failed.length) { status = 'partial'; headline = `${failed.length} of ${enabledFeeds} feeds failed; the rest were processed.`; }
  else if (results.every((r) => !r.items)) { status = 'empty'; headline = 'Feeds responded but returned no events in the 12-month window.'; }
  else { status = 'ok'; headline = 'All configured feeds were checked.'; }
  return { status, headline, enabledFeeds, failedFeeds: failed.map((r) => r.id), watchlistCount, stats };
}
