import { mulberry32, rollD6, shuffle } from './rng.js';
import { SHAPES, rotateDoors, buildDeck } from '../data/cards.js';

const GRID = 6;
const CORNERS = [[0,0],[0,5],[5,0],[5,5]];
const DIRS = [[-1,0],[0,1],[1,0],[0,-1]];
const OPP = [2,3,0,1];

function idx(r, c) { return r * GRID + c; }
function inBounds(r, c) { return r >= 0 && r < GRID && c >= 0 && c < GRID; }
function isCorner(r, c) { return CORNERS.some(([cr, cc]) => cr === r && cc === c); }

const OBJ_IDS = ['scenic','straight','explorer','treats','speed','long','social','brave','dodger','hopper'];

const OBJ_DEFS = {
  scenic:   { label: 'Scenic Route',     desc: 'Visit all 4 board edges',       pts: 5,
    check(s, conn, connSet) { let edges = [false,false,false,false];
      conn.forEach(([r,c]) => { if(r===0) edges[0]=true; if(r===5) edges[2]=true; if(c===0) edges[3]=true; if(c===5) edges[1]=true; });
      return edges.every(Boolean); } },
  straight: { label: 'Straight & Narrow', desc: 'Place 3 Lane cards in a single row', pts: 3,
    check(s) { for(let r=0;r<GRID;r++){let run=0; for(let c=0;c<GRID;c++){const cell=s.board[idx(r,c)]; if(cell&&cell.icon==='lane'){run++;if(run>=3)return true}else run=0}} return false; } },
  explorer: { label: 'Explorer',          desc: 'Place tiles in 5 different columns', pts: 3,
    check(s, conn) { const cols = new Set(); conn.forEach(([,c]) => cols.add(c)); return cols.size >= 5; } },
  treats:   { label: 'Treat Collector',   desc: 'Collect all 3 treats',           pts: 4,
    check(s) { return (s.treats||[]).filter(t=>t.collected).length >= 3; } },
  speed:    { label: 'Speed Run',         desc: 'Reach the beach in 10 turns or fewer', pts: 6,
    check(s) { return s.endReason === 'win' && s.turn <= 10; } },
  long:     { label: 'Long Walk',         desc: 'Build a connected path of 15+ tiles', pts: 4,
    check(s, conn) { return conn.length >= 15; } },
  social:   { label: 'Social Butterfly',  desc: 'Visit 3+ Dog Parks',             pts: 3,
    check(s, conn, connSet) { let count=0; conn.forEach(([r,c])=>{const cell=s.board[idx(r,c)]; if(cell&&cell.icon==='dogpark')count++}); return count>=3; } },
  brave:    { label: 'Brave Pup',         desc: 'Path passes adjacent to 2+ hazards', pts: 3,
    check(s, conn) { let adj=0; const hSet=new Set(); conn.forEach(([r,c])=>{DIRS.forEach(([dr,dc])=>{const nr=r+dr,nc=c+dc; if(inBounds(nr,nc)){const n=s.board[idx(nr,nc)]; if(n&&n.type==='hazard'&&!hSet.has(idx(nr,nc))){hSet.add(idx(nr,nc));adj++}}})}); return adj>=2; } },
  dodger:   { label: 'Cat Dodger',        desc: 'Win with the Mean Cat active',   pts: 4,
    check(s) { return s.endReason === 'win' && s.cat.active; } },
  hopper:   { label: 'Corner Hopper',     desc: 'Path passes through 2+ corners', pts: 3,
    check(s, conn) { let count=0; conn.forEach(([r,c])=>{if(isCorner(r,c))count++}); return count>=2; } },
};

