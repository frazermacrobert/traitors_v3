// Pure, deterministic game engine. No DOM. State is plain JSON.
// act(state, action) returns a NEW state, or throws on an invalid action.

import { ROOMS, SHAPES, RARITIES, isDraftable } from '../data/rooms.js';
import { HEIRLOOMS, MAX_HEIRLOOMS } from '../data/heirlooms.js';
import { MANSIONS, CURSES, DEEDS, DECKS, PERKS } from '../data/mansions.js';
import { rand, shuffle, hashSeed } from './rng.js';
import { UPGRADES } from '../data/progression.js';

export const DIRS = [[-1, 0], [0, 1], [1, 0], [0, -1]]; // [dr, dc] for N, E, S, W
export const DIR_NAMES = ['N', 'E', 'S', 'W'];
export const opp = (d) => (d + 2) % 4;
export const BASE_DRAW = 3;
export const BASE_RESHUFFLE = 2;

export function rotateDoors(doors, rot) {
  const out = [0, 0, 0, 0];
  for (let d = 0; d < 4; d++) if (doors[d]) out[(d + rot) % 4] = 1;
  return out;
}
export const roomDoors = (id, rot) => rotateDoors(SHAPES[ROOMS[id].shape].doors, rot);
export const mansionById = (id) => MANSIONS.find((m) => m.id === id);
const key = (r, c) => `${r},${c}`;
const lockKey = (r, c, d) => `${r},${c},${d}`;

export function cellAt(s, r, c) {
  if (r < 0 || c < 0 || r >= s.h || c >= s.w) return undefined; // out of bounds
  return s.cells[r * s.w + c];
}
function setCell(s, r, c, v) { s.cells[r * s.w + c] = v; }

// ---------- modifiers ----------
export function getMods(s) {
  const mods = [];
  const deck = DECKS[s.deckId];
  if (deck) mods.push(deck);
  const m = mansionById(s.mansionId);
  if (m) mods.push(m);
  if (m && CURSES[m.curse]) mods.push(CURSES[m.curse]);
  for (let i = 1; i <= s.deed; i++) if (DEEDS[i]) mods.push(DEEDS[i]);
  for (const h of s.heirlooms) mods.push(HEIRLOOMS[h]);
  for (const cell of s.cells) if (cell && cell.id && ROOMS[cell.id].passive) mods.push(ROOMS[cell.id].passive);
  return mods;
}
export function modValue(s, hook, base, ...args) {
  let v = base;
  for (const m of getMods(s)) if (typeof m[hook] === 'function') v = m[hook](v, s, ...args);
  return v;
}
export const gemCost = (s, id) => (s.pending && s.pending.free ? 0 : Math.max(0, modValue(s, 'gemCost', ROOMS[id].cost, ROOMS[id])));
export const shopPrice = (s, p) => Math.max(0, modValue(s, 'shopPrice', p));
export const drawCount = (s) => Math.max(1, modValue(s, 'drawCount', BASE_DRAW)
  + (s.buffs.extraDraw > 0 ? 1 : 0) + (s.buffs.bigDraw > 0 ? 2 : 0) - (s.buffs.smallDraw > 0 ? 1 : 0));

// Weighted random room from the run's pool.
export function randomRoom(s, pred = () => true) {
  const opts = s.pool.filter((id) => pred(ROOMS[id]));
  if (!opts.length) return null;
  const bias = DECKS[s.deckId].bias || {};
  const w = opts.map((id) => RARITIES[ROOMS[id].rarity].weight * (bias[ROOMS[id].family] || 1));
  let x = rand(s) * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < opts.length; i++) { x -= w[i]; if (x <= 0) return opts[i]; }
  return opts[opts.length - 1];
}

