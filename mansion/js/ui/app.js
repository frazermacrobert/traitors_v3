import { newGame, newRun, act, getProgress, getUpgradeList, COLS, ROWS, ENTRANCE_COL, ENTRANCE_ROW, cellKey } from '../engine/engine.js';
import { getRoomById, rotateDoors, FAMILY_EFFECTS, FAMILY_COLORS } from '../data/rooms.js';
import { roomSvg, emptyCellSvg, miniCellSvg } from './svg.js';
import * as sound from './sound.js';

const SAVE_VERSION = 3;

let state = null;
let ui = {
  screen: 'title',
  journalCell: null,
  helpPage: 0,
  showHelp: false,
  toast: null,
  toastTimer: null,
  endRunPrompt: false,
};

const $ = (sel) => document.querySelector(sel);

function save() {
  try {
    localStorage.setItem('mansion_save', JSON.stringify({ ...state, _v: SAVE_VERSION }));
  } catch {}
  try { localStorage.setItem('mansion_ui', JSON.stringify({ screen: ui.screen })); } catch {}
}

function load() {
  try {
    const s = localStorage.getItem('mansion_save');
    if (s) {
      const parsed = JSON.parse(s);
      if (!parsed._v || parsed._v < SAVE_VERSION) {
        localStorage.removeItem('mansion_save');
        localStorage.removeItem('mansion_ui');
        return false;
      }
      delete parsed._v;
      state = parsed;
      return true;
    }
  } catch {}
  return false;
}

function showToast(msg, dur = 2500) {
  ui.toast = msg;
  clearTimeout(ui.toastTimer);
  render();
  ui.toastTimer = setTimeout(() => { ui.toast = null; render(); }, dur);
}

function dispatch(action) {
  if (!state) return;
  const prev = state;
  state = act(state, action);

  if (action.type === 'draftRoom') {
    const dc = prev.run && prev.run.draftCell;
    if (dc) {
      const key = cellKey(dc.c, dc.r);
      if (state.locked[key] && !prev.locked[key]) {
        sound.playLock();
        showToast('Perfect placement! Room locked permanently.');
      } else if (state.run && state.run.placed[key]) {
        sound.playPlace();
      }
      // Show item drops
      if (state.run && state.run.lastItems && state.run.lastItems.length > 0) {
        const names = { gem: 'Gem', coin: 'Coin', key: 'Key', food: 'Food (+2 energy)' };
        const items = state.run.lastItems.map(i => names[i] || i).join(', ');
        showToast(`Found: ${items}`);
      }
    }
    if (state.run && state.run.phase === 'won') {
      sound.playWin();
      ui.screen = 'victory';
    } else if (state.run && state.run.phase === 'ended') {
      sound.playEndRun();
      ui.screen = 'runEnd';
    }
  }

  if (action.type === 'unlockDoor') {
    sound.playClue();
    showToast('Door unlocked!');
  }

  if (action.type === 'endRun' && state.run && state.run.phase === 'ended') {
    sound.playEndRun();
    ui.screen = 'runEnd';
  }

  if (action.type === 'tapClue') {
    sound.playClue();
    showToast('Clue revealed!');
  }

  save();
  render();
}