export function newGame(seed) {
  const rng = mulberry32(seed);
  let beachR, beachC;
  do { beachR = rollD6(rng) - 1; beachC = rollD6(rng) - 1; } while (isCorner(beachR, beachC));
  const deck = shuffle(buildDeck(), rng);

  const treats = [];
  let attempts = 0;
  while (treats.length < 3 && attempts < 50) {
    const tr = rollD6(rng) - 1, tc = rollD6(rng) - 1;
    attempts++;
    if (isCorner(tr, tc)) continue;
    if (tr === beachR && tc === beachC) continue;
    if (treats.some(t => t.r === tr && t.c === tc)) continue;
    treats.push({ r: tr, c: tc, collected: false });
  }

  const objIds = shuffle([...OBJ_IDS], rng).slice(0, 2);

  return {
    board: Array(GRID * GRID).fill(null),
    start: null,
    beach: { r: beachR, c: beachC },
    deck,
    discard: [],
    velvetPos: null,
    cat: { active: false, r: -1, c: -1 },
    turn: 0,
    phase: 'setup',
    drawn: [],
    picked: null,
    score: null,
    endReason: null,
    seed,
    rngState: seed,
    treats,
    objectives: objIds,
    fetchNext: false,
    peekCards: null,
    log: [`Beach at (${beachR + 1}, ${beachC + 1}). Pick your starting corner!`],
  };
}

function clone(s) { return structuredClone(s); }

export function act(state, action) {
  const s = clone(state);
  const rng = mulberry32(s.rngState);
  switch (action.type) {
    case 'chooseCorner': return doChooseCorner(s, action, rng);
    case 'pickCard': return doPickCard(s, action);
    case 'placeCard': return doPlaceCard(s, action);
    case 'digHazard': return doDigHazard(s, action);
    case 'skipDig': return doSkipDig(s);
    case 'skipTurn': return doSkipTurn(s);
    default: return s;
  }
}

function doChooseCorner(s, a, rng) {
  if (s.phase !== 'setup') return s;
  if (!isCorner(a.r, a.c) || (a.r === s.beach.r && a.c === s.beach.c)) return s;
  s.start = { r: a.r, c: a.c };
  s.velvetPos = { r: a.r, c: a.c };
  s.board[idx(a.r, a.c)] = { type: 'start', doors: [true, true, true, true] };
  s.turn = 1;
  s.rngState += 1;
  s.log.push(`Velvet starts at (${a.r + 1}, ${a.c + 1}). Let's ZOOM!`);
  return startTurn(s);
}

function startTurn(s) {
  const rng = mulberry32(s.rngState);
  if (s.deck.length === 0) return endGame(s, 'deck', 'The deck is empty!');

  const drawCount = Math.min(s.fetchNext ? 3 : 2, s.deck.length);
  s.fetchNext = false;
  s.drawn = [];
  let hazardsDone = [];

  let i = 0;
  while (i < drawCount && s.deck.length > 0) {
    const card = s.deck.shift();
    if (card.hazard) {
      hazardsDone.push(card);
      s.rngState += 2;
      const result = resolveHazard(s, card, mulberry32(s.rngState));
      if (result === 'gameover') return s;
      continue;
    }
    s.drawn.push(card);
    i++;
  }

  if (s.drawn.length === 0) {
    if (s.deck.length === 0) return endGame(s, 'deck', 'No cards left to draw!');
    while (s.drawn.length < 2 && s.deck.length > 0) {
      const card = s.deck.shift();
      if (card.hazard) {
        s.rngState += 2;
        resolveHazard(s, card, mulberry32(s.rngState));
        if (s.phase === 'end') return s;
        continue;
      }
      s.drawn.push(card);
    }
  }

  if (s.drawn.length === 0) return endGame(s, 'deck', 'No path cards left!');

  if (!canPlaceAny(s, s.drawn)) return endGame(s, 'stuck', 'No valid moves — Velvet is stuck!');

  s.phase = 'pick';
  s.rngState += 1;
  return s;
}

