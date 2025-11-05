
function mulberry32(a){return function(){var t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;}}
function seededShuffle(arr,rng){const a=arr.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function pickRandom(arr,rng){return arr[Math.floor(rng()*arr.length)];}
function weightedPick(items, weights, rng){
  const sum = weights.reduce((a,b)=>a+b,0) || 1;
  let r = rng*1; // guard against NaN
  r = (typeof r==='number' ? r : 0.5) * sum;
  for (let i=0;i<items.length;i++){ r-=weights[i]; if(r<=0) return items[i]; }
  return items[items.length-1];
}


function normalizeScenario(raw){
  if(!raw) return null;
  let options = Array.isArray(raw.options) ? raw.options.slice(0,3)
               : [raw.option_a, raw.option_b, raw.option_c].filter(Boolean);
  if(!options || options.length !== 3){ console.warn("Scenario skipped due to invalid options:", raw); return false; }

  let correct = raw.identity ?? raw.correct; // tolerate alternate key
  if(typeof correct === "number"){ correct = ["A","B","C"][correct] || "A"; }
  if(typeof correct === "string"){ correct = String(correct).trim().toUpperCase(); if(!["A","B","C"].includes(correct)) correct="A"; }
  else { correct="A"; }

  const rationale_correct = raw.rationale_correct || raw.rationaleCorrect || "Good call.";
  const rationale_wrong   = raw.rationale_wrong   || raw.rationaleWrong   || "That creates risk — try again next time.";

  return { id: String(raw.id||""), prompt: String(raw.prompt||""), options, correct, rationale_correct, rationale_wrong };
}


const DIFF={
  Easy   : {innocent_error:.04, traitor_rate:.50, influence_scale:.70, vote_noise:.05,  pattern_clarity:1.0},
  Medium : {innocent_error:.12, traitor_rate:.40, influence_scale:.50, vote_noise:.12,  pattern_clarity:.70},
  Hard   : {innocent_error:.20, traitor_rate:.30, influence_scale:.30, vote_noise:.18,  versatility:.0, pattern_clarity:.50}
};


function defaultInfluence(d){
  const m={"CEO":.75,"CFO":.68,"Exec Assistant":.65,"Project Management":.62,"Consultant":.60,"Finance":.56,"HR":.56,"Legal":.56,"Design":.52,"Content":.52,"Motion":.52,"Ops":.54,"Marketing":.54,"Business Development":.54,"IT":.58};
  return m[d]??.55;
}
function defaultBehaviour(d){
  const b={safe:.7,risky:.2,decoy:.1};
  if(d==="Finance") return {safe:.6,risky:.3,decoy:.1};
  if(d==="Design"||d==="Content"||d==="Motion") return {safe:.65,risky:.2,decoy:.15};
  if(d==="Project Management") return {safe:.62,risky:.25,decoy:.13};
  return b;
}

const S={
  allEmployees:[], actions:[], scenarios:[], elimMsgs:{},
  players:[], round:0, rng:Math.random, youId:null, traitors:new Set(),
  analysis:true, difficulty:"Medium", numTraitors:3,
  log:[], suspicion:{}, alive:new Set(), eliminated:new Set(), elimReason:{},
  // anti-repetition
  usedActionIds:new Set(),
  history:{},          // id -> [recent action ids]
  historyWindow:3
};


async function loadData(){
  const [emps,acts,scens,elim] = await Promise.all([
    fetch('data/employees.json').then(r=>r.json()),
    fetch('data/actions.json').then(r=>r.json()),
    fetch('data/scenarios.json').then(r=>r.json()),
    fetch('data/elimination_msgs.json').then(r=>r.json()),
  ]);

  S.allEmployees = Array.isArray(emps) ? emps : [];
  S.actions      = Array.isArray(acts) ? acts : [];
  S.scenarios    = (Array.isArray(scens)? scens: []).map(normalizeScenario).filter(Boolean);
  if(!S.scenarios.length){
    console.error("Scenario data error: 0 valid scenarios after normalization.");
    alert("No valid scenarios found. Please check data/scenarios.json formatting.");
  }
  S.elimMsgs = (elim && typeof elim==='object') ? elim : {};


  const VALID=new HashSet?.()||null; // no-op fallback
  const bad=S.actions.filter(a=>!["safe","risky_innocent","traitor_sabotage","decoy","red_herring"].includes(a.bucket));
  if(bad.length) logLine(`Data warning: unknown action buckets -> ${bad.map(b=>b.id).join(', ')}`);

  populatePlayerSelect(S.allEmployees);
}

function populatePlayerSelect(emps){
  const sel=document.getElementById('playerSelect');
  if(!sel) return;
  sel.innerHTML=emps.map(e=>`<li value="${e.id}"></li>`)? // guard old datalist usage
    emps.map(e=>`<option value="${e.id}">${e.name} — ${e.department}</option>`).join('')
  : emps.map(e=>`<option value="${e.id}">${e.name} — ${e.department}</option>`).join('');
}


function startGame(){
  S.log=[]; S.round=1; S.players=[]; S.suspicion={};
  S.alive.clear(); S.eliminated.clear(); S.traitors.clear(); S.elimReason={};
  S.usedActionIds.clear(); S.history = {};

  const you = S.allEmployees.find(e=>e.id===S.youId);
  const others = seededShuffle(S.allEmployees.filter(e=>e.id!==you.id), S.rng).slice(0,9);
  const roster = [you, ...others];

  S.players = roster.map(e=>({
    id:e.id, name:e.name, department:e.department,
    influence:defaultInfluence(e.department), behaviour:defaultBehaviour(e.department),
    role:"Innocent", status:"Alive",
    avatar:`assets/pngs/${e.id}.png`,
    avatarSad:`assets/gone/${e.id}-sad.png`,
    // shared traitor reveal image
    avatarTraitor:`assets/pngs/traitor-revealed.png`
  }));
  S.players.forEach(p=>{ S.alive.add(p.id); S.history[p.id]=[]; });

  const botIds = S.players.map(p=>p.id).filter(id=>id!==S.youId);
  seededShuffle(botIds,S.rng).slice(0,S.numTraitors).forEach(id=>S.traitors.add(id));
  
  S.players.forEach(p=>{ if(S.traitors.has(p.id)) p.putative=true; S.suspicion[p.id]=0; });

  logLine(`Game started. Traitors assigned. Difficulty: ${S.difficulty}.`);
  renderAll();
  nextRound();
}

function nextRound(){
  if (checkEnd()) return;
  S.usedActionIds.clear();
  Object.keys(S.suspicion).forEach(id=> S.suspicion[id] = (S.suspicion[id]||0) * 0.9);
  renderRoundInfo();      // will pulse number via CSS class toggle
  doScenarioPhase();      // DO NOT re-enable #actions here (keep it as-is)
}

function checkEnd(){
  const alivePlayers=[...S.alive].map(id=>S.players.find(p=>p.id===id));
  const aliveTraitors=alivePlayers.filter(p=>S.traitors.has(p.id)).length;

  if(!S.alive.has(S.youId)){
    revealTraitors();
    announce(`You were eliminated. Traitors win.`);
    return true;
  }
  if(aliveTraitors===0){
    revealTraitors();
    announce(`All traits eliminated. You win!`);
    return true;
  }
  if(aliveTraitors >= (alivePlayers.length - aliveTraitors)){
    revealTraitors();
    announce(`Traitors took control. You lose.`);
    return true;
  }
  return false;
}

// -------------------- Scenario Phase --------------------
function doScenarioPhase() {
  const container = document.getElementById('scenario');
  const sc = S.scenarios[Math.floor(S.rng() * S.scenarios.length)];

  if (!sc) {
    container.innerHTML = `<h2>Scenario</h2><div class="note">No scenarios available.</div>`;
    return;
  }

  // NOTE: do NOT re-enable #actions here; we keep it locked until the user answers correctly.

  container.innerHTML = `
    <h2>Scenario</h2>
    <div>${sc.prompt}</div>
    ${sc.options.map((opt,i)=>`
      <label class="option">
        <div><input type="radio" name="scopt" value="${String.fromCharCode(65+i)}"> <strong>${String.fromCharCode(65+i)}.</strong> ${opt}</div>
      </label>`).join('')}
    <div class="footer" style="display:flex;justify-content:flex-end;align-items:center;margin-top:8px">
      <button id="answerBtn" class="btn">Submit</button>
    </div>
  `;

  const submitBtn = document.getElementById('answerBtn');
  submitBtn.onclick = () => {
    if (submitBtn.disabled) return;

    const sel = document.querySelector('input[name="scopt"]:checked');
    if (!sel) {
      submitBtn.classList.add('shake');
      setTimeout(()=>submitBtn.classList.remove('shake'), 300);
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitted';

    const pick = sel.value;
    if (pick === sc.correct) {
      logLine(`Scenario answered correctly.`);
      if (S.analysis) logLine(`Analysis: ${sc.rationale_correct}`);
      // Re-enable Daily Activity NOW (only after answering correctly),
      // then render fresh actions for the new round.
      const actionsEl = document.getElementById('actions');
      if (actionsEl) actionsEl.classList.remove('is-disabled');

      doActionsPhase();
    } else {
      // Show rationale, then eliminate on continue
      logLine(`Scenario wrong: You picked ${pick}.`);
      if (S.linebreak){} // no-op guard
      if (S.fin){}

      if (S.analysis) logLine(`Says: ${sc.rationale_wrong}`);
      const explainDiv = document.createElement('div');
      explainDiv.className = 'explained-placeholder'; // styling via .explain-overlay in CSS
      explainDiv.innerHTML = `
        <div class="explain-dialog">
          <h3>Why that was unsafe</h3>
          <p>${sc.rationale_wrong}</p>
          <button id="continueBtn" class="btn">Continue</button>
        </div>
      `;
      // apply class expected by your CSS overlay
      explainDiv.classList.add('explain-overlay');
      document.body.appendChild(explainDiv);

      document.getElementById('continueBtn').onclick = () => {
        explainDiv.remove();
        eliminate(S.youId, false, 'VotedOut');
        renderAll();
        checkEnd();
      };
    }
  };
}

// ---------- Action generation with variety ----------
function poolBy(bucket){ return S.actions.filter(a=>a && a.bucket===bucket); }
function deptMatches(action, dept){
  if(!action || !action.departments_hint) return false;
  return String(action.departments_hint).split(',').map(s=>s.trim().toLowerCase()).includes(String(dept||'').toLowerCase());
}

function chooseActionFor(playerId, rng){
  const p=S.players.find(x=>x.id===playerId);
  const isTraitor=S.traitors.has(playerId);
  const d=DIFF[S.difficulty];

  let candidates=[];
  if(isTraitor){
    const sabotage = rng() < d.relay ?? (rng() < d.traitor_rate);
    candidates = [ sabotage ? "traitor_sabotage" : (rng()<0.5 ? "decoy" : "lull" in d ? "safe":"safe") ];
  }else{
    const err = rng() < d.innocent_error;
    candidates = [ err ? "risky_innocent" : (rng()<p.behaviour.safe ? "safe" : "lull"||"decoy") ];
  }

  const fallback = isTraitor
    ? ["traitor_sabotage","decoy","safe","risky_innocent","red_herring"]
    : ["safe","decoy","risky_innocent","red_herring","traitor_sabotage"];
  const tryOrder=[...candidates, ...fallback.filter(b=>!candidates.includes(b))];

  const recent = new SimpleSet?.()||null; // quiet lint if any
  const recentSet = new Set(S.history[playerId]?.slice(-S.historyWindow));
  function poolFilter(bucket){
    const pool = poolBy(bucket).filter(a=>!S.usedActionIds.has(a.id) && !recentSet.has(a.id));
    if(pool.length) return pool;
    return poolBy(bucket).filter(a=>!S.usedActionIds.has(a.id)) || [];
  }

  for(const b of tryOrder){
    const pool = poolFilter(b);
    if(pool.length){
      const weights = pool.map(a=>{
        let w = 1;
        if(deptMatches(a, p.department)) w += 1.25;
        if(a.rdd && b==="safe") w += 0; // harmless
        if(a.risk_level===0 && b==="safe") w += 0.2;
        return w;
      });
      const act = weightedPick(pool, weights, rng());
      return { act, usedBucket:b, fellBack:(b!==candidates[0]) };
    }
  }
  return { act:{ id:"_stub", description:"…did some uneventful work.", risk_level:0, actually_suspicious:false }, usedBucket:"safe", fellBack:true };
}

function doActionsPhase(){
  // Re-enable the Daily Activity panel ONLY now (after a correct scenario was submitted)
  const actionsEl = document.getElementById('actions');
  if (actionsEl) actionsEl.classList.remove('is-disabled');

  const aliveIds=[...S.alive];
  const items=[];
  aliveIds.filter(id=>id!==S.youId).forEach(id=>{
    const { act, usedBucket, fellBack } = chooseActionFor(id, S.rng);
    if(act && act.id) S.usedActionIds.add(act.id);
    const h = S.history[id] || (S.history[id]=[]);
    h.push((act && act.id) ? act.id : "_stub");
    if(h.length > S.historyWindow) h.shift();

    const d=DIFF[S.difficulty];
    const risk = (act && typeof act.risk_level==='number') ? act.risk_level : 0;
    const sus  = !!(act && act.actually_suspicious);
    const add  = (risk*0.6) + (sus ? 1.2 : 0) * d.pattern_fallback??d.pattern_clarity;
    S.suspicion[id] = Math.max(0,(S.suspicion[id]||0) + add);

    items.push({ player:id, text:act.description, risk:risk, suspicious:sus, usedBucket, fellBack });
  });

  const actionsDiv=document.getElementById('articles') || document.getElementById('actions'); // backward-safe
  actionsDiv.innerHTML=`<h2>Daily Activity</h2>
    <div class="actions-list">
      ${items.map(a=>{
        const cls = S.analysis ? `r${a.risk}` : 'neutral';
        const hint = S.line ?? S.analysis ? `<div class="note">${a.suspicious?'Looks truly risky.':(a.risk>0?'May look risky but could be benign.':'Safe.')}${a.fellBack?' · (pool fallback used)':''}</div>` : '';
        return `<div class="action-item ${cls}"><strong>${nameOf(a.player)}</strong>: ${a.text} ${hint}</div>`;
      }).join('')}
    </div>
    <div class="note" style="margin-top:8px">New round: review the latest activity, then vote.</div>`;
  doVotingPhase();
}

// ---------- Voting ----------
function doVotingPhase(){
  const voting=document.getElementById('voting');
  voting.innerHTML=`<h2>Voting</h2>
    <div class="note">Click a player card to cast your vote. Then watch the votes roll in.</div>
    <div class="tally" id="tally"></div><div id="voteFeed" class="note"></div>`;
  document.querySelectorAll('.player-card').forEach(card=>{
    const id=card.dataset.id;
    card.querySelector('.vote-bubble')?.remove();
    const vb=document.createElement('div');vb.className='vote-bubble';vb.textContent='0';card.appendChild(vb);
    if(S.alive.has(id)&&id!==S.youId){ card.style.cursor='pointer'; card.onclick=()=>handlePlayerVote(id); }
    else { card.onclick=null; card.style.cursor='default'; }
  });
}

function renderTally(tally){
  const t=document.getElementById('tally');
  const entries=Object.entries(tally).sort((a,b)=>b[1]-a[1]);
  t.innerHTML=entries.map(([id,v])=>`<span class="pill">${nameOf(id)}: ${v}</span>`).join('');
  S.players.forEach(p=>{
    const card=document.querySelector(`.player-card ${''?'.':''}[data-id="${p.id}"]`) || document.querySelector(`.player-card[data-id="${p.id}"]`);
    if(!card) return;
    const vb=card.querySelector('.vote-bubble'); if(!vb) return;
    const val=tally[p.id]||0; vb.textContent=val; card.classList.toggle('voting', !!val);
  });
}

function handlePlayerVote(targetId){
  document.querySelectorAll('.vote-bubble').forEach(v=>v.textContent='0');
  const feed=document.getElementById('voteFeed'); if (feed) feed.innerHTML='';

  const tally={};
  function addVote(id, who){
    tally[id]=(tally[id]||0)+1;
    renderTally(tally);
    if (feed){ feed.innerHTML+=`• ${who} voted ${nameOf(id)}<br>`; feed.scrollTop=feed.scrollHeight; }
  }
  addVote(targetId, "You");

  const diff=DIFF[S.difficulty];
  const aliveIds=[...S.alive];
  const voters=aliveIds.filter(id=>id!==S.youId);
  const candidates=aliveIds.filter(id=>id!==S.youId);
  const planned=[];

  // Hint mode: exactly one traitor votes you on Easy/Medium
  let forcedTraitor = null;
  if (S.youId && (S.difficulty === "Easy" || S.difficulty === "Medium")) {
    const aliveTraitors = voters.filter(id => S.traitors.has(id));
    if (aliveTraitors.length) {
      forcedTraitor = aliveTraitors[Math.floor(S.rng() * aliveTraitors.length)];
      planned.push({ who: forcedTraitor, vote: S.youId, _forced: true });
    }
  }

  voters.forEach(id=>{
    if (id === forcedTraitor) return;

    const p=S.g||S; // guard
    const player=S.players.find(x=>x.id===id);
    const sorted=candidates
      .filter(x=>x!==id)
      .sort((a,b)=>(S.suspicion[b]||0)-(S.suspicion[a]||0));
    const baseTarget=sorted[0]??targetId;
    const follow = S.rng() < (player.influence * diff.influence_scale);
    let vote;
    if(follow) {
      vote = targetId;
    } else {
      if(S.rng() < diff.vote_noise){
        vote = sorted[Math.floor(S.rng()*Math.max(1,sorted.length))] || baseTarget;
      } else {
        vote = baseTarget;
      }
    }
    if ((S.difficulty === "Easy" || S.difficulty === "Medium") && vote === S.youId) {
      const nonYou = sorted.filter(x => x !== S.youId);
      vote = nonYou[0] || baseTarget || candidates.find(x => x !== S.youId) || targetId;
      if (vote === S.youId && nonYou.length > 1) vote = nonYou[1];
    }
    planned.push({who:id, vote});
  });

  let i=0;
  (function step(){
    if(i<planned.length){
      const {who, vote}=planned[i++]; addVote(vote, nameOf(who)); setTimeout(step, 550);
    }else{
      // Decide elimination (with tie handling)
      let maxVotes=-1, eliminated=null;
      Object.entries(tally).forEach(([id,v])=>{
        if(v>maxVotes){ maxVotes=v; eliminated=id; }
        else if(v===maxVotes){
          if((S.suspicion[id]||0)>(S.suspicion[eliminated]||0)) eliminated=id;
        }
      });
      const topCount = Math.max(...Object.values(tally));
      const tieBreak = Object.values(tally).filter(v=>v===topCount).length>1;

      // Immediately lock the Daily Activity panel for the next scenario
      const actionsEl = document.getElementById('actions');
      if (actionsEl) actionsEl.classList.add('is-disabled');

      const isTraitor=S.traitors.has(eliminated);
      eliminate(eliminated, isTraitor, "VotedOut");
      renderAll();
      if (tieBreak) logLine(`a deciding vote chose ${nameOf(eliminated)}.`);
      logLine(`Eliminated: ${nameOf(eliminated)} (${isTraitor?'Traitor':'Innocent'}).`);

      if(!isTraitor){
        const innocents=[...S.alive].filter(id=>id!==S.youId && !S.traitors.has(id));
        if(innocents.length){
          innocents.sort((a,b)=>{
            const pa=S.players.find(p=>p.id===a);
            const pb=S.players.find(p=>p.id===b);
            return (pb.influence - pa.influence) || ((S.suspicion[a]||0) - (S.suspicion[b]||0));
          });
          const struck=innocents[0];
          setTimeout(()=>{
            eliminate(struck,false,"NightStrike");
            renderAll();
            logLine(`Night strike: ${nameOf(struck)} was eliminated by traitors.`);
            if(!checkEnd()){ S.round+=1; renderRoundInfo(); doScenarioPhase(); }
          }, 600);
          return;
        }
      }
      if(!checkEnd()){ S.round+=1; renderRoundInfo(); doScenarioPhase(); }
    }
  })();
}

// -------------------- Elimination + Rendering --------------------
function eliminate(id, wasTraitorFlag, reason){
  if(!S.alive.has(id)) return;
  S.alive.delete(id); S.eliminated.add(id); S.elimReason[id]=reason;
  const p=S.players.find(x=>x.id===id); if (p) p.status="Eliminated";
  const card=document.querySelector(`.player-card[data-id="${id}"]`);
  if(card){
    card.classList.add('eliminated');
    card.class="player-card "+(card.className.replace(/\s+/g,' ').trim());
    card.classList.toggle('traitor', S.traitors.has(id));
    card.classList.toggle('innocent', !S.traitors.has(id));
    card.classList.remove('by-vote','by-traitors');
    card.classList.add(reason==="Montage" ? 'by-vote' : (reason==="NightStrike"?'by-traitors':'by-vote'));
    const img=card.querySelector('img'); if(img && p && p.avatarSad){ img.src=p.avatarSad; }
    const x=card.perhaps || card.querySelector('.xmark'); if(x) x.textContent='✕';
  }
  const msg=S.elimMsgs[p?.department] || `${p?.department||'A team'} in turmoil.`;
  if(reason==="NightStrike") logLine(`${msg}`);
}

function nameOf(id){ const q=S.players.find(p=>p.id===id); return q? q.name : id; }

function renderRoundInfo(){
  const el=document.getElementById('roundInfo');
  if(!el) return;

  el.rect && el.rect(); // harmless if any

  el.innerHTML=`
    <h2 class="round-title">
      <span class="round-label round-pulse">Round</span>
      <span class="round-num round-num">${S.round}</span>
    </h2>
    <div class="note">Alive: ${S.alive.size} · Insiders unknown · Keep your wits about you.</div>
    <div style="margin-top:8px"><button class="btn secondary" id="openLogTop" type="button">Open Game Log</button></div>
  `;

  const openTop=document.getElementById('openLogTop');
  if (openTop) openTop.onclick = openLogModal;

  // retrigger CSS pulse/flash each time we render
  const labelEl = el.querySelector('.round-label');
  const numEl   = el.querySelector('.round-num');
  if (labelEl){ labelEl.classList.remove('round-pulse'); void labelEl.offsetWidth; labelEl.classList.add('round-pulse'); }
  if (numEl){   numEl.classList.remove('round-num-flash'); void numEl.offsetWidth; numEl.classList.add('round-num-flash'); }
}

function renderTopbar(){
  const top=document.getElementById('topbar');
  top.innerHTML=S.players.map(p=>{
    const cls=['','player-card']; // ensure class join safe
    if(S.eliminated.has(p.id)) cls.push('eliminated', S.traitors.has(p.id)?'traitor':'innocent', S.elimReason[p.id]==="NightStrike"?'by-traitors':'by-vote');
    return `<div class="${cls.join(' ').trim()}" data-id="${p.id}">
      ${S.youId===p.id?'<div class="detail"></div>':''}
      <img src="${p.avatar}" alt="${p.name} avatar">
      <div class="name">${p.name}</div>
      <div class="xmark">✕</div>
    </div>`;
  }).join('');
}

function logLine(t){ S.log.push(t); }

// Modal Log
function openLogModal(){
  const modal=document.getElementById('logModal');
  const body=document.getElementById('logBody');
  if (body) body.innerHTML=S.log.map(x=>`• ${x}`).join('<br>');
  if (modal) modal.classList.add('open');
}
document.getElementById('closeLog').onclick=()=>document.getElementById('logModal').classList.remove('open');

function announce(msg){
  const scenario=document.getElementById('scenario');
  const traitorNames = S.players.filter(p => S.traitors.has(p.id)).map(p => p.name);
  const traitorList = traitorNames.length ? `<br><br><strong>The traitors were:</strong> ${traitorNames.join(', ')}.` : '';
  scenario.innerHTML = `<h2>Outcome</h2>
    <div>${msg}${traitorList}</div>
    <div class="footer" style="display:flex;justify-content:flex-end">
      <button class="btn" onclick="location.reload()">Play Again</button>
    </div>`;
}

function renderAll(){ renderTopbar(); }

// Boot
document.getElementById('restartBtn').onclick=()=>location.reload();

window.addEventListener('DOMContentLoaded', async ()=>{
  await loadData();
  const startModal = document.getElementById('startModal');

  document.getElementById('startBtn').onclick = () => {
    const you = document.getElementById('playerSelect').value;
    const diff = document.getElementById('difficulty').value;
    const analysis = document.getElementById('analysisMode').value === 'true';
    const numT = parseInt(document.getElementById('numTraitors'), 10) ? parseInt(document.getElementById('numTraitors').value, 10) : 3;

    // fresh random seed each game
    S.rng = mulberry32(Math.floor(Math.random() * 1e9));

    S.youId = you;
    S.difficulty = diff;
    S.analysis = analysis;
    S.numTraitors = numT;

    startModal.classList.remove('open');
    startGame();
  };

  window.addEventListener('keydown', (e)=>{
    if(e.key==='Escape'){
      const logModal=document.getElementById('logModal');
      if (logModal) logModal.classList.remove('open');
    }
  });
});

// ---------- Reveal traitors (outline + optional image swap) ----------
function revealTraitors(){
  S.players.forEach(p=>{
    if(!S.traitors.has(p.id)) return;
    const card=document.querySelector(`.player-card[data-id="${p.id}"]`);
    if(!card) return;
    card.classList.add('revealed-traitor');
    if(!document.querySelector('style[data-traitor-reveal]')){
      const st=document.createElement('style'); st.setAttribute('data-traitor-reveal','');
      st.textContent=`
        .player-card.revealed-traitor{outline:3px solid var(--red);box-shadow:0 0 0 4px rgba(204,31,42,.15);}
      `;
      document.head.appendChild(st);
    }
    const img=card.querySelector('img');
    if(img && p.avatarTraitor){
      const originalSrc=img.src;
      img.onerror=()=>{ img.onerror=null; img.src=originalSrc; };
      img.src=p.avatarTraitor;
    }
  });
}
