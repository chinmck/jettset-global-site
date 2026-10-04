// In-memory repository (tests / local dev). Same interface as repo-db.ts.
import { randomUUID } from 'node:crypto';
export function memoryRepo(seed = {}) {
  const events = new Map(), cands = new Map(), reviews = [], runs = [], states = new Map();
  for (const e of seed.events || []) events.set(e.id || (e.id = randomUUID()), { lastVerifiedOn: null, lastSourceCheckAt: null, editorial: null, editorialReviewedBy: null, ...e });
  for (const c of seed.candidates || []) cands.set(c.id || (c.id = randomUUID()), { ...c });
  const clone = (o) => (o == null ? o : structuredClone(o));
  return {
    _events: events, _cands: cands, _reviews: reviews, _runs: runs, _states: states,
    async listEvents() { return [...events.values()].map(clone); },
    async getEvent(id) { return clone(events.get(id)); },
    async getEventBySlug(slug) { return clone([...events.values()].find((e) => e.slug === slug)); },
    async insertEvent(r) { const e = { id: randomUUID(), lastVerifiedOn: null, lastSourceCheckAt: null, editorial: null, editorialReviewedBy: null, ...r }; events.set(e.id, e); return clone(e); },
    async updateEvent(id, patch) { const e = events.get(id); if (!e) throw new Error('event not found'); Object.assign(e, patch); return clone(e); },
    async listCandidates(filter) { return [...cands.values()].filter((c) => !filter || !filter.status || filter.status.includes(c.status)).map(clone); },
    async getCandidate(id) { return clone(cands.get(id)); },
    async insertCandidate(c) { const x = { id: randomUUID(), decidedBy: null, decidedAt: null, decisionNotes: null, ...c }; cands.set(x.id, x); return clone(x); },
    async updateCandidate(id, patch) { const c = cands.get(id); if (!c) throw new Error('candidate not found'); Object.assign(c, patch); return clone(c); },
    async commitDecision({ candidate, result, audit }) {          // atomic: roll back everything on failure
      const snap = { e: structuredClone([...events]), c: structuredClone([...cands]), r: structuredClone(reviews) };
      try {
        if (this._failNextCommit) { this._failNextCommit = false; throw new Error('simulated write failure'); }
        let patch = result.candidatePatch;
        if (result.event?.type === 'insert') { const e = await this.insertEvent(result.event.record); patch = { ...patch, eventId: e.id }; }
        else if (result.event?.type === 'update') await this.updateEvent(result.event.id, result.event.patch);
        await this.updateCandidate(candidate.id, patch);
        await this.insertReview(result.review);
        (this._audit ||= []).push(audit);
      } catch (e) {
        events.clear(); snap.e.forEach(([k, v]) => events.set(k, v)); cands.clear(); snap.c.forEach(([k, v]) => cands.set(k, v)); reviews.length = 0; reviews.push(...snap.r);
        throw e;
      }
    },
    async commitEventUpdate(id, patch, audit) { await this.updateEvent(id, patch); (this._audit ||= []).push(audit); },
    async insertReview(r) { reviews.push({ id: randomUUID(), ...r }); },
    async listReviews(n = 50) { return reviews.slice(-n).reverse().map(clone); },
    async recordRun(r) { runs.push(clone(r)); },
    async listRuns(n = 20) { return runs.slice(-n).reverse().map(clone); },
    async upsertSourceState(s) { states.set(s.id, { ...states.get(s.id), ...s }); },
    async getSourceState(id) { return clone(states.get(id)); },
    async listSourceStates() { return [...states.values()].map(clone); },
  };
}
