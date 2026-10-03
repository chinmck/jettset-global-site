#!/usr/bin/env node
/* Generates the Global Culture Calendar event pages and sitemap from public/data/culture/events.json.
     node scripts/build-culture-pages.mjs          write public/culture/events/<slug>/index.html + sitemap
     node scripts/build-culture-pages.mjs --check  fail if the committed output is out of date
   A page is indexable (robots index, sitemap entry, Event structured data) only when the event is
   published AND its editorial.reviewed is set by a person (see docs/culture-calendar.md). */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCultureLib } from './culture-lib-loader.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lib = loadCultureLib();
const SITE = 'https://jettsetglobal.com';
const checkOnly = process.argv.includes('--check');

const data = JSON.parse(readFileSync(join(root, 'public/data/culture/events.json'), 'utf8'));
const airportDb = JSON.parse(readFileSync(join(root, 'public/data/private-jet-airports.json'), 'utf8'));
const airportByCode = new Map(airportDb.map((a) => [a.code, a]));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const year = (iso) => iso.slice(0, 4);

export function isIndexable(e) {
  return lib.isPublic(e) && !!(e.editorial && e.editorial.reviewed && e.editorial.reviewed.by && e.editorial.reviewed.on);
}

export function validateEvent(e) {
  const errors = [];
  for (const k of ['id', 'slug', 'name', 'city', 'country', 'countryCode', 'startDate', 'endDate', 'timezone', 'officialUrl', 'status', 'publication', 'lastChecked']) {
    if (!e[k]) errors.push(`${e.id || '?'}: missing ${k}`);
  }
  if (!e.source || !e.source.id) errors.push(`${e.id}: missing source.id`);
  if (e.slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.slug)) errors.push(`${e.id}: slug must be lowercase-hyphenated`);
  if (e.officialUrl && !/^https:\/\//.test(e.officialUrl)) errors.push(`${e.id}: officialUrl must be https`);
  if (e.startDate && e.endDate && e.startDate > e.endDate) errors.push(`${e.id}: start after end`);
  const ed = e.editorial || {};
  if (!ed.lede || !(ed.context || []).length || !(ed.guidance || []).length) errors.push(`${e.id}: editorial copy incomplete (lede, context, guidance)`);
  for (const c of ed.airports || []) if (!airportByCode.has(c)) errors.push(`${e.id}: airport ${c} not in private-jet-airports.json`);
  return errors;
}

function structuredData(e) {
  // Only for reviewed, indexable pages; every field is also visible on the page.
  const url = `${SITE}/culture/events/${e.slug}/`;
  return {
    '@context': 'https://schema.org', '@type': 'Event',
    name: `${e.name} ${year(e.startDate)}`,
    startDate: e.startDate, endDate: e.endDate,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place', name: e.venue || e.city,
      address: { '@type': 'PostalAddress', addressLocality: e.city, addressCountry: e.countryCode }
    },
    organizer: { '@type': 'Organization', name: e.organiser, url: e.officialUrl },
    description: e.editorial.lede,
    url
  };
}

export function renderPage(e) {
  const ed = e.editorial;
  const indexable = isIndexable(e);
  const title = `${e.name} ${year(e.startDate)}, ${e.city}`;
  const dates = lib.longRange(e.startDate, e.endDate);
  const metaDesc = `${e.name}, ${e.city}, ${dates}. A Jettset guide to planning your journey: timing, airports and what to confirm with the organiser.`;
  const canonical = `${SITE}/culture/events/${e.slug}/`;
  const airports = (ed.airports || []).map((c) => airportByCode.get(c)).filter(Boolean);
  const prefillNote = `Event: ${e.name}, ${e.city} (${dates})`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | The Global Culture Calendar | Jettset Global</title>
<meta name="description" content="${esc(metaDesc)}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="${indexable ? 'index, follow' : 'noindex, follow'}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)} | Jettset Global">
<meta property="og:description" content="${esc(metaDesc)}">
<meta property="og:url" content="${canonical}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,500&display=swap">
<link rel="stylesheet" href="/culture/culture-event.css?v=1">
${indexable ? `<script type="application/ld+json">${JSON.stringify(structuredData(e))}</script>\n` : ''}</head>
<body>
<header class="ce-top">
  <a class="ce-logo" href="/" aria-label="Jettset Global home"><img src="/images/nav-logo.png" alt="Jettset" width="120" height="34"></a>
</header>

