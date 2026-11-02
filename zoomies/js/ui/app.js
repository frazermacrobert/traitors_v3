import { newGame, act, getConnectedCells, GRID, idx } from '../engine/engine.js';
import { renderCell, renderCardPreview, SIZE } from './svg.js';
import { SHAPES, rotateDoors } from '../data/cards.js';

let state;
let selectedRot = 0;
let velvetPos = null;

const FLAVOR = {
  roll: ["Velvet is ZOOMING!", "Where to next?!", "The park awaits!", "Sniff sniff... this way!"],
  place: ["Pawfect spot!", "Trail blazed!", "Zoomie path growing!", "Good boy energy!"],
  hazard: ["Ruh roh!", "Watch out!", "Heckin' obstacle!", "Not the squirrel!"],
  win: ["BEACH TIME! 🏖️", "Velvet did it!", "THE ZOOMIEST BOY!", "Splashy splashy!"],
  stuck: ["Velvet got sleepy...", "Too many distractions!", "Nap time in the park..."],
};

function randomFlavor(key) {
  const arr = FLAVOR[key] || FLAVOR.roll;
  return arr[Math.floor(Math.random() * arr.length)];
}

function init() {
  try {
    const saved = localStorage.getItem('zoomies_save');
    if (saved) {
      state = JSON.parse(saved);
      selectedRot = 0;
      render();
      return;
    }
  } catch (e) { /* ignore */ }

  startNewGame();
}

function startNewGame() {
  const seed = Date.now();
  state = newGame(seed);
  selectedRot = 0;
  save();
  render();
}

function save() {
  try {
    localStorage.setItem('zoomies_save', JSON.stringify(state));
  } catch (e) { /* ignore */ }
}

function doAction(action) {
  state = act(state, action);
  save();
  render();
}

function render() {
  renderBoard();
  renderHUD();
  renderControls();
  renderLog();
  updateVelvet();
}

function renderBoard() {
  const grid = document.getElementById('board-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const connected = state.start ? getConnectedCells(state) : [];
  const connectedSet = new Set(connected.map(([r, c]) => idx(r, c)));

  // Beach marker on board
  const beachIdx = idx(state.beach.r, state.beach.c);

  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const i = idx(r, c);
      let cell = state.board[i];

      if (r === state.beach.r && c === state.beach.c && !cell) {
        cell = { type: 'beach' };
      }

      const isTarget = state.phase === 'place' && state.dice.row === r && state.dice.col === c;
      const isConn = connectedSet.has(i);

      const div = document.createElement('div');
      div.className = 'cell';
      div.innerHTML = renderCell(cell, { r, c, isTarget, isConnected: isConn, showDots: true });

      if (state.phase === 'setup') {
        const corners = [[0,0],[0,5],[5,0],[5,5]];
        if (corners.some(([cr, cc]) => cr === r && cc === c) && !(r === state.beach.r && c === state.beach.c)) {
          div.classList.add('clickable', 'corner-option');
          div.addEventListener('click', () => doAction({ type: 'chooseCorner', r, c }));
        }
      } else if (state.phase === 'place' && state.picked) {
        if (state.board[i] === null && !(r === state.beach.r && c === state.beach.c)) {
          div.classList.add('clickable');
          div.addEventListener('click', () => {
            doAction({ type: 'placeCard', r, c, rot: selectedRot });
          });
        }
      }

      grid.appendChild(div);
    }
  }

  // Row/col labels
  const labels = document.getElementById('board-labels');
  if (labels) {
    labels.innerHTML = '';
    // This is handled via CSS grid now
  }
}

function renderHUD() {
  const hud = document.getElementById('hud');
  if (!hud) return;

  const treatStr = '🦴'.repeat(Math.min(state.treats, 12));
  const connected = state.start ? getConnectedCells(state) : [];

  let phaseText = '';
  switch (state.phase) {
    case 'setup': phaseText = 'Choose a starting corner'; break;
    case 'roll': phaseText = 'Tap Roll Dice to start your turn'; break;
    case 'draw': phaseText = 'Draw cards or Dig Up'; break;
    case 'pick': phaseText = 'Pick a card to place'; break;
    case 'place': phaseText = `Place at (${state.dice.row + 1}, ${state.dice.col + 1}) — tap a cell or nudge`; break;
    case 'keepOrEnd': phaseText = 'Keep a card for later?'; break;
    case 'end': phaseText = state.score.beachPoints > 0 ? randomFlavor('win') : randomFlavor('stuck'); break;
  }

  hud.innerHTML = `
    <div class="hud-row">
      <span class="hud-treats" title="Treats">${treatStr} <b>${state.treats}</b></span>
      <span class="hud-turn">Turn ${state.turn}</span>
      <span class="hud-deck">📦 ${state.deck.length}</span>
      <span class="hud-path">🐾 ${connected.length}</span>
    </div>
    <div class="hud-phase">${phaseText}</div>
    ${state.dice.row !== null && state.phase === 'place' ? `<div class="hud-dice">🎲 Target: (${state.dice.row + 1}, ${state.dice.col + 1})</div>` : ''}
    ${state.phase === 'end' ? renderScoreCard() : ''}
  `;
}