function resolveHazard(s, hazard, rng) {
  if (hazard.hazard === 'meancat') {
    s.cat = { active: true, r: s.start.r, c: s.start.c };
    s.discard.push(hazard);
    s.log.push('😾 MEAN CAT! A cat enters the park at your starting spot!');
    return 'ok';
  }

  const hr = rollD6(rng) - 1;
  const hc = rollD6(rng) - 1;
  const icons = { squirrel: '🐿️', puddle: '💧' };

  if (hr === s.beach.r && hc === s.beach.c) {
    s.log.push(`${icons[hazard.hazard]} ${hazard.name} rolled (${hr+1},${hc+1}) — landed on the BEACH!`);
    endGame(s, 'beach_hazard', `${hazard.name} destroyed the beach! Game over!`);
    return 'gameover';
  }
  if (s.velvetPos && hr === s.velvetPos.r && hc === s.velvetPos.c) {
    s.log.push(`${icons[hazard.hazard]} ${hazard.name} rolled (${hr+1},${hc+1}) — landed on Velvet!`);
    endGame(s, 'player_hazard', `${hazard.name} landed right on Velvet! Game over!`);
    return 'gameover';
  }
  if (s.board[idx(hr, hc)] === null && !(hr === s.beach.r && hc === s.beach.c)) {
    s.board[idx(hr, hc)] = { type: 'hazard', hazard: hazard.hazard, id: hazard.id };
    s.log.push(`${icons[hazard.hazard]} ${hazard.name} at (${hr+1}, ${hc+1})! That space is blocked.`);
  } else {
    s.log.push(`${icons[hazard.hazard]} ${hazard.name} rolled (${hr+1},${hc+1}) — already occupied. Lucky!`);
  }
  s.discard.push(hazard);
  return 'ok';
}

function doPickCard(s, a) {
  if (s.phase !== 'pick') return s;
  const ci = s.drawn.findIndex(c => c.id === a.cardId);
  if (ci === -1) return s;

  s.picked = s.drawn.splice(ci, 1)[0];
  for (const c of s.drawn) s.discard.push(c);
  s.drawn = [];

  if (!hasValidPlacement(s, s.picked)) return endGame(s, 'stuck', `Can't place ${s.picked.name} anywhere!`);
  s.phase = 'place';
  return s;
}

function doPlaceCard(s, a) {
  if (s.phase !== 'place' || !s.picked) return s;
  const { r, c, rot } = a;
  if (!inBounds(r, c) || s.board[idx(r, c)] !== null) return s;
  if (r === s.beach.r && c === s.beach.c) return s;

  const card = s.picked;
  const doors = rotateDoors(SHAPES[card.shape], rot);

  if (!isValidPlacement(s, r, c, doors)) return s;

  s.board[idx(r, c)] = {
    type: 'path', cardId: card.id, shape: card.shape,
    rot, doors: [...doors], icon: card.icon,
    mod: card.mod || null,
  };
  s.velvetPos = { r, c };
  s.picked = null;
  s.log.push(`Placed ${card.name} at (${r + 1}, ${c + 1})`);

  // Collect treats
  if (s.treats) {
    s.treats.forEach(t => {
      if (!t.collected && t.r === r && t.c === c) {
        t.collected = true;
        s.log.push('🦴 Velvet found a treat!');
      }
    });
  }

  // Shuffle bonus (Roll Spots)
  if (card.bonus === 'shuffle') {
    const count = s.discard.length;
    if (count > 0) {
      s.deck.push(...s.discard);
      s.discard = [];
      s.rngState += 1;
      s.deck = shuffle(s.deck, mulberry32(s.rngState));
      s.log.push(`🌀 Roll Spot! ${count} cards shuffled back into the deck!`);
    }
  }

  // Fetch modifier — draw 3 next turn
  if (card.mod && card.mod.type === 'fetch') {
    s.fetchNext = true;
    s.log.push('🎾 Fetch! Draw 3 cards next turn!');
  }

  // Peek modifier — show top 2 deck cards
  if (card.mod && card.mod.type === 'peek') {
    s.peekCards = s.deck.slice(0, 2).map(c => ({ name: c.name, shape: c.shape, icon: c.icon, hazard: c.hazard }));
    s.log.push('👀 Peek! Velvet sniffs out the next 2 cards...');
  }

  if (checkVictory(s)) return endGame(s, 'win', 'Velvet reached the BEACH! 🏖️');

  // Dig modifier — enter dig phase
  if (card.mod && card.mod.type === 'dig') {
    s.phase = 'dig';
    s.log.push('🦴 Dig! Pick an adjacent hazard to remove!');
    return s;
  }

  return afterPlace(s);
}