<main class="ce-main">
  <p class="ce-crumb"><a href="/#culture-calendar">The Global Culture Calendar</a> <span aria-hidden="true">/</span> <span>${esc(e.city)}</span></p>
  <h1 class="ce-title">${esc(e.name)} ${year(e.startDate)}</h1>
  <p class="ce-meta"><time datetime="${e.startDate}">${esc(dates)}</time><br>${esc(e.city)}, ${esc(e.country)}${e.venue ? ' &middot; ' + esc(e.venue) : ''}</p>
  <p class="ce-lede">${esc(ed.lede)}</p>

  <figure class="ce-figure">
    <picture>
      <source type="image/avif" srcset="/images/inside-house/culture/inside-house-culture-desktop.avif">
      <source type="image/webp" srcset="/images/inside-house/culture/inside-house-culture-desktop.webp">
      <img src="/images/inside-house/culture/inside-house-culture-desktop.jpg" width="1728" height="2160" alt="A framed artwork and a vinyl record resting on a workbench in a dark studio, lit by evening light from a window" loading="lazy">
    </picture>
    <figcaption>Jettset editorial image. It is not from the event.</figcaption>
  </figure>

  <section class="ce-section" aria-labelledby="ce-context">
    <h2 id="ce-context" class="ce-h2">The week in context</h2>
${ed.context.map((p) => `    <p>${esc(p)}</p>`).join('\n')}
  </section>

  <section class="ce-section" aria-labelledby="ce-planning">
    <h2 id="ce-planning" class="ce-h2">Planning your journey</h2>
${ed.guidance.map((g) => `    <h3 class="ce-h3">${esc(g.title)}</h3>\n    <p>${esc(g.body)}</p>`).join('\n')}
${airports.length ? `    <ul class="ce-airports" aria-label="Airports we plan with for ${esc(e.city)}">\n${airports.map((a) => `      <li><span>${esc(a.name)}</span> <span class="ce-code">${esc(a.code)}</span></li>`).join('\n')}\n    </ul>` : ''}
  </section>

  <section class="ce-section" aria-labelledby="ce-official">
    <h2 id="ce-official" class="ce-h2">Official information</h2>
    <p>Programme, access and ticketing are managed by the organiser. For the latest details, go to <a class="ce-link" href="${esc(e.officialUrl)}" target="_blank" rel="noopener noreferrer">${esc(e.organiser)}&rsquo;s official information<span aria-hidden="true"> &#8599;</span></a>.</p>
  </section>

  <p class="ce-actions">
    <a class="ce-cta" id="cePlan" href="/quote" data-city="${esc(e.city)}" data-note="${esc(prefillNote)}">Plan Your Journey <span aria-hidden="true">&#8599;</span></a>
  </p>
  <p class="ce-back"><a href="/#culture-calendar"><span aria-hidden="true">&larr;</span> Back to The Global Culture Calendar</a></p>

  <footer class="ce-foot">
    <p class="ce-checked">Dates last checked <time datetime="${e.lastChecked}">${esc(lib.longDate(e.lastChecked))}</time>. Event details are published by the organiser and can change.</p>
    <p class="ce-disclaimer">Jettset is not affiliated with ${esc(e.organiser)}, is not an official partner of the event, and does not sell tickets or provide access to it. This page is Jettset&rsquo;s own planning guide.</p>
  </footer>
</main>

<script>
  /* Hands the destination and event to the existing enquiry flow (quote.html reads these keys). */
  (function () {
    var a = document.getElementById('cePlan');
    if (!a) return;
    a.addEventListener('click', function () {
      try {
        sessionStorage.setItem('prefill_qTo', a.getAttribute('data-city'));
        sessionStorage.setItem('prefill_qNotes', a.getAttribute('data-note'));
      } catch (e) { /* storage unavailable: the plain link still works */ }
    });
  })();
</script>
</body>
</html>
`;
}

export function renderSitemap(events) {
  const urls = events.filter(isIndexable).map((e) =>
    `  <url>\n    <loc>${SITE}/culture/events/${e.slug}/</loc>\n    <lastmod>${e.lastChecked}</lastmod>\n  </url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}${urls.length ? '\n' : ''}</urlset>\n`;
}

function main() {
  const errors = data.events.flatMap(validateEvent);
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  const outputs = new Map();
  for (const e of data.events.filter(lib.isPublic)) outputs.set(join(root, 'public/culture/events', e.slug, 'index.html'), renderPage(e));
  outputs.set(join(root, 'public/sitemap-culture.xml'), renderSitemap(data.events));

  if (checkOnly) {
    const stale = [...outputs].filter(([p, c]) => !existsSync(p) || readFileSync(p, 'utf8') !== c).map(([p]) => p);
    if (stale.length) { console.error('Out of date (run: node scripts/build-culture-pages.mjs):\n' + stale.join('\n')); process.exit(1); }
    console.log('Culture pages up to date.'); return;
  }
  // remove pages of events that are no longer published
  const dir = join(root, 'public/culture/events');
  if (existsSync(dir)) for (const d of readdirSync(dir)) if (![...outputs.keys()].some((p) => p === join(dir, d, 'index.html'))) rmSync(join(dir, d), { recursive: true, force: true });
  for (const [p, c] of outputs) { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, c); }
  console.log(`Wrote ${outputs.size} files (${data.events.filter(isIndexable).length} indexable).`);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
