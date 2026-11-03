import { newGame, newRun, act, getProgress, getValidPlacements, getAllValidPlacements, canPlace, COLS, ROWS, ENTRANCE_COL, ENTRANCE_ROW, cellKey } from '../engine/engine.js';
import { getRoomById, rotateDoors } from '../data/rooms.js';
import { roomSvg, emptyCellSvg, miniCellSvg } from './svg.js';
import * as sound from './sound.js';

let state = null;
let ui = {
  screen: 'title', // title | run | journal | runEnd | victory | shop
  journalCell: null,
  helpPage: 0,
  showHelp: false,
  toast: null,
  toastTimer: null,
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function save() {
  try { localStorage.setItem('mansion_save', JSON.stringify(state)); } catch {}
  try { localStorage.setItem('mansion_ui', JSON.stringify({ screen: ui.screen })); } catch {}
}

function load() {
  try {
    const s = localStorage.getItem('mansion_save');
    if (s) { state = JSON.parse(s); return true; }
  } catch {}
  return false;
}

function showToast(msg, dur = 2000) {
  ui.toast = msg;
  clearTimeout(ui.toastTimer);
  ui.toastTimer = setTimeout(() => { ui.toast = null; render(); }, dur);
}

function dispatch(action) {
  if (!state) return;
  const prev = state;
  state = act(state, action);

  if (action.type === 'place') {
    const key = cellKey(action.c, action.r);
    if (state.locked[key] && !prev.locked[key]) {
      sound.playLock();
      showToast('Perfect placement! Room locked in gold.');
    } else if (state.run && state.run.placed[key]) {
      sound.playPlace();
    }
    if (state.run && state.run.phase === 'won') {
      sound.playWin();
      ui.screen = 'victory';
    } else if (state.run && state.run.phase === 'ended') {
      sound.playEndRun();
      ui.screen = 'runEnd';
    }
  }

  if (action.type === 'endRun' && state.run && state.run.phase === 'ended') {
    sound.playEndRun();
    ui.screen = 'runEnd';
  }

  if (action.type === 'tapClue') {
    sound.playClue();
    showToast('Clue revealed!');
  }

  if (action.type === 'selectDraft') {
    sound.playDraft();
  }

  save();
  render();
}

function startNewGame() {
  const seed = Date.now();
  state = newGame(seed);
  ui.screen = 'run';
  state = newRun(state);
  save();
  render();
}

function continueGame() {
  if (state.run && state.run.phase === 'ended') {
    state = newRun(state);
  } else if (!state.run) {
    state = newRun(state);
  }
  ui.screen = 'run';
  save();
  render();
}

// ─── Renderers ───

function render() {
  const app = $('#app');
  if (!app) return;

  switch (ui.screen) {
    case 'title': app.innerHTML = renderTitle(); break;
    case 'run': app.innerHTML = renderRun(); break;
    case 'journal': app.innerHTML = renderJournal(); break;
    case 'runEnd': app.innerHTML = renderRunEnd(); break;
    case 'victory': app.innerHTML = renderVictory(); break;
    case 'shop': app.innerHTML = renderShop(); break;
    default: app.innerHTML = renderTitle();
  }

  if (ui.toast) {
    app.insertAdjacentHTML('beforeend', `<div class="toast">${ui.toast}</div>`);
  }

  if (ui.showHelp) {
    app.insertAdjacentHTML('beforeend', renderHelp());
  }
}

function renderTitle() {
  const hasSave = state !== null;
  const progress = hasSave ? getProgress(state) : null;

  return `
    <div class="screen title-screen">
      <div class="title-header">
        <div class="mansion-icon">🏰</div>
        <h1>The Perfect House</h1>
        <p class="subtitle">Reconstruct the hidden blueprint</p>
      </div>
      <div class="title-actions">
        <button class="btn btn-primary" data-a="newGame">New Puzzle</button>
        ${hasSave ? `<button class="btn" data-a="continue">Continue${progress ? ` (${progress.percent}%)` : ''}</button>` : ''}
      </div>
      <button class="btn-icon help-btn" data-a="help">?</button>
    </div>`;
}

function renderRun() {
  if (!state || !state.run) return renderTitle();
  const run = state.run;
  const progress = getProgress(state);

  let topBar = `
    <div class="top-bar">
      <div class="stat"><span class="stat-icon">👣</span><span class="stat-val">${run.steps}</span></div>
      <div class="stat"><span class="stat-icon">🔑</span><span class="stat-val">${run.keys}</span></div>
      <div class="stat"><span class="stat-icon">🏠</span><span class="stat-val">${progress.locked}/${progress.total}</span></div>
      <div class="top-actions">
        <button class="btn-icon" data-a="journal" title="Clue Journal">📓</button>
        <button class="btn-icon" data-a="endRunConfirm" title="End Run">🚪</button>
        <button class="btn-icon help-btn" data-a="help">?</button>
      </div>
    </div>`;

  const selectedRoom = run.phase === 'placing' && run.selectedDraft >= 0
    ? getRoomById(run.draft[run.selectedDraft])
    : null;
  const validCells = selectedRoom
    ? getAllValidPlacements(selectedRoom.id, state)
    : [];
  const validSet = new Set(validCells.map(v => cellKey(v.c, v.r)));

  let grid = '<div class="board">';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const key = cellKey(c, r);
      const locked = state.locked[key];
      const runPlaced = run.placed[key];
      const isOpen = run.openDoors.some(d => d.c === c && d.r === r);
      const isValid = validSet.has(key);
      const hasClue = (state.clueJournal[key] || []).length > 0;
      const bpCell = state.blueprint.cells.find(cell => cell.c === c && cell.r === r);

      let cellHtml;
      if (locked) {
        cellHtml = `<div class="cell locked" data-a="tapRoom" data-c="${c}" data-r="${r}">${roomSvg(locked.roomId, locked.rot, { locked: true })}</div>`;
      } else if (runPlaced) {
        cellHtml = `<div class="cell placed" data-a="tapRoom" data-c="${c}" data-r="${r}">${roomSvg(runPlaced.roomId, runPlaced.rot, { ghosted: true })}</div>`;
      } else if (isValid) {
        cellHtml = `<div class="cell valid-target" data-a="placeRoom" data-c="${c}" data-r="${r}">${emptyCellSvg({ openDoor: true, hasClue })}</div>`;
      } else if (isOpen) {
        cellHtml = `<div class="cell open" data-c="${c}" data-r="${r}">${emptyCellSvg({ openDoor: true, hasClue })}</div>`;
      } else {
        cellHtml = `<div class="cell wall${hasClue ? ' has-clue' : ''}${bpCell ? ' bp-cell' : ''}" data-c="${c}" data-r="${r}">${emptyCellSvg({ hasClue })}</div>`;
      }
      grid += cellHtml;
    }
  }
  grid += '</div>';

  let draft = '<div class="draft-tray">';
  if (run.phase === 'drafting' && run.draft.length > 0) {
    draft += '<div class="draft-label">Pick a room:</div><div class="draft-cards">';
    for (let i = 0; i < run.draft.length; i++) {
      const room = getRoomById(run.draft[i]);
      draft += `<div class="draft-card" data-a="selectDraft" data-i="${i}">
        ${roomSvg(room.id, 0)}
        <div class="draft-name">${room.name}</div>
        <div class="draft-info">${room.family} · ${room.shape}</div>
      </div>`;
    }
    draft += '</div>';
  } else if (run.phase === 'placing' && selectedRoom) {
    draft += `<div class="placement-controls">
      <div class="selected-room">
        ${roomSvg(selectedRoom.id, 0)}
        <div class="draft-name">${selectedRoom.name}</div>
      </div>
      <div class="placement-hint">Tap a highlighted cell</div>
      <button class="btn btn-secondary" data-a="cancelDraft">Back</button>
    </div>`;
  }
  draft += '</div>';

  return `<div class="screen run-screen">${topBar}${grid}${draft}</div>`;
}

