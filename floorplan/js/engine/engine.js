// Pure, deterministic game engine. No DOM. State is plain JSON.
// act(state, action) returns a NEW state, or throws on an invalid action.
//
// V2 run structure: a run is 3 Nights. Each Night is a freshly generated floor with its own goal and Omen.
// Reach the goal landmark (Stairwell, or the Vault on Night 3) while meeting its requirement.
// Dread rises as you draft; every so often the house acts against you.

import { ROOMS, SHAPES, RARITIES, isDraftable } from '../data/rooms.js';
import { HEIRLOOMS, MAX_HEIRLOOMS } from '../data/heirlooms.js';
import { MANSIONS, DEEDS, DECKS, PERKS } from '../data/mansions.js';
import { OMENS, HOUSE_ACTS, EVENTS, LANDINGS, WINGS, STEWARD, STEWARD_STORY } from '../data/nights.js';
import { rand, shuffle, hashSeed } from './rng.js';
import { UPGRADES } from '../data/progression.js';

export const DIRS = [[-1, 0], [0, 1], [1, 0], [0, -1]]; // [dr, dc] for N, E, S, W
export const opp = (d) => (d + 2) % 4;
export const BASE_DRAW = 3;
export const BASE_RESHUFFLE = 2;
export const NIGHTS = 3;

export function rotateDoors(doors, rot) {
  const out = [0, 0, 0, 0];
  for (let d = 0; d < 4; d++) if (doors[d]) out[(d + rot) % 4] = 1;
  return out;
}
export const roomDoors = (id, rot) => rotateDoors(SHAPES[ROOMS[id].shape].doors, rot);
export const mansionById = (id) => MANSIONS.find((m) => m.id === id);
const key = (r, c) => `${r},${c}`;
const lockKey = (r, c, d) => `${r},${c},${d}`;
const LANDMARKS = ['entrance', 'vault', 'vault_side', 'vault_open', 'stair'];
export const isVault = (id) => id === 'vault' || id === 'vault_side' || id === 'vault_open';

export function cellAt(s, r, c) {
  if (r < 0 || c < 0 || r >= s.h || c >= s.w) return undefined; // out of bounds
  return s.cells[r * s.w + c];
}
function setCell(s, r, c, v) { s.cells[r * s.w + c] = v; }
function pick(s, arr) { return arr[Math.floor(rand(s) * arr.length)]; }

// ---------- modifiers ----------
export function getMods(s) {
  const mods = [];
  if (DECKS[s.deckId]) mods.push(DECKS[s.deckId]);
  if (s.omen && OMENS[s.omen]) mods.push(OMENS[s.omen]);
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
// Mods that apply before a state exists (deck, deeds) — used for Night setup values.
function staticMod(s, hook, base) {
  let v = base;
  const mods = [DECKS[s.deckId], ...DEEDS.slice(1, s.deed + 1)];
  for (const m of mods) if (m && typeof m[hook] === 'function') v = m[hook](v, s);
  return v;
}
export const gemCost = (s, id) => (s.pending && s.pending.free ? 0 : Math.max(0, modValue(s, 'gemCost', ROOMS[id].cost, ROOMS[id])));
export const shopPrice = (s, p) => Math.max(0, modValue(s, 'shopPrice', p));
export const drawCount = (s) => Math.max(1, modValue(s, 'drawCount', BASE_DRAW)
  + (s.buffs.extraDraw > 0 ? 1 : 0) + (s.buffs.bigDraw > 0 ? 2 : 0) - (s.buffs.smallDraw > 0 ? 1 : 0));

export function randomRoom(s, pred = () => true) {
  const opts = s.pool.filter((id) => pred(ROOMS[id]));
  if (!opts.length) return null;
  const bias = DECKS[s.deckId].bias || {};
  const w = opts.map((id) => RARITIES[ROOMS[id].rarity].weight * (bias[ROOMS[id].family] || 1));
  let x = rand(s) * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < opts.length; i++) { x -= w[i]; if (x <= 0) return opts[i]; }
  return opts[opts.length - 1];
}

function log(s, msg) { s.logCount = (s.logCount || 0) + 1; s.log.push(msg); if (s.log.length > 30) s.log.shift(); }
function say(s, mood) {
  const bank = s.mode === 'story' ? STEWARD_STORY : STEWARD;
  const lines = bank[mood] || STEWARD[mood];
  if (lines) s.steward = pick(s, lines);
}
function mk(id, rot, preset = false) { return { id, rot, doors: roomDoors(id, rot), preset }; }

