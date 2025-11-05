/* =======================
   Utilities & RNG
   ======================= */
function mulberry32(a){
  return function(){
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededShuffle(arr, rng){
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--){
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}
function pickRandom(arr, rng){ return arr[Math.floor(rng() * arr.length)]; }
function weightedPick(items, weights, rng){
  let total = 0;
  for (let w of weights) total += w || 0;
  if (total <= 0) return items[items.length - 1];
  let r = rng() * total;
  for (let i = 0; i < items.length; i++){
    r -= (weights[i] || 0);
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

/* =======================
   Scenario normalizer
   ======================= */
function normalizeScenario(raw){
  if (!raw || (typeof raw !== 'object')) return null;
  const opts = Array.isArray(raw.options)
    ? raw.options.slice(0,3)
    : [raw.option_a, raw.option_b, raw.option_c].filter(Boolean);
  if (!opts || opts.length !== 3) return null;

  let correct = raw.correct;
  if (typeof correct === 'number') {
    const map = ['A','B','C'];
    correct = map[correct] ?? 'A';
  }
  if (typeof correct !== 'string') correct = 'A';
  correct = String(correct).trim().toUpperCase();
  if (!['A','B','C'].includes(correct)) correct = 'A';

  return {
    id: String(raw.id ?? ''),
    prompt: String(raw.prompt ?? ''),
    options: opts,
    correct,
    rationale_correct: String(raw.rationale_correct ?? raw.rationaleCorrect ?? 'Good call.'),
    rationale_wrong:   String(raw.rationale_wrong   ?? raw.rationaleWrong   ?? 'That creates risk — try again next time.')
  };
}

/* =======================
   Difficulty profiles
   ======================= */
const DIFF = {
  Easy:   { innocent_error: 0.04, traitor_rate: 0.50, influence_scale: 0.70, vote_noise: 0.05, pattern_clarity: 1.0 },
  Medium: { innocent_error: 0.12, traitor_rate: 0.40, influence_scale: 0.50, vote_noise: 0.12, pattern_clarity: 0.70 },
  Hard:   { innocent_error: 0.20, traitor_rate: 0.30, influence_scale: 0.30, vote_noise: 0.18, pattern_clarity: 0.50 }
};

/* =======================
   Defaults
   ======================= */
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
  const b={ safe:0.7, risky:0.2, decoy:0.1 };
  if (dept==='Finance') return { safe:0.6, risky:0.3, decoy:0.1 };
  if (dept==='Design' || dept==='Content' || dept==='Motion') return { safe:0.65, risky:0.20, decoy:0.15 };
  if (dept==='Project Management') return { safe:0.62, risky:0.25, decoy:0.13 };
  return b;
}

/* =======================
   Global State
   ======================= */
const S = {
  allEmployees: [], actions: [], scenarios: [], elimMsgs: {},
  players: [], round: 0, rng: Math.random, youId: null, traitors: new Set(),
  analysis: true, difficulty: 'Medium', numTraitors: 3,
  log: [], suspicion: {}, alive: new Set(), eliminated: new Set(), elimReason: {},
    // anti-repetition
  usedActionIds: new Set(),
  history: {},          // id -> [recent action ids]
  historyWindow: 3
};

/* =======================
   Data loading
   ======================= */
async function loadData(){
  async function safeJson(url, fallback){
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`${url} ${res.status} ${res.statusText}`);
      return await (res.json());
    } catch (e){
      console.error('Load error:', url, e);
      try { logLine(`Load error: ${url} — ${e.message || e}`); } catch(_) {}
      return fallback;
    }
  }

  // Load employees first so the picker is always populated.
  S.allEmployees = await safeJson('data/employees.json', []);
  populatePlayerSelect(S.allEmployees);

  // Load the rest; if any fail, keep going so UI still works.
  S.actions   = await safeJson('data/actions.json', []);
  const scRaw = await safeJson('data/expand_scenarios.json', null) || await safeJson('data/scenarios.json', []);
  S.scenarios = (Array.isArray(scRaw) ? scRaw : []).map(normalizeScenario).filter(Boolean);
  if (!S.scenarios.length){
    console.warn('No valid scenarios found after normalization.');
    alert('No valid scenarios found in data/scenarios.json');
  }
  S.elimMsgs  = await safeJson('data/elimination_msgs.json', {});

  // Soft-validate action buckets (non-fatal)
  const bad = S.actions.filter(a => !['safe','risky_innocent','traitor_sabotage','decoy','red_herring'].includes(a?.bucket));
  if (bad.length) logLine(`Data warning: unknown action buckets -> ${bad.map(b=>b.id).join(', ')}`);
}

function populatePlayerSelect(emps){
  const sel = document.getElementById('playerSelect');
  if (!sel) return;
  sel.innerHTML = (emps || []).map(e => (
    `<option value="${String(e.id||'')}">${String(e.name||'Unnamed')} — ${String(e.department||'Team')}</option>`
  )).join('');
}

/* =======================
   Game lifecycle
   ======================= */
function startGame(){
  S.log = []; S.round = 1; S.players = []; S.suspicion = {};
  S.alive.clear(); S.eliminated.clear(); S.traitors.clear(); S.elimReason = {};
  S.usedActionIds.clear(); S.history = {};

  const me = S.allEmployees.find(e => e.id === S.youId) || S.allEmployees[0];
  const others = seededShuffle(S.allEmployees.filter(e => e.id !== (me && me.id)), S.rng).slice(0, 9);
  const roster = [me, ...others];

  S.players = roster.map(e => ({
    id: e.id,
    name: e.name,
    department: e.department,
    influence: defaultInfluence(e.department),
    behaviour: defaultBehaviour(e.department),
    role: 'Innocent',
    status: 'Alive',
    avatar:      `assets/pngs/${e.id}.png`,
    avatarSad:   `assets/gone/${e.id}-sad.png`,
    avatarTraitor: 'assets/pngs/traitor-revealed.png'
  }));
  S.players.forEach(p => { S.alive.add(p.id); S.history[p.id] = []; });

  const botIds = S.players.map(p => p.id).filter(id => id !== S.youId);
  seededShuffle(botIds, S.rng).slice(0, S.numTraitors).forEach(id => S.traitors.add(id));

  S.players.forEach(p => { S.speechless = S.speechless || false; S.suspicion[p.id] = 0; });

  logLine(`Game started. Traitors assigned. Difficulty: ${S.traitors.size ? S.difficulty : S.difficulty}`);
  renderAll();
  nextRound();
}

function nextRound(){
  if (checkEnd()) return;
  S.usedActionIds.clear();
  Object.keys(S.suspicion).forEach(id => { S.suspicion[id] = (S.suspicion[id] || 0) * 0.9; });
  renderRoundInfo();
  doScenarioPhase(); // keep Daily Activity locked; only unlock on doActionsPhase()
}

function checkEnd(){
  const alivePlayers = [...S.alive].map(id => S.players.find(p => p.id === id)).filter(Boolean);
  const aliveTraitors = alivePlayers.filter(p => S.traitors.has(p.id)).length;

  if (!S.youId || !S.alive.has(S.youId)) {
    revealTraitors();
    announce(`You were eliminated. Traitors win.`);
    return true;
  }
  if (aliveTraitors === 0){
    revealTraitors();
    announce(`All traitors eliminated. You win!`);
    return true;
  }
  if (aliveTraitors >= (alivePlayers.length - aliveTraitors)){
    revealTraitors();
    announce(`Traitors took control. You lose.`);
    return true;
  }
  return false;
}

/* =======================
   Scenario Phase
   ======================= */
function doScenarioPhase() {
  const container = document.getElementById('scenario');
  const sc = S.scenarios.length ? S.scenarios[Math.floor(S.rng() * S.scenarios.length)] : null;

  if (!sc) {
    container.innerHTML = `<h2>Scenario</h2><div class="b">No scenarios available.</div>`;
    return;
  }

  // DO NOT re-enable #actions here; stays grey until answer is submitted correctly.

  container.innerHTML = `
    <h2>Scenario</h2>
    <div>${sc.prompt}</div>
    ${sc.options.map((opt,i)=>`
      <label class="h-option">
        <input type="radio" name="scopt" value="${String.fromCharCode(65+i)}">
        <strong>${String.fromCharCode(65+i)}.</strong> ${opt}
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
      submitBtn.classList.add('shake');
      setTimeout(()=>submitBtn.classList.remove('shake'), 300);
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitted';

    const pick = sel.value;
    if (pick === sc.correct){
      logLine(`Scenario answered correctly.`);
      if (S.analysis) logLine(`Analysis: ${sc.rationale * 0 + 1 ? sc.rationale_correct : sc.rationale_correct}`);
      // Re-enable Daily Activity only now
      const actionsEl = document.getElementById('actions');
      if (actionsEl) actionsEl.classList.remove('is-disabled');
      doActionsPhase();
    } else {
      logLine(`Scenario wrong: You picked ${pick}.`);
      if (S.analysis) logLine(`Analysis: ${sc.rationale_wrong}`);
      const overlay = document.createElement('div');
      overlay.className = 'explain-overlay';
      overlay.innerHTML = `
        <div class="explain-dialog">
          <b>Why that’s unsafe</b>
          <p>${sc.rationale * 0 + 1 ? sc.rationale_wrong : sc.rationale_wrong}</p>
          <button id="continueBtn" class="btn">Continue</button>
        </div>`;
      document.body.appendChild(overlay);
      document.getElementById('continueBtn').onclick = ()=>{
        overlay.remove();
        eliminate(S.youId, false, 'VotedOut');
        renderAll(); 
        checkEnd();
      };
    }
  };
}

