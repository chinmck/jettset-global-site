import { getStore } from "@netlify/blobs";

// Adapts a Netlify Blobs store to the small interface lib/culture/sync.mjs expects.
export function culturePendingStore() {
  const s = getStore({ name: "culture-events", consistency: "strong" });
  return {
    async get(key: string) { return (await s.get(key, { type: "json" })) ?? null; },
    async set(key: string, value: unknown) { await s.setJSON(key, value); },
    async delete(key: string) { await s.delete(key); },
    async list(prefix: string) {
      const { blobs } = await s.list({ prefix });
      return blobs.map((b: { key: string }) => b.key);
    },
  };
}