// ---------- setup ----------
export function newRun({
  seed = Date.now(), mansionId = 'm1', deed = 0, deckId = 'standard', unlockedRooms = [], perks = [],
  upgrades = {}, extraCards = [], startHeirloom = null, discoveredRooms = [], mode = 'endless', difficulty = 'hard',
} = {}) {
  const m = mansionById(mansionId);
  if (!m) throw new Error(`Unknown mansion ${mansionId}`);
  const s = {
    v: 2, seed, rng: hashSeed(seed), mansionId, deed, deckId, mode, difficulty, night: 0,
    w: m.w, h: m.h, cells: [], locks: {}, lockedCells: {}, mystery: {}, entrance: null, vault: null, goal: null, omen: null,
    res: { steps: 0, gems: 1, keys: 1, coins: 0, rerolls: 1 },
    deck: [], discard: [], heirlooms: [], counters: {}, pool: [], lastPlaced: null,
    buffs: { extraDraw: 0, bigDraw: 0, smallDraw: 0, freeDraft: 0, freeCost: 0, nextFamily: null, gardenDouble: 0 },
    dread: 0, dreadNext: 0, wings: {}, stepBonus: 0, carryBonus: 0, calmBonus: 0,
    phase: 'door', pending: null, queue: [], shop: null, heirloomOffer: null, event: null, landing: null, between: false,
    drafts: 0, placed: 0, reshuffles: 0, bonus: 0, nightsCleared: 0, score: 0, log: [], steward: '', result: null,
    discoveredThisRun: [], discoveryCells: {}, discoveryOffer: null,
    knownDiscoveries: [...discoveredRooms],
  };
  s.pool = Object.keys(ROOMS).filter((id) => isDraftable(id) && (
    (!ROOMS[id].unlock && !ROOMS[id].discover) || unlockedRooms.includes(id) || discoveredRooms.includes(id)
  ));
  s.deck = [...DECKS[deckId].cards, ...unlockedRooms, ...extraCards.filter((id) => ROOMS[id])];
  for (let i = 0; i < (DECKS[deckId].fill ?? 18); i++) s.deck.push(randomRoom(s));
  for (const mod of [DECKS[deckId], ...DEEDS.slice(1, deed + 1)]) if (mod && mod.start) mod.start(s);
  for (const p of perks) if (PERKS[p]) PERKS[p].start(s);
  for (const u of UPGRADES) if (u.start && upgrades[u.id]) u.start(s, upgrades[u.id]);
  if (startHeirloom && HEIRLOOMS[startHeirloom]) gainHeirloom(s, startHeirloom);
  s.deck = shuffle(s, s.deck);
  startNight(s, 1, 0);
  return s;
}

