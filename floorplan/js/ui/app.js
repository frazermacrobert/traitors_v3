// UI layer: rendering + input only. All rules live in ../engine.
import {
  newRun, act, openTargets, cellAt, gemCost, connectedSet, vaultToll, vaultConnected, roomDoors, drawCount, getMods, LOSS_TEXT,
} from '../engine/engine.js';
import {
  migrateMeta, applyResult, buyUnlock, mansionUnlocked, availableDecks, runOptions, ownedOf,
  keepBlueprint, skipKeep, toggleEquip, setStartHeirloom, buyUpgrade, upgradeCost, upgradeLevel, blueprintSlots, hasFamilyChest,
} from '../engine/meta.js';
import { UPGRADES } from '../data/progression.js';
import { ROOMS, FAMILIES, SHAPES, RARITIES } from '../data/rooms.js';
import { HEIRLOOMS, MAX_HEIRLOOMS } from '../data/heirlooms.js';
import { MANSIONS, CURSES, DEEDS, DECKS, UNLOCKS } from '../data/mansions.js';
import { roomSvg, shapeSvg, gradientDefs, esc } from './svg.js';

const $app = document.getElementById('app');
const $toast = document.getElementById('toast');
document.body.insertAdjacentHTML('afterbegin', gradientDefs());

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

const ui = {
  screen: 'title',
  meta: migrateMeta(store.get('floorplan.meta')),
  run: store.get('floorplan.run'),
  overlay: null, // 'help' | 'result' | 'menu' | 'effects' | 'deck' | {html}
  news: [],
  fresh: null,
  bumped: [],
  popups: [],
  tab: 'upgrades',
};
if (ui.run && (ui.run.v !== 1 || !ui.run.pool || ui.run.phase === 'won' || ui.run.phase === 'lost')) ui.run = null;

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
  toastTimer = setTimeout(() => { $toast.className = ''; }, err ? 2200 : 1900);
}
const buzz = (ms = 12) => { try { navigator.vibrate?.(ms); } catch { /* ignore */ } };

