// UI layer: rendering + input only. All rules live in ../engine.
import {
  newRun, act, openTargets, cellAt, gemCost, connectedSet, vaultToll, vaultConnected, roomDoors, LOSS_TEXT,
} from '../engine/engine.js';
import { newMeta, migrateMeta, applyResult, buyUnlock, mansionUnlocked, availableDecks, runOptions } from '../engine/meta.js';
import { ROOMS, FAMILIES, SHAPES } from '../data/rooms.js';
import { HEIRLOOMS } from '../data/heirlooms.js';
import { MANSIONS, CURSES, DEEDS, DECKS, UNLOCKS } from '../data/mansions.js';
import { roomSvg, esc } from './svg.js';

const $app = document.getElementById('app');
const $toast = document.getElementById('toast');
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

const ui = {
  screen: 'title',
  meta: migrateMeta(store.get('floorplan.meta')),
  run: store.get('floorplan.run'),
  overlay: null, // 'help' | 'result' | 'menu' | {info}
  news: [],
  fresh: null, // key of last placed cell for animation
  bumped: [],
};
if (ui.run && (ui.run.v !== 1 || ui.run.phase === 'won' || ui.run.phase === 'lost')) ui.run = null;

function save() {
  store.set('floorplan.meta', ui.meta);
  if (ui.run && ui.run.phase !== 'won' && ui.run.phase !== 'lost') store.set('floorplan.run', ui.run);
  else store.del('floorplan.run');
}

let toastTimer;
function toast(msg, err = false) {
  $toast.textContent = msg;
  $toast.className = `show${err ? ' err' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $toast.className = ''; }, err ? 2200 : 1800);
}
const buzz = (ms = 12) => { try { navigator.vibrate?.(ms); } catch { /* ignore */ } };

// ---------- actions ----------
function doAct(action) {
  const before = ui.run;
  try {
    ui.run = act(before, action);
  } catch (e) {
    toast(e.message, true);
    buzz([20, 40, 20]);
    return;
  }
  const s = ui.run;
  ui.bumped = Object.keys(s.res).filter((k) => s.res[k] !== before.res[k]);
  if (action.type === 'place') { ui.fresh = `${before.pending.r},${before.pending.c}`; buzz(15); } else ui.fresh = null;
  const fresh = Math.min(s.log.length, (s.logCount || 0) - (before.logCount || 0));
  const newLogs = fresh > 0 ? s.log.slice(-fresh) : [];
  const interesting = newLogs.filter((l) => !l.startsWith('Placed'));
  if (interesting.length && s.phase !== 'won' && s.phase !== 'lost') toast(interesting[interesting.length - 1]);
  if (s.phase === 'won' || s.phase === 'lost') endRun();
  save();
  render();
}

function endRun() {
  const { meta, news } = applyResult(ui.meta, ui.run);
  ui.meta = meta;
  ui.news = news;
  ui.overlay = 'result';
  $toast.className = '';
  buzz(ui.run.result.won ? [30, 50, 30, 50, 80] : 60);
}

function startRun() {
  const sel = ui.meta.last;
  const seed = `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  ui.run = newRun(runOptions(ui.meta, { ...sel, seed }));
  ui.screen = 'run';
  ui.overlay = ui.meta.seenHelp ? null : 'help';
  ui.fresh = null;
  save();
  render();
}

// ---------- render ----------
function render() {
  const fn = { title: renderTitle, select: renderSelect, archive: renderArchive, run: renderRun }[ui.screen];
  $app.innerHTML = fn() + renderOverlay();
  if (ui.screen === 'run') sizeBoard();
}

