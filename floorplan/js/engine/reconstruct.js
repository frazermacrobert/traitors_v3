// Reconstruction puzzle engine for Story mode.
// After the player reaches the crime scene, they must reconstruct the "true"
// floor plan by placing rooms using adjacency clues.
//
// Pure functions over plain JSON state, same pattern as engine.js.

import { ROOMS, FAMILIES } from '../data/rooms.js';
import { rand, shuffle } from './rng.js';
import { DIRS, opp, roomDoors, isVault } from './engine.js';

const LANDMARKS = ['entrance', 'vault', 'vault_side', 'vault_open', 'stair'];
const key = (r, c) => `${r},${c}`;

// Build the reconstruction puzzle state from a completed run.
export function initReconstruct(run) {
  const { w, h, cells, entrance, vault, rng } = run;
  const g = { rng };

  // Collect non-landmark, non-blocked placed rooms with their true positions.
  const truth = [];
  const presets = [];
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const cell = cells[r * w + c];
      if (!cell || !cell.id) continue;
      if (cell.blocked) continue;
      if (cell.preset || LANDMARKS.includes(cell.id)) {
        presets.push({ r, c, cell: { ...cell } });
      } else {
        truth.push({ r, c, id: cell.id, rot: cell.rot, doors: [...cell.doors] });
      }
    }
  }

  // The puzzle grid starts with only landmarks placed.
  const grid = Array(w * h).fill(null);
  for (const p of presets) {
    grid[p.r * w + p.c] = { ...p.cell, preset: true, fixed: true };
  }
  // Mark blocked cells
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const cell = cells[r * w + c];
      if (cell && cell.blocked) grid[r * w + c] = { blocked: true };
    }
  }

  // The tray: all rooms the player placed, shuffled.
  const tray = shuffle({ rng: g.rng }, truth.map((t) => ({ id: t.id, rot: t.rot, doors: [...t.doors] })));
  g.rng = g.rng; // rng advanced by shuffle

  // Generate clues for each room's true position.
  const clueMap = {};
  for (const t of truth) {
    clueMap[key(t.r, t.c)] = generateClues(run, t, truth, presets);
  }

  return {
    w, h, grid, tray, truth, clueMap,
    entrance, vault,
    placed: {},   // key(r,c) -> tray index
    revealed: {}, // key(r,c) -> clue array (revealed when a room is placed there)
    moves: 0,
    phase: 'placing', // 'placing' | 'solved' | 'scored'
    score: 0,
    correct: 0,
    total: truth.length,
    rng: g.rng,
  };
}

