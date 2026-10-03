// Read-only review report for the calendar sync (plus "dismiss" for a pending item).
//   GET  /.netlify/functions/culture-review            -> pending items, last run, source health
//   POST /.netlify/functions/culture-review  {"key":"pending/…","action":"dismiss"}
// Requires the CULTURE_REVIEW_TOKEN env var (Authorization: Bearer <token>). Approving an item means
// a person edits public/data/culture/events.json (with Jettset editorial copy) and merges it; this
// endpoint can never publish.
import { timingSafeEqual } from "node:crypto";
import { culturePendingStore } from "../../lib/culture/blob-store";

function authorised(req: Request) {
  const token = process.env.CULTURE_REVIEW_TOKEN;
  if (!token) return "unconfigured";
  const given = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(given), b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b) ? "ok" : "denied";
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export default async (req: Request) => {
  const auth = authorised(req);
  if (auth === "unconfigured") return json({ error: "CULTURE_REVIEW_TOKEN is not set" }, 503);
  if (auth === "denied") return json({ error: "unauthorised" }, 401);

  const store = culturePendingStore();
  if (req.method === "POST") {
    let body: { key?: string; action?: string } = {};
    try { body = await req.json(); } catch { return json({ error: "invalid JSON" }, 400); }
    if (body.action !== "dismiss" || !body.key || !body.key.startsWith("pending/")) return json({ error: "expected {key:'pending/…', action:'dismiss'}" }, 400);
    await store.delete(body.key);
    return json({ dismissed: body.key });
  }
  if (req.method !== "GET") return json({ error: "method not allowed" }, 405);

  const keys = await store.list("pending/");
  const pending = [];
  for (const k of keys) { const v = await store.get(k); if (v) pending.push(v); }
  const sourceKeys = await store.list("sources/");
  const sources: Record<string, unknown> = {};
  for (const k of sourceKeys) sources[k.replace("sources/", "")] = await store.get(k);
  return json({ lastRun: await store.get("runs/latest"), pending, sources });
};
