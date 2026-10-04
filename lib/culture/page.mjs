// Renders a Global Culture Calendar discovery page (pure; no I/O). Used by app/culture/events/[slug].
// Public pages keep visitors on Jettset: no links to organiser, venue or ticketing sites, and the
// call to action is the existing enquiry flow.
import { cal, isIndexable } from './domain.mjs';

export const SITE = 'https://jettsetglobal.com';
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const year = (iso) => iso.slice(0, 4);

export function pageUrl(slug) { return `${SITE}/culture/events/${slug}`; }

function structuredData(e) {
  // Only for indexable (staff-approved) pages; every field is also visible on the page.
  return {
    '@context': 'https://schema.org', '@type': 'Event',
    name: e.name, startDate: e.startDate, endDate: e.endDate,
    eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: { '@type': 'Place', name: e.venue || e.city, address: { '@type': 'PostalAddress', addressLocality: e.city, ...(e.countryCode ? { addressCountry: e.countryCode } : {}) } },
    description: (e.editorial && e.editorial.lede) || undefined, url: pageUrl(e.slug),
  };
}

export function renderEventPage(e, { airports = [] } = {}) {
  const ed = e.editorial || {};
  const indexable = isIndexable(e);
  const title = `${e.name}, ${e.city}`;
  const dates = cal.longRange(e.startDate, e.endDate);
  const metaDesc = `${e.name}, ${e.city}, ${dates}. A Jettset guide to planning your journey: timing, airports and travel notes.`;
  const canonical = pageUrl(e.slug);
  const prefillNote = `Event: ${e.name}, ${e.city} (${dates})`;
  const byCode = new Map(airports.map((a) => [a.code, a]));
  const apt = (ed.airports || []).map((c) => byCode.get(c)).filter(Boolean);
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
<link rel="stylesheet" href="/culture/culture-event.css?v=3">
${indexable ? `<script type="application/ld+json">${JSON.stringify(structuredData(e))}</script>\n` : ''}</head>
<body>
<header class="ce-top">
  <nav class="ce-nav" id="mainNav" aria-label="Site">
    <a class="ce-logo" href="/" aria-label="Jettset Global home"><img src="/images/nav-logo.png" alt="Jettset" width="120" height="34"></a>
    <div class="nav-tools ce-tools" id="navTools"></div>
  </nav>
</header>

<main class="ce-main">
  <p class="ce-crumb"><a href="/#culture-calendar">The Global Culture Calendar</a> <span aria-hidden="true">/</span> <span>${esc(e.city)}</span></p>
  <h1 class="ce-title">${esc(e.name)} ${year(e.startDate)}</h1>
  <p class="ce-meta"><time datetime="${e.startDate}">${esc(dates)}</time><br>${esc(e.city)}, ${esc(e.country)}${e.venue ? ' &middot; ' + esc(e.venue) : ''}</p>
  <p class="ce-lede">${esc(ed.lede || '')}</p>

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
${(ed.context || []).map((p) => `    <p>${esc(p)}</p>`).join('\n')}
  </section>
${(ed.guidance || []).length || apt.length ? `
  <section class="ce-section" aria-labelledby="ce-planning">
    <h2 id="ce-planning" class="ce-h2">Planning your journey</h2>
${(ed.guidance || []).map((g) => `    <h3 class="ce-h3">${esc(g.title)}</h3>\n    <p>${esc(g.body)}</p>`).join('\n')}
${apt.length ? `    <ul class="ce-airports" aria-label="Airports we plan with for ${esc(e.city)}">\n${apt.map((a) => `      <li><span>${esc(a.name)}</span> <span class="ce-code">${esc(a.code)}</span></li>`).join('\n')}\n    </ul>` : ''}
  </section>
` : ''}
  <p class="ce-actions">
    <a class="ce-cta" id="cePlan" href="/quote" data-city="${esc(e.city)}" data-note="${esc(prefillNote)}">Plan Your Journey <span aria-hidden="true">&#8599;</span></a>
  </p>
  <p class="ce-back"><a href="/#culture-calendar"><span aria-hidden="true">&larr;</span> Back to The Global Culture Calendar</a></p>

  <footer class="ce-foot">
    <p class="ce-checked">${e.lastVerifiedOn ? `Dates last checked <time datetime="${e.lastVerifiedOn}">${esc(cal.longDate(e.lastVerifiedOn))}</time>. ` : ''}Event details are set by the organiser and can change.</p>
    <p class="ce-disclaimer">Jettset is not affiliated with the organiser of this event, is not an official partner of it, and does not sell tickets or provide access to it. This page is Jettset&rsquo;s own planning guide.</p>
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
<script src="/i18n.js"></script>
</body>
</html>
`;
}

export function renderNotFound(status) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${status === 410 ? 'Event no longer listed' : 'Event not found'} | Jettset Global</title><link rel="stylesheet" href="/culture/culture-event.css?v=3"></head><body><main class="ce-main"><p class="ce-crumb"><a href="/#culture-calendar">The Global Culture Calendar</a></p><h1 class="ce-title">${status === 410 ? 'This event is no longer listed.' : 'We could not find that event.'}</h1><p class="ce-back"><a href="/#culture-calendar"><span aria-hidden="true">&larr;</span> Back to The Global Culture Calendar</a></p></main></body></html>`;
}

export function renderSitemap(events) {
  const urls = events.map((e) => `  <url>\n    <loc>${pageUrl(e.slug)}</loc>\n${e.lastVerifiedOn ? `    <lastmod>${e.lastVerifiedOn}</lastmod>\n` : ''}  </url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}${urls.length ? '\n' : ''}</urlset>\n`;
}