function renderScoreCard() {
  if (!state.score) return '';
  const s = state.score;
  return `<div class="score-card">
    <h3>${s.beachPoints > 0 ? '🏖️ BEACH REACHED!' : '😴 Game Over'}</h3>
    <div class="score-line">Beach bonus: <b>${s.beachPoints}</b></div>
    <div class="score-line">Path length: <b>${s.pathPoints}</b></div>
    <div class="score-line">Treats remaining: <b>${s.treatPoints}</b></div>
    <div class="score-line">Hazards survived: <b>${s.hazardPoints}</b></div>
    <div class="score-line">Empty penalty: <b>${s.emptyPenalty}</b></div>
    <div class="score-line">Scenic bonus: <b>${s.scenicBonus}</b></div>
    <div class="score-total">Total: <b>${s.total}</b></div>
  </div>`;
}

function renderControls() {
  const ctrl = document.getElementById('controls');
  if (!ctrl) return;
  ctrl.innerHTML = '';

  if (state.phase === 'roll') {
    const btn = el('button', { class: 'btn btn-primary btn-roll' }, '🎲 Roll Dice');
    btn.onclick = () => doAction({ type: 'roll' });
    ctrl.appendChild(btn);
  }

  if (state.phase === 'draw') {
    const drawBtn = el('button', { class: 'btn btn-primary' }, '🃏 Draw 3 Cards');
    drawBtn.onclick = () => doAction({ type: 'drawCards' });
    ctrl.appendChild(drawBtn);

    if (state.treats >= 1 && state.deck.length > 0) {
      const digBtn = el('button', { class: 'btn btn-secondary' }, `🦴 Dig Up (1 treat)`);
      digBtn.onclick = () => doAction({ type: 'digUp' });
      ctrl.appendChild(digBtn);
    }
  }

  if (state.phase === 'pick') {
    renderCardPicker(ctrl);
  }

  if (state.phase === 'place') {
    renderPlaceControls(ctrl);
  }

  if (state.phase === 'keepOrEnd') {
    renderKeepControls(ctrl);
  }

  if (state.phase === 'end') {
    const btn = el('button', { class: 'btn btn-primary' }, '🔄 New Game');
    btn.onclick = () => startNewGame();
    ctrl.appendChild(btn);
  }

  // Hand display
  if (state.hand.length > 0 && state.phase !== 'end') {
    const handDiv = el('div', { class: 'hand-section' });
    handDiv.innerHTML = '<div class="hand-label">In Hand:</div>';
    for (const card of state.hand) {
      const cardEl = el('div', { class: 'card-in-hand' });
      cardEl.innerHTML = renderCardPreview(card, 0, 44) + `<span class="card-name">${card.label}</span>`;

      if (state.phase === 'pick') {
        cardEl.classList.add('clickable');
        cardEl.onclick = () => doAction({ type: 'pickCard', cardId: card.id, fromHand: true });
      }
      handDiv.appendChild(cardEl);
    }
    ctrl.appendChild(handDiv);
  }
}

function renderCardPicker(container) {
  const pickerDiv = el('div', { class: 'card-picker' });
  pickerDiv.innerHTML = '<div class="picker-label">Pick a card to place:</div>';

  for (const card of state.drawn) {
    const cardEl = el('div', { class: 'card-option clickable' });
    cardEl.innerHTML = renderCardPreview(card, 0, 56) +
      `<div class="card-info"><b>${card.label}</b>${card.treatBonus ? ' (+1🦴)' : ''}${card.tunnel ? ' (Tunnel)' : ''}</div>`;
    cardEl.onclick = () => doAction({ type: 'pickCard', cardId: card.id, fromHand: false });
    pickerDiv.appendChild(cardEl);
  }

  container.appendChild(pickerDiv);
}