// Generates the floor for Night n. Guarantees a path of empty cells from the entrance to the goal.
export function generateFloor(m, n, rng, difficulty = 'hard') {
  const g = { rng };
  const r = () => rand(g);
  const ri = (k) => Math.floor(r() * k);
  const { w, h } = m;
  for (let tries = 0; tries < 60; tries++) {
    const cells = Array(w * h).fill(null);
    const at = (rr, cc) => rr * w + cc;
    const entrance = { r: h - 1, c: 1 + ri(w - 2) };
    let goal, approach;
    if (n === NIGHTS && difficulty === 'easy') {
      const gr = 2 + ri(Math.max(1, Math.floor(h / 2) - 2));
      const gc = 1 + ri(w - 2);
      goal = { r: gr, c: gc };
      approach = { r: gr + 1, c: gc };
    } else if (n === NIGHTS && difficulty === 'normal') {
      goal = { r: 0, c: ri(w) };
      approach = { r: 1, c: goal.c };
    } else {
      goal = { r: 0, c: ri(w) };
      approach = { r: 1, c: goal.c };
    }
    cells[at(entrance.r, entrance.c)] = 'E';
    cells[at(goal.r, goal.c)] = 'G';
    const protectedKeys = new Set([key(approach.r, approach.c), key(entrance.r - 1, entrance.c)]);
    if (n === NIGHTS && difficulty === 'easy') {
      for (const [dr, dc] of DIRS) {
        const ar = goal.r + dr, ac = goal.c + dc;
        if (ar >= 0 && ac >= 0 && ar < h && ac < w) protectedKeys.add(key(ar, ac));
      }
    }
    const free = [];
    for (let rr = 0; rr < h; rr++) for (let cc = 0; cc < w; cc++) {
      if (cells[at(rr, cc)] || protectedKeys.has(key(rr, cc))) continue;
      if (rr === h - 1 && Math.abs(cc - entrance.c) <= 1) continue;
      free.push({ r: rr, c: cc });
    }
    const blocks = [];
    const nBlocks = Math.min(free.length - 4, (m.blocks[n - 1] || 0) + (m.extraBlocks || 0));
    const pool = [...free];
    for (let i = 0; i < nBlocks; i++) blocks.push(pool.splice(ri(pool.length), 1)[0]);
    for (const b of blocks) cells[at(b.r, b.c)] = 'B';
    // path check (4-neighbour BFS through empty cells) from cell above entrance to approach
    const start = { r: entrance.r - 1, c: entrance.c };
    const seen = new Set([key(start.r, start.c)]);
    const q = [start];
    while (q.length) {
      const cur = q.shift();
      for (const [dr, dc] of DIRS) {
        const nr = cur.r + dr, nc = cur.c + dc;
        if (nr < 0 || nc < 0 || nr >= h || nc >= w || seen.has(key(nr, nc)) || cells[at(nr, nc)]) continue;
        seen.add(key(nr, nc));
        q.push({ r: nr, c: nc });
      }
    }
    if (!seen.has(key(approach.r, approach.c))) continue;
    const rest = pool.filter((p) => seen.has(key(p.r, p.c)) && !(Math.abs(p.r - entrance.r) + Math.abs(p.c - entrance.c) <= 1));
    const mystery = [];
    for (let i = 0; i < (m.mystery[n - 1] || 0) && rest.length; i++) mystery.push(rest.splice(ri(rest.length), 1)[0]);
    const locked = [];
    for (let i = 0; i < (m.lockedCells[n - 1] || 0) && rest.length; i++) {
      const cand = rest.filter((p) => p.r <= Math.floor(h / 2));
      const p = cand.length ? cand[ri(cand.length)] : rest[ri(rest.length)];
      rest.splice(rest.indexOf(p), 1);
      locked.push(p);
    }
    // Discovery cells: in hard-to-reach corners/edges, rewarding exploration
    const discoveryCells = [];
    const nDisc = m.discoveries?.[n - 1] || 0;
    if (nDisc > 0 && rest.length) {
      const edge = rest.filter((p) => (p.r <= 1 || p.r >= h - 2 || p.c === 0 || p.c === w - 1)
        && Math.abs(p.r - entrance.r) + Math.abs(p.c - entrance.c) > 2);
      const dpool = edge.length >= nDisc ? edge : rest;
      for (let i = 0; i < nDisc && dpool.length; i++) {
        const p = dpool.splice(ri(dpool.length), 1)[0];
        rest.splice(rest.indexOf(p), 1);
        discoveryCells.push(p);
      }
    }
    return { entrance, goal, blocks, mystery, locked, discoveryCells, rng: g.rng };
  }
  throw new Error('Could not generate a floor');
}

function startNight(s, n, carry) {
  const m = mansionById(s.mansionId);
  s.night = n;
  // Omen: Night-specific rule breaker, tier set by mansion and Deeds.
  const tier = Math.max(1, Math.min(3, staticMod(s, 'omenTier', m.omenTier[n - 1])));
  const omens = Object.values(OMENS).filter((o) => o.tier <= tier && o.tier >= tier - 1);
  s.omen = pick(s, omens).id;
  const omen = OMENS[s.omen];
  const fl = generateFloor({ ...m, extraBlocks: omen.extraBlocks || 0 }, n, s.rng, s.difficulty);
  s.rng = fl.rng;
  s.cells = Array(m.w * m.h).fill(null);
  s.locks = {};
  s.lockedCells = {};
  s.mystery = {};
  s.wings = {};
  s.entrance = fl.entrance;
  s.vault = fl.goal;
  setCell(s, fl.entrance.r, fl.entrance.c, mk('entrance', 0, true));
  if (n !== NIGHTS) {
    setCell(s, fl.goal.r, fl.goal.c, mk('stair', 2, true));
  } else {
    const diff = s.difficulty || 'hard';
    let vaultId = 'vault';
    let vaultRot = 2;
    if (diff === 'easy') {
      vaultId = 'vault_open'; vaultRot = 0;
    } else if (diff === 'normal') {
      vaultId = 'vault_side'; vaultRot = rand(s) < 0.5 ? 1 : 2;
    }
    setCell(s, fl.goal.r, fl.goal.c, mk(vaultId, vaultRot, true));
  }
  for (const b of fl.blocks) setCell(s, b.r, b.c, { blocked: true });
  for (const p of fl.mystery) s.mystery[key(p.r, p.c)] = true;
  for (const p of fl.locked) s.lockedCells[key(p.r, p.c)] = true;
  // Goal
  const gd = m.goals[n - 1];
  s.goal = { kind: gd.kind, res: gd.res, n: Math.max(1, staticMod(s, 'goalAmount', gd.n)), delta: 0 };
  if (gd.kind === 'wing') s.goal.family = null; // any family
  // Steps for the Night
  s.res.steps = Math.max(4, staticMod(s, 'nightSteps', m.nightSteps[n - 1]) + s.stepBonus + carry + s.carryBonus);
  s.carryBonus = 0;
  s.dread = 0;
  s.dreadPrev = 0;
  s.dreadNext = Math.max(3, modValue(s, 'dreadEvery', m.dreadEvery[n - 1]) + s.calmBonus);
  s.calmBonus = 0;
  // When the Night's goal requires Keys, inject extra key rooms into the deck so key goals are achievable.
  if (gd.kind === 'toll' && gd.res === 'keys') {
    const inject = 2;
    for (let i = 0; i < inject; i++) s.deck.splice(Math.floor(rand(s) * (s.deck.length + 1)), 0, 'strongroom');
    log(s, 'Keys are prized tonight. Extra Strongrooms shuffled in.');
  }
  if (omen.nightStart) omen.nightStart(s);
  // Discovery cells: place them only if undiscovered rooms remain
  s.discoveryCells = {};
  const undiscovered = Object.keys(ROOMS).filter((id) => ROOMS[id].discover && !s.knownDiscoveries.includes(id) && !s.discoveredThisRun.includes(id));
  if (undiscovered.length > 0 && fl.discoveryCells) {
    for (const p of fl.discoveryCells) s.discoveryCells[key(p.r, p.c)] = true;
  }
  s.between = false;
  s.phase = 'door';
  s.pending = null;
  log(s, `Night ${n}: ${omen.name}.`);
  say(s, `night${n}`);
  advance(s);
}