function startNewGame() {
  const seed = Date.now();
  state = newGame(seed);
  state = newRun(state);
  ui.screen = 'run';
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

// --- Renderers ---

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

  const topBar = `
    <div class="top-bar">
      <div class="stat" title="Energy"><span class="stat-icon">⚡</span><span class="stat-val">${run.energy}</span></div>
      <div class="stat" title="Gems"><span class="stat-icon">💎</span><span class="stat-val">${run.gems}</span></div>
      <div class="stat" title="Keys"><span class="stat-icon">🔑</span><span class="stat-val">${run.keys}</span></div>
      <div class="stat" title="Coins"><span class="stat-icon">🪙</span><span class="stat-val">${run.coins}</span></div>
      <div class="stat progress-stat"><span class="stat-val">${progress.locked}/${progress.total}</span></div>
      <div class="top-actions">
        <button class="btn-icon" data-a="journal" title="Journal">📓</button>
        <button class="btn-icon help-btn" data-a="help">?</button>
      </div>
    </div>`;

  let grid = '<div class="board">';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const key = cellKey(c, r);
      const locked = state.locked[key];
      const runPlaced = run.placed[key];
      const isOpen = run.openDoors && run.openDoors.some(d => d.c === c && d.r === r);
      const isLocked = run.lockedDoors && run.lockedDoors.some(d => d.c === c && d.r === r);
      const hasClue = (state.clueJournal[key] || []).length > 0;
      const bpCell = state.blueprint.cells.find(cell => cell.c === c && cell.r === r);
      const isEntrance = c === ENTRANCE_COL && r === ENTRANCE_ROW;

      let cellHtml;

      if (isEntrance) {
        cellHtml = `<div class="cell entrance" data-a="tapEntrance" data-c="${c}" data-r="${r}">${roomSvg(999, 0, { locked: true })}</div>`;
      } else if (locked) {
        cellHtml = `<div class="cell locked" data-a="tapRoom" data-c="${c}" data-r="${r}">${roomSvg(locked.roomId, locked.rot, { locked: true })}</div>`;
      } else if (runPlaced) {
        cellHtml = `<div class="cell placed" data-a="tapRoom" data-c="${c}" data-r="${r}">${roomSvg(runPlaced.roomId, runPlaced.rot, { ghosted: true })}</div>`;
      } else if (isOpen && run.phase === 'exploring') {
        cellHtml = `<div class="cell open-door" data-a="openDoor" data-c="${c}" data-r="${r}">${emptyCellSvg({ openDoor: true, hasClue })}</div>`;
      } else if (isLocked && run.phase === 'exploring') {
        cellHtml = `<div class="cell locked-door" data-a="tapLockedDoor" data-c="${c}" data-r="${r}">${lockedDoorSvg(hasClue)}</div>`;
      } else {
        cellHtml = `<div class="cell wall${hasClue ? ' has-clue' : ''}${bpCell ? ' bp-cell' : ''}" data-c="${c}" data-r="${r}">${emptyCellSvg({ hasClue })}</div>`;
      }
      grid += cellHtml;
    }
  }
  grid += '</div>';

  // Draft modal (overlaid when drafting)
  let draftModal = '';
  if (run.phase === 'drafting' && run.draftOptions) {
    draftModal = renderDraftModal();
  }

  // End run prompt
  let endPrompt = '';
  if (ui.endRunPrompt) {
    endPrompt = `
      <div class="modal-overlay" data-a="cancelEndRun">
        <div class="glass panel end-prompt" data-a="noop">
          <h3>End This Run?</h3>
          <p>Return to the entrance and tally your progress.</p>
          <div class="prompt-actions">
            <button class="btn btn-primary" data-a="confirmEndRun">End Run</button>
            <button class="btn btn-secondary" data-a="cancelEndRun">Keep Exploring</button>
          </div>
        </div>
      </div>`;
  }

  return `<div class="screen run-screen">${topBar}${grid}${draftModal}${endPrompt}</div>`;
}

function lockedDoorSvg(hasClue) {
  const SIZE = 60, HALF = SIZE / 2;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" class="room-tile locked-door-tile">`;
  svg += `<rect x="2" y="2" width="${SIZE-4}" height="${SIZE-4}" fill="none" stroke="var(--rust)" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.6"/>`;
  svg += `<text x="${HALF}" y="${HALF}" text-anchor="middle" dominant-baseline="central" font-size="18" opacity="0.7">🔒</text>`;
  if (hasClue) {
    svg += `<circle cx="${SIZE-8}" cy="8" r="3.5" fill="var(--mustard)" opacity="0.8"/>`;
  }
  svg += '</svg>';
  return svg;
}

