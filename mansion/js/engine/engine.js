import { mulberry32, shuffle, pick as rngPick } from './rng.js';
import { ROOMS, ENTRANCE, getRoomById, rotateDoors, FAMILY_EFFECTS, ITEM_TABLES } from '../data/rooms.js';
import { generateClue } from './clues.js';

export const COLS = 5, ROWS = 6;
export const ENTRANCE_COL = 2, ENTRANCE_ROW = 5;
const DIR = [[0,-1],[1,0],[0,1],[-1,0]]; // N,E,S,W
const OPP = [2,3,0,1];

const BASE_ENERGY = 14;
const DRAFT_SIZE = 3;
const MAX_CLUES_PER_CELL = 3;

export { DIR, OPP };

export function inBounds(c, r) { return c >= 0 && c < COLS && r >= 0 && r < ROWS; }

export function cellKey(c, r) { return `${c},${r}`; }

function neighborsWithDoors(c, r, doors) {
  const result = [];
  for (let d = 0; d < 4; d++) {
    if (!doors[d]) continue;
    const nc = c + DIR[d][0];
    const nr = r + DIR[d][1];
    if (inBounds(nc, nr)) result.push({ c: nc, r: nr, dir: d });
  }
  return result;
}

// --- Blueprint generation ---

export function generateBlueprint(seed) {
  const rng = mulberry32(seed);
  const placed = new Map();

  const entranceDoors = rotateDoors(ENTRANCE.doors, 2);
  placed.set(cellKey(ENTRANCE_COL, ENTRANCE_ROW), {
    c: ENTRANCE_COL, r: ENTRANCE_ROW, roomId: ENTRANCE.id, rot: 2,
  });

  const available = shuffle(ROOMS.slice(), rng);
  let pool = [...available, ...available.slice(0, 15)];
  pool = shuffle(pool, rng);

  const openDoors = [];
  for (const nd of neighborsWithDoors(ENTRANCE_COL, ENTRANCE_ROW, entranceDoors)) {
    if (!placed.has(cellKey(nd.c, nd.r))) {
      openDoors.push({ c: nd.c, r: nd.r, fromDir: OPP[nd.dir] });
    }
  }

  let attempts = 0;
  const targetRooms = 14 + Math.floor(rng() * 4); // 14-17 rooms + entrance

  while (placed.size < targetRooms && openDoors.length > 0 && pool.length > 0 && attempts < 500) {
    attempts++;
    const doorIdx = Math.floor(rng() * openDoors.length);
    const { c, r, fromDir } = openDoors[doorIdx];

    if (placed.has(cellKey(c, r))) {
      openDoors.splice(doorIdx, 1);
      continue;
    }

    let bestRoom = null;
    let bestRot = 0;
    let bestScore = -1;

    for (let pi = 0; pi < Math.min(pool.length, 10); pi++) {
      const room = pool[pi];
      for (let rot = 0; rot < 4; rot++) {
        const doors = rotateDoors(room.doors, rot);
        if (!doors[fromDir]) continue;

        let conflicts = false;
        let connections = 0;
        for (let d = 0; d < 4; d++) {
          const nc = c + DIR[d][0];
          const nr = r + DIR[d][1];
          if (!inBounds(nc, nr)) {
            if (doors[d]) { conflicts = true; break; }
            continue;
          }
          const neighbor = placed.get(cellKey(nc, nr));
          if (neighbor) {
            const nRoom = getRoomById(neighbor.roomId);
            const nDoors = rotateDoors(nRoom.doors, neighbor.rot);
            if (doors[d] && !nDoors[OPP[d]]) { conflicts = true; break; }
            if (!doors[d] && nDoors[OPP[d]]) { conflicts = true; break; }
            if (doors[d] && nDoors[OPP[d]]) connections++;
          }
        }
        if (conflicts) continue;

        const score = connections + rng() * 0.5;
        if (score > bestScore) {
          bestScore = score;
          bestRoom = pi;
          bestRot = rot;
        }
      }
    }

    if (bestRoom === null) {
      openDoors.splice(doorIdx, 1);
      continue;
    }

    const chosen = pool.splice(bestRoom, 1)[0];
    const doors = rotateDoors(chosen.doors, bestRot);
    placed.set(cellKey(c, r), { c, r, roomId: chosen.id, rot: bestRot });
    openDoors.splice(doorIdx, 1);

    for (const nd of neighborsWithDoors(c, r, doors)) {
      if (!placed.has(cellKey(nd.c, nd.r)) && !openDoors.some(o => o.c === nd.c && o.r === nd.r)) {
        openDoors.push({ c: nd.c, r: nd.r, fromDir: OPP[nd.dir] });
      }
    }
  }

  if (!verifyConnectivity(placed)) {
    return generateBlueprint(seed + 7);
  }

  const cells = [];
  for (const p of placed.values()) cells.push(p);

  // Determine locked doors based on row depth
  const lockedCells = {};
  for (const cell of cells) {
    if (cell.r === ENTRANCE_ROW || cell.r === ENTRANCE_ROW - 1) continue; // rows 4-5 never locked
    const depth = ENTRANCE_ROW - cell.r; // 2-5
    const lockChance = depth <= 3 ? 0.3 : 0.6;
    const lockRng = mulberry32(seed * 31 + cell.c * 100 + cell.r);
    if (lockRng() < lockChance) {
      lockedCells[cellKey(cell.c, cell.r)] = true;
    }
  }

  return { seed, cells, roomCount: cells.length, lockedCells };
}

