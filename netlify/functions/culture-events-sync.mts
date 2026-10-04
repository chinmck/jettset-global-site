// Weekly Global Culture Calendar sync (Mondays 05:17 UTC; see netlify.toml). Server-side only.
// Checks the verified feeds (none are enabled yet), raises manual-verification items from the
// curated watchlist, and rechecks published events. Everything lands in the Partner Hub review
// queue (Postgres). It never publishes, edits or removes public event data: staff decide.
import { runCultureSync } from "../../lib/culture/sync.mjs";
import { dbRepo } from "../../lib/culture/repo-db";
import sourcesConfig from "../config/culture-sources.json";
import watchlistConfig from "../config/culture-watchlist.json";

export default async () => {
  if (!process.env.DATABASE_URL) {
    console.error("culture sync: DATABASE_URL is not set; nothing was recorded");
    return new Response("Database not configured", { status: 503 });
  }
  try {
    const run = await runCultureSync({ repo: dbRepo(), sources: sourcesConfig.sources, watchlist: watchlistConfig.watchlist, trigger: "schedule" });
    console.log("culture sync finished", JSON.stringify({ status: run.status, created: run.created, headline: run.headline }));
    return new Response(JSON.stringify({ status: run.status, created: run.created, headline: run.headline }), { status: run.status === "failed" ? 500 : 200, headers: { "content-type": "application/json" } });
  } catch (error) {
    console.error("culture sync aborted", error instanceof Error ? error.message : error);
    return new Response("culture sync aborted", { status: 500 });
  }
};