function afterPlace(s) {
  if (s.cat.active) {
    moveCat(s);
    if (s.phase === 'end') return s;
  }
  s.turn++;
  return startTurn(s);
}

function doDigHazard(s, a) {
  if (s.phase !== 'dig') return s;
  const { r, c } = a;
  if (!inBounds(r, c)) return s;
  const cell = s.board[idx(r, c)];
  if (!cell || cell.type !== 'hazard') return s;
  // Must be adjacent to Velvet
  const vr = s.velvetPos.r, vc = s.velvetPos.c;
  const isAdj = DIRS.some(([dr,dc]) => vr+dr === r && vc+dc === c);
  if (!isAdj) return s;
  s.board[idx(r, c)] = null;
  s.log.push(`Velvet dug up the hazard at (${r+1}, ${c+1})!`);
  return afterPlace(s);
}

function doSkipDig(s) {
  if (s.phase !== 'dig') return s;
  s.log.push('Velvet skipped digging.');
  return afterPlace(s);
}

function doSkipTurn(s) {
  if (s.phase !== 'pick' && s.phase !== 'place') return s;
  return endGame(s, 'stuck', 'Velvet gave up!');
}

function isValidPlacement(s, r, c, doors) {
  const connected = getConnectedCells(s);
  for (let d = 0; d < 4; d++) {
    if (!doors[d]) continue;
    const [dr, dc] = DIRS[d];
    const nr = r + dr, nc = c + dc;
    if (!inBounds(nr, nc)) continue;
    if (!connected.some(([cr, cc]) => cr === nr && cc === nc)) continue;
    const neighbor = s.board[idx(nr, nc)];
    if (!neighbor) continue;
    const nDoors = neighbor.doors || [true, true, true, true];
    if (nDoors[OPP[d]]) return true;
  }
  return false;
}

function hasValidPlacement(s, card) {
  for (let rot = 0; rot < 4; rot++) {
    const doors = rotateDoors(SHAPES[card.shape], rot);
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        if (s.board[idx(r, c)] !== null) continue;
        if (r === s.beach.r && c === s.beach.c) continue;
        if (isValidPlacement(s, r, c, doors)) return true;
      }
    }
  }
  return false;
}

function canPlaceAny(s, cards) {
  for (const card of cards) {
    if (hasValidPlacement(s, card)) return true;
  }
  return false;
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
      const [dr, dc] = DIRS[d];
      const nr = r + dr, nc = c + dc;
      if (!inBounds(nr, nc) || visited.has(idx(nr, nc))) continue;
      const n = s.board[idx(nr, nc)];
      if (!n || n.type === 'hazard') continue;
      const nd = n.doors || [true, true, true, true];
      if (!nd[OPP[d]]) continue;
      visited.add(idx(nr, nc));
      queue.push([nr, nc]);
    }
  }
  return [...visited].map(i => [Math.floor(i / GRID), i % GRID]);
}

function bfsPath(s, from, to) {
  const visited = new Map();
  const queue = [[from.r, from.c]];
  visited.set(idx(from.r, from.c), null);
  while (queue.length > 0) {
    const [r, c] = queue.shift();
    if (r === to.r && c === to.c) {
      const path = [];
      let cur = idx(r, c);
      while (cur !== null) { path.unshift([Math.floor(cur / GRID), cur % GRID]); cur = visited.get(cur); }
      return path;
    }
    const cell = s.board[idx(r, c)];
    if (!cell) continue;
    const doors = cell.doors || [true, true, true, true];
    for (let d = 0; d < 4; d++) {
      if (!doors[d]) continue;
      const [dr, dc] = DIRS[d];
      const nr = r + dr, nc = c + dc;
      if (!inBounds(nr, nc) || visited.has(idx(nr, nc))) continue;
      const n = s.board[idx(nr, nc)];
      if (!n || n.type === 'hazard') continue;
      const nd = n.doors || [true, true, true, true];
      if (!nd[OPP[d]]) continue;
      visited.set(idx(nr, nc), idx(r, c));
      queue.push([nr, nc]);
    }
  }
  return null;
}