function verifyConnectivity(placed) {
  if (placed.size <= 1) return true;
  const start = cellKey(ENTRANCE_COL, ENTRANCE_ROW);
  const visited = new Set([start]);
  const queue = [start];

  while (queue.length > 0) {
    const key = queue.shift();
    const cell = placed.get(key);
    if (!cell) continue;
    const room = getRoomById(cell.roomId);
    const doors = rotateDoors(room.doors, cell.rot);

    for (let d = 0; d < 4; d++) {
      if (!doors[d]) continue;
      const nc = cell.c + DIR[d][0];
      const nr = cell.r + DIR[d][1];
      const nk = cellKey(nc, nr);
      if (!visited.has(nk) && placed.has(nk)) {
        visited.add(nk);
        queue.push(nk);
      }
    }
  }
  return visited.size === placed.size;
}

// --- Game state ---

export function newGame(seed) {
  const blueprint = generateBlueprint(seed);
  return {
    blueprint,
    seed,
    locked: {},
    unlockedDoors: {},
    clueJournal: {},
    meta: { runs: 0, ink: 0, upgrades: {} },
    run: null,
  };
}

export function newRun(state) {
  const s = structuredClone(state);
  const rng = mulberry32(s.seed * 1000 + s.meta.runs + 1);

  const extraEnergy = (s.meta.upgrades.energy || 0) * 2;
  const extraGems = s.meta.upgrades.startGem ? 1 : 0;
  const extraKeys = s.meta.upgrades.startKey ? 1 : 0;

  // Build the room pool for this run (exclude permanently locked rooms)
  const usedIds = new Set();
  for (const key of Object.keys(s.locked)) {
    usedIds.add(s.locked[key].roomId);
  }
  const roomPool = shuffle(ROOMS.filter(r => !usedIds.has(r.id)).map(r => r.id), rng);

  s.run = {
    placed: {},
    energy: BASE_ENERGY + extraEnergy,
    gems: extraGems,
    keys: extraKeys,
    coins: 0,
    roomPool,
    draftCell: null,
    draftOptions: null,
    lockedThisRun: 0,
    phase: 'exploring', // exploring | drafting | ended | won
    rngState: Math.floor(rng() * 2147483647),
    lastItems: null,
  };

  // Compute initial open/locked doors from the entrance + any permanently locked rooms
  computeDoors(s);
  return s;
}