// ---------- setup ----------
export function newRun({ seed = Date.now(), mansionId = 'm1', deed = 0, deckId = 'standard', unlockedRooms = [], perks = [], upgrades = {}, extraCards = [], startHeirloom = null } = {}) {
  const m = mansionById(mansionId);
  if (!m) throw new Error(`Unknown mansion ${mansionId}`);
  const s = {
    v: 1, seed, rng: hashSeed(seed), mansionId, deed, deckId,
    w: m.w, h: m.h, cells: Array(m.w * m.h).fill(null),
    locks: {}, lockedCells: {}, entrance: { r: m.entrance.r, c: m.entrance.c }, vault: { r: m.vault.r, c: m.vault.c },
    res: { steps: 16, gems: 1, keys: 1, coins: 0, rerolls: 1 },
    deck: [], discard: [], heirlooms: [], counters: {}, pool: [], tollDelta: 0, lastPlaced: null,
    buffs: { extraDraw: 0, bigDraw: 0, smallDraw: 0, freeDraft: 0, freeCost: 0, nextFamily: null, gardenDouble: 0 },
    phase: 'door', pending: null, queue: [], shop: null, heirloomOffer: null,
    drafts: 0, placed: 0, reshuffles: 0, bonus: 0, log: [], result: null,
  };
  for (const b of m.blocked) setCell(s, b.r, b.c, { blocked: true });
  for (const lc of m.lockedCells) s.lockedCells[key(lc.r, lc.c)] = true;
  setCell(s, m.entrance.r, m.entrance.c, mk('entrance', m.entrance.rot, true));
  setCell(s, m.vault.r, m.vault.c, mk('vault', m.vault.rot, true));
  for (const p of m.presets) setCell(s, p.r, p.c, mk(p.id, p.rot, true));
  s.pool = Object.keys(ROOMS).filter((id) => isDraftable(id) && (!ROOMS[id].unlock || unlockedRooms.includes(id)));
  s.deck = [...DECKS[deckId].cards, ...unlockedRooms, ...extraCards.filter((id) => ROOMS[id])];
  for (let i = 0; i < (DECKS[deckId].fill ?? 18); i++) s.deck.push(randomRoom(s));
  for (const mod of getMods(s)) if (mod.start) mod.start(s);
  for (const p of perks) if (PERKS[p]) PERKS[p].start(s);
  for (const u of UPGRADES) if (u.start && upgrades[u.id]) u.start(s, upgrades[u.id]);
  if (startHeirloom && HEIRLOOMS[startHeirloom]) gainHeirloom(s, startHeirloom);
  s.res.steps = Math.max(1, s.res.steps);
  s.deck = shuffle(s, s.deck);
  log(s, `Welcome to ${m.name}.`);
  advance(s);
  return s;
}
function mk(id, rot, preset = false) { return { id, rot, doors: roomDoors(id, rot), preset }; }
function log(s, msg) { s.logCount = (s.logCount || 0) + 1; s.log.push(msg); if (s.log.length > 30) s.log.shift(); }

// ---------- geometry ----------
// Rooms reachable from the entrance via matching door pairs.
export function connectedSet(s) {
  const seen = new Set([key(s.entrance.r, s.entrance.c)]);
  const stack = [s.entrance];
  while (stack.length) {
    const { r, c } = stack.pop();
    const cell = cellAt(s, r, c);
    for (let d = 0; d < 4; d++) {
      if (!cell.doors[d]) continue;
      const nr = r + DIRS[d][0], nc = c + DIRS[d][1];
      const n = cellAt(s, nr, nc);
      if (!n || !n.id || !n.doors[opp(d)] || seen.has(key(nr, nc))) continue;
      seen.add(key(nr, nc));
      stack.push({ r: nr, c: nc });
    }
  }
  return seen;
}