// Generate 2-3 clues about a room's true neighbors.
function generateClues(run, room, allRooms, presets) {
  const { w, h, cells } = run;
  const clues = [];
  const allPlaced = [...allRooms, ...presets.map((p) => ({ r: p.r, c: p.c, id: p.cell.id }))];
  const posMap = new Map(allPlaced.map((t) => [key(t.r, t.c), t]));
  const dirNames = ['north', 'east', 'south', 'west'];

  // Gather true neighbors
  const trueNeighbors = [];
  for (let d = 0; d < 4; d++) {
    const nr = room.r + DIRS[d][0], nc = room.c + DIRS[d][1];
    if (nr < 0 || nc < 0 || nr >= h || nc >= w) {
      trueNeighbors.push({ d, type: 'wall' });
    } else {
      const cell = cells[nr * w + nc];
      if (!cell || cell.blocked) {
        trueNeighbors.push({ d, type: cell?.blocked ? 'blocked' : 'empty' });
      } else if (cell.id) {
        trueNeighbors.push({ d, type: 'room', id: cell.id, family: ROOMS[cell.id].family });
      }
    }
  }

  // Clue types:
  // 1. "A [family] room is [direction] of here" (positive adjacency)
  // 2. "No room is [direction] of here" (wall/blocked)
  // 3. "The [name] is [direction] of here" (specific room, rarer)
  // 4. "This room is NOT next to any [family]" (negative family)

  // Always include 1-2 positive neighbor clues
  const roomNeighbors = trueNeighbors.filter((n) => n.type === 'room');
  const wallNeighbors = trueNeighbors.filter((n) => n.type === 'wall' || n.type === 'blocked');

  // Positive family clues
  for (const n of roomNeighbors) {
    if (LANDMARKS.includes(n.id)) {
      clues.push({ type: 'landmark', dir: n.d, text: `${ROOMS[n.id].name} is ${dirNames[n.d]}`, id: n.id });
    } else {
      clues.push({ type: 'family', dir: n.d, text: `A ${FAMILIES[n.family].name} is ${dirNames[n.d]}`, family: n.family });
    }
  }

  // Wall/boundary clues
  for (const n of wallNeighbors) {
    clues.push({ type: 'wall', dir: n.d, text: `Nothing ${dirNames[n.d]} (wall or rubble)` });
  }

  // Negative family clue: pick a family NOT adjacent
  const adjFamilies = new Set(roomNeighbors.map((n) => n.family).filter(Boolean));
  const allFamilies = Object.keys(FAMILIES).filter((f) => f !== 'special');
  const absentFamilies = allFamilies.filter((f) => !adjFamilies.has(f));
  if (absentFamilies.length > 0 && absentFamilies.length < allFamilies.length) {
    const pick = absentFamilies[Math.floor(Math.random() * absentFamilies.length)];
    clues.push({ type: 'absent', text: `Not next to any ${FAMILIES[pick].name}`, family: pick });
  }

  // Pick 2-3 clues, preferring variety
  const selected = [];
  const byType = {};
  for (const c of clues) {
    if (!byType[c.type]) byType[c.type] = [];
    byType[c.type].push(c);
  }
  // Prioritize: one directional (family/landmark), one wall or absent
  const directional = [...(byType.family || []), ...(byType.landmark || [])];
  if (directional.length) selected.push(directional[Math.floor(Math.random() * directional.length)]);
  const structural = [...(byType.wall || []), ...(byType.absent || [])];
  if (structural.length) {
    const pick = structural.filter((c) => !selected.includes(c));
    if (pick.length) selected.push(pick[Math.floor(Math.random() * pick.length)]);
  }
  // Fill to 2-3
  const remaining = clues.filter((c) => !selected.includes(c));
  while (selected.length < 2 && remaining.length) {
    selected.push(remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0]);
  }
  if (remaining.length && selected.length < 3 && Math.random() < 0.5) {
    selected.push(remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0]);
  }

  return selected;
}

