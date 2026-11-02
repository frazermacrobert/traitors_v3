// Crime scene reconstruction puzzle for Story mode.
// A 3x3 grid of evidence items. The player must place them correctly
// using adjacency clues revealed as pieces are placed.

import { rand, shuffle } from './rng.js';

// Evidence items for the crime scene
const EVIDENCE = [
  { id: 'chair', name: 'Overturned Chair', icon: '🪑', desc: 'Knocked over in the struggle.' },
  { id: 'desk', name: 'Writing Desk', icon: '🪶', desc: 'A letter was being written.' },
  { id: 'glass', name: 'Smashed Glass', icon: '🥃', desc: 'Shattered on the floor.' },
  { id: 'footprint', name: 'Bloody Footprint', icon: '👣', desc: 'Leading away from the body.' },
  { id: 'candle', name: 'Snuffed Candle', icon: '🕯️', desc: 'Still warm.' },
  { id: 'knife', name: 'Letter Opener', icon: '🗡️', desc: 'The likely weapon.' },
  { id: 'book', name: 'Torn Pages', icon: '📄', desc: 'Ripped from a journal.' },
  { id: 'clock', name: 'Stopped Clock', icon: '🕰️', desc: 'Smashed at the time of death.' },
  { id: 'key', name: 'Dropped Key', icon: '🗝️', desc: 'To the room itself.' },
  { id: 'portrait', name: 'Fallen Portrait', icon: '🖼️', desc: 'Face down on the carpet.' },
  { id: 'wine', name: 'Spilled Wine', icon: '🍷', desc: 'Two glasses. One untouched.' },
  { id: 'curtain', name: 'Torn Curtain', icon: '🪟', desc: 'Someone grabbed it falling.' },
  { id: 'ring', name: 'Signet Ring', icon: '💍', desc: 'Not the victim\'s.' },
  { id: 'ash', name: 'Fireplace Ash', icon: '🔥', desc: 'Something was burned recently.' },
  { id: 'mud', name: 'Muddy Boot Print', icon: '🥾', desc: 'From outside. Fresh.' },
];

export { EVIDENCE };

const DIR_NAMES = ['above', 'right of', 'below', 'left of'];
const DIRS = [[-1, 0], [0, 1], [1, 0], [0, -1]];
const key = (r, c) => `${r},${c}`;

export function initReconstruct(run) {
  const g = { rng: run.rng };
  const size = 3;

  // Pick 9 evidence items
  const picked = shuffle(g, [...EVIDENCE]).slice(0, size * size);
  g.rng = g.rng; // rng advanced

  // Assign them to the 3x3 grid (this is the true solution)
  const truth = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      truth.push({ r, c, item: picked[r * size + c] });
    }
  }

  // Generate clues for each position
  const clueMap = {};
  for (const t of truth) {
    clueMap[key(t.r, t.c)] = generateClues(truth, t, size, g);
  }

  // The tray: all items shuffled
  const tray = shuffle(g, truth.map((t) => ({ ...t.item })));

  return {
    size,
    grid: Array(size * size).fill(null),
    tray,
    truth,
    clueMap,
    placed: {},
    revealed: {},
    moves: 0,
    phase: 'placing',
    score: 0,
    correct: 0,
    total: size * size,
    rng: g.rng,
  };
}

function generateClues(truth, target, size, g) {
  const clues = [];
  const tMap = new Map(truth.map((t) => [key(t.r, t.c), t]));

  for (let d = 0; d < 4; d++) {
    const nr = target.r + DIRS[d][0], nc = target.c + DIRS[d][1];
    if (nr < 0 || nc < 0 || nr >= size || nc >= size) {
      clues.push({ type: 'edge', dir: d, text: `Against the ${['north', 'east', 'south', 'west'][d]} wall` });
    } else {
      const neighbor = tMap.get(key(nr, nc));
      if (neighbor) {
        clues.push({ type: 'adjacent', dir: d, itemId: neighbor.item.id,
          text: `${neighbor.item.icon} ${neighbor.item.name} is ${DIR_NAMES[d]} this` });
      }
    }
  }

  // "Not adjacent" clues
  const adjIds = new Set();
  for (let d = 0; d < 4; d++) {
    const nr = target.r + DIRS[d][0], nc = target.c + DIRS[d][1];
    const n = tMap.get(key(nr, nc));
    if (n) adjIds.add(n.item.id);
  }
  const nonAdj = truth.filter((t) => t.r !== target.r || t.c !== target.c)
    .filter((t) => !adjIds.has(t.item.id));
  if (nonAdj.length > 0) {
    const pick = nonAdj[Math.floor(rand(g) * nonAdj.length)];
    clues.push({ type: 'notadjacent', itemId: pick.item.id,
      text: `Not next to ${pick.item.icon} ${pick.item.name}` });
  }

  // Corner / center / edge clue
  if (target.r === 1 && target.c === 1) {
    clues.push({ type: 'position', text: 'In the centre of the room' });
  } else if ((target.r === 0 || target.r === 2) && (target.c === 0 || target.c === 2)) {
    clues.push({ type: 'position', text: 'In a corner of the room' });
  }

  // Select 2-3 clues with variety
  const selected = [];
  const adjacent = clues.filter((c) => c.type === 'adjacent');
  const other = clues.filter((c) => c.type !== 'adjacent');

  if (adjacent.length) selected.push(adjacent[Math.floor(rand(g) * adjacent.length)]);
  if (other.length) {
    const pick = other.filter((c) => !selected.includes(c));
    if (pick.length) selected.push(pick[Math.floor(rand(g) * pick.length)]);
  }
  const remaining = clues.filter((c) => !selected.includes(c));
  while (selected.length < 2 && remaining.length) {
    selected.push(remaining.splice(Math.floor(rand(g) * remaining.length), 1)[0]);
  }
  if (selected.length < 3 && remaining.length && rand(g) < 0.6) {
    selected.push(remaining[Math.floor(rand(g) * remaining.length)]);
  }

  return selected;
}