function renderDraftModal() {
  const run = state.run;
  const options = run.draftOptions;
  if (!options) return '';

  let cards = '';
  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const room = getRoomById(opt.roomId);
    const effect = FAMILY_EFFECTS[room.family];
    const colors = FAMILY_COLORS[room.family] || { color: '#999', deep: '#555' };
    const energyCost = (effect && effect.type === 'costly') ? effect.value : 1;
    const canAfford = room.cost <= run.gems && run.energy >= energyCost;

    cards += `
      <div class="draft-option${canAfford ? '' : ' unaffordable'}" data-a="draftRoom" data-i="${i}" style="border-color: ${colors.deep}40">
        <div class="draft-option-svg">${roomSvg(opt.roomId, opt.rot)}</div>
        <div class="draft-option-info">
          <div class="draft-option-name">${room.name}</div>
          <div class="draft-option-family">${room.icon} ${room.family}</div>
          ${effect ? `<div class="draft-option-effect">${effect.desc}</div>` : ''}
          <div class="draft-option-costs">
            <span class="cost-tag">⚡${energyCost}</span>
            ${room.cost > 0 ? `<span class="cost-tag gem-cost">💎${room.cost}</span>` : '<span class="cost-tag free-tag">Free</span>'}
          </div>
          ${!canAfford ? '<div class="draft-option-cant">Cannot afford</div>' : ''}
        </div>
      </div>`;
  }

  return `
    <div class="draft-modal">
      <div class="draft-modal-header">
        <h3>Choose a Room</h3>
        <span class="draft-cell-label">Floor ${ENTRANCE_ROW - run.draftCell.r + 1}</span>
      </div>
      <div class="draft-options">${cards}</div>
    </div>`;
}