function renderTitle() {
  const m = ui.meta;
  return `<section class="screen"><div class="title-wrap">
    <div class="logo">Floorplan</div>
    <p class="tag">Draft rooms. Rotate them. Reach the Vault before your Steps run out.</p>
    <div class="title-buttons">
      ${ui.run ? '<button class="btn primary" data-a="resume">Continue run</button>' : ''}
      <button class="btn ${ui.run ? '' : 'primary'}" data-a="go" data-to="select">${ui.run ? 'New run' : 'Play'}</button>
      <button class="btn" data-a="go" data-to="archive">Archive · ${m.ink} Ink</button>
      <button class="btn ghost" data-a="help">How to play</button>
    </div>
    <div class="stats">${m.runs} runs · ${m.wins} wins</div>
  </div></section>`;
}

function renderSelect() {
  const sel = ui.meta.last;
  const mansions = MANSIONS.map((m, i) => {
    const open = mansionUnlocked(ui.meta, i);
    const st = ui.meta.mansions[m.id];
    const curse = CURSES[m.curse];
    return `<button class="panel ${open ? '' : 'locked'} ${sel.mansionId === m.id ? 'selected' : ''}" style="text-align:left;cursor:pointer" ${open ? `data-a="pickMansion" data-id="${m.id}"` : 'disabled'}>
      <div class="row"><h3 class="grow">${i + 1}. ${esc(m.name)}</h3><span class="chip">${m.w}×${m.h}</span></div>
      <div class="muted" style="margin:4px 0 8px">${open ? esc(m.blurb) : `Beat ${esc(MANSIONS[i - 1].name)} to unlock.`}</div>
      ${open ? `<div class="row wrap">
        <span class="chip">♛ toll ${m.toll}💎</span>
        <span class="chip curse">✸ ${esc(curse.name)}: ${esc(curse.text)}</span>
        ${st.wins ? `<span class="chip">🏆 ${st.wins} · best ${st.best}</span>` : ''}
      </div>` : ''}
    </button>`;
  }).join('');
  const st = ui.meta.mansions[sel.mansionId];
  const deed = Math.min(sel.deed, st.maxDeed);
  const deedText = DEEDS.slice(1, deed + 1).map((d) => `<li>${esc(d.text)}</li>`).join('');
  const decks = availableDecks(ui.meta).map((id) => `<button class="btn small ${sel.deckId === id ? 'on' : ''}" data-a="pickDeck" data-id="${id}">${esc(DECKS[id].name)}</button>`).join('');
  return `<section class="screen">
    <div class="topbar"><button class="icon-btn" data-a="go" data-to="title" aria-label="Back">←</button><h2>Choose a mansion</h2></div>
    <div class="list">${mansions}</div>
    <div class="panel">
      <div class="deed-row">
        <div class="grow"><h3>Deed</h3><div class="muted" style="font-size:13px">Cumulative handicaps. Win to unlock the next.</div></div>
        <button class="icon-btn" data-a="deed" data-d="-1" ${deed <= 0 ? 'disabled' : ''} aria-label="Lower deed">−</button>
        <div class="deed-num">${deed}</div>
        <button class="icon-btn" data-a="deed" data-d="1" ${deed >= st.maxDeed ? 'disabled' : ''} aria-label="Raise deed">+</button>
      </div>
      ${deed ? `<ul style="margin:8px 0 0;padding-left:20px;font-size:13px">${deedText}</ul>` : ''}
    </div>
    <div class="panel"><h3 style="margin-bottom:8px">Plans (starting deck)</h3><div class="seg">${decks}</div>
      <div class="muted" style="font-size:13px;margin-top:8px">${esc(DECKS[sel.deckId].text)}</div></div>
    <button class="btn primary" data-a="start">Enter ${esc(MANSIONS.find((m) => m.id === sel.mansionId).name)}</button>
  </section>`;
}