// Empty cells reachable through an open doorway of a connected room.
// Returns [{r, c, from: [{r,c,d,locked}], dirs: [side of target facing a source], locked}]
export function openTargets(s) {
  const conn = connectedSet(s);
  const map = new Map();
  for (const k of conn) {
    const [r, c] = k.split(',').map(Number);
    const cell = cellAt(s, r, c);
    for (let d = 0; d < 4; d++) {
      if (!cell.doors[d]) continue;
      const nr = r + DIRS[d][0], nc = c + DIRS[d][1];
      if (cellAt(s, nr, nc) !== null) continue; // out of bounds, blocked or occupied
      const tk = key(nr, nc);
      if (!map.has(tk)) map.set(tk, { r: nr, c: nc, from: [], dirs: [] });
      const t = map.get(tk);
      t.from.push({ r, c, d, locked: !!s.locks[lockKey(r, c, d)] });
      t.dirs.push(opp(d));
    }
  }
  const out = [...map.values()];
  for (const t of out) t.locked = !!s.lockedCells[key(t.r, t.c)] || t.from.every((f) => f.locked);
  return out;
}

export function validRotations(s, id, target) {
  const rots = [];
  for (let rot = 0; rot < 4; rot++) {
    const doors = roomDoors(id, rot);
    if (!target.dirs.some((d) => doors[d])) continue;
    const sig = doors.join('');
    if (rots.some((x) => roomDoors(id, x).join('') === sig)) continue; // symmetric duplicates
    rots.push(rot);
  }
  return rots;
}

// Neighbours of a cell (for effects/UI).
export function neighbors(s, r, c) {
  const cell = cellAt(s, r, c);
  const out = [];
  for (let d = 0; d < 4; d++) {
    const nr = r + DIRS[d][0], nc = c + DIRS[d][1];
    const n = cellAt(s, nr, nc);
    if (!n || !n.id) continue;
    out.push({ r: nr, c: nc, d, room: ROOMS[n.id], connected: !!(cell && cell.doors && cell.doors[d] && n.doors[opp(d)]) });
  }
  return out;
}

// ---------- deck ----------
function reshuffle(s) {
  s.deck = shuffle(s, s.discard);
  s.discard = [];
  const pen = Math.max(0, modValue(s, 'reshufflePenalty', BASE_RESHUFFLE));
  s.reshuffles++;
  s.res.steps = Math.max(0, s.res.steps - pen);
  for (const m of getMods(s)) if (m.onReshuffle) m.onReshuffle(s);
  log(s, `The house rearranges: deck reshuffled (−${pen} Steps).`);
}
// Make sure one offer is of the given family: pull it from the deck, discard, or the pool.
function ensureFamily(s, offers, fam) {
  if (!offers.length || offers.some((id) => ROOMS[id].family === fam)) return;
  for (const pile of ['deck', 'discard']) {
    const i = s[pile].findIndex((id) => ROOMS[id].family === fam);
    if (i >= 0) { const [id] = s[pile].splice(i, 1); s.deck.unshift(offers.pop()); offers.push(id); return; }
  }
  const id = randomRoom(s, (r) => r.family === fam);
  if (id) { s.deck.unshift(offers.pop()); offers.push(id); }
}
function draw(s, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    if (!s.deck.length) { if (!s.discard.length) break; reshuffle(s); }
    out.push(s.deck.pop());
  }
  return out;
}

