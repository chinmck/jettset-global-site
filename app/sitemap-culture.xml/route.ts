import { loadEvents } from "@/lib/culture/public-data";
import { cal, sitemapEvents, renderSitemap } from "@/lib/culture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Only approved, staff-signed-off events enter the sitemap (pending, rejected and cancelled never do).
export async function GET() {
  const { events } = await loadEvents();
  const list = sitemapEvents(events, cal.londonToday());
  return new Response(renderSitemap(list), { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=900" } });
}