function renderArchive() {
  const items = UNLOCKS.map((u) => {
    const owned = ui.meta.owned.includes(u.id);
    let name, text, pic = '';
    if (u.kind === 'room') {
      const r = ROOMS[u.ref];
      name = r.name; text = `${FAMILIES[r.family].name} · ${SHAPES[r.shape].name}${r.cost ? ` · ${r.cost}💎` : ''} — ${r.text}`;
      pic = `<div style="width:48px;height:48px;flex:none;position:relative">${roomSvg(u.ref, roomDoors(u.ref, 0), { label: false })}</div>`;
    } else if (u.kind === 'deck') { name = DECKS[u.ref].name; text = DECKS[u.ref].text; pic = '<div style="font-size:30px;width:48px;text-align:center">🂠</div>'; }
    else { name = u.name; text = u.text; pic = '<div style="font-size:30px;width:48px;text-align:center">✦</div>'; }
    const kind = { room: 'New room (added to every starting deck)', deck: 'New starting deck', perk: 'Permanent perk' }[u.kind];
    return `<div class="panel row" style="align-items:flex-start">${pic}
      <div class="grow"><div style="font-size:11px;letter-spacing:.6px;text-transform:uppercase" class="muted">${kind}</div>
      <h3>${esc(name)}</h3><div class="muted" style="font-size:13px">${esc(text)}</div></div>
      ${owned ? '<span class="chip">Owned</span>' : `<button class="btn small" data-a="buy" data-id="${u.id}" ${ui.meta.ink < u.cost ? 'disabled' : ''}>${u.cost} Ink</button>`}
    </div>`;
  }).join('');
  return `<section class="screen">
    <div class="topbar"><button class="icon-btn" data-a="go" data-to="title" aria-label="Back">←</button><h2>Archive</h2><span class="chip">🖋 ${ui.meta.ink} Ink</span></div>
    <p class="muted" style="margin:0">Every run earns Ink, win or lose. Spend it to expand your plans.</p>
    <div class="list">${items}</div>
  </section>`;
}

function renderRun() {
  const s = ui.run;
  const m = MANSIONS.find((x) => x.id === s.mansionId);
  const toll = vaultToll(s);
  const res = [
    ['steps', '👣', 'Steps', s.res.steps <= 3],
    ['gems', '💎', `Gems/${toll}`, false],
    ['keys', '🗝️', 'Keys', false],
    ['coins', '🪙', 'Coins', false],
    ['rerolls', '🎲', 'Rerolls', false],
  ].map(([k, ic, lbl, low]) => `<div class="res ${low ? 'low' : ''} ${ui.bumped.includes(k) ? 'bump' : ''}">${ic} ${s.res[k]}<small>${lbl}</small></div>`).join('')
    + `<div class="res">🂠 ${s.deck.length}<small>Deck · ${s.discard.length}</small></div>`;
  const extras = [
    ...s.heirlooms.map((h) => `<span class="chip" data-a="info" data-kind="heirloom" data-id="${h}">${HEIRLOOMS[h].icon} ${esc(HEIRLOOMS[h].name)}</span>`),
    s.buffs.freeDraft > 0 ? `<span class="chip">🪶 Free draft ×${s.buffs.freeDraft}</span>` : '',
    s.buffs.extraDraw > 0 ? `<span class="chip">📖 +1 card ×${s.buffs.extraDraw}</span>` : '',
    `<span class="chip curse" data-a="info" data-kind="curse">✸ ${esc(CURSES[m.curse].name)}</span>`,
    s.deed ? `<span class="chip" data-a="info" data-kind="deed">Deed ${s.deed}</span>` : '',
  ].join('');
  return `<div class="run">
    <div class="run-head">
      <button class="icon-btn" data-a="menu" aria-label="Menu">☰</button>
      <div class="name">${esc(m.name)}</div>
      <button class="icon-btn" data-a="help" aria-label="Help">?</button>
    </div>
    <div class="hud">${res}</div>
    <div class="extras">${extras}</div>
    <div class="board-wrap"><div class="board" style="--cols:${s.w}">${renderBoard(s)}</div></div>
    <div class="tray">${renderTray(s)}</div>
  </div>`;
}

