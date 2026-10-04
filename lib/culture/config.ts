// Static configuration bundled with the app (reviewed in git): verified feeds and the curated watchlist.
import sourcesConfig from "../../netlify/config/culture-sources.json";
import watchlistConfig from "../../netlify/config/culture-watchlist.json";
import snapshot from "../../public/data/culture/events.json";

export const cultureSources = sourcesConfig.sources as Array<Record<string, unknown>>;
export const cultureWatchlist = watchlistConfig.watchlist as Array<Record<string, unknown>>;
// Last-known-good snapshot of the approved events, used only when the database is unreachable.
export const cultureSnapshot = snapshot.events as Array<Record<string, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
