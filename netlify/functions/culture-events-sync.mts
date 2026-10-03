// Scheduled daily (see netlify.toml). Server-side only: the browser never fetches event feeds.
// Checks the allowlisted official feeds in netlify/config/culture-sources.json and records new or
// changed events as PENDING REVIEW in Netlify Blobs. It does not publish anything and never
// replaces published events, so a failing feed leaves the live calendar exactly as it was.
import { runSync } from "../../lib/culture/sync.mjs";
import { culturePendingStore } from "../../lib/culture/blob-store.mts";
import sourcesConfig from "../config/culture-sources.json";
import published from "../../public/data/culture/events.json";

export default async () => {
  try {
    const run = await runSync({
      sources: sourcesConfig.sources,
      published: published.events,
      store: culturePendingStore(),
    });
    console.log("culture sync finished", JSON.stringify({ failures: run.failures, newPending: run.newPending, changedPending: run.changedPending, note: run.note }));
    return new Response(JSON.stringify(run), { status: 200, headers: { "content-type": "application/json" } });
  } catch (error) {
    // Storage unavailable etc.: log and exit without touching anything.
    console.error("culture sync aborted", error instanceof Error ? error.message : error);
    return new Response("culture sync aborted", { status: 500 });
  }
};