function computeDoors(state) {
  if (!state.run) return;

  const allPlaced = new Map();

  // Always include entrance
  const ek = cellKey(ENTRANCE_COL, ENTRANCE_ROW);
  allPlaced.set(ek, { c: ENTRANCE_COL, r: ENTRANCE_ROW, roomId: ENTRANCE.id, rot: 2 });

  // Permanently locked rooms
  for (const [key, cell] of Object.entries(state.locked)) {
    allPlaced.set(key, cell);
  }
  // Rooms placed this run
  for (const [key, cell] of Object.entries(state.run.placed)) {
    allPlaced.set(key, cell);
  }

  const openDoors = [];
  const lockedDoors = [];

  for (const [, cell] of allPlaced) {
    const room = getRoomById(cell.roomId);
    const doors = rotateDoors(room.doors, cell.rot);
    for (let d = 0; d < 4; d++) {
      if (!doors[d]) continue;
      const nc = cell.c + DIR[d][0];
      const nr = cell.r + DIR[d][1];
      if (!inBounds(nc, nr)) continue;
      const nk = cellKey(nc, nr);
      if (allPlaced.has(nk)) continue;
      if (openDoors.some(o => o.c === nc && o.r === nr)) continue;
      if (lockedDoors.some(o => o.c === nc && o.r === nr)) continue;

      // Check if this cell has a locked door in the blueprint
      const isLocked = state.blueprint.lockedCells[nk] && !state.unlockedDoors[nk];
      if (isLocked) {
        lockedDoors.push({ c: nc, r: nr });
      } else {
        openDoors.push({ c: nc, r: nr });
      }
    }
  }

  state.run.openDoors = openDoors;
  state.run.lockedDoors = lockedDoors;
}

// --- Draft generation ---

function generateDraft(c, r, state) {
  const rng = mulberry32(state.run.rngState + c * 97 + r * 13 + Object.keys(state.run.placed).length);
  state.run.rngState = Math.floor(rng() * 2147483647);

  const depth = ENTRANCE_ROW - r; // 0 at entrance, up to 5
  const required = getRequiredDoors(c, r, state);

  // Filter room pool to rooms that can physically connect
  const usedIds = new Set([...Object.values(state.locked).map(c => c.roomId),
                           ...Object.values(state.run.placed).map(c => c.roomId)]);

  const fitting = [];
  for (const roomId of state.run.roomPool) {
    if (usedIds.has(roomId)) continue;
    const room = getRoomById(roomId);
    for (let rot = 0; rot < 4; rot++) {
      if (canPlace(roomId, rot, c, r, state)) {
        fitting.push({ roomId, rot, room });
        break; // one valid rotation is enough to include
      }
    }
  }

  if (fitting.length === 0) return null;

  // Weight by depth and rarity
  const weighted = fitting.map(f => {
    let w = 1;
    const bpCell = state.blueprint.cells.find(cell => cell.c === c && cell.r === r);

    // Rooms whose blueprint row matches this row get a boost
    if (bpCell && bpCell.roomId === f.roomId) w += 2;

    // Rarity weighting by depth
    if (f.room.rarity === 'common') w += Math.max(0, 3 - depth);
    if (f.room.rarity === 'uncommon') w += 1;
    if (f.room.rarity === 'rare') w += depth * 0.5;

    // Prefer free rooms more often (cost 0 gems)
    if (f.room.cost === 0) w += 1;

    return { ...f, weight: w };
  });

  const totalWeight = weighted.reduce((s, w) => s + w.weight, 0);

  function pickWeighted() {
    let roll = rng() * totalWeight;
    for (const w of weighted) {
      roll -= w.weight;
      if (roll <= 0) return w;
    }
    return weighted[weighted.length - 1];
  }

  const options = [];
  const pickedIds = new Set();

  // Slot 1 & 2: weighted picks
  for (let i = 0; i < 2 && options.length < 2; i++) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const pick = pickWeighted();
      if (!pickedIds.has(pick.roomId)) {
        pickedIds.add(pick.roomId);
        options.push(pick);
        break;
      }
    }
  }

  // Slot 3: skew rare / higher cost
  const rarePool = weighted.filter(w => !pickedIds.has(w.roomId) && (w.room.rarity === 'rare' || w.room.rarity === 'uncommon'));
  if (rarePool.length > 0) {
    const pick = rarePool[Math.floor(rng() * rarePool.length)];
    pickedIds.add(pick.roomId);
    options.push(pick);
  } else if (weighted.filter(w => !pickedIds.has(w.roomId)).length > 0) {
    const remaining = weighted.filter(w => !pickedIds.has(w.roomId));
    const pick = remaining[Math.floor(rng() * remaining.length)];
    pickedIds.add(pick.roomId);
    options.push(pick);
  }

  // Ensure at least one free option (cost 0)
  const hasFree = options.some(o => o.room.cost === 0);
  if (!hasFree && options.length > 0) {
    const freeOptions = weighted.filter(w => !pickedIds.has(w.roomId) && w.room.cost === 0);
    if (freeOptions.length > 0) {
      const freeRoom = freeOptions[Math.floor(rng() * freeOptions.length)];
      options[0] = freeRoom; // replace first slot
    }
  }

  // If we have fewer than 3, fill from whatever remains
  while (options.length < DRAFT_SIZE) {
    const remaining = weighted.filter(w => !pickedIds.has(w.roomId));
    if (remaining.length === 0) break;
    const pick = remaining[Math.floor(rng() * remaining.length)];
    pickedIds.add(pick.roomId);
    options.push(pick);
  }

  return options.map(o => ({ roomId: o.roomId, rot: findBestRotation(o.roomId, c, r, state) }));
}

