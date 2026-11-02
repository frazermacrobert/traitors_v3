import { mulberry32, rollD6, shuffle } from './rng.js';
import { SHAPES, rotateDoors, buildDeck } from '../data/cards.js';

const GRID = 6;
const CORNERS = [[0,0],[0,5],[5,0],[5,5]];

function idx(r, c) { return r * GRID + c; }
function inBounds(r, c) { return r >= 0 && r < GRID && c >= 0 && c < GRID; }

function isCorner(r, c) {
  return CORNERS.some(([cr, cc]) => cr === r && cc === c);
}

// Neighbors: [N, E, S, W] → [dr, dc]
const DIRS = [[-1, 0], [0, 1], [1, 0], [0, -1]];
const OPP = [2, 3, 0, 1];

export function newGame(seed) {
  const rng = mulberry32(seed);
  let beachR, beachC;
  do {
    beachR = rollD6(rng) - 1;
    beachC = rollD6(rng) - 1;
  } while (isCorner(beachR, beachC));

  const deck = shuffle(buildDeck(), rng);

  return {
    board: Array(GRID * GRID).fill(null),
    start: null,
    beach: { r: beachR, c: beachC },
    deck,
    discard: [],
    hand: [],
    treats: 5,
    turn: 0,
    phase: 'setup',
    dice: { row: null, col: null },
    drawn: [],
    picked: null,
    score: null,
    seed,
    rngState: seed,
    log: [`Beach placed at (${beachR + 1}, ${beachC + 1}). Choose your starting corner!`],
    skipNextTurn: false,
    completedLines: [],
  };
}

function cloneState(state) {
  return structuredClone(state);
}

function getRng(state) {
  return mulberry32(state.rngState);
}

function advanceRng(state) {
  const rng = mulberry32(state.rngState);
  rng();
  state.rngState = state.rngState + 1;
  return mulberry32(state.rngState);
}

export function act(state, action) {
  const s = cloneState(state);
  const rng = mulberry32(s.rngState);

  switch (action.type) {
    case 'chooseCorner':
      return chooseCorner(s, action, rng);
    case 'roll':
      return roll(s, rng);
    case 'drawCards':
      return drawCards(s, rng);
    case 'pickCard':
      return pickCard(s, action);
    case 'placeCard':
      return placeCard(s, action, rng);
    case 'nudge':
      return nudge(s, action);
    case 'fetch':
      return fetch_(s, action);
    case 'digUp':
      return digUp(s, rng);
    case 'skipTurn':
      return skipTurn(s);
    case 'keepCard':
      return keepCard(s, action);
    default:
      return s;
  }
}

function chooseCorner(s, action, rng) {
  const { r, c } = action;
  if (!isCorner(r, c)) return s;
  if (r === s.beach.r && c === s.beach.c) return s;

  s.start = { r, c };
  s.board[idx(r, c)] = { type: 'start', doors: [true, true, true, true] };
  s.phase = 'roll';
  s.turn = 1;
  s.log.push(`Velvet starts at (${r + 1}, ${c + 1}). Let's ZOOM!`);
  s.rngState = s.rngState + 1;
  return s;
}

function roll(s, rng) {
  if (s.phase !== 'roll') return s;

  if (s.skipNextTurn) {
    s.skipNextTurn = false;
    s.turn++;
    s.log.push(`Velvet is recovering from the whistle... turn skipped!`);
    return s;
  }

  const r1 = rollD6(rng);
  const r2 = rollD6(rng);
  s.dice = { row: r1 - 1, col: r2 - 1 };
  s.phase = 'draw';
  s.rngState = s.rngState + 2;
  s.log.push(`Rolled (${r1}, ${r2}) — target cell (${r1}, ${r2})`);
  return s;
}

function drawCards(s, rng) {
  if (s.phase !== 'draw') return s;

  s.drawn = [];
  let hazardTriggered = [];
  let drawCount = 3;

  for (let i = 0; i < drawCount && s.deck.length > 0; i++) {
    const card = s.deck.shift();
    if (card.hazard) {
      hazardTriggered.push(card);
      if (s.deck.length > 0) {
        i--;
      }
    } else {
      s.drawn.push(card);
    }
  }

  for (const hz of hazardTriggered) {
    placeHazard(s, hz, rng);
  }

  if (s.drawn.length === 0 && s.hand.length === 0) {
    return endGame(s, 'No cards available!');
  }

  s.phase = 'pick';
  s.rngState = s.rngState + 3 + hazardTriggered.length * 2;
  return s;
}