function renderJournal() {
  const progress = getProgress(state);

  let header = `
    <div class="journal-header">
      <button class="btn-icon" data-a="closeJournal">←</button>
      <h2>Clue Journal</h2>
      <span class="progress-text">${progress.locked}/${progress.total}</span>
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
      const effect = FAMILY_EFFECTS[room.family];
      detail += `<div class="journal-room">${roomSvg(locked.roomId, locked.rot, { locked: true })}<div class="journal-room-name">${room.name}</div><div class="journal-room-family">${room.family}${effect ? ' · ' + effect.desc : ''} · Locked</div></div>`;
    } else if (clues.length > 0) {
      detail += '<div class="clue-list">';
      for (const clue of clues) {
        detail += `<div class="clue-entry"><span class="clue-type">${clue.type}</span><span class="clue-text">${clue.text}</span></div>`;
      }
      detail += '</div>';
    } else {
      detail += '<div class="no-clues">No clues yet for this cell.</div>';
    }
  } else {
    detail += '<div class="no-clues">Tap a cell to see its clues.</div>';
  }
  detail += '</div>';

  return `<div class="screen journal-screen">${header}${minimap}${detail}</div>`;
}

function renderRunEnd() {
  const run = state.run;
  const progress = getProgress(state);
  return `
    <div class="screen end-screen">
      <div class="glass panel">
        <h2>Run Complete</h2>
        <p class="subtitle">Run #${state.meta.runs}</p>
        <div class="end-stats">
          <div class="end-stat"><span>Rooms locked</span><strong>${run.lockedThisRun}</strong></div>
          <div class="end-stat"><span>Coins gathered</span><strong>${run.coins || 0}</strong></div>
          <div class="end-stat"><span>Ink earned</span><strong>+${run.inkEarned || 0}</strong></div>
          <div class="end-stat"><span>Total progress</span><strong>${progress.percent}%</strong></div>
        </div>
        <div class="end-actions">
          <button class="btn btn-primary" data-a="nextRun">Next Run</button>
          <button class="btn" data-a="shop">Ink Shop (${state.meta.ink} ink)</button>
          <button class="btn btn-secondary" data-a="journal">View Journal</button>
        </div>
      </div>
    </div>`;
}

function renderVictory() {
  return `
    <div class="screen victory-screen">
      <div class="glass panel victory-panel">
        <div class="victory-icon">🏆</div>
        <h1>The Perfect House!</h1>
        <p class="subtitle">Every room in its rightful place</p>
        <div class="end-stats">
          <div class="end-stat"><span>Runs taken</span><strong>${state.meta.runs}</strong></div>
          <div class="end-stat"><span>Total ink earned</span><strong>${state.meta.ink}</strong></div>
        </div>
        <button class="btn btn-primary" data-a="newGame">New Puzzle</button>
      </div>
    </div>`;
}

function renderShop() {
  const ink = state.meta.ink;
  const upgrades = getUpgradeList();

  let items = '';
  for (const u of upgrades) {
    const level = state.meta.upgrades[u.id] || 0;
    const maxed = level >= u.max;
    const canBuy = !maxed && ink >= u.cost;
    items += `
      <div class="shop-item${maxed ? ' maxed' : ''}${canBuy ? ' available' : ''}">
        <div class="shop-info">
          <div class="shop-name">${u.name}</div>
          <div class="shop-desc">${u.desc}</div>
          <div class="shop-level">${maxed ? 'MAX' : `Level ${level}/${u.max} · ${u.cost} ink`}</div>
        </div>
        ${canBuy ? `<button class="btn btn-small" data-a="buyUpgrade" data-upgrade="${u.id}">Buy</button>` : ''}
      </div>`;
  }

  return `
    <div class="screen shop-screen">
      <div class="shop-header">
        <button class="btn-icon" data-a="closeShop">←</button>
        <h2>Ink Shop</h2>
        <span class="ink-display">🖤 ${ink}</span>
      </div>
      <div class="shop-list">${items}</div>
      <button class="btn" data-a="closeShop">Back</button>
    </div>`;
}

const HELP_PAGES = [
  { title: 'The Goal', text: 'A secret blueprint hides the <strong>perfect layout</strong> of this mansion. Discover it room by room across multiple runs. Place each room <strong>correctly</strong> and it locks permanently.' },
  { title: 'Exploring', text: 'Tap an <strong>open door</strong> (dashed cell) to see 3 room options. You must pick one. Each placement costs <strong>energy</strong> — red rooms cost 2.' },
  { title: 'Resources', text: '<strong>⚡ Energy</strong> — spent on each placement. <strong>💎 Gems</strong> — pay room costs. <strong>🔑 Keys</strong> — unlock locked doors. <strong>🪙 Coins</strong> — buy clues, convert to ink.' },
  { title: 'Items', text: 'Rooms may contain <strong>hidden items</strong> — gems, coins, keys, or food (energy). Some room families are richer than others. Explore to learn which!' },
  { title: 'Locked Doors', text: 'Deeper rooms may have <strong>🔒 locked doors</strong>. Spend a key to unlock. Once unlocked, they stay open for the run.' },
  { title: 'Progression', text: 'Correct placements <strong>lock permanently</strong>. Earn <strong>ink</strong> each run to buy upgrades. Early runs are tough — each one makes the next easier.' },
];

function renderHelp() {
  const page = HELP_PAGES[ui.helpPage];
  return `
    <div class="modal-overlay" data-a="closeHelp">
      <div class="glass panel help-panel" data-a="noop">
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

// --- Input Handler ---

function handleClick(e) {
  const el = e.target.closest('[data-a]');
  if (!el) return;
  const a = el.dataset.a;

  switch (a) {
    case 'newGame': startNewGame(); break;
    case 'continue': continueGame(); break;

    case 'openDoor':
      dispatch({ type: 'openDoor', c: parseInt(el.dataset.c), r: parseInt(el.dataset.r) });
      sound.playDraft();
      break;

    case 'tapLockedDoor': {
      const c = parseInt(el.dataset.c);
      const r = parseInt(el.dataset.r);
      if (state.run && state.run.keys > 0) {
        dispatch({ type: 'unlockDoor', c, r });
      } else {
        showToast('You need a key to unlock this door.');
      }
      break;
    }

    case 'draftRoom': {
      const idx = parseInt(el.dataset.i);
      dispatch({ type: 'draftRoom', index: idx });
      break;
    }

    case 'tapEntrance':
      ui.endRunPrompt = true;
      render();
      break;

    case 'confirmEndRun':
      ui.endRunPrompt = false;
      dispatch({ type: 'endRun' });
      break;

    case 'cancelEndRun':
      ui.endRunPrompt = false;
      render();
      break;

    case 'tapRoom': {
      // Show room info popup? For now show a toast with room name
      const c = parseInt(el.dataset.c);
      const r = parseInt(el.dataset.r);
      const key = cellKey(c, r);
      const locked = state.locked[key];
      const runPlaced = state.run ? state.run.placed[key] : null;
      const cell = locked || runPlaced;
      if (cell) {
        const room = getRoomById(cell.roomId);
        const clues = state.clueJournal[key] || [];
        let msg = `${room.icon} ${room.name} (${room.family})`;
        if (locked) msg += ' — Locked';
        if (clues.length > 0) msg += ` · ${clues.length} clue${clues.length > 1 ? 's' : ''}`;
        showToast(msg, 3000);
      }
      break;
    }

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

    case 'goHome':
      ui.screen = 'title';
      ui.showHelp = false;
      ui.endRunPrompt = false;
      render();
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

// --- Init ---

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
