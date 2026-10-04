import { NextResponse } from "next/server";
import { loadEvents } from "@/lib/culture/public-data";
import { cal, publicEvents } from "@/lib/culture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public, read-only: approved events inside the rolling 12-month window. Nothing private is returned
// (no source links, review notes or drafts). Staff decisions in the Partner Hub are the only writers.
export async function GET() {
  const today = cal.londonToday();
  const { events, source } = await loadEvents();
  const win = cal.windowBounds(today);
  const list = publicEvents(events, today).filter((e: { startDate: string }) => e.startDate <= win.end);
  return NextResponse.json(
    { generatedAt: new Date().toISOString(), today, window: win, range: cal.rangeLabel(cal.rollingMonths(today)), source, events: list },
    { headers: { "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=900" } },
  );
}