const RES_ICON = { steps: '👣', gems: '💎', keys: '🗝️', coins: '🪙', rerolls: '🎲' };

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
  ui.popups = [];
  ui.fresh = null;
  if (action.type === 'place') {
    const { r, c } = before.pending;
    ui.fresh = `${r},${c}`;
    ui.popups = Object.keys(RES_ICON).map((k) => [k, s.res[k] - before.res[k]]).filter(([, d]) => d)
      .map(([k, d], i) => ({ r, c, i, neg: d < 0, text: `${d > 0 ? '+' : ''}${d}${RES_ICON[k]}` }));
    buzz(15);
  } else if (action.type === 'select') {
    ui.popups = before.res.steps !== s.res.steps ? [{ r: action.r, c: action.c, i: 0, neg: true, text: `−${before.res.steps - s.res.steps}👣` }] : [];
  }
  const fresh = Math.min(s.log.length, (s.logCount || 0) - (before.logCount || 0));
  const interesting = (fresh > 0 ? s.log.slice(-fresh) : []).filter((l) => !l.startsWith('Placed'));
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
  if (ui.meta.pendingKeep) ui.meta = skipKeep(ui.meta);
  const seed = `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  ui.run = newRun(runOptions(ui.meta, { ...ui.meta.last, seed }));
  ui.screen = 'run';
  ui.overlay = ui.meta.seenHelp ? null : 'help';
  ui.fresh = null;
  ui.popups = [];
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
  const tiles = [['guest', 1], ['junction', 0], ['orchard', 3], ['library', 2], ['vault', 2], ['crossway', 0], ['herb', 0], ['passage', 1], ['furnace', 0]]
    .map(([id, rot]) => `<div>${roomSvg(id, roomDoors(id, rot), { label: false })}</div>`).join('');
  return `<section class="screen"><div class="title-wrap">
    <div class="title-tiles" aria-hidden="true">${tiles}</div>
    <div class="logo">Floorplan</div>
    <p class="tag">Draft rooms. Turn them to fit. Reach the Vault before your Steps run out.</p>
    <div class="title-buttons">
      ${ui.run ? '<button class="btn primary" data-a="resume">Continue run</button>' : ''}
      <button class="btn ${ui.run ? '' : 'primary'}" data-a="go" data-to="select">${ui.run ? 'New run' : 'Play'}</button>
      <button class="btn ${canAffordSomething(m) ? 'gold' : ''}" data-a="go" data-to="archive">Archive · 🖋 ${m.ink} Ink${canAffordSomething(m) ? ' · upgrade ready' : ''}</button>
      <button class="btn ghost" data-a="help">How to play</button>
    </div>
    <div class="stats">${m.runs} runs · ${m.wins} wins</div>
  </div></section>`;
}

function canAffordSomething(meta) {
  return UPGRADES.some((u) => { const c = upgradeCost(meta, u.id); return c !== null && c <= meta.ink; })
    || UNLOCKS.some((u) => !meta.owned.includes(u.id) && u.cost <= meta.ink);
}

function minimap(m) {
  const cells = [];
  const key = (r, c) => `${r},${c}`;
  const blocked = new Set(m.blocked.map((b) => key(b.r, b.c)));
  const locked = new Set(m.lockedCells.map((b) => key(b.r, b.c)));
  const pre = new Set(m.presets.map((b) => key(b.r, b.c)));
  for (let r = 0; r < m.h; r++) {
    for (let c = 0; c < m.w; c++) {
      const k = key(r, c);
      const cls = k === key(m.entrance.r, m.entrance.c) ? 'e' : k === key(m.vault.r, m.vault.c) ? 'v' : blocked.has(k) ? 'b' : pre.has(k) ? 'p' : locked.has(k) ? 'l' : '';
      cells.push(`<i class="${cls}"></i>`);
    }
  }
  return `<div class="minimap" style="grid-template-columns:repeat(${m.w},9px)">${cells.join('')}</div>`;
}

function renderSelect() {
  const sel = ui.meta.last;
  const mansions = MANSIONS.map((m, i) => {
    const open = mansionUnlocked(ui.meta, i);
    const st = ui.meta.mansions[m.id];
    const curse = CURSES[m.curse];
    return `<button class="glass panel mansion ${open ? '' : 'locked'} ${sel.mansionId === m.id ? 'selected' : ''}" ${open ? `data-a="pickMansion" data-id="${m.id}"` : 'disabled'}>
      ${minimap(m)}
      <div class="grow" style="display:flex;flex-direction:column;gap:6px">
        <div class="eyebrow">Mansion ${i + 1} · ${m.w}×${m.h}</div>
        <h3>${esc(m.name)}</h3>
        <div class="muted" style="font-size:13px">${open ? esc(m.blurb) : `Beat ${esc(MANSIONS[i - 1].name)} to unlock.`}</div>
        ${open ? `<div class="row wrap">
          <span class="chip">👑 Toll ${m.toll}💎</span>
          <span class="chip curse">✸ ${esc(curse.name)}</span>
          ${st.wins ? `<span class="chip good">🏆 ${st.wins} · best ${st.best}</span>` : ''}
        </div>
        <div class="muted" style="font-size:12px">${esc(curse.text)}</div>` : ''}
      </div>
    </button>`;
  }).join('');
  const st = ui.meta.mansions[sel.mansionId];
  const deed = Math.min(sel.deed, st.maxDeed);
  const deedText = DEEDS.slice(1, deed + 1).map((d) => `<li>${esc(d.text)}</li>`).join('');
  const decks = availableDecks(ui.meta).map((id) => `<button class="btn small ${sel.deckId === id ? 'on' : ''}" data-a="pickDeck" data-id="${id}">${esc(DECKS[id].name)}</button>`).join('');
  return `<section class="screen">
    <div class="topbar"><button class="icon-btn" data-a="go" data-to="title" aria-label="Back">←</button><h2>Choose a mansion</h2></div>
    <div class="list">${mansions}</div>
    <div class="glass panel">
      <div class="deed-row">
        <div class="grow"><h3>Deed</h3><div class="muted" style="font-size:13px">Stacking handicaps. Win at your highest Deed to unlock the next.</div></div>
        <button class="icon-btn" data-a="deed" data-d="-1" ${deed <= 0 ? 'disabled' : ''} aria-label="Lower deed">−</button>
        <div class="deed-num">${deed}</div>
        <button class="icon-btn" data-a="deed" data-d="1" ${deed >= st.maxDeed ? 'disabled' : ''} aria-label="Raise deed">+</button>
      </div>
      ${deed ? `<ul style="margin:10px 0 0;padding-left:20px;font-size:13px">${deedText}</ul>` : ''}
    </div>
    <div class="glass panel"><h3 style="margin-bottom:10px">Plans</h3><div class="seg">${decks}</div>
      <div class="muted" style="font-size:13px;margin-top:10px">${esc(DECKS[sel.deckId].text)}</div></div>
    ${loadoutPanel()}
    <button class="btn primary" data-a="start">Enter ${esc(MANSIONS.find((m) => m.id === sel.mansionId).name)}</button>
  </section>`;
}

function loadoutPanel() {
  const m = ui.meta;
  const slots = blueprintSlots(m);
  const eq = m.equipped.slice(0, slots);
  const ups = UPGRADES.filter((u) => upgradeLevel(m, u.id) && u.start).map((u) => `<span class="chip">${u.icon} ${esc(u.text(upgradeLevel(m, u.id)))}</span>`).join('');
  const heir = hasFamilyChest(m)
    ? `<div class="row wrap" style="margin-top:6px"><span class="eyebrow grow">Starting heirloom</span>${m.heirloomsFound.length
      ? [null, ...m.heirloomsFound].map((h) => `<button class="btn small ${m.startHeirloom === h ? 'on' : ''}" style="box-shadow:none" data-a="startHeir" data-id="${h || ''}">${h ? `${HEIRLOOMS[h].icon} ${esc(HEIRLOOMS[h].name)}` : 'None'}</button>`).join('')
      : '<span class="muted" style="font-size:13px">Find one in a run first.</span>'}</div>` : '';
  return `<div class="glass panel seg-wrap" style="display:flex;flex-direction:column;gap:8px">
    <div class="row"><h3 class="grow">Your loadout</h3><button class="btn small ghost" data-a="go" data-to="archive">Edit</button></div>
    <div class="eyebrow">Blueprints ${eq.length}/${slots} · added to your deck</div>
    <div class="row wrap">${eq.length ? eq.map((id) => `<span class="chip" style="color:${FAMILIES[ROOMS[id].family].color}">${ROOMS[id].icon} ${esc(ROOMS[id].name)}</span>`).join('') : '<span class="muted" style="font-size:13px">After each run you keep one room you drafted. Equip them here.</span>'}</div>
    ${ups ? `<div class="eyebrow">Upgrades</div><div class="row wrap">${ups}</div>` : ''}
    ${heir}
  </div>`;
}

function renderArchive() {
  const tabs = [['upgrades', 'Upgrades'], ['blueprints', `Blueprints · ${ui.meta.collection.length}`], ['unlocks', 'Unlocks']]
    .map(([k, l]) => `<button class="btn small ${ui.tab === k ? 'on' : ''}" data-a="tab" data-id="${k}">${l}</button>`).join('');
  const body = ui.tab === 'upgrades' ? renderUpgrades() : ui.tab === 'blueprints' ? renderBlueprints() : renderUnlocks();
  return `<section class="screen">
    <div class="topbar"><button class="icon-btn" data-a="go" data-to="title" aria-label="Back">←</button><h2>Archive</h2><span class="chip">🖋 ${ui.meta.ink} Ink</span></div>
    <div class="seg">${tabs}</div>
    ${body}
  </section>`;
}

function renderUpgrades() {
  const rows = UPGRADES.map((u) => {
    const lvl = upgradeLevel(ui.meta, u.id);
    const cost = upgradeCost(ui.meta, u.id);
    const pips = Array.from({ length: u.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('');
    return `<div class="glass panel upg">
      <div class="ui">${u.icon}</div>
      <div class="grow"><h3>${esc(u.name)}</h3>
        <div class="muted" style="font-size:13px">${lvl ? esc(u.text(lvl)) : `Next: ${esc(u.text(1))}`}${lvl && cost !== null ? ` <span style="opacity:.7">→ ${esc(u.text(lvl + 1))}</span>` : ''}</div>
        <div class="pips">${pips}</div></div>
      ${cost === null ? '<span class="chip good">Max</span>' : `<button class="btn small ${ui.meta.ink >= cost ? 'gold' : ''}" data-a="upg" data-id="${u.id}" ${ui.meta.ink < cost ? 'disabled' : ''}>🖋 ${cost}</button>`}
    </div>`;
  }).join('');
  return `<p class="muted" style="margin:0">Permanent. Every run earns Ink, win or lose, so every attempt makes the next one stronger.</p><div class="list">${rows}</div>`;
}

function renderBlueprints() {
  const m = ui.meta;
  const slots = blueprintSlots(m);
  const cards = m.collection.map((id) => {
    const on = m.equipped.includes(id);
    return `<div class="unlock">${cardHtml(null, id, -1, { static: true })}
      <button class="btn small ${on ? 'primary' : ''}" data-a="equip" data-id="${id}">${on ? '✓ Equipped' : 'Equip'}</button></div>`;
  }).join('');
  const heir = m.heirloomsFound.map((h) => `<div class="fx-item"><span class="fi">${HEIRLOOMS[h].icon}</span><div><b>${esc(HEIRLOOMS[h].name)}</b><span>${esc(HEIRLOOMS[h].text)}</span></div></div>`).join('');
  return `<p class="muted" style="margin:0">After every run you keep one room you drafted. Equipped Blueprints join your starting deck. <b>${m.equipped.length}/${slots} slots used</b>; buy more with the Drafting Table upgrade.</p>
    ${cards ? `<div class="unlock-grid">${cards}</div>` : '<div class="glass panel muted">No Blueprints yet. Finish a run to keep your first.</div>'}
    <h3 style="margin-top:8px">Heirlooms found · ${m.heirloomsFound.length}</h3>
    <p class="muted" style="margin:0;font-size:13px">${hasFamilyChest(m) ? 'Pick one to start each run with on the mansion screen.' : 'Unlock the Family Chest to start runs with one of these.'}</p>
    ${heir || '<div class="muted" style="font-size:13px">None yet.</div>'}`;
}

function renderUnlocks() {
  const items = UNLOCKS.map((u) => {
    const owned = ui.meta.owned.includes(u.id);
    let top;
    if (u.kind === 'room') top = cardHtml(null, u.ref, -1, { static: true });
    else {
      const name = u.kind === 'deck' ? DECKS[u.ref].name : u.name;
      const text = u.kind === 'deck' ? DECKS[u.ref].text : u.text;
      top = `<div class="card static r-rare heir"><div class="card-in"><div class="art"><span class="emo">${u.kind === 'deck' ? '🗂️' : '✨'}</span></div>
        <div class="body"><div class="nm">${esc(name)}</div><div class="meta">${u.kind === 'deck' ? 'Starting plans' : 'Permanent perk'}</div><div class="tx">${esc(text)}</div></div></div></div>`;
    }
    return `<div class="unlock">${top}
      ${owned ? '<span class="chip good" style="justify-content:center">✓ Owned</span>' : `<button class="btn small ${ui.meta.ink >= u.cost ? 'gold' : ''}" data-a="buy" data-id="${u.id}" ${ui.meta.ink < u.cost ? 'disabled' : ''}>🖋 ${u.cost} Ink</button>`}
    </div>`;
  }).join('');
  return `<p class="muted" style="margin:0">Permanent. New rooms join the random pool; new Plans and perks apply to every run.</p>
    <div class="unlock-grid">${items}</div>`;
}

function renderRun() {
  const s = ui.run;
  const m = MANSIONS.find((x) => x.id === s.mansionId);
  const toll = vaultToll(s);
  const gemPct = toll ? Math.min(100, (100 * s.res.gems) / toll) : 100;
  const res = `
    <div class="res steps ${s.res.steps <= 3 ? 'low' : ''} ${ui.bumped.includes('steps') ? 'bump' : ''}"><span class="v"><span class="ic">👣</span>${s.res.steps}</span><small>Steps</small></div>
    <div class="res ${s.res.gems >= toll ? 'met' : ''} ${ui.bumped.includes('gems') ? 'bump' : ''}"><span class="v"><span class="ic">💎</span>${s.res.gems}<span style="font-size:12px;opacity:.6">/${toll}</span></span><small>Gems</small><span class="bar" style="width:${gemPct}%"></span></div>
    <div class="res ${ui.bumped.includes('keys') ? 'bump' : ''}"><span class="v"><span class="ic">🗝️</span>${s.res.keys}</span><small>Keys</small></div>
    <div class="res ${ui.bumped.includes('coins') ? 'bump' : ''}"><span class="v"><span class="ic">🪙</span>${s.res.coins}</span><small>Coins</small></div>
    <div class="res ${ui.bumped.includes('rerolls') ? 'bump' : ''}"><span class="v"><span class="ic">🎲</span>${s.res.rerolls}</span><small>Rerolls</small></div>`;
  const fx = activeEffects(s);
  const heir = s.heirlooms.map((h) => `<span class="heir-dot" data-a="effects" title="${esc(HEIRLOOMS[h].name)}">${HEIRLOOMS[h].icon}</span>`).join('');
  return `<div class="run">
    <div class="run-head">
      <button class="icon-btn" data-a="menu" aria-label="Menu">☰</button>
      <div class="name"><b>${esc(m.name)}</b><span>✸ ${esc(CURSES[m.curse].name)}${s.deed ? ` · Deed ${s.deed}` : ''}</span></div>
      <button class="icon-btn" data-a="help" aria-label="How to play">?</button>
    </div>
    <div class="hud">${res}</div>
    <div class="strip">
      <span class="chip" data-a="effects">✨ Effects · ${fx.count}</span>
      <span class="chip" data-a="deck">🂠 Deck ${s.deck.length} · Discard ${s.discard.length}</span>
      ${heir}
    </div>
    <div class="board-wrap"><div class="board" style="--cols:${s.w}">${renderBoard(s)}</div></div>
    <div class="tray">${renderTray(s)}</div>
  </div>`;
}

function renderBoard(s) {
  const conn = connectedSet(s);
  const targets = s.phase === 'door' ? openTargets(s) : [];
  const tmap = new Map(targets.map((t) => [`${t.r},${t.c}`, t]));
  const p = s.pending;
  const toll = vaultToll(s);
  let html = '';
  for (let r = 0; r < s.h; r++) {
    for (let c = 0; c < s.w; c++) {
      const k = `${r},${c}`;
      const cell = cellAt(s, r, c);
      if (cell && cell.blocked) { html += `<div class="cell blocked ${cell.collapsed ? 'collapsed' : ''}"></div>`; continue; }
      if (cell && cell.id) {
        const locks = [0, 1, 2, 3].map((d) => s.locks[`${r},${c},${d}`]);
        const extra = cell.id === 'vault'
          ? `<text x="50" y="80" text-anchor="middle" font-size="15" font-weight="800" font-family="Unbounded, system-ui" fill="${s.res.gems >= toll ? '#48e08f' : '#ffcf5a'}">${toll}💎</text>` : '';
        html += `<div class="cell room ${cell.id === 'vault' ? `vault ${s.res.gems >= toll ? 'ready' : ''}` : conn.has(k) ? '' : 'disconnected'} ${ui.fresh === k ? 'fresh' : ''}" data-a="info" data-id="${cell.id}">${roomSvg(cell.id, cell.doors, { locks, label: cell.id !== 'vault' && cellSize >= 58, extra })}</div>`;
        continue;
      }
      if (p && p.r === r && p.c === c) {
        html += s.phase === 'place' ? `<div class="cell pending ghost">${roomSvg(p.id, roomDoors(p.id, p.rot), { label: cellSize >= 58 })}</div>` : '<div class="cell pending"></div>';
        continue;
      }
      const t = tmap.get(k);
      if (t) {
        html += `<div class="cell target ${t.locked ? 'locked' : ''}" data-a="select" data-r="${r}" data-c="${c}" role="button" aria-label="Draft into row ${r + 1}, column ${c + 1}"></div>`;
        continue;
      }
      html += '<div class="cell"></div>';
    }
  }
  html += ui.popups.map((pp) => `<div class="pop ${pp.neg ? 'neg' : ''}" style="left:calc(6px + ${pp.c + 0.5} * var(--cell));top:calc(6px + ${pp.r + 0.5} * var(--cell) - ${pp.i * 18}px);animation-delay:${pp.i * 0.12}s">${pp.text}</div>`).join('');
  return html;
}

function cardHtml(s, id, i, { static: isStatic = false } = {}) {
  const r = ROOMS[id];
  const fam = FAMILIES[r.family];
  const free = s && s.pending && s.pending.free;
  const cost = s ? gemCost(s, id) : r.cost;
  const cant = s ? cost > s.res.gems : false;
  let mrot = 0;
  if (s && s.pending) for (let x = 0; x < 4; x++) if (s.pending.dirs.some((d) => roomDoors(id, x)[d])) { mrot = x; break; }
  const attrs = !s || cant ? '' : `data-a="pick" data-i="${i}" role="button" tabindex="0"`;
  return `<div class="card r-${r.rarity} ${cant ? 'cant' : ''} ${isStatic ? 'static' : ''}" style="--fam:${fam.color};--deep:${fam.deep}" ${attrs}>
    <div class="card-in">
      ${r.cost ? `<span class="cost ${free ? 'free' : ''}">${r.cost}💎</span>` : ''}
      <div class="art">${r.rarity === 'rare' || r.rarity === 'legendary' ? `<span class="rtag">${RARITIES[r.rarity].name}</span>` : ''}<span class="emo">${r.icon}</span>${shapeSvg(roomDoors(id, mrot), fam.color)}</div>
      <div class="body">
        <div class="nm">${esc(r.name)}</div>
        <div class="meta">${esc(fam.name)}</div>
        <div class="tx">${esc(r.text)}</div>
      </div>
    </div>
  </div>`;
}

function renderTray(s) {
  const p = s.pending;
  switch (s.phase) {
    case 'door': {
      const toll = vaultToll(s);
      const sealed = vaultConnected(s) && s.res.gems < toll;
      const need = Math.max(0, toll - s.res.gems);
      return `<div class="goal"><span class="gi">👑</span><div class="grow">${sealed
        ? `<b>The Vault is reached but sealed.</b> Collect ${need} more 💎 to open it.`
        : `<b>Reach the Vault</b> holding ${toll} 💎 ${need ? `<span class="muted">(${need} to go)</span>` : '<span style="color:var(--ok)">✓ ready</span>'}`}</div></div>
        <div class="hint">Tap a glowing doorway to draft. <b>Each draft costs 1 👣.</b>${drawCount(s) !== 3 ? ` Next draft shows <b>${drawCount(s)}</b> cards.` : ''}</div>`;
    }
    case 'card': {
      const anyOk = p.offers.some((id) => gemCost(s, id) <= s.res.gems);
      return `<div class="tray-head"><h3>Choose a room</h3>
        <button class="btn small" data-a="reroll" ${s.res.rerolls > 0 ? '' : 'disabled'}>🎲 Reroll · ${s.res.rerolls}</button></div>
        <div class="cards">${p.offers.map((id, i) => cardHtml(s, id, i)).join('') || '<div class="hint">Your deck is empty.</div>'}</div>
        ${anyOk ? '' : '<button class="btn" data-a="closet">Nothing affordable · take a Broom Closet</button>'}`;
    }
    case 'place': {
      const r = ROOMS[p.id];
      const one = p.rots.length <= 1;
      return `<div class="tray-head"><span style="font-size:24px">${r.icon}</span><div class="grow"><h3>${esc(r.name)}</h3><div class="muted" style="font-size:12.5px">${esc(r.text)}</div></div></div>
        <div class="place-bar">
          <button class="btn" data-a="unpick">Back</button>
          <button class="btn" data-a="rot" data-d="-1" ${one ? 'disabled' : ''} aria-label="Rotate left">⟲</button>
          <button class="btn" data-a="rot" data-d="1" ${one ? 'disabled' : ''} aria-label="Rotate right">⟳</button>
          <button class="btn primary" data-a="place">Place</button>
        </div>
        <div class="hint" style="font-size:12.5px">${one ? 'It only fits one way.' : `${p.rots.length} ways it fits. Rotate to aim its doors.`}</div>`;
    }
    case 'shop': {
      const items = s.shop.items.map((it, i) => `<div class="shop-item ${it.sold ? 'sold' : ''}">
        <span class="lbl">${esc(it.label)}</span>
        ${it.sold ? '<span class="chip">Sold</span>' : `<button class="btn small gold" data-a="buyItem" data-i="${i}" ${s.res.coins < it.price ? 'disabled' : ''}>${it.price} 🪙</button>`}
      </div>`).join('');
      return `<div class="tray-head"><h3>🛍️ Shop</h3><span class="chip">🪙 ${s.res.coins}</span><button class="btn small primary" data-a="leave">Leave</button></div>
        <div class="shop-list">${items}</div>`;
    }
    case 'heirloom': {
      const cards = s.heirloomOffer.map((h, i) => `<div class="card heir" data-a="heir" data-i="${i}" role="button" tabindex="0"><div class="card-in">
        <div class="art"><span class="emo">${HEIRLOOMS[h].icon}</span></div>
        <div class="body"><div class="nm">${esc(HEIRLOOMS[h].name)}</div><div class="meta">Heirloom · this run</div><div class="tx">${esc(HEIRLOOMS[h].text)}</div></div></div></div>`).join('');
      return `<div class="tray-head"><h3>Choose an Heirloom</h3><button class="btn small ghost" data-a="heir" data-i="-1">Skip</button></div>
        <div class="cards">${cards}</div>
        <div class="hint" style="font-size:12px">Heirlooms last until this run ends. You can hold ${MAX_HEIRLOOMS}.</div>`;
    }
    default:
      return `<div class="hint">${s.result?.won ? 'The Vault is open.' : 'The run is over.'}</div>
        <button class="btn primary" data-a="showResult">See results</button>`;
  }
}

// Everything currently changing the rules, for the Effects sheet.
function activeEffects(s) {
  const m = MANSIONS.find((x) => x.id === s.mansionId);
  const items = [];
  const heir = s.heirlooms.map((h) => ({ icon: HEIRLOOMS[h].icon, name: HEIRLOOMS[h].name, text: HEIRLOOMS[h].text }));
  const b = s.buffs;
  const boosts = [
    b.freeDraft > 0 && { icon: '🪶', name: `Free drafts × ${b.freeDraft}`, text: 'Drafting costs no Steps.' },
    b.extraDraw > 0 && { icon: '📖', name: `+1 card × ${b.extraDraw} drafts`, text: 'More choice on upcoming drafts.' },
    b.bigDraw > 0 && { icon: '🔍', name: '+2 cards next draft', text: 'From the Spy Hole.' },
    b.smallDraw > 0 && { icon: '🗿', name: `−1 card × ${b.smallDraw} drafts`, text: 'The Idol’s price.' },
    b.freeCost > 0 && { icon: '🎱', name: 'Next draft is free', text: 'Every card costs 0 Gems.' },
    b.nextFamily && { icon: '✒️', name: `Next draft includes a ${FAMILIES[b.nextFamily].name}`, text: 'Guaranteed.' },
    b.gardenDouble > 0 && { icon: '💠', name: `Double Gems × ${b.gardenDouble} Gardens`, text: 'From the Glasshouse.' },
    s.tollDelta && { icon: '👑', name: `Vault toll ${s.tollDelta > 0 ? '+' : ''}${s.tollDelta}`, text: 'Changed by rooms this run.' },
  ].filter(Boolean);
  const passives = s.cells.filter((x) => x && x.id && ROOMS[x.id].passive).map((x) => ({ icon: ROOMS[x.id].icon, name: ROOMS[x.id].name, text: ROOMS[x.id].text }));
  const rules = [
    { icon: '✸', name: `Curse: ${CURSES[m.curse].name}`, text: CURSES[m.curse].text },
    ...DEEDS.slice(1, s.deed + 1).map((d) => ({ icon: '📜', name: `Deed ${d.level}`, text: d.text })),
  ];
  const perks = UNLOCKS.filter((u) => u.kind === 'perk' && ui.meta.owned.includes(u.id)).map((u) => ({ icon: '✨', name: u.name, text: u.text }));
  items.push(...heir, ...boosts, ...passives);
  return { heir, boosts, passives, rules, perks, count: items.length };
}

const fxList = (arr, empty) => (arr.length ? arr.map((x) => `<div class="fx-item"><span class="fi">${x.icon}</span><div><b>${esc(x.name)}</b><span>${esc(x.text)}</span></div></div>`).join('') : `<div class="muted" style="font-size:13px">${empty}</div>`);

function renderOverlay() {
  const o = ui.overlay;
  if (!o) return '';
  const sheet = (inner, mid = false) => `<div class="overlay ${mid ? 'mid' : ''}" data-a="close"><div class="modal ${mid ? 'center-modal' : ''}" data-stop>${inner}</div></div>`;
  if (o === 'help') {
    return sheet(`<h2>How to play</h2>
      <ul>
        <li>Start at the <b>🚪 Entrance</b>. Reach the <b>👑 Vault</b> at the far end.</li>
        <li>Tap a glowing doorway. You're dealt <b>3 rooms</b>. Pick one; the others go to the discard pile.</li>
        <li><b>Rotate</b> it so its doors lead where you want. It must connect back to the doorway.</li>
        <li>Each draft costs <b>1 👣 Step</b>. Chambers (purple) give Steps back. Run out and the run ends.</li>
        <li>The Vault opens only while you hold its <b>💎 Gem toll</b>. Gardens (green) grow Gems; rare rooms cost Gems.</li>
        <li><b>🔒 Locked</b> doorways need a 🗝️ Key. If every way on is blocked, the run ends.</li>
        <li><b>Heirlooms</b> last for the current run.</li>
        <li><b>You get stronger every run.</b> Each run earns Ink for permanent Upgrades, and you keep one room you drafted as a Blueprint for your starting deck.</li>
      </ul>
      <div class="section-title eyebrow">Room families</div>
      ${Object.entries(FAMILIES).filter(([k]) => k !== 'special').map(([, f]) => `<div class="fx-item"><span class="fi" style="color:${f.color}">●</span><div><b style="color:${f.color}">${f.name}</b><span>${f.role}</span></div></div>`).join('')}
      <button class="btn primary" data-a="close">Got it</button>`);
  }
  if (o === 'menu') {
    return sheet(`<h2>Paused</h2>
      <button class="btn primary" data-a="close">Resume</button>
      <button class="btn" data-a="home">Save and quit to title</button>
      <button class="btn danger" data-a="abandon">Abandon run</button>`, true);
  }
  if (o === 'effects') {
    const fx = activeEffects(ui.run);
    return sheet(`<h2>Active effects</h2>
      <div class="eyebrow section-title">Heirlooms · this run (${fx.heir.length}/${MAX_HEIRLOOMS})</div>${fxList(fx.heir, 'None yet. Trophy Rooms, shrines and shops offer them.')}
      ${fx.boosts.length ? `<div class="eyebrow section-title">Boosts</div>${fxList(fx.boosts)}` : ''}
      ${fx.passives.length ? `<div class="eyebrow section-title">Standing rooms</div>${fxList(fx.passives)}` : ''}
      <div class="eyebrow section-title">House rules</div>${fxList(fx.rules)}
      <div class="eyebrow section-title">Permanent perks</div>${fxList(fx.perks, 'Buy perks in the Archive with Ink.')}
      <button class="btn primary" data-a="close">Close</button>`);
  }
  if (o === 'deck') {
    const s = ui.run;
    const counts = {};
    for (const id of s.deck) counts[id] = (counts[id] || 0) + 1;
    const order = Object.keys(FAMILIES);
    const rows = Object.entries(counts).sort((a, b) => order.indexOf(ROOMS[a[0]].family) - order.indexOf(ROOMS[b[0]].family) || b[1] - a[1])
      .map(([id, n]) => {
        const r = ROOMS[id];
        const dot = { common: 'transparent', uncommon: '#c9d6f0', rare: '#ffcf5a', legendary: '#ff7ad9' }[r.rarity];
        return `<div class="deck-row" data-a="info" data-id="${id}"><span class="n">${n}×</span><span style="font-size:18px">${r.icon}</span><span class="grow" style="color:${FAMILIES[r.family].color};font-weight:700">${esc(r.name)}</span><span class="rar" style="background:${dot}"></span></div>`;
      }).join('');
    return sheet(`<h2>Draw pile · ${s.deck.length}</h2>
      <div class="muted" style="font-size:13px">${s.discard.length} in the discard pile. When the draw pile runs out it reshuffles, which costs Steps.</div>
      <div style="display:flex;flex-direction:column;gap:6px">${rows || '<div class="muted">Empty.</div>'}</div>
      <button class="btn primary" data-a="close">Close</button>`);
  }
  if (o === 'result') {
    const s = ui.run;
    const r = s.result;
    return `<div class="overlay mid"><div class="modal center-modal">
      <div class="big-result">${r.won ? '👑' : '🕯️'}</div>
      <h2 class="center">${r.won ? 'Vault opened!' : 'The house wins'}</h2>
      <p class="center muted" style="margin:0">${r.won ? 'You reached the Vault.' : esc(LOSS_TEXT[r.why] || '')}</p>
      <div class="kv">
        <span>Rooms drafted</span><b>${s.placed}</b>
        <span>Rows advanced</span><b>${r.rowsAdvanced}</b>
        ${r.won ? `<span>Score</span><b>${r.score}</b>` : ''}
        <span>Ink earned</span><b>🖋 ${r.ink}</b>
      </div>
      ${ui.news.length ? `<ul>${ui.news.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
      ${ui.meta.pendingKeep ? `<div class="eyebrow">Keep a Blueprint</div>
        <div class="muted" style="font-size:13px;margin-top:-6px">It joins your collection for good${ui.meta.equipped.length < blueprintSlots(ui.meta) ? ' and goes straight into your starting deck' : ''}.</div>
        <div class="cards">${ui.meta.pendingKeep.map((id) => cardHtml(null, id, -1, { static: true }).replace('<div class="card ', `<div data-a="keep" data-id="${id}" role="button" tabindex="0" class="card `)).join('')}</div>` : ''}
      <div class="row"><button class="btn grow" data-a="resultBoard">View house</button><button class="btn grow" data-a="goSelect">Mansions</button></div>
      <button class="btn primary" data-a="again">Run again</button>
    </div></div>`;
  }
  if (o.html) return sheet(`${o.html}<button class="btn primary" data-a="close">OK</button>`);
  return '';
}