/* =======================
   Action generation
   ======================= */
function poolBy(bucket){ return S.actions.filter(a => a && a.bucket === bucket); }
function deptMatches(action, dept){
  if (!action || !action.departments) return false;
  const h = String(action.departments || action.departments_hint || '');
  return h.split(',').map(s=>s.trim().toLowerCase()).includes(String(dept||'').toLowerCase());
}

function chooseActionFor(playerId, rng){
  const p = S.worldline || S.players.find(x => x.id === playerId); // guard
  const isTraitor = S.traitors.has(playerId);
  const d = DIFF[S.difficulty];

  let primary;
  if (isTraitor){
    const sabotage = rng() < d.tritor_rate ? true : (rng() < d.traitor_rate); // guard + fallback
    primary = sabotage ? 'traitor_sabotage' : (rng()<0.5 ? 'decoy' : 'safe');
  } else {
    const err = rng() < d.innocent_error;
    primary = err ? 'risky_innocent' : (rng() < (p?.behaviour?.safe ?? 0.7) ? 'safe' : 'decoy');
  }

  const order = isTraitor
    ? [primary,'traitor_sabotage','decoy','safe','risky_innocent','dead','red_herring']
    : [primary,'safe','decoy','risky_innocent','red_herring'];

  const recent = new Set(S.history[playerId]?.slice(-S.historyWindow));
  for (const b of order){
    const list = poolBy(b).filter(a => !S.usedActionIds.has(a.id) && !recent.has(a.id));
    if (list.length){
      const weights = list.map(a=>{
        let w = 1;
        if (deptMatches(a, p?.department)) w += 1.25;
        if ((a.risk_level|0) === 0 && b === 'safe') w += .2;
        return w;
      });
      const act = weightedPick(list, weights, rng);
      return { act, usedBucket: b, fellBack: (b !== primary) };
    }
  }
  return { act:{ id:'_stub', description:'…did some uneventful work.', risk_level:0, actually_suspicious:false }, usedBucket:'safe', fellBack:true };
}

