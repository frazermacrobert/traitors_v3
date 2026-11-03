import { mulberry32, shuffle, pick as rngPick, pickN } from './rng.js';
import { ROOMS, ENTRANCE, getRoomById, rotateDoors, getDoorsAt } from '../data/rooms.js';
import { generateClue } from './clues.js';

const COLS = 5, ROWS = 9;
const ENTRANCE_COL = 2, ENTRANCE_ROW = 8;
const DIR = [[0,-1],[1,0],[0,1],[-1,0]]; // N,E,S,W
const OPP = [2,3,0,1];

const BASE_STEPS = 18;
const BASE_KEYS = 3;
const DRAFT_SIZE = 3;
const MAX_CLUES_PER_CELL = 3;

function inBounds(c, r) { return c >= 0 && c < COLS && r >= 0 && r < ROWS; }

function cellKey(c, r) { return `${c},${r}`; }

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

export function generateBlueprint(seed) {
  const rng = mulberry32(seed);
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  const placed = new Map();

  const entranceDoors = rotateDoors(ENTRANCE.doors, 2); // T facing north: doors N,E,W
  grid[ENTRANCE_ROW][ENTRANCE_COL] = { roomId: ENTRANCE.id, rot: 2 };
  placed.set(cellKey(ENTRANCE_COL, ENTRANCE_ROW), { c: ENTRANCE_COL, r: ENTRANCE_ROW, roomId: ENTRANCE.id, rot: 2 });

  const available = shuffle(ROOMS.slice(), rng);
  let pool = [...available, ...available.slice(0, 15)]; // extra copies for fill
  pool = shuffle(pool, rng);

  const openDoors = [];
  const eDoors = neighborsWithDoors(ENTRANCE_COL, ENTRANCE_ROW, entranceDoors);
  for (const nd of eDoors) {
    if (!placed.has(cellKey(nd.c, nd.r))) {
      openDoors.push({ c: nd.c, r: nd.r, fromDir: OPP[nd.dir] });
    }
  }

  let attempts = 0;
  const targetRooms = 25 + Math.floor(rng() * 6);

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
    grid[r][c] = { roomId: chosen.id, rot: bestRot };
    placed.set(cellKey(c, r), { c, r, roomId: chosen.id, rot: bestRot });
    openDoors.splice(doorIdx, 1);

    const newDoors = neighborsWithDoors(c, r, doors);
    for (const nd of newDoors) {
      if (!placed.has(cellKey(nd.c, nd.r)) && !openDoors.some(o => o.c === nd.c && o.r === nd.r)) {
        openDoors.push({ c: nd.c, r: nd.r, fromDir: OPP[nd.dir] });
      }
    }
  }

  if (!verifyConnectivity(placed)) {
    return generateBlueprint(seed + 7);
  }

  const cells = [];
  for (const p of placed.values()) {
    cells.push(p);
  }

  return { seed, cells, roomCount: cells.length };
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

export function newGame(seed) {
  const blueprint = generateBlueprint(seed);
  return {
    blueprint,
    seed,
    locked: {},
    clueJournal: {},
    meta: { runs: 0, totalSteps: 0, totalClues: 0, ink: 0, upgrades: {} },
    run: null,
  };
}

export function newRun(state) {
  const s = structuredClone(state);
  const rng = mulberry32(s.seed * 1000 + s.meta.runs + 1);

  const extraSteps = (s.meta.upgrades.steps || 0) * 2;
  const extraKeys = s.meta.upgrades.keys || 0;

  const deck = buildDeck(s, rng);

  s.run = {
    placed: {},
    steps: BASE_STEPS + extraSteps,
    keys: BASE_KEYS + extraKeys,
    deck,
    draft: null,
    selectedDraft: -1,
    placementRotation: 0,
    openDoors: [],
    rngState: Math.floor(rng() * 2147483647),
    lockedThisRun: 0,
    cluesThisRun: 0,
    phase: 'drafting', // drafting | placing | tapClue | ended
  };

  computeOpenDoors(s);
  s.run.draft = drawDraft(s);

  return s;
}

function buildDeck(state, rng) {
  const usedIds = new Set();
  for (const key of Object.keys(state.locked)) {
    usedIds.add(state.locked[key].roomId);
  }
  let pool = ROOMS.filter(r => !usedIds.has(r.id));
  pool = [...pool, ...pool.slice(0, Math.floor(pool.length * 0.5))];
  return shuffle(pool.map(r => r.id), rng);
}