function roomInfo(id) {
  const s = ui.run;
  const r = ROOMS[id];
  if (id === 'vault') return { html: `<h2>👑 The Vault</h2><p>Connect a door to it while holding ${vaultToll(s)} 💎 to win.</p>` };
  if (id === 'entrance') return { html: '<h2>🚪 Entrance Hall</h2><p>Where every visit begins.</p>' };
  return { html: `<div style="display:flex;justify-content:center">${cardHtml(null, id, -1, { static: true }).replace('class="card ', 'style="width:180px;flex:none" class="card ')}</div>` };
}

// Fit the board to the free space.
let cellSize = 64;
function sizeBoard() {
  const wrap = $app.querySelector('.board-wrap');
  const board = $app.querySelector('.board');
  if (!wrap || !board || !ui.run) return;
  const w = wrap.clientWidth - 28, h = wrap.clientHeight - 20;
  const next = Math.max(28, Math.floor(Math.min(w / ui.run.w, h / ui.run.h, 88)));
  board.style.setProperty('--cell', `${next}px`);
  if ((next >= 58) !== (cellSize >= 58)) { cellSize = next; board.innerHTML = renderBoard(ui.run); }
  cellSize = next;
}
window.addEventListener('resize', () => { if (ui.screen === 'run') sizeBoard(); });