function renderBoard(s) {
  const conn = connectedSet(s);
  const targets = s.phase === 'door' ? openTargets(s) : [];
  const tmap = new Map(targets.map((t) => [`${t.r},${t.c}`, t]));
  const p = s.pending;
  let html = '';
  for (let r = 0; r < s.h; r++) {
    for (let c = 0; c < s.w; c++) {
      const k = `${r},${c}`;
      const cell = cellAt(s, r, c);
      if (cell && cell.blocked) { html += '<div class="cell blocked"></div>'; continue; }
      if (cell && cell.id) {
        const locks = [0, 1, 2, 3].map((d) => s.locks[`${r},${c},${d}`]);
        const extra = cell.id === 'vault'
          ? `<text x="50" y="84" text-anchor="middle" font-size="14" font-weight="800" fill="${s.res.gems >= vaultToll(s) ? '#4fd18b' : '#ffd84a'}">${vaultToll(s)}💎</text>` : '';
        html += `<div class="cell room ${conn.has(k) ? '' : 'disconnected'} ${ui.fresh === k ? 'fresh' : ''}" data-a="info" data-kind="room" data-id="${cell.id}">${roomSvg(cell.id, cell.doors, { locks, label: cell.id !== 'vault', extra })}</div>`;
        continue;
      }
      if (p && p.r === r && p.c === c) {
        if (s.phase === 'place') html += `<div class="cell pending ghost">${roomSvg(p.id, roomDoors(p.id, p.rot))}</div>`;
        else html += '<div class="cell pending"></div>';
        continue;
      }
      const t = tmap.get(k);
      if (t) {
        const locked = s.lockedCells[k] ? 'locked' : t.locked ? 'locked' : '';
        html += `<div class="cell target ${locked}" data-a="select" data-r="${r}" data-c="${c}" role="button" aria-label="Draft into row ${r + 1} column ${c + 1}"></div>`;
        continue;
      }
      html += '<div class="cell"></div>';
    }
  }
  return html;
}

function cardHtml(s, id, i, { chosen = false, rot = null } = {}) {
  const r = ROOMS[id];
  const fam = FAMILIES[r.family];
  const cost = gemCost(s, id);
  const cant = cost > s.res.gems;
  const p = s.pending;
  // Orient the mini so a door faces the source doorway.
  let mrot = rot;
  if (mrot === null) for (let x = 0; x < 4; x++) if (p.dirs.some((d) => roomDoors(id, x)[d])) { mrot = x; break; }
  return `<div class="card ${cant ? 'cant' : ''} ${chosen ? 'chosen' : ''}" style="--fam:${fam.color}" ${cant ? '' : `data-a="pick" data-i="${i}"`} role="button">
    ${cost ? `<span class="cost">${cost}💎</span>` : ''}
    <div class="mini" style="position:relative">${roomSvg(id, roomDoors(id, mrot ?? 0), { label: false })}</div>
    <div class="nm">${esc(r.name)}</div>
    <div class="fam">${esc(fam.name)} · ${SHAPES[r.shape].name}</div>
    <div class="tx">${esc(r.text)}</div>
  </div>`;
}