function renderJournal() {
  const progress = getProgress(state);

  let header = `
    <div class="journal-header">
      <button class="btn-icon" data-a="closeJournal">←</button>
      <h2>Clue Journal</h2>
      <span class="progress-text">${progress.locked}/${progress.total} rooms found</span>
    </div>`;

  let minimap = '<div class="minimap">';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const key = cellKey(c, r);
      const bpCell = state.blueprint.cells.find(cell => cell.c === c && cell.r === r);
      const hasClue = (state.clueJournal[key] || []).length > 0;
      const isLocked = !!state.locked[key];
      const isSelected = ui.journalCell === key;

      let cls = 'mini-cell-wrap';
      if (isLocked) cls += ' locked';
      else if (hasClue) cls += ' has-clue';
      else if (bpCell) cls += ' bp-cell';
      if (isSelected) cls += ' selected';

      minimap += `<div class="${cls}" data-a="journalTap" data-c="${c}" data-r="${r}" data-key="${key}">${miniCellSvg(state, c, r)}</div>`;
    }
  }
  minimap += '</div>';

  let detail = '<div class="journal-detail">';
  if (ui.journalCell) {
    const key = ui.journalCell;
    const locked = state.locked[key];
    const clues = state.clueJournal[key] || [];

    if (locked) {
      const room = getRoomById(locked.roomId);
      detail += `<div class="journal-room">${roomSvg(locked.roomId, locked.rot, { locked: true })}<div class="journal-room-name">${room.name}</div><div class="journal-room-family">${room.family} · Locked</div></div>`;
    } else if (clues.length > 0) {
      detail += '<div class="clue-list">';
      for (const clue of clues) {
        detail += `<div class="clue-entry"><span class="clue-type">${clue.type}</span><span class="clue-text">${clue.text}</span></div>`;
      }
      detail += '</div>';
    } else {
      detail += '<div class="no-clues">No clues yet for this cell.<br>Tap a placed room during a run and spend a 🔑 to reveal a clue.</div>';
    }
  } else {
    detail += '<div class="no-clues">Tap a cell on the map above to see its clues.</div>';
  }
  detail += '</div>';

  return `<div class="screen journal-screen">${header}${minimap}${detail}</div>`;
}