export function reconstructAct(prev, action) {
  const s = structuredClone(prev);
  switch (action.type) {
    case 'rPlace': {
      if (s.phase !== 'placing') throw new Error('Not in placing phase');
      const { trayIndex, r, c } = action;
      if (trayIndex < 0 || trayIndex >= s.tray.length) throw new Error('Invalid tray index');
      if (!s.tray[trayIndex]) throw new Error('Item already placed');
      const idx = r * s.size + c;
      // If cell occupied, return existing item to tray
      if (s.grid[idx] && s.placed[key(r, c)] !== undefined) {
        const oldIdx = s.placed[key(r, c)];
        s.tray[oldIdx] = s.grid[idx];
        delete s.placed[key(r, c)];
        delete s.revealed[key(r, c)];
      }
      s.grid[idx] = { ...s.tray[trayIndex] };
      s.tray[trayIndex] = null;
      s.placed[key(r, c)] = trayIndex;
      s.moves++;
      if (s.clueMap[key(r, c)]) {
        s.revealed[key(r, c)] = s.clueMap[key(r, c)];
      }
      return s;
    }
    case 'rRemove': {
      if (s.phase !== 'placing') throw new Error('Not in placing phase');
      const { r, c } = action;
      const k = key(r, c);
      if (s.placed[k] === undefined) throw new Error('Nothing to remove');
      const trayIdx = s.placed[k];
      s.tray[trayIdx] = s.grid[r * s.size + c];
      s.grid[r * s.size + c] = null;
      delete s.placed[k];
      delete s.revealed[k];
      s.moves++;
      return s;
    }
    case 'rSubmit': {
      if (s.phase !== 'placing') throw new Error('Not in placing phase');
      if (s.tray.some((t) => t !== null)) throw new Error('Place all evidence first');
      let correct = 0;
      for (const t of s.truth) {
        const cell = s.grid[t.r * s.size + t.c];
        if (cell && cell.id === t.item.id) correct++;
      }
      s.correct = correct;
      s.total = s.truth.length;
      s.score = Math.round((correct / s.total) * 100);
      s.phase = correct === s.total ? 'solved' : 'wrong';
      return s;
    }
    case 'rRetry': {
      if (s.phase !== 'wrong') throw new Error('Not in wrong state');
      // Return all items to tray
      for (let r = 0; r < s.size; r++) {
        for (let c = 0; c < s.size; c++) {
          const k = key(r, c);
          if (s.placed[k] !== undefined) {
            s.tray[s.placed[k]] = s.grid[r * s.size + c];
            s.grid[r * s.size + c] = null;
            delete s.placed[k];
          }
        }
      }
      s.revealed = {};
      s.phase = 'placing';
      s.moves++;
      return s;
    }
    default:
      throw new Error(`reconstruct: unknown action ${action.type}`);
  }
}

export function checkClue(s, r, c, clue) {
  if (clue.type === 'adjacent') {
    const nr = r + DIRS[clue.dir][0], nc = c + DIRS[clue.dir][1];
    if (nr < 0 || nc < 0 || nr >= s.size || nc >= s.size) return false;
    const cell = s.grid[nr * s.size + nc];
    if (!cell) return null;
    return cell.id === clue.itemId;
  }
  if (clue.type === 'edge') {
    const nr = r + DIRS[clue.dir][0], nc = c + DIRS[clue.dir][1];
    return nr < 0 || nc < 0 || nr >= s.size || nc >= s.size;
  }
  if (clue.type === 'notadjacent') {
    let found = false, allFilled = true;
    for (let d = 0; d < 4; d++) {
      const nr = r + DIRS[d][0], nc = c + DIRS[d][1];
      if (nr < 0 || nc < 0 || nr >= s.size || nc >= s.size) continue;
      const cell = s.grid[nr * s.size + nc];
      if (!cell) { allFilled = false; continue; }
      if (cell.id === clue.itemId) found = true;
    }
    if (found) return false;
    return allFilled ? true : null;
  }
  if (clue.type === 'position') {
    if (clue.text.includes('centre')) return r === 1 && c === 1;
    if (clue.text.includes('corner')) return (r === 0 || r === 2) && (c === 0 || c === 2);
    return null;
  }
  return null;
}
