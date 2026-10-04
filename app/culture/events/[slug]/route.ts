/* eslint-disable @typescript-eslint/no-explicit-any */
import { loadEvents } from "@/lib/culture/public-data";
import { renderEventPage, renderNotFound } from "@/lib/culture";
import airportDb from "../../../../public/data/private-jet-airports.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const html = (body: string, status = 200, cache = "public, max-age=0, s-maxage=300, stale-while-revalidate=900") =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": cache, ...(status === 200 ? {} : { "x-robots-tag": "noindex" }) } });

// Discovery page for an approved event. Unapproved, rejected and unknown slugs return 404; an event
// that was approved and later cancelled returns 410. Nothing here links off-site.
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const { events } = await loadEvents();
  const e = events.find((x: { slug: string }) => x.slug === slug);
  if (!e) return html(renderNotFound(404), 404, "public, max-age=0, s-maxage=60");
  if (e.status !== "published") return html(renderNotFound(410), 410, "public, max-age=0, s-maxage=300");
  return html(renderEventPage(e, { airports: airportDb as any }));
}