function generateItems(family, rng) {
  const table = ITEM_TABLES[family];
  if (!table) return [];
  const items = [];
  for (const entry of table) {
    if (rng() < entry.chance) {
      items.push(entry.item);
    }
  }
  return items;
}

// --- Placement helpers ---

function getRequiredDoors(c, r, state) {
  const required = [null, null, null, null];
  const allPlaced = {};

  // Entrance
  const ek = cellKey(ENTRANCE_COL, ENTRANCE_ROW);
  allPlaced[ek] = { c: ENTRANCE_COL, r: ENTRANCE_ROW, roomId: ENTRANCE.id, rot: 2 };

  Object.assign(allPlaced, state.locked);
  if (state.run) Object.assign(allPlaced, state.run.placed);

  for (let d = 0; d < 4; d++) {
    const nc = c + DIR[d][0];
    const nr = r + DIR[d][1];
    if (!inBounds(nc, nr)) {
      required[d] = 0;
      continue;
    }
    const nk = cellKey(nc, nr);
    const neighbor = allPlaced[nk];
    if (neighbor) {
      const nRoom = getRoomById(neighbor.roomId);
      const nDoors = rotateDoors(nRoom.doors, neighbor.rot);
      required[d] = nDoors[OPP[d]] ? 1 : 0;
    }
  }
  return required;
}

export function canPlace(roomId, rot, c, r, state) {
  const room = getRoomById(roomId);
  if (!room) return false;
  const doors = rotateDoors(room.doors, rot);
  const required = getRequiredDoors(c, r, state);

  let hasConnection = false;
  for (let d = 0; d < 4; d++) {
    if (required[d] === null) continue;
    if (required[d] === 1 && !doors[d]) return false;
    if (required[d] === 0 && doors[d]) {
      const nc = c + DIR[d][0];
      const nr = r + DIR[d][1];
      if (!inBounds(nc, nr)) return false;
    }
    if (required[d] === 1 && doors[d]) hasConnection = true;
  }
  return hasConnection;
}

export function findBestRotation(roomId, c, r, state) {
  const bpCell = state.blueprint.cells.find(cell => cell.c === c && cell.r === r);
  // Prefer the blueprint-correct rotation
  for (let rot = 0; rot < 4; rot++) {
    if (bpCell && bpCell.roomId === roomId && bpCell.rot === rot && canPlace(roomId, rot, c, r, state)) {
      return rot;
    }
  }
  for (let rot = 0; rot < 4; rot++) {
    if (canPlace(roomId, rot, c, r, state)) return rot;
  }
  return 0;
}