// ---------- effects ----------
function makeCtx(s, r, c, room) {
  const ctx = {
    s, r, c, room,
    rand: () => rand(s),
    gain(res, n) {
      let amt = modValue(s, 'gainAmount', n, { res, room });
      if (ctx.double && res === 'gems' && amt > 0) amt *= 2;
      if (!amt) return;
      s.res[res] = Math.max(0, s.res[res] + amt);
      if (res === 'gems' && amt > 0) s.bonus += amt;
    },
    buff(name, n) { s.buffs[name] = (s.buffs[name] || 0) + n; },
    queue(type) { s.queue.push(type); },
    neighbors: () => neighbors(s, r, c),
    placed: (pred) => s.cells.filter((x) => x && x.id && !['entrance', 'vault'].includes(x.id) && pred(ROOMS[x.id])),
    onEdge: () => r === 0 || c === 0 || r === s.h - 1 || c === s.w - 1,
    toll(n) { s.tollDelta = (s.tollDelta || 0) + n; log(s, `Vault toll ${n > 0 ? 'rises' : 'drops'} by ${Math.abs(n)}.`); },
    burn(n) { for (let i = 0; i < n; i++) burnWorst(s); },
    addCards(ids) { s.discard.push(...ids); log(s, `Added ${ids.map((i) => ROOMS[i].name).join(', ')} to your discard pile.`); },
    addRandom(n, pred) {
      const got = [];
      for (let i = 0; i < n; i++) { const id = randomRoom(s, pred); if (id) got.push(id); }
      if (got.length) ctx.addCards(got);
    },
    collapse(n) {
      const v = cellAt(s, s.vault.r, s.vault.c);
      const vd = v.doors.findIndex(Boolean);
      const keep = key(s.vault.r + DIRS[vd][0], s.vault.c + DIRS[vd][1]);
      const empties = shuffle(s, DIRS.map(([dr, dc]) => ({ r: r + dr, c: c + dc }))
        .filter((p) => cellAt(s, p.r, p.c) === null && key(p.r, p.c) !== keep));
      empties.slice(0, n).forEach((p) => setCell(s, p.r, p.c, { blocked: true, collapsed: true }));
      if (empties.length && n) log(s, `${Math.min(n, empties.length)} cell(s) collapsed.`);
    },
    unlockAround() {
      for (const [dr, dc] of DIRS) {
        const nr = r + dr, nc = c + dc;
        for (let d = 0; d < 4; d++) delete s.locks[lockKey(nr, nc, d)];
        delete s.lockedCells[key(nr, nc)];
      }
      for (let d = 0; d < 4; d++) delete s.locks[lockKey(r, c, d)];
    },
    echo(n) {
      const ns = shuffle(s, neighbors(s, r, c).filter((x) => x.connected && x.room.onPlace && !x.room.echo)).slice(0, n);
      for (const x of ns) { log(s, `Echo: ${x.room.name}.`); x.room.onPlace(makeCtx(s, x.r, x.c, x.room)); }
    },
    purge(pred) {
      const before = s.deck.length + s.discard.length;
      s.deck = s.deck.filter((id) => !pred(ROOMS[id]));
      s.discard = s.discard.filter((id) => !pred(ROOMS[id]));
      log(s, `Removed ${before - s.deck.length - s.discard.length} card(s).`);
    },
  };
  return ctx;
}

// ---------- flow ----------
export const vaultToll = (s) => Math.max(0, modValue(s, 'toll', mansionById(s.mansionId).toll || 0) + (s.tollDelta || 0));
export const vaultConnected = (s) => connectedSet(s).has(key(s.vault.r, s.vault.c));
export function isWon(s) { return vaultConnected(s) && s.res.gems >= vaultToll(s); }

function canContinue(s) {
  if (s.res.steps <= 0 && !(s.buffs.freeDraft > 0)) return { ok: false, why: 'steps' };
  const ts = openTargets(s);
  if (!ts.length) return { ok: false, why: 'sealed' };
  const freeLock = getMods(s).some((m) => m.canFreeLock && m.canFreeLock(s));
  if (ts.every((t) => t.locked) && s.res.keys <= 0 && !freeLock) return { ok: false, why: 'locked' };
  return { ok: true };
}

// Moves the state on after any resolution: win check, queued events, loss check.
function advance(s) {
  if (s.phase === 'won' || s.phase === 'lost') return;
  if (isWon(s)) {
    s.res.gems -= vaultToll(s);
    return finish(s, true, 'vault');
  }
  while (s.queue.length) {
    const q = s.queue.shift();
    if (q === 'shop') { s.shop = makeShop(s); s.phase = 'shop'; return; }
    if (q === 'heirloom') {
      const offer = heirloomOffer(s);
      if (offer.length) { s.heirloomOffer = offer; s.phase = 'heirloom'; return; }
    }
  }
  s.phase = 'door';
  s.pending = null;
  if (s.res.steps <= 0 && !(s.buffs.freeDraft > 0) && s.counters.secondWind > 0) {
    s.counters.secondWind--;
    s.res.steps += 4;
    log(s, 'Second Wind: +4 Steps.');
  }
  const cc = canContinue(s);
  if (!cc.ok) finish(s, false, cc.why);
}