function renderRunEnd() {
  const run = state.run;
  return `
    <div class="screen end-screen">
      <div class="glass panel">
        <h2>Run Complete</h2>
        <p class="subtitle">Out of steps!</p>
        <div class="end-stats">
          <div class="end-stat"><span>Rooms locked this run</span><strong>${run.lockedThisRun}</strong></div>
          <div class="end-stat"><span>Clues found</span><strong>${run.cluesThisRun}</strong></div>
          <div class="end-stat"><span>Ink earned</span><strong>+${run.inkEarned || 0}</strong></div>
          <div class="end-stat"><span>Total progress</span><strong>${getProgress(state).percent}%</strong></div>
        </div>
        <div class="end-actions">
          <button class="btn btn-primary" data-a="nextRun">Next Run</button>
          <button class="btn" data-a="shop">Upgrades (${state.meta.ink} ink)</button>
          <button class="btn btn-secondary" data-a="journal">View Journal</button>
        </div>
      </div>
    </div>`;
}

function renderVictory() {
  const progress = getProgress(state);
  return `
    <div class="screen victory-screen">
      <div class="glass panel victory-panel">
        <div class="victory-icon">🏆</div>
        <h1>The Perfect House!</h1>
        <p class="subtitle">You've reconstructed the entire mansion</p>
        <div class="end-stats">
          <div class="end-stat"><span>Runs taken</span><strong>${state.meta.runs}</strong></div>
          <div class="end-stat"><span>Clues gathered</span><strong>${state.meta.totalClues}</strong></div>
          <div class="end-stat"><span>Steps spent</span><strong>${state.meta.totalSteps}</strong></div>
        </div>
        <button class="btn btn-primary" data-a="newGame">New Puzzle</button>
      </div>
    </div>`;
}

function renderShop() {
  const ink = state.meta.ink;
  const upgrades = [
    { id: 'steps', name: '+2 Starting Steps', cost: 5, max: 3, icon: '👣' },
    { id: 'keys', name: '+1 Starting Key', cost: 3, max: 3, icon: '🔑' },
    { id: 'peek', name: 'Peek (reveal a room)', cost: 8, max: 2, icon: '👁️' },
    { id: 'surveyor', name: 'Free shape hints', cost: 10, max: 1, icon: '📐' },
  ];

  let items = '';
  for (const u of upgrades) {
    const level = state.meta.upgrades[u.id] || 0;
    const maxed = level >= u.max;
    const canBuy = !maxed && ink >= u.cost;
    items += `
      <div class="shop-item${maxed ? ' maxed' : ''}${canBuy ? ' available' : ''}">
        <span class="shop-icon">${u.icon}</span>
        <div class="shop-info">
          <div class="shop-name">${u.name}</div>
          <div class="shop-level">${maxed ? 'MAX' : `Level ${level}/${u.max} · ${u.cost} ink`}</div>
        </div>
        ${canBuy ? `<button class="btn btn-small" data-a="buyUpgrade" data-upgrade="${u.id}">Buy</button>` : ''}
      </div>`;
  }

  return `
    <div class="screen shop-screen">
      <div class="shop-header">
        <button class="btn-icon" data-a="closeShop">←</button>
        <h2>Upgrades</h2>
        <span class="ink-display">🖤 ${ink} ink</span>
      </div>
      <div class="shop-list">${items}</div>
      <button class="btn" data-a="closeShop">Back</button>
    </div>`;
}