function checkCorrect(roomId, rot, c, r, blueprint) {
  const bpCell = blueprint.cells.find(cell => cell.c === c && cell.r === r);
  if (!bpCell) return false;
  return bpCell.roomId === roomId && bpCell.rot === rot;
}

function checkWin(state) {
  for (const cell of state.blueprint.cells) {
    if (!state.locked[cellKey(cell.c, cell.r)]) return false;
  }
  return true;
}

// --- Main action dispatcher ---

export function act(state, action) {
  const s = structuredClone(state);

  switch (action.type) {

    case 'openDoor': {
      if (!s.run || s.run.phase !== 'exploring') return s;
      const { c, r } = action;
      const key = cellKey(c, r);

      // Must be a valid open door
      if (!s.run.openDoors.some(d => d.c === c && d.r === r)) return s;

      // Generate 3 draft options for this cell
      const options = generateDraft(c, r, s);
      if (!options || options.length === 0) return s;

      s.run.draftCell = { c, r };
      s.run.draftOptions = options;
      s.run.phase = 'drafting';
      return s;
    }

    case 'unlockDoor': {
      if (!s.run || s.run.phase !== 'exploring') return s;
      const { c, r } = action;
      const key = cellKey(c, r);

      if (!s.run.lockedDoors.some(d => d.c === c && d.r === r)) return s;
      if (s.run.keys < 1) return s;

      s.run.keys--;
      s.unlockedDoors[key] = true;

      // Recompute doors — this cell is now open
      computeDoors(s);
      return s;
    }

    case 'draftRoom': {
      if (!s.run || s.run.phase !== 'drafting') return s;
      const { index } = action;
      if (!s.run.draftOptions || index < 0 || index >= s.run.draftOptions.length) return s;

      const option = s.run.draftOptions[index];
      const { c, r } = s.run.draftCell;
      const { roomId, rot } = option;
      const room = getRoomById(roomId);

      // Check gem cost
      if (room.cost > s.run.gems) return s;

      // Check energy
      const effect = FAMILY_EFFECTS[room.family];
      const energyCost = (effect && effect.type === 'costly') ? effect.value : 1;
      if (s.run.energy < energyCost) return s;

      // Pay costs
      s.run.gems -= room.cost;
      s.run.energy -= energyCost;

      // Place the room
      const key = cellKey(c, r);
      const isCorrect = checkCorrect(roomId, rot, c, r, s.blueprint);

      if (isCorrect) {
        s.locked[key] = { c, r, roomId, rot };
        s.run.lockedThisRun++;
      } else {
        s.run.placed[key] = { c, r, roomId, rot };
      }

      // Apply room family effect
      if (effect) {
        applyRoomEffect(s, effect, room, c, r, isCorrect);
      }

      // Roll item drops
      const itemRng = mulberry32(s.run.rngState + roomId * 7 + c * 11 + r * 3);
      s.run.rngState = Math.floor(itemRng() * 2147483647);
      const items = generateItems(room.family, itemRng);
      for (const item of items) {
        switch (item) {
          case 'gem': s.run.gems++; break;
          case 'coin': s.run.coins++; break;
          case 'key': s.run.keys++; break;
          case 'food': s.run.energy += 2; break;
        }
      }
      s.run.lastItems = items.length > 0 ? items : null;

      // Clear draft state
      s.run.draftCell = null;
      s.run.draftOptions = null;

      // Check win
      if (checkWin(s)) {
        s.run.phase = 'won';
        return s;
      }

      // Recompute doors
      computeDoors(s);

      // Check if player can continue
      if (s.run.energy <= 0 && s.run.openDoors.length > 0) {
        return endRun(s);
      }

      s.run.phase = 'exploring';
      return s;
    }

    case 'tapClue': {
      if (!s.run) return s;
      const { c, r } = action;
      const key = cellKey(c, r);
      if (s.locked[key]) return s;

      const existing = s.clueJournal[key] || [];
      if (existing.length >= MAX_CLUES_PER_CELL) return s;

      const bpCell = s.blueprint.cells.find(cell => cell.c === c && cell.r === r);
      if (!bpCell) return s;

      // Clues cost 1 coin
      if (s.run.coins < 1) return s;
      s.run.coins--;

      const rng = mulberry32(s.seed * 7 + c * 100 + r * 10 + existing.length);
      const clue = generateClue(bpCell, s.blueprint, rng, existing);
      s.clueJournal[key] = [...existing, clue];
      return s;
    }

    case 'endRun': {
      if (!s.run || s.run.phase === 'ended' || s.run.phase === 'won') return s;
      return endRun(s);
    }

    case 'buyUpgrade': {
      const { upgrade } = action;
      const upgrades = getUpgradeList();
      const def = upgrades.find(u => u.id === upgrade);
      if (!def) return s;
      const current = s.meta.upgrades[upgrade] || 0;
      if (current >= def.max) return s;
      if (s.meta.ink < def.cost) return s;
      s.meta.ink -= def.cost;
      s.meta.upgrades[upgrade] = current + 1;
      return s;
    }

    default:
      return s;
  }
}