function drawDraft(state) {
  const deck = state.run.deck;
  const draft = [];
  for (let i = 0; i < DRAFT_SIZE && deck.length > 0; i++) {
    draft.push(deck.pop());
  }
  return draft;
}

function computeOpenDoors(state) {
  const allPlaced = new Map();

  for (const key of Object.keys(state.locked)) {
    const cell = state.locked[key];
    allPlaced.set(key, cell);
  }
  if (state.run) {
    for (const key of Object.keys(state.run.placed)) {
      allPlaced.set(key, state.run.placed[key]);
    }
  }

  if (allPlaced.size === 0) {
    const ek = cellKey(ENTRANCE_COL, ENTRANCE_ROW);
    const entranceCell = { c: ENTRANCE_COL, r: ENTRANCE_ROW, roomId: ENTRANCE.id, rot: 2 };
    allPlaced.set(ek, entranceCell);
    state.locked[ek] = entranceCell;
  }

  const open = [];
  for (const [, cell] of allPlaced) {
    const room = getRoomById(cell.roomId);
    const doors = rotateDoors(room.doors, cell.rot);
    for (let d = 0; d < 4; d++) {
      if (!doors[d]) continue;
      const nc = cell.c + DIR[d][0];
      const nr = cell.r + DIR[d][1];
      if (!inBounds(nc, nr)) continue;
      const nk = cellKey(nc, nr);
      if (!allPlaced.has(nk)) {
        if (!open.some(o => o.c === nc && o.r === nr)) {
          open.push({ c: nc, r: nr });
        }
      }
    }
  }
  if (state.run) state.run.openDoors = open;
}