function renderTray(s) {
  const p = s.pending;
  switch (s.phase) {
    case 'door': {
      const toll = vaultToll(s);
      const msg = vaultConnected(s) && s.res.gems < toll
        ? `The Vault is reached but sealed: collect <b>${toll - s.res.gems} more 💎</b>.`
        : 'Tap a glowing doorway to draft a room. <b>Each draft costs 1 Step.</b>';
      return `<div class="hint">${msg}</div>
        <div class="hint" style="font-size:12.5px">Goal: connect a door to the ♛ Vault while holding ${toll} 💎.</div>
        <div class="hint" style="font-size:12px;opacity:.8">${esc(s.log[s.log.length - 1] || '')}</div>`;
    }
    case 'card': {
      const anyOk = p.offers.some((id) => gemCost(s, id) <= s.res.gems);
      return `<div class="tray-head"><h3>Choose a room</h3>
        <button class="btn small" data-a="reroll" ${s.res.rerolls > 0 ? '' : 'disabled'}>🎲 Reroll (${s.res.rerolls})</button></div>
        <div class="cards" style="--n:${Math.max(1, p.offers.length)}">${p.offers.map((id, i) => cardHtml(s, id, i)).join('') || '<div class="hint">Your deck is empty.</div>'}</div>
        ${anyOk ? '' : '<button class="btn" data-a="closet">Nothing affordable — take a Broom Closet</button>'}`;
    }
    case 'place': {
      const r = ROOMS[p.id];
      const one = p.rots.length <= 1;
      return `<div class="tray-head"><h3>${esc(r.name)}</h3><span class="muted" style="font-size:13px">${esc(r.text)}</span></div>
        <div class="place-bar">
          <button class="btn" data-a="unpick">Back</button>
          <button class="btn" data-a="rot" data-d="-1" ${one ? 'disabled' : ''} aria-label="Rotate left">⟲</button>
          <button class="btn" data-a="rot" data-d="1" ${one ? 'disabled' : ''} aria-label="Rotate right">⟳</button>
          <button class="btn primary" data-a="place">Place ✓</button>
        </div>
        <div class="hint" style="font-size:12.5px">${one ? 'Only one way it fits.' : `${p.rots.length} ways it fits — rotate to aim its doors.`}</div>`;
    }
    case 'shop': {
      const items = s.shop.items.map((it, i) => `<div class="shop-item ${it.sold ? 'sold' : ''}">
        <span class="lbl">${esc(it.label)}</span>
        ${it.sold ? '<span class="chip">Sold</span>' : `<button class="btn small" data-a="buyItem" data-i="${i}" ${s.res.coins < it.price ? 'disabled' : ''}>${it.price} 🪙</button>`}
      </div>`).join('');
      return `<div class="tray-head"><h3>Shop</h3><span class="chip">🪙 ${s.res.coins}</span><button class="btn small primary" data-a="leave">Leave</button></div>
        <div class="shop-list">${items}</div>`;
    }
    case 'heirloom': {
      const cards = s.heirloomOffer.map((h, i) => `<div class="card heir" data-a="heir" data-i="${i}" role="button">
        <div class="ico">${HEIRLOOMS[h].icon}</div><div class="nm">${esc(HEIRLOOMS[h].name)}</div><div class="tx">${esc(HEIRLOOMS[h].text)}</div></div>`).join('');
      return `<div class="tray-head"><h3>Choose an Heirloom</h3><button class="btn small ghost" data-a="heir" data-i="-1">Skip</button></div>
        <div class="cards" style="--n:${s.heirloomOffer.length}">${cards}</div>`;
    }
    default:
      return `<div class="hint">${s.result?.won ? 'The Vault is open.' : 'The run is over.'}</div>
        <button class="btn primary" data-a="showResult">See results</button>`;
  }
}

