// Meta-progression between runs. Pure functions over a plain JSON meta object.

import { MANSIONS, UNLOCKS, MAX_DEED } from '../data/mansions.js';

export function newMeta() {
  return {
    v: 1, ink: 0, totalInk: 0, runs: 0, wins: 0, owned: [], seenHelp: false,
    mansions: Object.fromEntries(MANSIONS.map((m) => [m.id, { wins: 0, best: 0, maxDeed: 0 }])),
    last: { mansionId: 'm1', deed: 0, deckId: 'standard' },
  };
}

// Fill in anything added since the save was made.
export function migrateMeta(meta) {
  const base = newMeta();
  if (!meta || meta.v !== 1) return base;
  const m = { ...base, ...meta, mansions: { ...base.mansions, ...meta.mansions }, last: { ...base.last, ...meta.last } };
  return m;
}

export function mansionUnlocked(meta, i) {
  return i === 0 || (meta.mansions[MANSIONS[i - 1].id]?.wins || 0) > 0;
}

export function ownedOf(meta, kind) {
  return UNLOCKS.filter((u) => u.kind === kind && meta.owned.includes(u.id)).map((u) => u.ref);
}
export const availableDecks = (meta) => ['standard', ...ownedOf(meta, 'deck')];

export function runOptions(meta, { mansionId, deed, deckId, seed }) {
  return { seed, mansionId, deed, deckId, unlockedRooms: ownedOf(meta, 'room'), perks: ownedOf(meta, 'perk') };
}

// Apply a finished run. Returns { meta, news: [strings] }.
export function applyResult(prev, run) {
  const meta = structuredClone(prev);
  const r = run.result;
  const news = [];
  meta.runs++;
  meta.ink += r.ink;
  meta.totalInk += r.ink;
  const ms = meta.mansions[run.mansionId];
  if (r.won) {
    meta.wins++;
    if (ms.wins === 0) {
      const i = MANSIONS.findIndex((m) => m.id === run.mansionId);
      if (MANSIONS[i + 1]) news.push(`New mansion unlocked: ${MANSIONS[i + 1].name}`);
    }
    ms.wins++;
    if (r.score > ms.best) { ms.best = r.score; news.push(`New best score: ${r.score}`); }
    if (run.deed === ms.maxDeed && ms.maxDeed < MAX_DEED) { ms.maxDeed++; news.push(`Deed ${ms.maxDeed} unlocked for this mansion`); }
  }
  return { meta, news };
}

export function buyUnlock(prev, id) {
  const u = UNLOCKS.find((x) => x.id === id);
  if (!u) throw new Error('Unknown unlock');
  if (prev.owned.includes(id)) throw new Error('Already owned');
  if (prev.ink < u.cost) throw new Error('Not enough Ink');
  const meta = structuredClone(prev);
  meta.ink -= u.cost;
  meta.owned.push(id);
  return meta;
}