function getRequiredDoors(c, r, state) {
  const required = [null, null, null, null];
  const allPlaced = { ...state.locked, ...(state.run ? state.run.placed : {}) };

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

function checkCorrect(roomId, rot, c, r, blueprint) {
  const bpCell = blueprint.cells.find(cell => cell.c === c && cell.r === r);
  if (!bpCell) return false;
  return bpCell.roomId === roomId && bpCell.rot === rot;
}

export function getValidPlacements(roomId, rot, state) {
  if (!state.run) return [];
  return state.run.openDoors.filter(({ c, r }) => canPlace(roomId, rot, c, r, state));
}

export function getAllValidPlacements(roomId, state) {
  if (!state.run) return [];
  const seen = new Set();
  const results = [];
  for (let rot = 0; rot < 4; rot++) {
    for (const { c, r } of state.run.openDoors) {
      const key = cellKey(c, r);
      if (seen.has(key)) continue;
      if (canPlace(roomId, rot, c, r, state)) {
        seen.add(key);
        results.push({ c, r });
      }
    }
  }
  return results;
}

export function findBestRotation(roomId, c, r, state) {
  const bpCell = state.blueprint.cells.find(cell => cell.c === c && cell.r === r);
  for (let rot = 0; rot < 4; rot++) {
    if (bpCell && bpCell.roomId === roomId && bpCell.rot === rot && canPlace(roomId, rot, c, r, state)) {
      return rot;
    }
  }
  for (let rot = 0; rot < 4; rot++) {
    if (canPlace(roomId, rot, c, r, state)) return rot;
  }
  return -1;
}

export function act(state, action) {
  const s = structuredClone(state);

  switch (action.type) {
    case 'selectDraft': {
      if (!s.run || s.run.phase !== 'drafting') return s;
      const idx = action.index;
      if (idx < 0 || idx >= s.run.draft.length) return s;
      s.run.selectedDraft = idx;
      s.run.placementRotation = 0;
      s.run.phase = 'placing';
      return s;
    }

    case 'rotate': {
      if (!s.run || s.run.phase !== 'placing') return s;
      s.run.placementRotation = (s.run.placementRotation + 1) % 4;
      return s;
    }

    case 'place': {
      if (!s.run || s.run.phase !== 'placing') return s;
      const { c, r } = action;
      const roomId = s.run.draft[s.run.selectedDraft];
      const rot = findBestRotation(roomId, c, r, s);

      if (rot < 0 || !canPlace(roomId, rot, c, r, s)) return s;

      const key = cellKey(c, r);
      const isCorrect = checkCorrect(roomId, rot, c, r, s.blueprint);

      if (isCorrect) {
        s.locked[key] = { c, r, roomId, rot };
        s.run.lockedThisRun++;
      } else {
        s.run.placed[key] = { c, r, roomId, rot };
        s.run.steps--;
      }

      const room = getRoomById(roomId);
      if (room.givesKey) s.run.keys += room.givesKey;

      s.run.draft.splice(s.run.selectedDraft, 1);
      s.run.selectedDraft = -1;
      s.run.placementRotation = 0;
      computeOpenDoors(s);

      if (checkWin(s)) {
        s.run.phase = 'won';
        return s;
      }

      if (s.run.steps <= 0 || s.run.deck.length === 0) {
        return endRun(s);
      }

      s.run.draft = drawDraft(s);
      if (s.run.draft.length === 0) return endRun(s);

      s.run.phase = 'drafting';
      return s;
    }

    case 'tapClue': {
      if (!s.run || s.run.keys <= 0) return s;
      const { c, r } = action;
      const key = cellKey(c, r);

      if (s.locked[key]) return s;

      const existing = s.clueJournal[key] || [];
      if (existing.length >= MAX_CLUES_PER_CELL) return s;

      const bpCell = s.blueprint.cells.find(cell => cell.c === c && cell.r === r);
      if (!bpCell) return s;

      const rng = mulberry32(s.seed * 7 + c * 100 + r * 10 + existing.length);
      const clue = generateClue(bpCell, s.blueprint, rng, existing);

      s.run.keys--;
      s.clueJournal[key] = [...existing, clue];
      s.run.cluesThisRun++;
      s.meta.totalClues++;
      return s;
    }

    case 'endRun': {
      return endRun(s);
    }

    case 'buyUpgrade': {
      const { upgrade } = action;
      const costs = { steps: 5, keys: 3, peek: 8, surveyor: 10 };
      const cost = costs[upgrade];
      if (!cost || s.meta.ink < cost) return s;
      const current = s.meta.upgrades[upgrade] || 0;
      const maxLevels = { steps: 3, keys: 3, peek: 2, surveyor: 1 };
      if (current >= maxLevels[upgrade]) return s;
      s.meta.ink -= cost;
      s.meta.upgrades[upgrade] = current + 1;
      return s;
    }

    case 'usePeek': {
      if (!s.run || (s.meta.upgrades.peek || 0) <= 0) return s;
      const rng = mulberry32(s.seed * 13 + s.meta.runs * 3 + Date.now());
      const unlockedBp = s.blueprint.cells.filter(cell => !s.locked[cellKey(cell.c, cell.r)]);
      if (unlockedBp.length === 0) return s;
      const target = pick(unlockedBp, rng);
      const key = cellKey(target.c, target.r);
      const room = getRoomById(target.roomId);
      s.clueJournal[key] = s.clueJournal[key] || [];
      s.clueJournal[key].push({
        type: 'peek',
        text: `This cell contains: **${room.name}** (${room.family}), rotation ${target.rot}`,
      });
      s.meta.upgrades.peek--;
      return s;
    }

    default:
      return s;
  }
}

function endRun(state) {
  const s = state;
  s.meta.runs++;
  s.meta.totalSteps += (BASE_STEPS + (s.meta.upgrades.steps || 0) * 2) - s.run.steps;

  const inkEarned = 1 + s.run.lockedThisRun + Math.floor(s.run.cluesThisRun / 2);
  s.meta.ink += inkEarned;

  s.run.inkEarned = inkEarned;
  s.run.phase = 'ended';
  s.run.placed = {};
  computeOpenDoors(s);
  return s;
}

function checkWin(state) {
  const bpCells = state.blueprint.cells;
  for (const cell of bpCells) {
    const key = cellKey(cell.c, cell.r);
    if (!state.locked[key]) return false;
  }
  return true;
}

export function getProgress(state) {
  const total = state.blueprint.cells.length;
  const locked = Object.keys(state.locked).length;
  return { locked, total, percent: Math.round((locked / total) * 100) };
}

export { COLS, ROWS, ENTRANCE_COL, ENTRANCE_ROW, cellKey, inBounds, DIR, OPP };

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}