function renderOverlay() {
  const o = ui.overlay;
  if (!o) return '';
  if (o === 'help') {
    return `<div class="overlay" data-a="close"><div class="modal" data-stop>
      <h2>How to play</h2>
      <ul>
        <li>Start in the <b>Entrance</b>. Reach the <b>♛ Vault</b> at the far end.</li>
        <li>Tap any glowing doorway. You're dealt <b>3 rooms</b> from your deck — pick one, the others are discarded.</li>
        <li><b>Rotate</b> it so its doors lead where you want. It must connect back to the doorway.</li>
        <li>Each draft costs <b>1 👣 Step</b>. Chambers give Steps back. Run out and the run ends.</li>
        <li>The Vault only opens if you hold enough <b>💎 Gems</b> (its toll). Gardens make Gems; rare rooms cost them.</li>
        <li><b>🔒 Locked</b> doorways need a 🗝️ Key. If every way on is sealed, the run ends.</li>
        <li>When the deck runs out it reshuffles — and costs Steps.</li>
        <li>Every run earns <b>Ink</b> for the Archive. Win to unlock new mansions and harder Deeds.</li>
      </ul>
      <button class="btn primary" data-a="close">Got it</button>
    </div></div>`;
  }
  if (o === 'menu') {
    return `<div class="overlay" data-a="close"><div class="modal" data-stop>
      <h2>Paused</h2>
      <button class="btn primary" data-a="close">Resume</button>
      <button class="btn" data-a="home">Save &amp; quit to title</button>
      <button class="btn ghost" style="border-color:var(--danger);color:#ffc2c8" data-a="abandon">Abandon run</button>
    </div></div>`;
  }
  if (o === 'result') {
    const s = ui.run;
    const r = s.result;
    return `<div class="overlay"><div class="modal">
      <div class="big-result">${r.won ? '♛' : '✕'}</div>
      <h2 class="center">${r.won ? 'Vault opened!' : 'The house wins'}</h2>
      <p class="center muted" style="margin:0">${r.won ? 'You reached the Vault.' : esc(LOSS_TEXT[r.why] || '')}</p>
      <div class="kv">
        <span>Rooms drafted</span><b>${s.placed}</b>
        <span>Rows advanced</span><b>${r.rowsAdvanced}</b>
        ${r.won ? `<span>Score</span><b>${r.score}</b>` : ''}
        <span>Ink earned</span><b>🖋 ${r.ink}</b>
      </div>
      ${ui.news.length ? `<ul>${ui.news.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
      <div class="row"><button class="btn grow" data-a="resultBoard">View house</button><button class="btn grow" data-a="goSelect">Mansions</button></div>
      <button class="btn primary" data-a="again">Run again</button>
    </div></div>`;
  }
  if (o.kind) {
    return `<div class="overlay" data-a="close"><div class="modal" data-stop>${o.html}<button class="btn primary" data-a="close">OK</button></div></div>`;
  }
  return '';
}

function infoOverlay(kind, id) {
  const s = ui.run;
  if (kind === 'heirloom') { const h = HEIRLOOMS[id]; return { kind, html: `<h2>${h.icon} ${esc(h.name)}</h2><p>${esc(h.text)}</p>` }; }
  if (kind === 'curse') { const c = CURSES[MANSIONS.find((m) => m.id === s.mansionId).curse]; return { kind, html: `<h2>✸ ${esc(c.name)}</h2><p>${esc(c.text)}</p>` }; }
  if (kind === 'deed') return { kind, html: `<h2>Deed ${s.deed}</h2><ul>${DEEDS.slice(1, s.deed + 1).map((d) => `<li>${esc(d.text)}</li>`).join('')}</ul>` };
  const r = ROOMS[id];
  const fam = FAMILIES[r.family];
  return { kind, html: `<h2 style="color:${fam.color}">${fam.icon} ${esc(r.name)}</h2><div class="muted">${esc(fam.name)} · ${SHAPES[r.shape].name}${r.cost ? ` · ${r.cost}💎` : ''}</div><p>${esc(id === 'vault' ? `Connect a door to it while holding ${vaultToll(s)} 💎 to win.` : r.text)}</p>` };
}

// Fit the board to the free space.
function sizeBoard() {
  const wrap = $app.querySelector('.board-wrap');
  const board = $app.querySelector('.board');
  if (!wrap || !board || !ui.run) return;
  const w = wrap.clientWidth - 16, h = wrap.clientHeight - 8;
  const cell = Math.max(28, Math.floor(Math.min(w / ui.run.w, h / ui.run.h, 84)));
  board.style.setProperty('--cell', `${cell}px`);
}
window.addEventListener('resize', () => { if (ui.screen === 'run') sizeBoard(); });

// ---------- input ----------
$app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (!el) return;
  // Clicks inside a modal shouldn't hit the backdrop's close handler.
  if (el.dataset.a === 'close' && el.classList.contains('overlay') && e.target.closest('[data-stop]')) return;
  const a = el.dataset.a;
  const s = ui.run;
  switch (a) {
    case 'go': ui.screen = el.dataset.to; ui.overlay = null; break;
    case 'resume': ui.screen = 'run'; break;
    case 'help': ui.overlay = 'help'; break;
    case 'close':
      if (ui.overlay === 'help' && !ui.meta.seenHelp) { ui.meta.seenHelp = true; save(); }
      ui.overlay = null; break;
    case 'menu': ui.overlay = 'menu'; break;
    case 'home': ui.overlay = null; ui.screen = 'title'; break;
    case 'abandon': ui.overlay = null; doAct({ type: 'abandon' }); return;
    case 'pickMansion': {
      ui.meta.last.mansionId = el.dataset.id;
      ui.meta.last.deed = Math.min(ui.meta.last.deed, ui.meta.mansions[el.dataset.id].maxDeed);
      save(); break;
    }
    case 'deed': {
      const max = ui.meta.mansions[ui.meta.last.mansionId].maxDeed;
      ui.meta.last.deed = Math.max(0, Math.min(max, ui.meta.last.deed + Number(el.dataset.d)));
      save(); break;
    }
    case 'pickDeck': ui.meta.last.deckId = el.dataset.id; save(); break;
    case 'start': startRun(); return;
    case 'buy':
      try { ui.meta = buyUnlock(ui.meta, el.dataset.id); save(); toast('Unlocked!'); buzz(20); } catch (err) { toast(err.message, true); }
      break;
    case 'select': return doAct({ type: 'select', r: Number(el.dataset.r), c: Number(el.dataset.c) });
    case 'pick': return doAct({ type: 'pick', index: Number(el.dataset.i) });
    case 'closet': return doAct({ type: 'pick', index: -1 });
    case 'reroll': return doAct({ type: 'reroll' });
    case 'unpick': return doAct({ type: 'unpick' });
    case 'rot': return doAct({ type: 'rotate', dir: Number(el.dataset.d) });
    case 'place': return doAct({ type: 'place' });
    case 'buyItem': return doAct({ type: 'buy', index: Number(el.dataset.i) });
    case 'leave': return doAct({ type: 'leave' });
    case 'heir': return doAct({ type: 'heirloom', index: Number(el.dataset.i) });
    case 'info': if (s) ui.overlay = infoOverlay(el.dataset.kind, el.dataset.id); break;
    case 'showResult': ui.overlay = 'result'; break;
    case 'resultBoard': ui.overlay = null; break;
    case 'goSelect': ui.run = null; ui.overlay = null; ui.screen = 'select'; save(); break;
    case 'again': ui.overlay = null; startRun(); return;
    default: return;
  }
  render();
});

// Swipe-free: keyboard shortcuts for desktop testing.
window.addEventListener('keydown', (e) => {
  if (ui.screen !== 'run' || !ui.run || ui.overlay) return;
  const ph = ui.run.phase;
  if (ph === 'card' && ['1', '2', '3', '4'].includes(e.key)) doAct({ type: 'pick', index: Number(e.key) - 1 });
  else if (ph === 'place' && (e.key === 'r' || e.key === 'ArrowRight')) doAct({ type: 'rotate', dir: 1 });
  else if (ph === 'place' && e.key === 'ArrowLeft') doAct({ type: 'rotate', dir: -1 });
  else if (ph === 'place' && e.key === 'Enter') doAct({ type: 'place' });
  else if (ph === 'place' && e.key === 'Escape') doAct({ type: 'unpick' });
});

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Test hook for automated screenshots.
window.__floorplan = { ui, render, startRun, doAct, newMeta };

render();