// Actions for the reconstruction phase.
export function reconstructAct(prev, action) {
  const s = structuredClone(prev);
  switch (action.type) {
    case 'rPlace': {
      if (s.phase !== 'placing') throw new Error('Not in placing phase');
      const { trayIndex, r, c } = action;
      if (trayIndex < 0 || trayIndex >= s.tray.length) throw new Error('Invalid tray index');
      if (!s.tray[trayIndex]) throw new Error('Room already placed');
      const idx = r * s.w + c;
      if (s.grid[idx] && (s.grid[idx].fixed || s.grid[idx].blocked)) throw new Error('Cannot place here');
      // If something is already in this cell, return it to tray
      if (s.grid[idx] && s.placed[key(r, c)] !== undefined) {
        const oldTrayIdx = s.placed[key(r, c)];
        s.tray[oldTrayIdx] = s.grid[idx];
        delete s.placed[key(r, c)];
        delete s.revealed[key(r, c)];
      }
      const room = s.tray[trayIndex];
      s.grid[idx] = { ...room, preset: false, fixed: false };
      s.tray[trayIndex] = null;
      s.placed[key(r, c)] = trayIndex;
      s.moves++;
      // Reveal clues for this position
      if (s.clueMap[key(r, c)]) {
        s.revealed[key(r, c)] = s.clueMap[key(r, c)];
      }
      return s;
    }
    case 'rRemove': {
      if (s.phase !== 'placing') throw new Error('Not in placing phase');
      const { r, c } = action;
      const k = key(r, c);
      if (s.placed[k] === undefined) throw new Error('No room to remove');
      const trayIdx = s.placed[k];
      s.tray[trayIdx] = s.grid[r * s.w + c];
      s.grid[r * s.w + c] = null;
      delete s.placed[k];
      delete s.revealed[k];
      s.moves++;
      return s;
    }
    case 'rSwap': {
      if (s.phase !== 'placing') throw new Error('Not in placing phase');
      const { r1, c1, r2, c2 } = action;
      const k1 = key(r1, c1), k2 = key(r2, c2);
      if (s.placed[k1] === undefined || s.placed[k2] === undefined) throw new Error('Both cells must have placed rooms');
      const idx1 = r1 * s.w + c1, idx2 = r2 * s.w + c2;
      const tmp = s.grid[idx1];
      s.grid[idx1] = s.grid[idx2];
      s.grid[idx2] = tmp;
      const tmpTray = s.placed[k1];
      s.placed[k1] = s.placed[k2];
      s.placed[k2] = tmpTray;
      // Re-reveal clues for swapped positions
      if (s.clueMap[k1]) s.revealed[k1] = s.clueMap[k1];
      if (s.clueMap[k2]) s.revealed[k2] = s.clueMap[k2];
      s.moves++;
      return s;
    }
    case 'rSubmit': {
      if (s.phase !== 'placing') throw new Error('Not in placing phase');
      // Check: all rooms must be placed
      if (s.tray.some((t) => t !== null)) throw new Error('Place all rooms before submitting');
      // Score: count correct placements
      let correct = 0;
      for (const t of s.truth) {
        const cell = s.grid[t.r * s.w + t.c];
        if (cell && cell.id === t.id) correct++;
      }
      s.correct = correct;
      s.total = s.truth.length;
      s.score = Math.round((correct / Math.max(1, s.total)) * 100);
      s.phase = 'scored';
      // Reveal the true layout
      s.truthGrid = Array(s.w * s.h).fill(null);
      for (let i = 0; i < s.grid.length; i++) {
        if (s.grid[i] && (s.grid[i].fixed || s.grid[i].blocked)) s.truthGrid[i] = s.grid[i];
      }
      for (const t of s.truth) {
        s.truthGrid[t.r * s.w + t.c] = { id: t.id, rot: t.rot, doors: [...t.doors] };
      }
      return s;
    }
    default:
      throw new Error(`reconstruct: unknown action ${action.type}`);
  }
}

// Get open cells where rooms can be placed (empty, not blocked, not fixed).
export function openReconstructCells(s) {
  const cells = [];
  for (let r = 0; r < s.h; r++) {
    for (let c = 0; c < s.w; c++) {
      const cell = s.grid[r * s.w + c];
      if (cell === null || (cell && !cell.fixed && !cell.blocked)) {
        cells.push({ r, c, occupied: cell !== null });
      }
    }
  }
  return cells;
}

// Check if a clue is satisfied by the current grid state.
export function checkClue(s, r, c, clue) {
  if (clue.type === 'family' || clue.type === 'landmark') {
    const nr = r + DIRS[clue.dir][0], nc = c + DIRS[clue.dir][1];
    if (nr < 0 || nc < 0 || nr >= s.h || nc >= s.w) return false;
    const cell = s.grid[nr * s.w + nc];
    if (!cell || !cell.id) return null; // unknown yet
    if (clue.type === 'landmark') return cell.id === clue.id;
    return ROOMS[cell.id].family === clue.family;
  }
  if (clue.type === 'wall') {
    const nr = r + DIRS[clue.dir][0], nc = c + DIRS[clue.dir][1];
    if (nr < 0 || nc < 0 || nr >= s.h || nc >= s.w) return true;
    const cell = s.grid[nr * s.w + nc];
    if (cell && cell.blocked) return true;
    if (cell === null) return null; // could still be wall
    return false; // there's a room there
  }
  if (clue.type === 'absent') {
    let foundAny = false;
    let allFilled = true;
    for (let d = 0; d < 4; d++) {
      const nr = r + DIRS[d][0], nc = c + DIRS[d][1];
      if (nr < 0 || nc < 0 || nr >= s.h || nc >= s.w) continue;
      const cell = s.grid[nr * s.w + nc];
      if (!cell || !cell.id) { if (!cell?.blocked) allFilled = false; continue; }
      if (ROOMS[cell.id].family === clue.family) foundAny = true;
    }
    if (foundAny) return false;
    return allFilled ? true : null;
  }
  return null;
}