// ---------- geometry ----------
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

export function openTargets(s) {
  const conn = connectedSet(s);
  const map = new Map();
  for (const k of conn) {
    const [r, c] = k.split(',').map(Number);
    const cell = cellAt(s, r, c);
    for (let d = 0; d < 4; d++) {
      if (!cell.doors[d]) continue;
      const nr = r + DIRS[d][0], nc = c + DIRS[d][1];
      if (cellAt(s, nr, nc) !== null) continue;
      const tk = key(nr, nc);
      if (!map.has(tk)) map.set(tk, { r: nr, c: nc, from: [], dirs: [] });
      const t = map.get(tk);
      t.from.push({ r, c, d, locked: !!s.locks[lockKey(r, c, d)] });
      t.dirs.push(opp(d));
    }
  }
  const out = [...map.values()];
  for (const t of out) {
    t.locked = !!s.lockedCells[key(t.r, t.c)] || t.from.every((f) => f.locked);
    t.mystery = !!s.mystery[key(t.r, t.c)];
    t.disc = !!s.discoveryCells[key(t.r, t.c)];
  }
  return out;
}

export function validRotations(s, id, target) {
  const rots = [];
  for (let rot = 0; rot < 4; rot++) {
    const doors = roomDoors(id, rot);
    if (!target.dirs.some((d) => doors[d])) continue;
    const sig = doors.join('');
    if (rots.some((x) => roomDoors(id, x).join('') === sig)) continue;
    rots.push(rot);
  }
  return rots;
}

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

// Size of the connected same-family group containing (r, c).
export function wingAt(s, r, c) {
  const cell = cellAt(s, r, c);
  if (!cell || !cell.id || LANDMARKS.includes(cell.id)) return { size: 0, family: null };
  const fam = ROOMS[cell.id].family;
  const seen = new Set([key(r, c)]);
  const stack = [{ r, c }];
  while (stack.length) {
    const cur = stack.pop();
    for (const n of neighbors(s, cur.r, cur.c)) {
      if (!n.connected || n.room.family !== fam || LANDMARKS.includes(n.room.id) || seen.has(key(n.r, n.c))) continue;
      seen.add(key(n.r, n.c));
      stack.push({ r: n.r, c: n.c });
    }
  }
  return { size: seen.size, family: fam };
}
export function biggestWing(s) {
  let best = { size: 0, family: null };
  for (let r = 0; r < s.h; r++) for (let c = 0; c < s.w; c++) {
    const w = wingAt(s, r, c);
    if (w.size > best.size) best = w;
  }
  return best;
}