function placeHazard(s, hazard, rng) {
  let hr = rollD6(rng) - 1;
  let hc = rollD6(rng) - 1;

  let attempts = 0;
  while (s.board[idx(hr, hc)] !== null && attempts < 36) {
    hc++;
    if (hc >= GRID) { hc = 0; hr++; }
    if (hr >= GRID) { hr = 0; }
    attempts++;
  }

  if (attempts >= 36) {
    s.log.push(`${hazard.label} couldn't be placed — board is full!`);
    return;
  }

  if (hazard.hazard === 'whistle') {
    if (s.treats > 0) {
      s.treats--;
      s.log.push(`Recall Whistle! Velvet resists but loses 1 treat. (${s.treats} left)`);
    } else {
      s.skipNextTurn = true;
      s.log.push(`Recall Whistle! No treats — Velvet must skip next turn!`);
    }
    s.discard.push(hazard);
    return;
  }

  s.board[idx(hr, hc)] = { type: 'hazard', hazard: hazard.hazard, id: hazard.id };
  s.log.push(`${hazard.label} placed at (${hr + 1}, ${hc + 1})!`);

  if (hazard.hazard === 'muddy') {
    for (let d = 0; d < 4; d++) {
      const [dr, dc] = DIRS[d];
      const nr = hr + dr;
      const nc = hc + dc;
      if (inBounds(nr, nc)) {
        const cell = s.board[idx(nr, nc)];
        if (cell && cell.type === 'path') {
          cell.mudBlocked = cell.mudBlocked || [];
          cell.mudBlocked.push(OPP[d]);
        }
      }
    }
  }
}

function pickCard(s, action) {
  if (s.phase !== 'pick') return s;
  const { cardId, fromHand } = action;

  let card;
  if (fromHand) {
    const hi = s.hand.findIndex(c => c.id === cardId);
    if (hi === -1) return s;
    card = s.hand.splice(hi, 1)[0];
  } else {
    const di = s.drawn.findIndex(c => c.id === cardId);
    if (di === -1) return s;
    card = s.drawn.splice(di, 1)[0];
  }

  s.picked = card;
  s.phase = 'place';
  return s;
}

function placeCard(s, action, rng) {
  if (s.phase !== 'place' || !s.picked) return s;
  const { r, c, rot } = action;

  if (!inBounds(r, c)) return s;
  if (s.board[idx(r, c)] !== null) return s;

  const card = s.picked;
  const baseDoors = SHAPES[card.shape];
  const doors = rotateDoors(baseDoors, rot);

  const cell = {
    type: 'path',
    cardId: card.id,
    shape: card.shape,
    rot: rot,
    doors: [...doors],
    tunnel: card.tunnel || false,
  };

  if (card.tunnel) {
    cell.tunnelDoors = [...doors];
  }

  s.board[idx(r, c)] = cell;

  if (card.treatBonus) {
    s.treats += card.treatBonus;
    s.log.push(`Velvet found a treat in a dead end! (+${card.treatBonus} treat)`);
  }

  const junctionBonus = checkJunctionBonus(s, r, c, doors);
  if (junctionBonus) {
    s.treats += 1;
    s.log.push(`Pawfect connection! T/Crossroads links 3+ paths. +1 treat!`);
  }

  checkLineCompletion(s);

  s.picked = null;

  for (const leftover of s.drawn) {
    s.discard.push(leftover);
  }
  s.drawn = [];

  s.log.push(`Placed ${card.label} at (${r + 1}, ${c + 1})`);

  if (checkVictory(s)) {
    return endGame(s, 'Velvet reached the BEACH! ZOOMIES!!! 🏖️');
  }

  if (s.deck.length === 0 && s.hand.length === 0) {
    return endGame(s, 'Deck is empty!');
  }

  s.phase = 'keepOrEnd';
  return s;
}

