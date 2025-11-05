// =======================
// Utilities & RNG
// =======================
function mulberry32(a){
  return function(){
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rng){
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--){
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pickRandom(arr, rng){ return arr[Math.floor(rng()*arr.length)]; }
function escapeHtml(s){
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}
function weightedPick(items, weights, rng){
  let total = 0;
  for (const w of weights) total += (w || 0);
  if (total <= 0) return items[items.length - 1];
  let r = rng() * total;
  for (let i = 0; i < items.length; i++){
    r -= (weights[i] || 0);
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// =======================
// Scenario normalizer
// =======================
function normalizeScenario(raw){
  if (!raw || typeof raw !== 'object') return null;
  const options = Array.isArray(raw.options) ? raw.options.slice(0,3)
                : [raw.option_a, raw.option_b, raw.option_c].filter(Boolean);
  if (!options || options.length !== 3) return null;

  let correct = raw.correct;
  if (typeof correct === 'number'){
    const map = ['A','B','C'];
    correct = map[correct] ?? 'A';
  }
  if (typeof correct !== 'string') correct = 'A';
  correct = String(correct).trim().toUpperCase();
  if (!['A','B','C'].includes(correct)) correct = 'A';

  return {
    id: String(raw.id ?? ''),
    prompt: String(raw.prompt ?? ''),
    options,
    correct,
    rationale_correct: String(raw.rationale_correct ?? raw.rationaleCorrect ?? 'Good call.'),
    rationale_wrong:   String(raw.rationale_wrong   ?? raw.rationaleWrong   ?? 'That creates risk — try again next time.')
  };
}

// =======================
// Difficulty profiles
// =======================
const DIFF = {
  Easy:   { innocent_error: 0.04, traitor_rate: 0.50, influence_scale: 0.70, vote_noise: 0.05, pattern_clarity: 1.0 },
  Medium: { innocent_error: 0.12, traitor_rate: 0.40, influence_scale: 0.50, vote_noise: 0.12, pattern_clarity: 0.70 },
  Hard:   { innocent_error: 0.20, traitor_rate: 0.30, influence_scale: 0.30, vote_noise: 0.18, pattern_clarity: 0.50 }
};

function defaultInfluence(dept){
  const m = {
    'CEO':0.75,'CFO':0.68,'Exec Assistant':0.65,'Project Management':0.62,
    'Consultant':0.60,'Finance':0.56,'HR':0.56,'Legal':0.56,'Design':0.52,
    'Content':0.52,'Motion':0.52,'Ops':0.54,'Marketing':0.54,'Business Development':0.54,
    'IT':0.58
  };
  return m[dept] ?? 0.55;
}
function defaultBehaviour(dept){
  const b = { safe:0.7, risky:0.2, decoy:0.1 };
  if (dept === 'Finance') return { safe:0.6, risky:0.3, decoy:0.1 };
  if (dept === 'Design' || dept === 'Content' || dept === 'Motion') return { safe:0.65, risky:0.20, decoy:0.15 };
  if (dept === 'Project Management') return { safe:0.62, risky:0.25, decoy:0.13 };
  return b;
}

// =======================
// Global State
// =======================
const S = {
  allEmployees: [], actions: [], scenarios: [], elimMsgs: {},
  players: [], round: 0, rng: Math.random, youId: null, traitors: new Set(),
  analysis: true, difficulty: 'Medium', numTraitors: 3,
  log: [], suspicion: {}, alive: new Set(), eliminated: new Set(), elimReason: {},
  usedActionIds: new Set(),   // per-round uniqueness
  history: {},                // id -> recent action ids
  historyWindow: 3
};
function logLine(t){ S.log.push(t); }
function nameOf(id){ const p = S.players.find(p => p.id === id); return p ? p.name : 'Unknown'; }

// =======================
// Data loading
// =======================
async function loadData(){
  async function safeJson(url, fallback){
    try{
      const res = await fetch(url, { cache:'no-store' });
      if (!res.ok) throw new Error(url+' '+res.status);
      return await res.json();
    }catch(e){
      console.error('Load error:', url, e);
      try { logLine(`Load error: ${url} — ${e.message || e}`); } catch(_){}
      return fallback;
    }
  }

  // Load employees first so the picker is always populated
  S.allEmployees = await safeJson('data/employees.json', []);
  populatePlayerSelect(S.allEmployees);

  // Load the rest (tolerant to failures)
  S.actions   = await safeJson('data/actions.json', []);
  const scRaw = await safeJson('data/scenarios.json', []);
  S.scenarios = (Array.isArray(scRaw) ? scRaw : []).map(normalizeScenario).filter(Boolean);
  if (!S.scenarios.length) alert('No valid scenarios found in data/scenarios.json');
  S.elimMsgs  = await safeJson('data/elimination_msgs.json', {});

  // Optional: warn on bad action buckets
  const bad = S.actions.filter(a => !['safe','risky_innocent','traitor_sabotage','decoy','red_herring'].includes(a?.bucket));
  if (bad.length) logLine(`Data warning: unknown action buckets -> ${bad.map(b=>b.id).join(', ')}`);
}
function populatePlayerSelect(emps){
  const sel = document.getElementById('playerSelect');
  if (!sel) return;
  sel.innerHTML = (emps || []).map(e => (
    `<option value="${String(e.id||'')}">${escapeHtml(e?.name||'Unnamed')} — ${escapeHtml(e?.department||'Team')}</option>`
  )).join('');
}

// =======================
// Lifecycle
// =======================
function startGame(){
  S.log = []; S.round = 1; S.players = []; S.suspicion = {};
  S.alive.clear(); S.eliminated.clear(); S.traitors.clear(); S.elimReason = {};
  S.usedActionIds.clear(); S.history = {};

  const me = S.allEmployees.find(e => e.id === S.youId) || S.allEmployees[0];
  const others = me ? shuffle(S.allEmployees.filter(e => e.id !== me.id), S.rng).slice(0,9) : [];
  const roster = me ? [me, ...others] : others;

  S.players = roster.map(e => ({
    id: e.id,
    name: e.name,
    department: e.department,
    influence: defaultInfluence(e.department),
    behaviour: defaultBehaviour(e.department),
    role: 'Innocent',
    status: 'Alive',
    avatar:       `assets/pngs/${e.id}.png`,
    avatarSad:    `assets/gone/${e.id}-sad.png`,
    avatarTraitor:`assets/pngs/traitor-revealed.png`
  }));
  S.players.forEach(p => { S.alive.add(p.id); S.history[p.id] = []; });

  const botIds = S.players.map(p => p.id).filter(id => id !== S.youId);
  shuffle(botIds, S.rng).slice(0, S.numTraitors).forEach(id => S.traitors.add(id));
  S.players.forEach(p => { S.suspicion[p.id] = 0; });

  // Start with Daily Activity locked
  const actionsEl = document.getElementById('actions');
  if (actionsEl) actionsEl.classList.add('is-disabled');

  logLine(`Game started. Traitors assigned. Difficulty: ${S.difficulty}.`);
  renderAll();
  nextRound();
}
function nextRound(){
  if (checkEnd()) return;
  S.usedActionIds.clear();
  Object.keys(S.suspicion).forEach(id => { S.suspicion[id] = (S.suspicion[id] || 0) * 0.9; });
  renderRoundInfo();     // pulse round header / flash number
  doScenarioPhase();     // keep #actions grey until the scenario is answered
}
function checkEnd(){
  const alivePlayers = [...S.alive].map(id => S.players.find(p => p.id === id)).filter(Boolean);
  const aliveTraitors = alivePlayers.filter(p => S.traitors.has(p.id)).length;

  if (!S.youId || !S.alive.has(S.youId)){
    revealTraitors();
    announce('You were eliminated. Traitors win.');
    return true;
  }
  if (aliveTraitors === 0){
    revealTraitors();
    announce('All traitors eliminated. You win!');
    return true;
  }
  if (aliveTraitors >= (alivePlayers.length - aliveTraitors)){
    revealTraitors();
    announce('Traitors took control. You lose.');
    return true;
  }
  return false;
}

// =======================
// UI Rendering
// =======================
function renderAll(){ renderTopbar(); }
function renderTopbar(){
  const top = document.getElementById('topbar'); if (!top) return;
  top.innerHTML = S.players.map(p=>{
    const dead = S.eliminated.has(p.id);
    const state = dead ? (S.traitors.has(p.id) ? ' eliminated traitor by-traitors' : ' eliminated innocent by-vote') : '';
    return `<div class="player-card${state}" data-id="${escapeHtml(p.id)}">
      ${S.youId===p.id?'<div class="tag">You</div>':''}
      <img src="${escapeHtml(dead ? p.avatarSad : p.avatar)}" alt="${escapeHtml(p.name)}">
      <div class="name">${escapeHtml(p.name)}</div>
      <div class="xmark">✕</div>
      <div class="vote-bubble">0</div>
    </div>`;
  }).join('');
}
function renderRoundInfo(){
  const el = document.getElementById('roundInfo'); if (!el) return;
  el.innerHTML = `
    <h2 class="round-title">
      <span class="round-label round-pulse">Round</span>
      <span class="round-num round-num-flash">${S.round}</span>
    </h2>
    <div class="note">Alive: ${S.alive.size} · Traitors unknown · Keep your wits about you.</div>
    <div style="margin-top:8px"><button class="btn secondary" id="openLogTop" type="button">Open Game Log</button></div>
  `;
  const btn = document.getElementById('openLogTop');
  if (btn) btn.onclick = openLogModal;

  // retrigger CSS pulse/flash
  const lab = el.querySelector('.round-label'); if (lab){ lab.classList.remove('round-pulse'); void lab.offsetWidth; lab.classList.add('round-pulse'); }
  const num = el.querySelector('.round-num');   if (num){ num.classList.remove('round-num-flash'); void num.offsetWidth; num.classList.add('round-num-flash'); }
}

// =======================
// Scenario Phase
// =======================
function doScenarioPhase(){
  const container = document.getElementById('scenario');
  const sc = S.scenarios.length ? S.scenarios[Math.floor(S.rng() * S.scenarios.length)] : null;

  if (!sc){
    container.innerHTML = '<h2>Scenario</h2><div class="note">No scenarios available.</div>';
    return;
  }

 
container.innerHTML = `
  <h2>Scenario</h2>
  <div>${escapeHtml(sc.prompt)}</div>
  ${sc.options.map((opt, i) => `
    <label class="option">
      <input type="radio" name="scopt" value="${String.fromCharCode(65 + i)}">
      <strong>${String.fromCharCode(65 + i)}.</strong> ${escapeHtml(opt)}
    </label>
  `).join('')}
  <div class="footer" style="display:flex;justify-content:flex-end;align-items:center;margin-top:8px">
    <button id="answerBtn" class="btn">Submit</button>
  </div>
`;


  const submitBtn = document.getElementById('answerBtn');
  submitBtn.onclick = () => {
    if (submitBtn.disabled) return;

    const sel = document.querySelector('input[name="scopt"]:checked');
    if (!sel){
      submitBtn.classList.add('shake'); setTimeout(()=>submitBtn.classList.remove('shake'), 300);
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitted';

    const pick = String(sel.value||'').toUpperCase();
    if (pick === sc.correct){
      logLine('Scenario answered correctly.');
      if (S.analysis) logLine('Analysis: ' + sc.rationale_correct);
      const actionsEl = document.getElementById('actions');
      if (actionsEl) actionsEl.classList.remove('is-disabled');
      doActionsPhase();
    } else {
      logLine('Scenario wrong: You picked ' + pick + '.');
      if (S.analysis) logLine('Analysis: ' + sc.rationale_wrong);
      const overlay = document.createElement('div');
      overlay.className = 'explain-overlay';
      overlay.innerHTML = `
        <div class="explain-dialog">
          <h3>Why that’s unsafe</h3>
          <p>${escapeHtml(sc.rationale_wrong)}</p>
          <button id="continueBtn" class="btn">Continue</button>
        </div>`;
      document.body.appendChild(overlay);
      document.getElementById('continueBtn').onclick = () => {
        overlay.remove();
        eliminate(S.youId, false, 'VotedOut');
        renderAll();
        checkEnd();
      };
    }
  };
}

// =======================
// Daily Activity
// =======================
function poolBy(bucket){ return S.actions.filter(a => a && a.bucket === bucket); }
function deptMatches(action, dept){
  const tags = String(action?.departments_hint || '').toLowerCase().split(',').map(s=>s.trim());
  return tags.includes(String(dept||'').toLowerCase());
}
function chooseActionFor(playerId, rng){
  const p = S.players.find(x => x.id === playerId);
  const d = DIFF[S.difficulty];
  const isTraitor = S.traitors.has(playerId);

  const primary = isTraitor
    ? (rng() < d.traitor_rate ? 'traitor_sabotage' : (rng() < 0.5 ? 'decoy' : 'safe'))
    : (rng() < d.innocent_error ? 'risky_innocent' : ((p?.behaviour?.safe ?? 0.7) > 0.5 ? 'safe' : 'decoy'));

  const order = isTraitor
    ? [primary,'traitor_sabotage','decoy','safe','risky_innocent','red_herring']
    : [primary,'safe','decoy','risky_innocent','red_herring'];

  const recent = new Set(S.history[playerId]?.slice(-S.historyWindow));
  for (const b of order){
    const list = poolBy(b).filter(a => a && !S.usedActionIds.has(a.id) && !recent.has(a.id));
    const candidates = list.length ? list : poolBy(b).filter(a => a && !S.usedActionIds.has(a.id));
    if (!candidates.length) continue;
    const weights = candidates.map(a => {
      let w = 1;
      if (deptMatches(a, p?.department)) w += 1.25;
      if ((a.risk_level|0) === 0 && b === 'safe') w += 0.2;
      return w;
    });
    const act = weightedPick(candidates, weights, rng);
    return { act, usedBucket: b, fellBack: (b !== primary) };
  }
  return { act: { id: '_stub', description: '…did some uneventful work.', risk_level: 0, actually_suspicious: false }, usedBucket: 'safe', fellBack: true };
}
function doActionsPhase(){
  const actionsEl = document.getElementById('actions');
  if (actionsEl) actionsEl.classList.remove('is-disabled');

  const items = [];
  for (const id of [...S.alive]){
    if (id === S.youId) continue;
    const choice = chooseActionFor(id, S.rng);
    const act = choice.act || {};
    if (act.id) S.usedActionIds.add(act.id);
    const hist = S.history[id] || (S.history[id] = []);
    if (act.id){ hist.push(act.id); if (hist.length > S.historyWindow) hist.shift(); }

    const d = DIFF[S.difficulty];
    const risk = Number.isFinite(act.risk_level) ? act.risk_level : 0;
    const sus  = !!act.actually_suspicious;
    const delta = (risk * 0.8) + (sus ? 1.2 : 0) * d.pattern_clarity;
    S.suspicion[id] = Math.max(0, (S.suspicion[id]||0) + delta);

    items.push({ id, text: act.description || '', risk, sus, fellBack: choice.fellBack });
  }

  const host = document.getElementById('actions');
  host.innerHTML = `
    <h2>Daily Activity</h2>
    <div class="actions-list">
      ${items.map(a => {
        const cls = S.analysis ? ('r' + a.risk) : 'neutral';
        const hint = S.analysis ? \`
          <div class="note">
            \${a.sus ? 'Looks truly risky.' : (a.risk>0 ? 'May look risky but could be benign.' : 'Safe.')}
            \${a.fellBack ? '· (pool fallback used)' : ''}
          </div>\` : '';
        return \`<div class="action-item \${cls}"><strong>\${escapeHtml(nameOf(a.id))}</strong>: \${escapeHtml(a.text)} \${hint}</div>\`;
      }).join('')}
    </div>
    <div class="note" style="margin-top:8px">New round: review behaviours, then vote.</div>
  `;

  doVotingPhase();
}

// =======================
// Voting
// =======================
function doVotingPhase(){
  const voting = document.getElementById('voting');
  if (!voting) return;
  voting.innerHTML = `
    <h2>Voting</h2>
    <div class="note">Click a player card to cast your vote. Then watch the votes roll in.</div>
    <div class="tally" id="tally"></div>
    <div id="voteFeed" class="note"></div>
  `;

  document.querySelectorAll('#topbar .player-card').forEach(card=>{
    const id = card.getAttribute('data-id');
    if (!id) return;
    let bub = card.querySelector('.vote-bubble');
    if (!bub){
      bub = document.createElement('div');
      bub.className = 'vote-bubble';
      card.appendChild(bub);
    }
    bub.textContent = '0';
    if (S.alive.has(id) && id !== S.youId){
      card.style.cursor = 'pointer';
      card.onclick = () => handlePlayerVote(id);
    }else{
      card.onclick = null;
      card.style.cursor = 'default';
    }
  });
}
function renderTally(tally){
  const t = document.getElementById('tally'); if (!t) return;
  const entries = Object.entries(tally).sort((a,b)=>b[1]-a[1]);
  t.innerHTML = entries.map(([id,v])=>`<span class="pill">${escapeHtml(nameOf(id))}: ${v}</span>`).join('');
  document.querySelectorAll('#topbar .player-card').forEach(card=>{
    const id = card.getAttribute('data-id');
    const vb = card.querySelector('.vote-bubble');
    if (vb){
      const val = tally[id] || 0;
      vb.textContent = String(val);
      card.classList.toggle('voting', !!val);
    }
  });
}
function handlePlayerVote(targetId){
  // Reset bubbles and log
  document.querySelectorAll('#topbar .vote-bubble').forEach(b => b.textContent = '0');
  const feed = document.getElementById('voteFeed'); if (feed) feed.innerHTML = '';

  const tally = {};
  function bump(id, who){
    tally[id] = (tally[id] || 0) + 1;
    renderTally(tally);
    if (feed){
      feed.innerHTML += `• ${escapeHtml(who)} voted ${escapeHtml(nameOf(id))}<br>`;
      feed.scrollTop = feed.scrollHeight;
    }
  }

  bump(targetId, 'You');

  const cfg = DIFF[S.difficulty] || DIFF.Medium;
  const alive = [...S.alive];
  const voters = alive.filter(id => id !== S.youId);
  const candidates = alive.filter(id => id !== S.youId);
  const planned = [];

  // Hint mode: exactly one traitor will vote you in Easy/Medium; no one else may
  let forcedTraitor = null;
  if (S.youId && (S.difficulty === 'Easy' || S.difficulty === 'Medium')){
    const ts = voters.filter(id => S.traitors.has(id));
    if (ts.length){
      forcedTraitor = ts[Math.floor(S.rng() * ts.length)];
      planned.push({ who: forcedTraitor, vote: S.youId, forced: true });
    }
  }

  voters.forEach(id=>{
    if (id === forcedTraitor) return;
    const p = S.players.find(x => x.id === id);
    const order = candidates.filter(x => x !== id).sort((a,b)=>(S.suspicion[b]||0)-(S.suspicion[a]||0));
    const base = order[0] ?? targetId;
    const follow = S.rng() < (p?.influence ?? 0.5) * cfg.influence_scale;
    let vote = follow ? targetId : (order.length ? order[0] : base);

    // On Easy/Medium, prevent *extra* votes on you (only the one forced traitor should vote you)
    if ((S.difficulty === 'Easy' || S.difficulty === 'Medium') && vote === S.youId){
      if (id !== forcedTraitor){
        const alt = order.find(x => x !== S.youId) || base;
        vote = alt;
      }
    }
    planned.push({ who:id, vote });
  });

  let i = 0;
  (function step(){
    if (i < planned.length){
      const { who, vote } = planned[i++];
      bump(vote, nameOf(who));
      setTimeout(step, 550);
      return;
    }

    // Decide elimination with tie-break by suspicion
    let max = -1, eliminated = null;
    Object.entries(tally).forEach(([id,v])=>{
      if (v > max){ max = v; eliminated = id; }
      else if (v === max){
        if ((S.suspicion[id]||0) > (S.suspicion[eliminated]||0)) eliminated = id;
      }
    });
    const tie = Object.values(tally).filter(v => v === max).length > 1;

    // Lock Daily Activity until the next scenario is answered
    const actionsEl = document.getElementById('actions');
    if (actionsEl) actionsEl.classList.add('is-disabled');

    const isT = S.traitors.has(eliminated);
    eliminate(eliminated, isT, 'VotedOut');
    renderAll();
    if (tie) logLine(`a deciding vote chose ${nameOf(eliminated)}.`);
    logLine(`Eliminated: ${nameOf(eliminated)} (${isT ? 'Traitor' : 'Innocent'}).`);

    if (!isT){
      // Night strike, then next round
      const pool = [...S.alive].filter(id => id !== S.youId && !S.traitors.has(id));
      if (pool.length){
        pool.sort((a,b)=>{
          const pa=S.players.find(p=>p.id===a), pb=S.players.find(p=>p.id===b);
          return (pb?.influence ?? 0) - (pa?.influence ?? 0) || ((S.suspicion[a]||0) - (S.suspicion[b]||0));
        });
        const struck = pool[0];
        setTimeout(()=>{
          eliminate(struck, false, 'NightStrike');
          renderAll();
          logLine(`Night strike: ${nameOf(struck)} was eliminated by traitors.`);
          if (!checkEnd()){ S.round += 1; renderRoundInfo(); doScenarioPhase(); }
        }, 600);
        return;
      }
    }
    if (!checkEnd()){ S.round += 1; renderRoundInfo(); doScenarioPhase(); }
  })();
}

// =======================
// Elimination & Log
// =======================
function eliminate(id, wasTraitor, reason){
  if (!S.alive.has(id)) return;
  S.alive.delete(id); S.eliminated.add(id); S.elimReason[id] = reason;
  const p = S.players.find(x => x.id === id);
  if (p) p.status = 'Eliminated';

  const card = document.querySelector(`.player-card[data-id="${id}"]`);
  if (card){
    card.classList.add('eliminated');
    card.classList.toggle('traitor', S.traitors.has(id));
    card.classList.toggle('innocent', !S.traitors.has(id));
    card.classList.remove('by-vote','by-traitors');
    card.classList.add(reason === 'NightStrike' ? 'by-traitors' : 'by-vote');
    const img = card.querySelector('img');
    if (img && p && p.avatarSad) img.src = p.avatarSad;
    const x = card.querySelector('.xmark'); if (x) x.textContent = '✕';
  }

  const msg = S.elimMsgs[p?.department] || `${p?.department || 'A team'} in turmoil.`;
  if (reason === 'NightStrike') logLine(msg);
}

// =======================
// Modal Log & announce
// =======================
function openLogModal(){
  const modal = document.getElementById('logModal');
  const body  = document.getElementById('logBody');
  if (body) body.innerHTML = S.log.map(x => `• ${escapeHtml(x)}`).join('<br>');
  if (modal) modal.classList.add('open');
}
document.getElementById('closeLog').onclick = () => document.getElementById('logModal').classList.remove('open');

function announce(msg){
  const el = document.getElementById('scenario');
  const names = S.players.filter(p => S.traitors.has(p.id)).map(p => p.name);
  const list = names.length ? `<br><br><strong>The traitors were:</strong> ${escapeHtml(names.join(', '))}.` : '';
  el.innerHTML = `<h2>Outcome</h2>
    <div>${escapeHtml(msg)}${list}</div>
    <div class="footer" style="display:flex;justify-content:flex-end">
      <button class="btn" onclick="location.reload()">Play Again</button>
    </div>`;
}

// =======================
// Boot
// =======================
document.getElementById('restartBtn').onclick = () => location.reload();

window.addEventListener('DOMContentLoaded', async ()=>{
  await loadData();
  const startModal = document.getElementById('startModal');
  const startBtn   = document.getElementById('startBtn');
  if (startBtn){
    startBtn.onclick = () => {
      const you  = document.getElementById('playerSelect').value;
      const diff = document.getElementById('difficulty').value;
      const ana  = document.getElementById('analysisMode').value === 'true';
      const numT = parseInt(document.getElementById('numTraitors').value, 10) || 3;

      S.rng         = mulberry32(Math.floor(Math.random() * 1e9));
      S.youId       = you;
      S.difficulty  = diff;
      S.analysis    = ana;
      S.numTraitors = numT;

      if (startModal) startModal.classList.remove('open');
      startGame();
    };
  }

  window.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape'){
      const logModal = document.getElementById('logModal');
      if (logModal) logModal.classList.remove('open');
    }
  });
});

// =======================
// Traitor reveal
// =======================
function revealTraitors(){
  S.players.forEach(p=>{
    if (!S.traitors.has(p.id)) return;
    const card = document.querySelector(`.player-card[data-id="${p.id}"]`);
    if (!card) return;
    card.classList.add('revealed-traitor');
    const img = card.querySelector('img');
    if (img && p.avatarTraitor){
      const orig = img.src;
      img.onerror = ()=>{ img.onerror=null; img.src = orig; };
      img.src = p.avatarTraitor;
    }
  });
}
