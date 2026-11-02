// Meta-progression between runs. Pure functions over a plain JSON meta object.

import { MANSIONS, UNLOCKS, MAX_DEED } from '../data/mansions.js';
import { ROOMS, isDraftable } from '../data/rooms.js';
import { UPGRADES, BASE_SLOTS, upgradeById } from '../data/progression.js';

export function newMeta() {
  return {
    v: 2, ink: 0, totalInk: 0, runs: 0, wins: 0, owned: [], seenHelp: false,
    upgrades: {}, collection: [], equipped: [], heirloomsFound: [], startHeirloom: null, pendingKeep: null, discoveries: [],
    mansions: Object.fromEntries(MANSIONS.map((m) => [m.id, { wins: 0, best: 0, maxDeed: 0, losses: 0 }])),
    last: { mansionId: 'm1', deed: 0, deckId: 'standard' },
  };
}

// Fill in anything added since the save was made.
export function migrateMeta(meta) {
  const base = newMeta();
  if (!meta) return base;
  if (meta.v === 1) {
    // V2 reset: keep settings and the help flag, credit some Ink for past effort.
    return { ...base, seenHelp: !!meta.seenHelp, ink: Math.min(60, Math.floor((meta.totalInk || 0) * 0.3)), migratedFromV1: true };
  }
  if (meta.v !== 2) return base;
  const mansions = Object.fromEntries(Object.entries(base.mansions).map(([k, v]) => [k, { ...v, ...(meta.mansions || {})[k] }]));
  const m = { ...base, ...meta, mansions, last: { ...base.last, ...meta.last } };
  if (!m.discoveries) m.discoveries = [];
  return m;
}

export function mansionUnlocked(meta, i) {
  return i === 0 || (meta.mansions[MANSIONS[i - 1].id]?.wins || 0) > 0;
}

export function ownedOf(meta, kind) {
  return UNLOCKS.filter((u) => u.kind === kind && meta.owned.includes(u.id)).map((u) => u.ref);
}
export const availableDecks = (meta) => ['standard', ...ownedOf(meta, 'deck')];
export const upgradeLevel = (meta, id) => meta.upgrades[id] || 0;
export const blueprintSlots = (meta) => BASE_SLOTS + upgradeLevel(meta, 'table');
export const hasFamilyChest = (meta) => ownedOf(meta, 'perk').includes('heirloom');

export function runOptions(meta, { mansionId, deed, deckId, seed }) {
  return {
    seed, mansionId, deed, deckId,
    unlockedRooms: ownedOf(meta, 'room'),
    perks: ownedOf(meta, 'perk'),
    upgrades: { ...meta.upgrades },
    extraCards: meta.equipped.slice(0, blueprintSlots(meta)),
    startHeirloom: hasFamilyChest(meta) && meta.heirloomsFound.includes(meta.startHeirloom) ? meta.startHeirloom : null,
    discoveredRooms: meta.discoveries || [],
  };
}

const RANK = { legendary: 0, rare: 1, uncommon: 2, common: 3 };

// Up to 3 rooms you placed this run (rarest first) that aren't already in your collection.
export function keepOffer(meta, run) {
  const ids = [...new Set((run.cells || []).filter((c) => c && c.id && !c.preset && isDraftable(c.id)).map((c) => c.id))]
    .filter((id) => !meta.collection.includes(id));
  ids.sort((a, b) => RANK[ROOMS[a].rarity] - RANK[ROOMS[b].rarity] || ROOMS[a].name.localeCompare(ROOMS[b].name));
  return ids.slice(0, 3);
}

// Apply a finished run. Returns { meta, news: [strings] }.
export function applyResult(prev, run) {
  const meta = structuredClone(prev);
  const r = run.result;
  const news = [];
  meta.runs++;
  meta.ink += r.ink;
  meta.totalInk += r.ink;
  for (const h of run.heirlooms || []) if (!meta.heirloomsFound.includes(h)) { meta.heirloomsFound.push(h); news.push('New heirloom recorded in your Archive'); }
  for (const d of run.discoveredThisRun || []) if (!meta.discoveries.includes(d)) { meta.discoveries.push(d); news.push(`New room discovered: ${ROOMS[d]?.name || d}`); }
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
  } else ms.losses = (ms.losses || 0) + 1;
  meta.pendingKeep = keepOffer(meta, run);
  if (!meta.pendingKeep.length) meta.pendingKeep = null;
  return { meta, news: [...new Set(news)] };
}

export function keepBlueprint(prev, id) {
  if (!prev.pendingKeep || !prev.pendingKeep.includes(id)) throw new Error('Not on offer');
  const meta = structuredClone(prev);
  meta.collection.push(id);
  if (meta.equipped.length < blueprintSlots(meta)) meta.equipped.push(id);
  meta.pendingKeep = null;
  return meta;
}
export function skipKeep(prev) { return { ...prev, pendingKeep: null }; }

export function toggleEquip(prev, id) {
  if (!prev.collection.includes(id)) throw new Error('Not in your collection');
  const meta = structuredClone(prev);
  const i = meta.equipped.indexOf(id);
  if (i >= 0) meta.equipped.splice(i, 1);
  else {
    if (meta.equipped.length >= blueprintSlots(meta)) throw new Error('All Blueprint slots are full');
    meta.equipped.push(id);
  }
  return meta;
}

export function setStartHeirloom(prev, id) {
  if (id && !prev.heirloomsFound.includes(id)) throw new Error('Not found yet');
  return { ...prev, startHeirloom: id };
}

export function upgradeCost(meta, id) {
  const u = upgradeById(id);
  const lvl = upgradeLevel(meta, id);
  return lvl >= u.max ? null : u.costs[lvl];
}
export function buyUpgrade(prev, id) {
  const cost = upgradeCost(prev, id);
  if (cost === null) throw new Error('Already maxed');
  if (prev.ink < cost) throw new Error('Not enough Ink');
  const meta = structuredClone(prev);
  meta.ink -= cost;
  meta.upgrades[id] = upgradeLevel(prev, id) + 1;
  return meta;
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

export { UPGRADES };