function renderPlaceControls(container) {
  if (!state.picked) return;

  const preview = el('div', { class: 'place-preview' });
  preview.innerHTML = `<div class="preview-label">Placing: <b>${state.picked.label}</b></div>`;

  const rotDiv = el('div', { class: 'rotation-controls' });
  for (let r = 0; r < 4; r++) {
    const btn = el('div', { class: `rot-option ${r === selectedRot ? 'selected' : ''} clickable` });
    btn.innerHTML = renderCardPreview(state.picked, r, 48);
    btn.onclick = () => { selectedRot = r; render(); };
    rotDiv.appendChild(btn);
  }
  preview.appendChild(rotDiv);

  const targetCell = state.board[idx(state.dice.row, state.dice.col)];
  const isBeach = state.dice.row === state.beach.r && state.dice.col === state.beach.c;
  const isOccupied = targetCell !== null || isBeach;

  if (isOccupied) {
    preview.innerHTML += `<div class="warning">⚠️ Target cell is occupied! Nudge or skip.</div>`;
  }

  // Nudge buttons
  if (state.treats >= 1) {
    const nudgeDiv = el('div', { class: 'nudge-controls' });
    nudgeDiv.innerHTML = '<div class="nudge-label">Nudge (1🦴):</div>';
    const dirs = [
      { label: '⬆️', axis: 'row', dir: -1 },
      { label: '⬇️', axis: 'row', dir: 1 },
      { label: '⬅️', axis: 'col', dir: -1 },
      { label: '➡️', axis: 'col', dir: 1 },
    ];
    for (const d of dirs) {
      const btn = el('button', { class: 'btn btn-nudge' }, d.label);
      btn.onclick = () => doAction({ type: 'nudge', axis: d.axis, dir: d.dir });
      nudgeDiv.appendChild(btn);
    }
    preview.appendChild(nudgeDiv);
  }

  // Fetch button
  if (state.treats >= 2) {
    const fetchNote = el('div', { class: 'fetch-note' }, '🦴🦴 Fetch: tap any empty cell next to your path');
    preview.appendChild(fetchNote);
  }

  // Skip
  const skipBtn = el('button', { class: 'btn btn-danger' }, '💨 Skip Turn');
  skipBtn.onclick = () => doAction({ type: 'skipTurn' });
  preview.appendChild(skipBtn);

  container.appendChild(preview);
}

function renderKeepControls(container) {
  if (state.drawn.length === 0 || state.hand.length >= 2) {
    const btn = el('button', { class: 'btn btn-primary' }, '➡️ End Turn');
    btn.onclick = () => doAction({ type: 'keepCard', cardId: null });
    container.appendChild(btn);
    return;
  }

  const keepDiv = el('div', { class: 'keep-section' });
  keepDiv.innerHTML = `<div class="keep-label">Keep a card? (Hand: ${state.hand.length}/2)</div>`;

  for (const card of state.drawn) {
    const cardEl = el('div', { class: 'card-option clickable' });
    cardEl.innerHTML = renderCardPreview(card, 0, 48) + `<div class="card-info"><b>${card.label}</b></div>`;
    cardEl.onclick = () => doAction({ type: 'keepCard', cardId: card.id });
    keepDiv.appendChild(cardEl);
  }

  const skipBtn = el('button', { class: 'btn btn-secondary' }, 'No thanks — End Turn');
  skipBtn.onclick = () => doAction({ type: 'keepCard', cardId: null });
  keepDiv.appendChild(skipBtn);

  container.appendChild(keepDiv);
}

function renderLog() {
  const log = document.getElementById('game-log');
  if (!log) return;
  const recent = state.log.slice(-6);
  log.innerHTML = recent.map((l, i) =>
    `<div class="log-entry ${i === recent.length - 1 ? 'latest' : ''}">${l}</div>`
  ).join('');
  log.scrollTop = log.scrollHeight;
}

function updateVelvet() {
  const connected = state.start ? getConnectedCells(state) : [];
  if (connected.length === 0) return;

  // Velvet sits at the furthest connected cell from start
  let maxDist = 0;
  let furthest = connected[0];
  for (const [r, c] of connected) {
    const d = Math.abs(r - state.start.r) + Math.abs(c - state.start.c);
    if (d > maxDist) {
      maxDist = d;
      furthest = [r, c];
    }
  }
  velvetPos = furthest;

  // Overlay Velvet on the board
  const cells = document.querySelectorAll('#board-grid .cell');
  if (velvetPos && state.phase !== 'end') {
    const vi = idx(velvetPos[0], velvetPos[1]);
    if (cells[vi]) {
      const marker = document.createElement('div');
      marker.className = 'velvet-marker';
      marker.textContent = '🐕';
      cells[vi].style.position = 'relative';
      cells[vi].appendChild(marker);
    }
  }
}

function el(tag, attrs = {}, text = '') {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else e.setAttribute(k, v);
  }
  if (text) e.textContent = text;
  return e;
}

// Expose for HTML
window.zoomiesInit = init;
window.zoomiesNewGame = startNewGame;