function moveCat(s) {
  if (!s.cat.active) return;
  const path = bfsPath(s, s.cat, s.velvetPos);
  if (!path || path.length <= 1) {
    endGame(s, 'cat', '😾 The Mean Cat caught Velvet!');
    return;
  }
  const steps = Math.min(2, path.length - 1);
  s.cat.r = path[steps][0];
  s.cat.c = path[steps][1];
  s.log.push(`😾 Mean Cat prowls to (${s.cat.r + 1}, ${s.cat.c + 1})...`);
  if (s.cat.r === s.velvetPos.r && s.cat.c === s.velvetPos.c) {
    endGame(s, 'cat', '😾 The Mean Cat caught Velvet! Game over!');
  }
}

function checkVictory(s) {
  const conn = getConnectedCells(s);
  const { r: br, c: bc } = s.beach;
  for (const [cr, cc] of conn) {
    for (let d = 0; d < 4; d++) {
      const [dr, dc] = DIRS[d];
      if (cr + dr !== br || cc + dc !== bc) continue;
      const cell = s.board[idx(cr, cc)];
      const doors = cell.doors || [true, true, true, true];
      if (doors[d]) return true;
    }
  }
  return false;
}

export function calculateScore(s) {
  const conn = getConnectedCells(s);
  const connSet = new Set(conn.map(([r,c]) => idx(r,c)));
  const reached = s.endReason === 'win';
  if (!reached) return { tiles: conn.length, modBonus: 0, treatBonus: 0, objBonus: 0, total: 0, reached: false, rating: 0, stars: 0 };

  let modBonus = 0;
  conn.forEach(([r,c]) => {
    const cell = s.board[idx(r,c)];
    if (cell && cell.mod && cell.mod.type === 'pts') modBonus += cell.mod.val;
  });

  const treatBonus = (s.treats || []).filter(t => t.collected).length * 2;

  let objBonus = 0;
  const objResults = [];
  (s.objectives || []).forEach(id => {
    const def = OBJ_DEFS[id];
    if (!def) return;
    const met = def.check(s, conn, connSet);
    objResults.push({ id, label: def.label, met, pts: def.pts });
    if (met) objBonus += def.pts;
  });

  const total = conn.length + modBonus + treatBonus + objBonus;

  let stars = 0, rating = '';
  if (total >= 29) { stars = 5; rating = 'ULTIMATE ZOOMIE'; }
  else if (total >= 21) { stars = 4; rating = 'Neighbourhood Legend'; }
  else if (total >= 13) { stars = 3; rating = 'Trail Blazer'; }
  else if (total >= 6) { stars = 2; rating = 'Park Regular'; }
  else if (total >= 1) { stars = 1; rating = 'Good Boy'; }
  else { stars = 0; rating = 'Lost Pup'; }

  return { tiles: conn.length, modBonus, treatBonus, objBonus, total, reached, rating, stars, objResults };
}

function endGame(s, reason, msg) {
  s.phase = 'end';
  s.endReason = reason;
  s.score = calculateScore(s);
  s.log.push(msg);
  if (s.score.total > 0) s.log.push(`Score: ${s.score.total} (${s.score.tiles} tiles + ${s.score.modBonus} mod + ${s.score.treatBonus} treats + ${s.score.objBonus} objectives) — ${s.score.rating}!`);
  else s.log.push('Score: 0 — Velvet didn\'t reach the beach.');
  return s;
}

export function getValidSpots(s, card, rot) {
  const doors = rotateDoors(SHAPES[card.shape], rot);
  const spots = [];
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (s.board[idx(r, c)] !== null) continue;
      if (r === s.beach.r && c === s.beach.c) continue;
      if (isValidPlacement(s, r, c, doors)) spots.push([r, c]);
    }
  }
  return spots;
}

export { GRID, DIRS, OPP, idx, inBounds, isCorner, shuffle, OBJ_DEFS };