const HELP_PAGES = [
  { title: 'The Goal', text: 'A secret blueprint hides the <strong>perfect layout</strong> of this mansion. Discover it by building, room by room, across multiple runs.' },
  { title: 'Building', text: 'Each run, <strong>draft 3 rooms, pick 1</strong>. Rotate it and place it on an open doorway. Doors must connect to the existing network.' },
  { title: 'Correctness', text: 'Place a room in the <strong>exact right position and rotation</strong> matching the secret blueprint and it <strong>locks in gold</strong> permanently — no step cost!' },
  { title: 'Clues', text: 'Tap any placed room and spend a 🔑 to get a <strong>cryptic clue</strong> about what belongs in that cell. Clues persist in your journal between runs.' },
  { title: 'Steps & Keys', text: 'You have limited <strong>Steps</strong> (wrong placements cost 1). <strong>Keys</strong> buy clues. Some rooms give bonus keys. Earn <strong>Ink</strong> each run to buy upgrades.' },
];

function renderHelp() {
  const page = HELP_PAGES[ui.helpPage];
  return `
    <div class="modal-overlay" data-a="closeHelp">
      <div class="glass panel help-panel" onclick="event.stopPropagation()">
        <h3>${page.title}</h3>
        <p>${page.text}</p>
        <div class="help-nav">
          ${ui.helpPage > 0 ? '<button class="btn btn-small" data-a="helpPrev">← Prev</button>' : '<span></span>'}
          <span class="help-dots">${ui.helpPage + 1}/${HELP_PAGES.length}</span>
          ${ui.helpPage < HELP_PAGES.length - 1 ? '<button class="btn btn-small" data-a="helpNext">Next →</button>' : '<button class="btn btn-small" data-a="closeHelp">Done</button>'}
        </div>
      </div>
    </div>`;
}

// ─── Input Handler ───

function handleClick(e) {
  const el = e.target.closest('[data-a]');
  if (!el) return;
  const a = el.dataset.a;

  switch (a) {
    case 'newGame': startNewGame(); break;
    case 'continue': continueGame(); break;

    case 'selectDraft':
      dispatch({ type: 'selectDraft', index: parseInt(el.dataset.i) });
      break;

    case 'rotate':
      dispatch({ type: 'rotate' });
      break;

    case 'placeRoom':
      dispatch({ type: 'place', c: parseInt(el.dataset.c), r: parseInt(el.dataset.r) });
      break;

    case 'cancelDraft':
      if (state.run) {
        state.run.phase = 'drafting';
        state.run.selectedDraft = -1;
        save();
        render();
      }
      break;

    case 'tapRoom': {
      if (!state.run || state.run.keys <= 0) {
        showToast('No keys left!');
        render();
        break;
      }
      const c = parseInt(el.dataset.c);
      const r = parseInt(el.dataset.r);
      dispatch({ type: 'tapClue', c, r });
      break;
    }

    case 'endRunConfirm':
      if (confirm('End this run?')) dispatch({ type: 'endRun' });
      break;

    case 'nextRun': continueGame(); break;

    case 'journal':
      ui.screen = 'journal';
      ui.journalCell = null;
      render();
      break;

    case 'closeJournal':
      ui.screen = state.run && state.run.phase !== 'ended' ? 'run' : 'runEnd';
      render();
      break;

    case 'journalTap':
      ui.journalCell = el.dataset.key;
      render();
      break;

    case 'shop': ui.screen = 'shop'; render(); break;
    case 'closeShop':
      ui.screen = state.run && state.run.phase === 'ended' ? 'runEnd' : 'run';
      render();
      break;

    case 'buyUpgrade':
      dispatch({ type: 'buyUpgrade', upgrade: el.dataset.upgrade });
      break;

    case 'help':
      ui.showHelp = true;
      ui.helpPage = 0;
      render();
      break;

    case 'closeHelp':
      ui.showHelp = false;
      render();
      break;

    case 'helpPrev':
      ui.helpPage = Math.max(0, ui.helpPage - 1);
      render();
      break;

    case 'helpNext':
      ui.helpPage = Math.min(HELP_PAGES.length - 1, ui.helpPage + 1);
      render();
      break;
  }
}

// ─── Init ───

export function init() {
  document.addEventListener('click', handleClick);
  const hasSave = load();
  if (hasSave && state.run && state.run.phase !== 'ended') {
    ui.screen = 'run';
  } else {
    ui.screen = 'title';
  }
  render();
}