function finish(s, won, why) {
  s.phase = won ? 'won' : 'lost';
  s.pending = null;
  const rowsAdvanced = Math.max(0, ...s.cells.map((cell, i) => (cell && cell.id && !cell.preset ? s.entrance.r - Math.floor(i / s.w) : 0)));
  const score = won ? 50 + s.res.steps * 3 + s.res.gems * 2 + s.res.keys * 3 + s.res.coins + s.bonus + s.deed * 10 : 0;
  const ink = s.placed + rowsAdvanced * 2 + (won ? 12 + s.deed * 4 : 0);
  s.result = { won, why, score, ink, rowsAdvanced, drafts: s.drafts };
  log(s, won ? 'The Vault opens!' : `Run over: ${LOSS_TEXT[why]}`);
}
export const LOSS_TEXT = {
  steps: 'you ran out of Steps.',
  sealed: 'no open doorways remain.',
  locked: 'every doorway is locked and you have no Keys.',
  abandon: 'you left the house.',
};

function heirloomOffer(s) {
  if (s.heirlooms.length >= MAX_HEIRLOOMS) return [];
  const pool = shuffle(s, Object.keys(HEIRLOOMS).filter((h) => !s.heirlooms.includes(h)));
  return pool.slice(0, 3);
}
function gainHeirloom(s, id) {
  s.heirlooms.push(id);
  if (HEIRLOOMS[id].onGain) HEIRLOOMS[id].onGain(s);
  log(s, `Heirloom gained: ${HEIRLOOMS[id].name}.`);
}

const SHOP_ITEMS = [
  { kind: 'steps', n: 4, price: 3, label: '+4 Steps' },
  { kind: 'steps', n: 2, price: 1, label: '+2 Steps' },
  { kind: 'keys', n: 1, price: 3, label: '+1 Key' },
  { kind: 'gems', n: 2, price: 3, label: '+2 Gems' },
  { kind: 'rerolls', n: 1, price: 2, label: '+1 Reroll' },
  { kind: 'remove', price: 2, label: 'Burn your worst card' },
  { kind: 'heirloom', price: 7 },
  { kind: 'card', price: 2 },
];
function makeShop(s) {
  const items = shuffle(s, SHOP_ITEMS.map((x) => ({ ...x }))).slice(0, 4);
  for (const it of items) {
    if (it.kind === 'heirloom') {
      const opts = Object.keys(HEIRLOOMS).filter((h) => !s.heirlooms.includes(h));
      if (!opts.length || s.heirlooms.length >= MAX_HEIRLOOMS) { it.kind = 'steps'; it.n = 2; it.price = 1; it.label = '+2 Steps'; continue; }
      it.id = opts[Math.floor(rand(s) * opts.length)];
      it.label = `Heirloom: ${HEIRLOOMS[it.id].name}`;
    }
    if (it.kind === 'card') { it.id = randomRoom(s, (r) => r.rarity !== 'common'); it.label = `Add ${ROOMS[it.id].name} (${ROOMS[it.id].rarity})`; }
    it.price = shopPrice(s, it.price);
    it.sold = false;
  }
  return { items };
}
const WORST_ORDER = ['rubble', 'furnace', 'servants', 'haunted', 'boarded', 'gambling', 'passage', 'bend', 'foyer'];
function burnWorst(s) {
  for (const id of WORST_ORDER) {
    for (const pile of ['deck', 'discard']) {
      const i = s[pile].indexOf(id);
      if (i >= 0) { s[pile].splice(i, 1); log(s, `Burned ${ROOMS[id].name}.`); return; }
    }
  }
}