// ---------- input ----------
function handle(el, e) {
  const a = el.dataset.a;
  const s = ui.run;
  switch (a) {
    case 'go': ui.screen = el.dataset.to; ui.overlay = null; break;
    case 'resume': ui.screen = 'run'; break;
    case 'help': ui.overlay = 'help'; break;
    case 'close':
      if (el.classList.contains('overlay') && e.target.closest('[data-stop]')) return;
      if (ui.overlay === 'help' && !ui.meta.seenHelp) { ui.meta.seenHelp = true; save(); }
      ui.overlay = null; break;
    case 'menu': ui.overlay = 'menu'; break;
    case 'effects': ui.overlay = 'effects'; break;
    case 'deck': ui.overlay = 'deck'; break;
    case 'home': ui.overlay = null; ui.screen = 'title'; break;
    case 'abandon': ui.overlay = null; doAct({ type: 'abandon' }); return;
    case 'pickMansion':
      ui.meta.last.mansionId = el.dataset.id;
      ui.meta.last.deed = Math.min(ui.meta.last.deed, ui.meta.mansions[el.dataset.id].maxDeed);
      save(); break;
    case 'deed': {
      const max = ui.meta.mansions[ui.meta.last.mansionId].maxDeed;
      ui.meta.last.deed = Math.max(0, Math.min(max, ui.meta.last.deed + Number(el.dataset.d)));
      save(); break;
    }
    case 'pickDeck': ui.meta.last.deckId = el.dataset.id; save(); break;
    case 'tab': ui.tab = el.dataset.id; break;
    case 'upg':
      try { ui.meta = buyUpgrade(ui.meta, el.dataset.id); save(); toast('Upgraded!'); buzz(20); } catch (err) { toast(err.message, true); }
      break;
    case 'equip':
      try { ui.meta = toggleEquip(ui.meta, el.dataset.id); save(); } catch (err) { toast(err.message, true); }
      break;
    case 'keep':
      ui.meta = keepBlueprint(ui.meta, el.dataset.id); save(); toast(`${ROOMS[el.dataset.id].name} added to your Blueprints`); buzz(20);
      break;
    case 'startHeir': ui.meta = setStartHeirloom(ui.meta, el.dataset.id || null); save(); break;
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
    case 'info': if (s) ui.overlay = roomInfo(el.dataset.id); break;
    case 'showResult': ui.overlay = 'result'; break;
    case 'resultBoard': ui.overlay = null; break;
    case 'goSelect': ui.run = null; ui.overlay = null; ui.screen = 'select'; save(); break;
    case 'again': ui.overlay = null; startRun(); return;
    default: return;
  }
  ui.popups = [];
  render();
}
$app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (el) handle(el, e);
});

// Keyboard support for desktop testing.
window.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches?.('[data-a][tabindex]')) { handle(e.target, e); return; }
  if (ui.screen !== 'run' || !ui.run || ui.overlay) return;
  const ph = ui.run.phase;
  if (ph === 'card' && ['1', '2', '3', '4', '5'].includes(e.key)) doAct({ type: 'pick', index: Number(e.key) - 1 });
  else if (ph === 'place' && (e.key === 'r' || e.key === 'ArrowRight')) doAct({ type: 'rotate', dir: 1 });
  else if (ph === 'place' && e.key === 'ArrowLeft') doAct({ type: 'rotate', dir: -1 });
  else if (ph === 'place' && e.key === 'Enter') doAct({ type: 'place' });
  else if (ph === 'place' && e.key === 'Escape') doAct({ type: 'unpick' });
});

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Test hook for automated screenshots.
window.__floorplan = { ui, render, startRun, doAct, getMods, ownedOf };

render();