function applyRoomEffect(s, effect, room, c, r, isCorrect) {
  switch (effect.type) {
    case 'energy':
      s.run.energy += effect.value;
      break;
    case 'food':
      s.run.energy += 2;
      break;
    case 'gem':
      s.run.gems += effect.value;
      break;
    case 'key':
      s.run.keys += effect.value;
      break;
    case 'oracle': {
      const key = cellKey(c, r);
      s.clueJournal[key] = s.clueJournal[key] || [];
      s.clueJournal[key].push({
        type: 'oracle',
        text: isCorrect
          ? '**This room is in its rightful place.**'
          : '**This room does not belong here.**',
      });
      break;
    }
    case 'clue': {
      const rng = mulberry32(s.seed * 11 + c * 50 + r * 7 + s.meta.runs);
      const neighbors = [];
      for (const [dc, dr] of DIR) {
        const nc = c + dc, nr = r + dr;
        if (!inBounds(nc, nr)) continue;
        const nk = cellKey(nc, nr);
        if (s.locked[nk]) continue;
        const bpCell = s.blueprint.cells.find(cell => cell.c === nc && cell.r === nr);
        if (bpCell) neighbors.push(bpCell);
      }
      if (neighbors.length > 0) {
        const target = neighbors[Math.floor(rng() * neighbors.length)];
        const tk = cellKey(target.c, target.r);
        s.clueJournal[tk] = s.clueJournal[tk] || [];
        const clue = generateClue(target, s.blueprint, rng, s.clueJournal[tk]);
        s.clueJournal[tk].push(clue);
      }
      break;
    }
    case 'lush': // handled by item drops (Garden has rich item table)
    case 'passage': // handled by shape (Halls have many doors)
    case 'costly': // handled by energy cost in draftRoom
      break;
  }
}

function endRun(state) {
  const s = state;
  s.meta.runs++;

  const inkEarned = 1 + s.run.lockedThisRun + Math.floor(s.run.coins / 5);
  s.meta.ink += inkEarned;

  s.run.inkEarned = inkEarned;
  s.run.phase = 'ended';

  // Clear non-permanent placements
  s.run.placed = {};
  computeDoors(s);
  return s;
}

// --- Upgrades ---

export function getUpgradeList() {
  return [
    { id: 'energy', name: '+2 Max Energy', desc: 'Start each run with 2 extra energy', cost: 15, max: 2 },
    { id: 'startGem', name: '+1 Starting Gem', desc: 'Start each run with 1 gem', cost: 25, max: 1 },
    { id: 'startKey', name: '+1 Starting Key', desc: 'Start each run with 1 key', cost: 25, max: 1 },
    { id: 'keenEye', name: 'Keen Eye', desc: 'Draft options show family hints', cost: 30, max: 1 },
  ];
}

// --- Progress ---

export function getProgress(state) {
  const total = state.blueprint.cells.length;
  const locked = Object.keys(state.locked).length;
  return { locked, total, percent: Math.round((locked / total) * 100) };
}
