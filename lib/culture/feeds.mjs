// Feed parsing for the Global Culture Calendar sync. Pure functions, no network.
// Only structured, official feeds are read (ICS/iCalendar or a JSON API). Nothing is scraped.

const pad = (n) => String(n).padStart(2, '0');

function unfold(text) {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}
function unescapeText(v) {
  return v.replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/\;/g, ';').replace(/\\\\/g, '\\').trim();
}
function isoInZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  return parts; // en-CA -> YYYY-MM-DD
}
// DTSTART/DTEND value -> {iso, allDay}. UTC date-times are converted into the source's timezone.
function icsDate(value, timeZone) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z?))?$/.exec(value.trim());
  if (!m) return null;
  if (m[4] === undefined) return { iso: `${m[1]}-${m[2]}-${m[3]}`, allDay: true };
  if (m[7] === 'Z') {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
    return { iso: isoInZone(d, timeZone || 'UTC'), allDay: false };
  }
  return { iso: `${m[1]}-${m[2]}-${m[3]}`, allDay: false };   // floating / TZID local time: keep the written date
}
function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function parseIcs(text, { timeZone = 'UTC' } = {}) {
  const events = [];
  let cur = null;
  for (const line of unfold(text)) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') {
      if (cur && cur.uid && cur.name && cur.startDate) {
        if (!cur.endDate) cur.endDate = cur.startDate;
        events.push(cur);
      }
      cur = null; continue;
    }
    if (!cur) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const name = line.slice(0, idx).split(';')[0].toUpperCase();
    const val = line.slice(idx + 1);
    if (name === 'UID') cur.uid = val.trim();
    else if (name === 'SUMMARY') cur.name = unescapeText(val);
    else if (name === 'LOCATION') cur.location = unescapeText(val);
    else if (name === 'URL') cur.url = val.trim();
    else if (name === 'STATUS') cur.status = val.trim().toUpperCase() === 'CANCELLED' ? 'cancelled' : 'confirmed';
    else if (name === 'DTSTART') { const d = icsDate(val, timeZone); if (d) cur.startDate = d.iso; }
    else if (name === 'DTEND') { const d = icsDate(val, timeZone); if (d) cur.endDate = d.allDay ? addDays(d.iso, -1) : d.iso; }   // all-day DTEND is exclusive
  }
  return events.map((e) => ({ status: 'confirmed', ...e, endDate: e.endDate < e.startDate ? e.startDate : e.endDate }));
}

function pick(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
const isoPart = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

// Generic JSON adapter, driven by the source's `mapping` (dotted paths) in culture-sources.json.
export function parseJsonFeed(json, mapping) {
  const items = mapping.itemsPath ? pick(json, mapping.itemsPath) : json;
  if (!Array.isArray(items)) throw new Error('JSON feed: itemsPath did not resolve to an array');
  const out = [];
  for (const it of items) {
    const uid = pick(it, mapping.uid), name = pick(it, mapping.name);
    const startDate = isoPart(pick(it, mapping.start)), endDate = isoPart(pick(it, mapping.end)) || startDate;
    if (!uid || !name || !startDate) continue;
    const raw = mapping.status ? String(pick(it, mapping.status) || '').toLowerCase() : '';
    out.push({
      uid: String(uid), name: String(name), startDate, endDate,
      city: mapping.city ? pick(it, mapping.city) : undefined,
      country: mapping.country ? pick(it, mapping.country) : undefined,
      url: mapping.url ? pick(it, mapping.url) : undefined,
      status: /cancel/.test(raw) ? 'cancelled' : 'confirmed'
    });
  }
  return out;
}