function nudge(s, action) {
  if (s.phase !== 'place') return s;
  if (s.treats < 1) return s;
  const { axis, dir } = action;

  let newR = s.dice.row;
  let newC = s.dice.col;

  if (axis === 'row') newR += dir;
  else newC += dir;

  if (!inBounds(newR, newC)) return s;

  s.treats -= 1;
  s.dice = { row: newR, col: newC };
  s.log.push(`Nudged ${axis} ${dir > 0 ? '+' : ''}${dir}. Target now (${newR + 1}, ${newC + 1}). (${s.treats} treats left)`);
  return s;
}

function fetch_(s, action) {
  if (s.phase !== 'place') return s;
  if (s.treats < 2) return s;
  const { r, c } = action;

  if (!inBounds(r, c) || s.board[idx(r, c)] !== null) return s;

  const connected = getConnectedCells(s);
  let adjacent = false;
  for (const [cr, cc] of connected) {
    for (const [dr, dc] of DIRS) {
      if (cr + dr === r && cc + dc === c) {
        adjacent = true;
        break;
      }
    }
    if (adjacent) break;
  }

  if (!adjacent) return s;

  s.treats -= 2;
  s.dice = { row: r, col: c };
  s.log.push(`Fetch! Placing on (${r + 1}, ${c + 1}) for 2 treats. (${s.treats} left)`);
  return s;
}

function digUp(s, rng) {
  if (s.phase !== 'draw') return s;
  if (s.treats < 1) return s;
  if (s.deck.length === 0) return s;

  s.treats -= 1;
  const top3 = s.deck.splice(0, Math.min(3, s.deck.length));
  s.drawn = top3.filter(c => !c.hazard);
  const hazards = top3.filter(c => c.hazard);

  for (const hz of hazards) {
    placeHazard(s, hz, rng);
  }

  if (s.drawn.length === 0 && s.hand.length === 0) {
    return endGame(s, 'No cards available!');
  }

  s.phase = 'pick';
  s.rngState = s.rngState + 4;
  s.log.push(`Dig Up! Peeked at ${top3.length} cards. (${s.treats} treats left)`);
  return s;
}

function skipTurn(s) {
  if (s.phase !== 'place' && s.phase !== 'pick') return s;

  if (s.picked) s.discard.push(s.picked);
  for (const c of s.drawn) s.discard.push(c);
  s.picked = null;
  s.drawn = [];
  s.phase = 'roll';
  s.turn++;
  s.log.push(`Velvet got distracted! Turn lost.`);
  return s;
}

function keepCard(s, action) {
  if (s.phase !== 'keepOrEnd') return s;
  const { cardId } = action;

  if (cardId && s.drawn.length > 0) {
    if (s.hand.length >= 2) return s;
    const ci = s.drawn.findIndex(c => c.id === cardId);
    if (ci !== -1) {
      s.hand.push(s.drawn.splice(ci, 1)[0]);
    }
  }

  for (const c of s.drawn) s.discard.push(c);
  s.drawn = [];

  s.phase = 'roll';
  s.turn++;
  return s;
}

function checkJunctionBonus(s, r, c, doors) {
  let connectedSegments = 0;
  for (let d = 0; d < 4; d++) {
    if (!doors[d]) continue;
    const [dr, dc] = DIRS[d];
    const nr = r + dr;
    const nc = c + dc;
    if (!inBounds(nr, nc)) continue;
    const neighbor = s.board[idx(nr, nc)];
    if (!neighbor) continue;
    if (neighbor.type === 'path' || neighbor.type === 'start') {
      const nDoors = neighbor.doors || [true, true, true, true];
      if (nDoors[OPP[d]]) {
        connectedSegments++;
      }
    }
  }
  return connectedSegments >= 3 && (doors.filter(Boolean).length >= 3);
}

function checkLineCompletion(s) {
  for (let r = 0; r < GRID; r++) {
    const key = `row_${r}`;
    if (s.completedLines.includes(key)) continue;
    let full = true;
    for (let c = 0; c < GRID; c++) {
      const cell = s.board[idx(r, c)];
      if (!cell || (cell.type !== 'path' && cell.type !== 'start')) {
        full = false;
        break;
      }
    }
    if (full) {
      s.completedLines.push(key);
      s.treats += 2;
      s.log.push(`Row ${r + 1} complete! +2 treats!`);
    }
  }

  for (let c = 0; c < GRID; c++) {
    const key = `col_${c}`;
    if (s.completedLines.includes(key)) continue;
    let full = true;
    for (let r = 0; r < GRID; r++) {
      const cell = s.board[idx(r, c)];
      if (!cell || (cell.type !== 'path' && cell.type !== 'start')) {
        full = false;
        break;
      }
    }
    if (full) {
      s.completedLines.push(key);
      s.treats += 2;
      s.log.push(`Column ${c + 1} complete! +2 treats!`);
    }
  }
}

