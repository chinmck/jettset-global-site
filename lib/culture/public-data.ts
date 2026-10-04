import { dbRepo } from "./repo-db";
import { cultureSnapshot } from "./config";

/* eslint-disable @typescript-eslint/no-explicit-any */
// Approved events for the public site. The database is the source of truth; the bundled snapshot
// (public/data/culture/events.json, the three events approved with the mock-up) is used only when
// the database cannot be reached or the culture tables have not been created yet, so the public
// calendar never goes blank because of an infrastructure problem. Returns where the data came from.
export async function loadEvents(): Promise<{ events: any[]; source: "database" | "snapshot"; error?: string }> {
  try {
    const events = await dbRepo().listEvents();
    return { events, source: "database" };
  } catch (error) {
    return { events: snapshotEvents(), source: "snapshot", error: error instanceof Error ? error.message : String(error) };
  }
}

export function snapshotEvents(): any[] {
  return cultureSnapshot.map((e) => ({
    id: e.id, slug: e.slug, name: e.name, category: e.category ?? "art-design-architecture", city: e.city, country: e.country, countryCode: e.countryCode ?? null,
    venue: e.venue, startDate: e.startDate, endDate: e.endDate, timezone: e.timezone, status: "published", organiser: e.organiser ?? null,
    lastVerifiedOn: e.lastChecked ?? null, editorial: e.editorial ?? null, editorialReviewedBy: e.editorial?.reviewed?.by ?? null,
  }));
}