// ---------- deck ----------
function reshuffle(s) {
  s.deck = shuffle(s, s.discard);
  s.discard = [];
  const pen = Math.max(0, modValue(s, 'reshufflePenalty', BASE_RESHUFFLE));
  s.reshuffles++;
  s.res.steps = Math.max(0, s.res.steps - pen);
  for (const m of getMods(s)) if (m.onReshuffle) m.onReshuffle(s);
  log(s, `Deck reshuffled (−${pen} Steps).`);
}
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
const WORST_ORDER = ['rubble', 'furnace', 'servants', 'haunted', 'boarded', 'gambling', 'passage', 'bend', 'foyer', 'closet'];
function burnWorst(s) {
  for (const id of WORST_ORDER) {
    for (const pile of ['deck', 'discard']) {
      const i = s[pile].indexOf(id);
      if (i >= 0) { s[pile].splice(i, 1); log(s, `Burned ${ROOMS[id].name}.`); return; }
    }
  }
}
function addRandomCards(s, n, pred) {
  const got = [];
  for (let i = 0; i < n; i++) { const id = randomRoom(s, pred); if (id) got.push(id); }
  if (got.length) { s.discard.push(...got); log(s, `Added ${got.map((i) => ROOMS[i].name).join(', ')} to your deck.`); }
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
    dread(n) { s.dread = Math.max(0, s.dread + n); },
    neighbors: () => neighbors(s, r, c),
    placed: (pred) => s.cells.filter((x) => x && x.id && !LANDMARKS.includes(x.id) && pred(ROOMS[x.id])),
    onEdge: () => r === 0 || c === 0 || r === s.h - 1 || c === s.w - 1,
    toll(n) { ctx.goalDelta(n); },
    goalDelta(n) {
      if (s.goal.kind === 'wing') return;
      s.goal.delta += n;
      log(s, `The goal ${n > 0 ? 'rises' : 'drops'} by ${Math.abs(n)}.`);
    },
    burn(n) { for (let i = 0; i < n; i++) burnWorst(s); },
    addCards(ids) { s.discard.push(...ids); log(s, `Added ${ids.map((i) => ROOMS[i].name).join(', ')} to your deck.`); },
    addRandom(n, pred) { addRandomCards(s, n, pred); },
    collapse(n) { collapseNear(s, r, c, n); },
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
const approachKey = (s) => {
  const v = cellAt(s, s.vault.r, s.vault.c);
  const vd = v.doors.findIndex(Boolean);
  return key(s.vault.r + DIRS[vd][0], s.vault.c + DIRS[vd][1]);
};
function collapseNear(s, r, c, n) {
  const keep = approachKey(s);
  const empties = shuffle(s, DIRS.map(([dr, dc]) => ({ r: r + dr, c: c + dc }))
    .filter((p) => cellAt(s, p.r, p.c) === null && key(p.r, p.c) !== keep));
  empties.slice(0, n).forEach((p) => { setCell(s, p.r, p.c, { blocked: true, collapsed: true }); delete s.mystery[key(p.r, p.c)]; });
  if (empties.length && n) log(s, `${Math.min(n, empties.length)} cell(s) collapsed.`);
  return Math.min(n, empties.length);
}

// ---------- goals ----------
export const goalTarget = (s) => (s.goal.kind === 'wing' ? s.goal.n : Math.max(0, modValue(s, 'toll', s.goal.n + s.goal.delta)));
export function goalProgress(s) {
  if (s.goal.kind === 'wing') return Math.min(biggestWing(s).size, s.goal.n);
  return s.res[s.goal.res];
}
export const goalMet = (s) => goalProgress(s) >= goalTarget(s);
export const vaultConnected = (s) => connectedSet(s).has(key(s.vault.r, s.vault.c));
export const vaultToll = goalTarget; // back-compat name used by UI/bot
export function isWon(s) { return vaultConnected(s) && goalMet(s); }
export const RES_NAMES = { gems: 'Gems', coins: 'Coins', keys: 'Keys', steps: 'Steps' };
export function goalText(s) {
  const where = s.night === NIGHTS ? (s.mode === 'story' ? 'the Crime Scene' : 'the Vault') : 'the Stairwell';
  if (s.goal.kind === 'wing') return `Reach ${where} with a Wing of ${s.goal.n} connected rooms of one colour.`;
  return `Reach ${where} holding ${goalTarget(s)} ${RES_NAMES[s.goal.res]}.`;
}

// ---------- Dread ----------
function houseActs(s) {
  const acts = HOUSE_ACTS.filter((a) => a.minNight <= s.night);
  const total = acts.reduce((t, a) => t + a.weight, 0);
  let x = rand(s) * total;
  let act = acts[0];
  for (const a of acts) { x -= a.weight; if (x <= 0) { act = a; break; } }
  let did = true;
  switch (act.id) {
    case 'seal': {
      // Locks the open doorway nearest the goal: the house is spiteful.
      const ts = openTargets(s).filter((t) => !t.locked);
      if (!ts.length) { did = false; break; }
      ts.sort((a, b) => Math.abs(a.r - s.vault.r) + Math.abs(a.c - s.vault.c) - (Math.abs(b.r - s.vault.r) + Math.abs(b.c - s.vault.c)));
      for (const f of ts[0].from) s.locks[lockKey(f.r, f.c, f.d)] = true;
      break;
    }
    case 'collapse': {
      const conn = [...connectedSet(s)].map((k) => k.split(',').map(Number));
      let done = 0;
      for (const [r, c] of shuffle(s, conn)) { done = collapseNear(s, r, c, 1); if (done) break; }
      did = done > 0;
      break;
    }
    case 'chill': s.res.steps = Math.max(0, s.res.steps - 2); break;
    case 'rubble': s.deck.splice(Math.floor(rand(s) * (s.deck.length + 1)), 0, 'rubble'); break;
    case 'whisper': s.buffs.smallDraw += 2; break;
    case 'toll': if (s.goal.kind === 'wing') s.goal.n += 1; else s.goal.delta += 1; break;
    case 'shift': {
      const rooms = [];
      s.cells.forEach((cell, i) => { if (cell && cell.id && !LANDMARKS.includes(cell.id) && ROOMS[cell.id].shape !== 'X') rooms.push(i); });
      if (!rooms.length) { did = false; break; }
      const i = pick(s, rooms);
      const cell = s.cells[i];
      cell.rot = (cell.rot + 1) % 4;
      cell.doors = roomDoors(cell.id, cell.rot);
      s.lastShift = i;
      break;
    }
    default: break;
  }
  if (did) for (const m of getMods(s)) if (m.onHouseAct) m.onHouseAct(s);
  if (did) { log(s, `The house stirs: ${act.text}`); say(s, 'act'); s.lastAct = { id: act.id, text: act.text, n: (s.lastAct?.n || 0) + 1 }; }
}

// ---------- flow ----------
function canContinue(s) {
  if (s.res.steps <= 0 && !(s.buffs.freeDraft > 0)) return { ok: false, why: 'steps' };
  const ts = openTargets(s);
  if (!ts.length) return { ok: false, why: 'sealed' };
  const freeLock = getMods(s).some((m) => m.canFreeLock && m.canFreeLock(s));
  if (ts.every((t) => t.locked) && s.res.keys <= 0 && !freeLock) return { ok: false, why: 'locked' };
  return { ok: true };
}

function advance(s) {
  if (s.phase === 'won' || s.phase === 'lost') return;
  while (s.queue.length) {
    const q = s.queue.shift();
    if (q === 'shop') { s.shop = makeShop(s); s.phase = 'shop'; return; }
    if (q === 'heirloom') {
      const offer = heirloomOffer(s);
      if (offer.length) { s.heirloomOffer = offer; s.phase = 'heirloom'; return; }
    }
    if (q === 'event') {
      s.event = { id: pick(s, EVENTS).id };
      s.phase = 'event';
      return;
    }
    if (q === 'discovery') {
      const offer = discoveryOffer(s);
      if (offer.length) { s.discoveryOffer = offer; s.phase = 'discovery'; return; }
    }
  }
  if (s.between) { startNight(s, s.night + 1, s.carry || 0); return; }
  if (isWon(s)) { clearNight(s); return; }
  s.phase = 'door';
  s.pending = null;
  if (s.res.steps <= 0 && !(s.buffs.freeDraft > 0) && s.counters.secondWind > 0) {
    s.counters.secondWind--;
    s.res.steps += 3;
    log(s, 'Second Wind: +3 Steps.');
  }
  if (s.res.steps <= 3 && s.res.steps > 0) say(s, 'low');
  const cc = canContinue(s);
  if (!cc.ok) finish(s, false, cc.why);
}

function clearNight(s) {
  if (s.goal.kind === 'toll') s.res[s.goal.res] -= goalTarget(s);
  s.nightsCleared++;
  for (const m of getMods(s)) if (m.onNightClear) m.onNightClear(s);
  s.score += 30 + s.res.steps * 3 + Math.max(0, 10 - s.dread);
  // Everything you placed returns to your deck for the next Night.
  for (const cell of s.cells) if (cell && cell.id && !cell.preset && cell.id !== 'closet') s.discard.push(cell.id);
  s.deck = shuffle(s, [...s.deck, ...s.discard]);
  s.discard = [];
  if (s.night >= NIGHTS) { finish(s, true, 'vault'); return; }
  s.carry = Math.floor(s.res.steps / 2);
  log(s, `Night ${s.night} cleared!`);
  say(s, 'clear');
  const opts = shuffle(s, LANDINGS.filter((l) => l.id !== 'trophy' || s.heirlooms.length < MAX_HEIRLOOMS)).slice(0, 3);
  s.landing = opts.map((l) => l.id);
  s.phase = 'landing';
  s.pending = null;
}

function finish(s, won, why) {
  s.phase = won ? 'won' : 'lost';
  s.pending = null;
  if (won) s.score += 100 + s.res.gems * 2 + s.res.keys * 3 + s.res.coins + s.bonus + s.deed * 25;
  const ink = Math.round(s.placed * 0.6) + s.nightsCleared * 6 + (won ? 12 + s.deed * 4 : 0);
  s.result = { won, why, score: won ? s.score : 0, ink, nights: s.nightsCleared, drafts: s.drafts };
  say(s, won ? 'win' : 'lose');
  log(s, won ? (s.mode === 'story' ? 'The crime scene is reached!' : 'The Vault opens!') : `Run over: ${LOSS_TEXT[why]}`);
}
export const LOSS_TEXT = {
  steps: 'you ran out of Steps.',
  sealed: 'no open doorways remain.',
  locked: 'every doorway is locked and you have no Keys.',
  abandon: 'you left the house.',
};

function heirloomOffer(s) {
  if (s.heirlooms.length >= MAX_HEIRLOOMS) return [];
  return shuffle(s, Object.keys(HEIRLOOMS).filter((h) => !s.heirlooms.includes(h))).slice(0, 3);
}
function gainHeirloom(s, id) {
  s.heirlooms.push(id);
  if (HEIRLOOMS[id].onGain) HEIRLOOMS[id].onGain(s);
  log(s, `Heirloom gained: ${HEIRLOOMS[id].name}.`);
}

const SHOP_ITEMS = [
  { kind: 'steps', n: 3, price: 3, label: '+3 Steps' },
  { kind: 'keys', n: 1, price: 3, label: '+1 Key' },
  { kind: 'gems', n: 2, price: 3, label: '+2 Gems' },
  { kind: 'rerolls', n: 1, price: 2, label: '+1 Reroll' },
  { kind: 'remove', price: 2, label: 'Burn your worst card' },
  { kind: 'calm', n: 4, price: 2, label: 'Calm the house (−4 Dread)' },
  { kind: 'heirloom', price: 8 },
  { kind: 'card', price: 3 },
];
function makeShop(s) {
  const items = shuffle(s, SHOP_ITEMS.map((x) => ({ ...x }))).slice(0, 4);
  for (const it of items) {
    if (it.kind === 'heirloom') {
      const opts = Object.keys(HEIRLOOMS).filter((h) => !s.heirlooms.includes(h));
      if (!opts.length || s.heirlooms.length >= MAX_HEIRLOOMS) { Object.assign(it, { kind: 'steps', n: 3, price: 3, label: '+3 Steps' }); }
      else { it.id = pick(s, opts); it.label = `Heirloom: ${HEIRLOOMS[it.id].name}`; }
    }
    if (it.kind === 'card') { it.id = randomRoom(s, (r) => r.rarity !== 'common'); it.label = `Add ${ROOMS[it.id].name} (${ROOMS[it.id].rarity})`; }
    it.price = shopPrice(s, it.price);
    it.sold = false;
  }
  return { items };
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
        } else log(s, 'The lock gives way for free.');
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
      s.pending = { r: t.r, c: t.c, dirs: t.dirs, offers, pick: null, rots: null, rot: null, free, mystery: t.mystery };
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
      const m = mansionById(s.mansionId);
      const room = ROOMS[id];
      const chance = m.lockChance[s.night - 1] + (p.r <= s.h / 2 ? 0.03 : 0) + modValue(s, 'lockBonus', 0);
      for (let d = 0; d < 4; d++) {
        if (!cell.doors[d]) continue;
        const nr = p.r + DIRS[d][0], nc = p.c + DIRS[d][1];
        if (cellAt(s, nr, nc) !== null) continue;
        if (!room.noLock && (room.lockExits || rand(s) < chance)) s.locks[lockKey(p.r, p.c, d)] = true;
      }
      s.pending = null;
      s.lastAct = s.lastAct ? { ...s.lastAct, fresh: false } : null;
      log(s, `Placed ${room.name}.`);
      const ctx = makeCtx(s, p.r, p.c, room);
      if (room.family === 'green' && s.buffs.gardenDouble > 0) { ctx.double = true; s.buffs.gardenDouble--; }
      if (room.onPlace) room.onPlace(ctx);
      if (room.calm) ctx.dread(-room.calm);
      for (const mod of getMods(s)) if (mod.onPlace) mod.onPlace(ctx);
      if (id !== 'closet') s.lastPlaced = id;
      // Wings
      const wing = wingAt(s, p.r, p.c);
      if (wing.size >= 3 && wing.size > (s.wings[wing.family] || 0) && WINGS[wing.family]) {
        s.wings[wing.family] = wing.size;
        WINGS[wing.family].run(ctx);
        s.lastWing = { family: wing.family, size: wing.size, n: (s.lastWing?.n || 0) + 1 };
        for (const mod of getMods(s)) if (mod.onWing) mod.onWing(ctx, wing);
        log(s, `Wing of ${wing.size}: ${WINGS[wing.family].text}.`);
        say(s, 'wing');
      }
      // Mystery
      if (s.mystery[key(p.r, p.c)]) { delete s.mystery[key(p.r, p.c)]; s.queue.unshift('event'); say(s, 'mystery'); }
      // Discovery
      if (s.discoveryCells[key(p.r, p.c)]) { delete s.discoveryCells[key(p.r, p.c)]; s.queue.unshift('discovery'); }
      // Dread
      const sprawl = openTargets(s).length >= 6 ? 1 : 0;
      s.dread += Math.max(0, modValue(s, 'dreadPerDraft', 1)) + sprawl;
      if (s.dread >= s.dreadNext && !isWon(s)) {
        houseActs(s);
        s.dreadPrev = s.dreadNext;
        s.dreadNext += Math.max(3, modValue(s, 'dreadEvery', m.dreadEvery[s.night - 1]));
      }
      advance(s);
      return s;
    }
    case 'choose': {
      if (s.phase !== 'event') throw new Error('No event');
      const ev = EVENTS.find((e) => e.id === s.event.id);
      const opt = ev.options[a.index];
      if (!opt) throw new Error('Bad option');
      if (opt.need && !opt.need(s)) throw new Error('You can’t afford that');
      opt.run(makeCtx(s, s.vault.r, s.vault.c, ROOMS.closet));
      s.event = null;
      advance(s);
      return s;
    }
    case 'land': {
      if (s.phase !== 'landing') throw new Error('Not on a landing');
      const id = s.landing[a.index];
      const l = LANDINGS.find((x) => x.id === id);
      if (!l) throw new Error('Bad landing');
      l.run(s, { burn: (n) => { for (let i = 0; i < n; i++) burnWorst(s); }, addRandom: (n, pred) => addRandomCards(s, n, pred) });
      s.deck = shuffle(s, [...s.deck, ...s.discard]);
      s.discard = [];
      s.landing = null;
      s.between = true;
      advance(s);
      return s;
    }
    case 'buy': {
      if (s.phase !== 'shop') throw new Error('No shop');
      const it = s.shop.items[a.index];
      if (!it || it.sold) throw new Error('Not for sale');
      if (s.res.coins < it.price) throw new Error('Not enough Coins');
      if (it.kind === 'heirloom' && s.heirlooms.length >= MAX_HEIRLOOMS) throw new Error('Heirlooms full');
      s.res.coins -= it.price;
      it.sold = true;
      if (['steps', 'keys', 'gems', 'rerolls'].includes(it.kind)) s.res[it.kind] += it.n;
      else if (it.kind === 'remove') burnWorst(s);
      else if (it.kind === 'calm') s.dread = Math.max(0, s.dread - it.n);
      else if (it.kind === 'card') s.discard.push(it.id);
      else if (it.kind === 'heirloom') gainHeirloom(s, it.id);
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
    case 'discover': {
      if (s.phase !== 'discovery') throw new Error('No discovery offer');
      if (a.index >= 0) {
        const id = s.discoveryOffer[a.index];
        if (!id) throw new Error('Bad discovery');
        s.discoveredThisRun.push(id);
        s.knownDiscoveries.push(id);
        s.discard.push(id);
        s.pool.push(id);
        log(s, `Discovered ${ROOMS[id].name}!`);
      }
      s.discoveryOffer = null;
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

function discoveryOffer(s) {
  const available = Object.keys(ROOMS).filter((id) => ROOMS[id].discover && !s.knownDiscoveries.includes(id) && !s.discoveredThisRun.includes(id));
  return shuffle(s, available).slice(0, 3);
}

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
    if (n && n.id) { if (n.doors[opp(d)]) sc += LANDMARKS.includes(n.id) && n.id !== 'entrance' ? 100 : 0.5; else sc -= 0.5; continue; }
    const before = Math.abs(target.r - s.vault.r) + Math.abs(target.c - s.vault.c);
    const after = Math.abs(nr - s.vault.r) + Math.abs(nc - s.vault.c);
    sc += 1 + (after < before ? 1 : 0);
  }
  return sc;
}