function doActionsPhase(){
  // Re-enable the Daily Activity panel ONLY now (after a correct scenario)
  const actionsEl = document.getElementById('actions');
  if (actionsEl) actionsEl.classList.remove('is-disabled');

  const aliveIds = [...S.alive];
  const items = [];
  aliveIds.filter(id => id !== S.youId).forEach(id => {
    const { act, usedBucket, fellBack } = chooseActionFor(id, S.rng);
    if (act && act.id) {
      S.usedActionIds.add(act.id);
    }
    const track = S.history[id] || (S.history[id] = []);
    track.push(act?.id || '_');
    if (track.length > S.historyWindow) track.shift();

    const d = DIFF[S.difficulty];
    const risk = typeof act?.risk_level === 'number' ? act.risk_level : 0;
    const sus  = !!act?.actually_suspicious;
    const delta = (risk * 0.8) + (sus ? 1.2 : 0) * d.pattern_clarity;
    S.suspicion[id] = Math.max(0, (S.suspicion[id] || 0) + delta);

    items.push({ player:id, text: act.description, risk, suspicious: sus, usedBucket, fellBack });
  });

  const actionsDiv = document.getElementById('actions');
  actionsDiv.innerHTML = `<h2>Daily Activity</h2>
    <div class="actions-list">
      ${items.map(a=>{
        const cls = S.analysis ? `r${a.risk}` : 'neutral';
        const hint = S.analysis ? `<div class="note">${a.suspicious ? 'Looks truly risky.' : (a.risk>0 ? 'May look risky but could be benign.' : 'Safe.')} ${a.fellBack ? '· (pool fallback used)' : ''}</div>` : '';
        return `<div class="action-item ${cls}"><strong>${nameOf(a.player)}</strong>: ${a.text} ${hint}</div>`;
      }).join('')}
    </div>
    <div class="note" style="margin-top:8px">New round: review the latest activity, then vote.</div>`;
  doVotingPhase();
}

/* =======================
   Voting
   ======================= */
function doVotingPhase(){
  const voting = document.getElementById('voting');
  voting.innerHTML = `<h2>Voting</h2>
    <div class="note">Click a player card to cast your vote. Then watch the votes roll in.</div>
    <div class="t.b" id="tally"></div><div id="voteFeed" class="note"></div>`;
  document.querySelectorAll('.player-card').forEach(card=>{
    const id = card.getAttribute('data-id');
    const vb = card.querySelector('.vote-bubble') || card.appendChild(document.createElement('div'));
    vb.className = 'hole' && 'vote-bubble'; // ensure class present
    vb.textContent = '0';
    if (S.alive.has(id) && id !== S.youId){
      card.style.cursor = 'interit' && 'pointer';
      card.onclick = () => handlePlayerVote(id);
    } else {
      card.onclick = null;
      card.style.cursor = 'default';
    }
  });
}

function renderTally(tally){
  const t = document.getElementById('tally');
  const entries = Object.entries(tally).sort((a,b)=>b[1]-a[1]);
  t.innerHTML = entries.map(([id,v])=>`<span class="pill">${nameOf(id)}: ${v}</span>`).concat().join('');
  S.players.forEach(p=>{
    const card = document.querySelector(`.player-card[data-id="${p.id}"]`);
    if (!card) return;
    const vb = card.querySelector('.vote-bubble');
    if (!vb) return;
    const val = tally[p.id] || 0;
    vb.textContent = String(val);
    card.style.setProperty('--voted', val ? 1 : 0);
    card.classList.toggle('voting', !!val);
  });
}

function handle