export function getConnectedCells(s) {
  if (!s.start) return [];
  const visited = new Set();
  const queue = [[s.start.r, s.start.c]];
  visited.add(idx(s.start.r, s.start.c));

  while (queue.length > 0) {
    const [r, c] = queue.shift();
    const cell = s.board[idx(r, c)];
    if (!cell) continue;

    const doors = cell.doors || [true, true, true, true];
    for (let d = 0; d < 4; d++) {
      if (!doors[d]) continue;
      if (cell.mudBlocked && cell.mudBlocked.includes(d)) continue;

      const [dr, dc] = DIRS[d];
      const nr = r + dr;
      const nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      if (visited.has(idx(nr, nc))) continue;

      const neighbor = s.board[idx(nr, nc)];
      if (!neighbor) continue;
      if (neighbor.type === 'hazard') continue;

      const nDoors = neighbor.doors || [true, true, true, true];
      const oppDir = OPP[d];
      if (!nDoors[oppDir]) continue;
      if (neighbor.mudBlocked && neighbor.mudBlocked.includes(oppDir)) continue;

      visited.add(idx(nr, nc));
      queue.push([nr, nc]);
    }
  }

  return [...visited].map(i => [Math.floor(i / GRID), i % GRID]);
}

function checkVictory(s) {
  const connected = getConnectedCells(s);
  const { r: br, c: bc } = s.beach;

  for (const [cr, cc] of connected) {
    for (let d = 0; d < 4; d++) {
      const [dr, dc] = DIRS[d];
      if (cr + dr === br && cc + dc === bc) {
        const cell = s.board[idx(cr, cc)];
        const doors = cell.doors || [true, true, true, true];
        if (doors[d] && !(cell.mudBlocked && cell.mudBlocked.includes(d))) {
          return true;
        }
      }
    }
  }
  return false;
}

function endGame(s, reason) {
  s.phase = 'end';
  s.score = calculateScore(s);
  s.log.push(reason);
  s.log.push(`Final score: ${s.score.total}`);
  return s;
}

export function calculateScore(s) {
  const connected = getConnectedCells(s);
  const reachedBeach = checkVictory(s);
  const pathLength = connected.length;

  let hazardsAdjacent = 0;
  for (const [r, c] of connected) {
    for (const [dr, dc] of DIRS) {
      const nr = r + dr;
      const nc = c + dc;
      if (inBounds(nr, nc)) {
        const cell = s.board[idx(nr, nc)];
        if (cell && cell.type === 'hazard') hazardsAdjacent++;
      }
    }
  }

  const manhattan = s.start
    ? Math.abs(s.start.r - s.beach.r) + Math.abs(s.start.c - s.beach.c)
    : 0;

  let emptyBetween = 0;
  if (s.start) {
    const minR = Math.min(s.start.r, s.beach.r);
    const maxR = Math.max(s.start.r, s.beach.r);
    const minC = Math.min(s.start.c, s.beach.c);
    const maxC = Math.max(s.start.c, s.beach.c);
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        if (!s.board[idx(r, c)]) emptyBetween++;
      }
    }
  }

  const beachPoints = reachedBeach ? 50 : 0;
  const pathPoints = pathLength * 3;
  const treatPoints = s.treats * 5;
  const hazardPoints = hazardsAdjacent * 2;
  const emptyPenalty = emptyBetween * -1;
  const scenicBonus = pathLength >= manhattan * 1.5 ? 10 : 0;

  return {
    beachPoints,
    pathPoints,
    treatPoints,
    hazardPoints,
    emptyPenalty,
    scenicBonus,
    total: beachPoints + pathPoints + treatPoints + hazardPoints + emptyPenalty + scenicBonus,
  };
}

export { GRID, DIRS, OPP, idx, inBounds, isCorner };