// ---------- actions ----------
export function act(prev, a) {
  const s = structuredClone(prev);
  if (s.phase === 'won' || s.phase === 'lost') throw new Error('Run is over');
  switch (a.type) {
    case 'select': {
      if (s.phase !== 'door') throw new Error('Not choosing a door');
      const t = openTargets(s).find((x) => x.r === a.r && x.c === a.c);
      if (!t) throw new Error('No open doorway into that cell');
      const dir = t.dirs[0];
      if (t.locked) {
        const free = getMods(s).some((m) => m.freeLock && m.freeLock(s));
        if (!free) {
          if (s.res.keys <= 0) throw new Error('Locked: you need a Key');
          s.res.keys--;
          log(s, 'Used a Key.');
        } else log(s, 'The Skeleton Key turns.');
        delete s.lockedCells[key(t.r, t.c)];
        for (const f of t.from) delete s.locks[lockKey(f.r, f.c, f.d)];
      }
      let cost = modValue(s, 'draftCost', 1, { dir: opp(dir) });
      if (s.buffs.freeDraft > 0) { cost = 0; s.buffs.freeDraft--; }
      if (cost > s.res.steps) throw new Error('Not enough Steps');
      s.res.steps -= cost;
      const n = drawCount(s);
      for (const b of ['extraDraw', 'bigDraw', 'smallDraw']) if (s.buffs[b] > 0) s.buffs[b]--;
      const offers = draw(s, n);
      if (s.buffs.nextFamily) { ensureFamily(s, offers, s.buffs.nextFamily); s.buffs.nextFamily = null; }
      const free = s.buffs.freeCost > 0;
      if (free) s.buffs.freeCost--;
      s.pending = { r: t.r, c: t.c, dirs: t.dirs, offers, pick: null, rots: null, rot: null, free };
      s.phase = 'card';
      return s;
    }
    case 'reroll': {
      if (s.phase !== 'card') throw new Error('Nothing to reroll');
      if (s.res.rerolls <= 0) throw new Error('No rerolls');
      s.res.rerolls--;
      const n = s.pending.offers.length || BASE_DRAW;
      s.discard.push(...s.pending.offers);
      s.pending.offers = [];
      s.pending.offers = draw(s, n);
      return s;
    }
    case 'pick': {
      if (s.phase !== 'card') throw new Error('Not choosing a card');
      const p = s.pending;
      let id;
      if (a.index === -1) {
        if (p.offers.some((o) => gemCost(s, o) <= s.res.gems)) throw new Error('Closet only when nothing is affordable');
        id = 'closet';
      } else {
        id = p.offers[a.index];
        if (!id) throw new Error('Bad card');
        if (gemCost(s, id) > s.res.gems) throw new Error('Not enough Gems');
      }
      p.pick = a.index;
      p.id = id;
      p.rots = validRotations(s, id, p);
      p.rot = bestRotation(s, id, p, p.rots);
      s.phase = 'place';
      return s;
    }
    case 'unpick': {
      if (s.phase !== 'place') throw new Error('Nothing picked');
      Object.assign(s.pending, { pick: null, id: null, rots: null, rot: null });
      s.phase = 'card';
      return s;
    }
    case 'rotate': {
      if (s.phase !== 'place') throw new Error('Nothing to rotate');
      const p = s.pending;
      const i = p.rots.indexOf(p.rot);
      p.rot = p.rots[(i + (a.dir === -1 ? p.rots.length - 1 : 1)) % p.rots.length];
      return s;
    }
    case 'place': {
      if (s.phase !== 'place') throw new Error('Nothing to place');
      const p = s.pending;
      const rot = a.rot ?? p.rot;
      if (!p.rots.includes(rot)) throw new Error('Invalid rotation');
      const id = p.id;
      s.res.gems -= gemCost(s, id);
      p.offers.forEach((o, i) => { if (i !== p.pick) s.discard.push(o); });
      const cell = mk(id, rot);
      setCell(s, p.r, p.c, cell);
      s.drafts++;
      s.placed++;
      // lock new exits
      const m = mansionById(s.mansionId);
      const room = ROOMS[id];
      const chance = m.lockChance(p.r) + modValue(s, 'lockBonus', 0);
      for (let d = 0; d < 4; d++) {
        if (!cell.doors[d]) continue;
        const nr = p.r + DIRS[d][0], nc = p.c + DIRS[d][1];
        if (cellAt(s, nr, nc) !== null) continue;
        if (!room.noLock && (room.lockExits || rand(s) < chance)) s.locks[lockKey(p.r, p.c, d)] = true;
      }
      s.pending = null;
      log(s, `Placed ${room.name}.`);
      const ctx = makeCtx(s, p.r, p.c, room);
      if (room.family === 'green' && s.buffs.gardenDouble > 0) { ctx.double = true; s.buffs.gardenDouble--; }
      if (room.onPlace) room.onPlace(ctx);
      for (const mod of getMods(s)) if (mod.onPlace) mod.onPlace(ctx);
      if (id !== 'closet') s.lastPlaced = id;
      advance(s);
      return s;
    }
    case 'buy': {
      if (s.phase !== 'shop') throw new Error('No shop');
      const it = s.shop.items[a.index];
      if (!it || it.sold) throw new Error('Not for sale');
      if (s.res.coins < it.price) throw new Error('Not enough Coins');
      s.res.coins -= it.price;
      it.sold = true;
      if (['steps', 'keys', 'gems', 'rerolls'].includes(it.kind)) s.res[it.kind] += it.n;
      else if (it.kind === 'remove') burnWorst(s);
      else if (it.kind === 'card') { s.discard.push(it.id); }
      else if (it.kind === 'heirloom') {
        if (s.heirlooms.length >= MAX_HEIRLOOMS) throw new Error('Heirlooms full');
        gainHeirloom(s, it.id);
      }
      return s;
    }
    case 'leave': {
      if (s.phase !== 'shop') throw new Error('No shop');
      s.shop = null;
      advance(s);
      return s;
    }
    case 'heirloom': {
      if (s.phase !== 'heirloom') throw new Error('No heirloom offer');
      if (a.index >= 0) {
        const id = s.heirloomOffer[a.index];
        if (!id) throw new Error('Bad heirloom');
        gainHeirloom(s, id);
      }
      s.heirloomOffer = null;
      advance(s);
      return s;
    }
    case 'abandon': {
      finish(s, false, 'abandon');
      return s;
    }
    default:
      throw new Error(`Unknown action ${a.type}`);
  }
}

// Default rotation: the one leaving the most usable exits, preferring those toward the vault.
export function bestRotation(s, id, target, rots) {
  let best = rots[0], bestScore = -Infinity;
  for (const rot of rots) {
    const sc = rotationScore(s, id, target, rot);
    if (sc > bestScore) { bestScore = sc; best = rot; }
  }
  return best;
}
export function rotationScore(s, id, target, rot) {
  const doors = roomDoors(id, rot);
  let sc = 0;
  for (let d = 0; d < 4; d++) {
    if (!doors[d]) continue;
    const nr = target.r + DIRS[d][0], nc = target.c + DIRS[d][1];
    const n = cellAt(s, nr, nc);
    if (n === undefined || (n && n.blocked)) { sc -= 1; continue; }
    if (n && n.id) { if (n.doors[opp(d)]) sc += n.id === 'vault' ? 100 : 0.5; else sc -= 0.5; continue; }
    const before = Math.abs(target.r - s.vault.r) + Math.abs(target.c - s.vault.c);
    const after = Math.abs(nr - s.vault.r) + Math.abs(nc - s.vault.c);
    sc += 1 + (after < before ? 1 : 0);
  }
  return sc;
}
