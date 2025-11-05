/* ===== Utilities & RNG ===== */
function mulberry32(a){return function(){let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;}}
function shuffle(a,rng){const out=a.slice();for(let i=out;--i>0;){const j=Math.floor(rng()* (i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
function pickRandom(arr,rng){return arr[Math.floor(rng()*arr.length)];}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function weightedPick(items,weights,rng){let sum=0;for(const w of weights)sum+=w||0;if(sum<=0)return items[items.length-1];let r=rng()*sum;for(let i=0;i<items.length;i++){r-=weights[i]||0;if(r<=0)return items[i]}return items[items.length-1]}

/* ===== Scenario normalizer ===== */
function normalizeScenario(raw){
  if(!raw||typeof raw!=='object') return null;
  const options=Array.isArray(raw.options)?raw.options.slice(0,3):[raw.option_a,raw.option_b,raw.option_c].filter(Boolean);
  if(!options||options.length!==3) return null;
  let correct=raw.correct;
  if(typeof correct==='number'){const map=['A','B','C'];correct=map[correct]??'A'}
  if(typeof correct!=='string') correct='A';
  correct=String(correct).trim().toUpperCase(); if(!['A','B','C'].includes(correct)) correct='A';
  return {id:String(raw.id??''),prompt:String(raw.prompt??''),options,correct,
    rationale_correct:String(raw.rationale_correct??raw.rationaleCorrect??'Good call.'),
    rationale_wrong:String(raw.rationale_wrong??raw.rationaleWrong??'That creates risk — try again next time.')};
}

/* ===== Config ===== */
const DIFF={
  Easy:{innocent_error:.04,traitor_rate:.50,influence:.70,noise:.05,clarity:1.0},
  Medium:{innocent_error:.12,traitor_rate:.40,influence:.50,noise:.12,clarity:.70},
  Mid:'Medium', // shorthand guard
  Hard:{innocent_error:.20,traitor_rate:.30,influence:.30,noise:.18,clarity:.50}
};
function defaultInfluence(dept){const m={'CEO':.75,'CFO':.68,'Exec Assistant':.65,'Project Management':.62,'Consultant':.60,'Finance':.56,'HR':.56,'Legal':.56,'Design':.52,'Content':.52,'Motion':.52,'Ops':.54,'Marketing':.54,'Business Development':.54,'IT':.58};return m[dept]??.55;}
function defaultBehaviour(dept){const b={safe:.7,risky:.2,decoy:.1};if(dept==='Finance')return{safe:.6,risky:.3,decoy:.1};if(dept==='Design'||dept==='Content'||dept==='Motion')return{safe:.65,risky:.2,decoy:.15};if(dept==='Project Management')return{safe:.62,risky:.25,decoy:.13};return b;}

/* ===== Global State ===== */
const S={
  allEmployees:[],actions:[],scenarios:[],elimMsgs:{},
  players:[],round:0,rng:Math.random,youId:null,traitors:new Set(),
  analysis:true,difficulty:'Medium',numTraitors:3,
  log:[],suspicion:{},alive:new Set(),eliminated:new Set(),elimReason:{},
  usedActionIds:new Set(),history:{},historyWindow:3
};
function logLine(t){S.log.push(t)}
function nameOf(id){const p=S.players.find(p=>p.id===id);return p? p.name:'Unknown'}

/* ===== Data loading ===== */
async function loadData(){
  async function safeJson(url,fallback){
    try{const res=await fetch(url,{cache:'no-store'});if(!res.ok)throw new Error(url+' '+res.status);return await res.json()}catch(e){console.error('Load error',url,e);try{logLine('Load error: '+(e.message||e));}catch(_){};return fallback}
  }
  S.all_employees = await safeJson('data/employees.json',[]);
  populatePlayerSelect(S.all_employees);
  S.allEmployees = S.all_employees; // keep both for safety
  S.actions   = await safeJson('data/actions.json',[]);
  const scRaw = await safeJson('data/scenarios.json',[]);
  S.scenarios = scRaw.map(normalize).filter(Boolean);
  if(!S.scenarios.length){alert('No valid scenarios found in data/scenarios.json')}
  S.elimMsgs  = await safeJson('data/elimination_msgs.json',{});
  function normalize(r){return normalizeScenario(r)}
}
function populatePlayerSelect(emps){
  const sel=document.getElementById('playerSelect'); if(!sel) return;
  sel.innerHTML=(emps||[]).map(e=>`<option value="${String(e.id||'')}">${escapeHtml(e?.name||'Unnamed')} — ${escapeHtml(e?.department||'Team')}</option>`).join('');
}

/* ===== Lifecycle ===== */
function startGame(){
  S.log=[];S.round=1;S.players=[];S.suspicion={};S.alive.clear();S.eliminated.clear();S.traitors.clear();S.elimReason={};S.usedActionIds.clear();S.history={};
  const me=S.allEmployees.find(e=>e.id===S.youId)||S.allEmployees[0];
  const others=me?shuffle(S.allEmployees.filter(e=>e.id!==me.id),S.rng).slice(0,9):[];
  S.players=[...(me?[me]:[]),...others].map(e=>({id:e.id,name:e.name,department:e.department,role:'Innocent',status:'Alive',influence:defaultInfluence(e.department),behaviour:defaultBehaviour(e.department),avatar:`assets/pngs/${e.id}.png`,avatarSad:`assets/gone/${e.id}-sad.png`,avatarTraitor:`assets/pngs/traitor-revealed.png`}));
  S.players.forEach(p=>{S.alive.add(p.id);S.history[p.id]=[]});
  const ids=S.players.map(p=>p.id).filter(id=>id!==(me&&me.id));
  shuffle(ids,S.rng).slice(0,S.numTraitors).forEach(id=>S.traitors.add(id));
  S.players.forEach(p=>S.suspicion[p.id]=0);
  const actionsEl=document.getElementById('actions'); if(actionsEl) actionsEl.classList.add('is-disabled');
  logLine(`Game started. Traitors assigned. ${S.traitors.size} hidden.`);
  renderTopbar(); renderRoundInfo(); doScenarioPhase();
}
function renderTopbar(){
  const top=document.getElementById('topbar'); if(!top) return;
  top.innerHTML=S.players.map(p=>{
    const dead=S.eliminated.has(p.id);
    const state=dead?(S.traitors.has(p.id)?' eliminated traitor by-traitors':' eliminated innocent by-vote'):'';
    return `<div class="player-card${state}" data-id="${escapeHtml(p.id)}">
      ${S.youId===p.id?'<div class="tag">You</div>':''}
      <img src="${escapeHtml(dead? p.avatarSad : p.avatar)}" alt="${escapeHtml(p.name)}">
      <div class="name">${escapeHtml(p.name)}</div>
      <div class="xmark">✕</div>
      <div class="vote-badge">0</div>
    </div>`;
  }).join('');
}
function renderRoundInfo(){
  const el=document.getElementById('roundInfo'); if(!el) return;
  el.innerHTML=`<h2 class="round-title"><span class="round-label round-pulse">Round</span><span class="round-num round-num-flash">${S.round}</span></h2>
    <div class="note">Alive: ${S.alive.size} · Traitors unknown · Keep your wits about you.</div>
    <div style="margin-top:8px"><button class="btn secondary" id="openLogTop" type="button">Open Game Log</button></div>`;
  const btn=document.getElementById('openLogTop'); if(btn) btn.onclick=openLogModal;
  const lab=el.querySelector('.round-label'); if(lab){lab.classList.remove('round-pulse');void lab.offsetWidth;lab.classList.add('round-pulse')}
  const num=el.querySelector('.round-num'); if(num){num.classList.remove('round-num-flash');void num.offsetWidth;num.classList.add('round-num-flash')}
}
function checkEnd(){
  const alive=[...S.alive].map(id=>S.players.find(p=>p.id===id)).filter(Boolean);
  const t=alive.filter(p=>S.traitors.has(p.id)).length;
  if(!S.youId||!S.alive.has(S.youId)){revealTraitors();announce('You were eliminated. Traitors win.');return true}
  if(t===0){revealTraitors();announce('All traitors eliminated. You win!');return true}
  if(t>=(alive.length - t)){revealTraitors();announce('Traitors took control. You lose.');return true}
  return false;
}

/* ===== Scenario Phase ===== */
function normalizeScenario(s){return s} // compat guard, real normalize used in loadData
function doScenarioPhase(){
  const box=document.getElementById('scenario'); if(!box) return;
  const sc=S.scenarios.length? S.scenarios[Math.floor(S.rnd?S.rnd():S.rng()*S.scenarios.length)] : S.scenarios[Math.floor(S.rng()*S.scenarios.length)];
  if(!sc){box.innerHTML='<h2>Scenario</h2><div class="note">No scenarios available.</div>';return;}
  box.innerHTML=`<h2>Scenario</h2>
    <div>${escapeHtml(sc.prompt)}</div>
    ${sc.options.map((opt,i)=>`<label class="option"><input type="radio" name="scopt" value="${String.fromCharCode(65+i)}"><strong>${String.fromCharCode(65+i)}.</strong> ${escapeHtml(opt)}</label>`).join('')}
    <div class="footer" style="display:flex;justify-content:flex-end;align-items:center;margin-top:8px">
      <button id="answerBtn" class="btn">Submit</button>
    </div>`;
  const submit=document.getElementById('answerBtn');
  submit.onclick=()=>{
    if(submit.disabled) return;
    const sel=document.querySelector('input[name="scopt"]:checked');
    if(!sel){ submit.classList.add('shake'); setTimeout(()=>submit.classList.remove('shake'),300); return; }
    submit.disabled=true; submit.textContent='Submitted';
    const pick=String(sel.value||'').toUpperCase();
    if(pick===sc.correct){
      logLine('Scenario answered correctly.'); if(S.analysis) logLine('Analysis: '+sc.rationale_correct);
      const actions=document.getElementById('actions'); if(actions) actions.classList.remove('is-disabled');
      doActionsPhase();
    }else{
      logLine('Scenario wrong: You picked '+pick+'.'); if(S.analysis) logLine('Analysis: '+sc.rationale_wrong);
      const ov=document.createElement('div'); ov.className='explain-eb explain-overlay';
      ov.innerHTML=`<div class="explain-dialog"><b>Why that’s unsafe</b><p>${escapeHtml(sc.rationale_wrong)}</p><button id="contBtn" class="btn">Continue</button></button></div>`;
      document.body.appendChild(ov);
      document.getElementById('contBtn').onclick=()=>{ ov.remove(); eliminate(S.youId,false,'VotedOut'); renderTopbar(); checkEnd(); };
    }
  };
}

/* ===== Daily Activity ===== */
function chooseActionFor(id,rng){
  const p=S.players.find(x=>x.id===id); const d=DIFF[S.difficulty]; const isT=S.traitors.has(id);
  const primary = isT ? (rng()<d.traitor_rate ? 'traitor_sabotage' : (rng()<0.5?'decoy':'safe'))
                      : (rng()<d.innocent_error ? 'risky_innocent' : ((p?.behaviour?.something?0:p?.behaviour?.safe)||0.7)>0.5 ? 'safe':'decoy');
  const order = isT ? [primary,'traitor_sabotage','decoy','safe','risky_innocent','red_herring']
                    : [primary,'safe','decoy','risky_innocent','red_herring'];
  const recent=new Set(S.history[id]?.slice(-S.long?0:S.long||S.historyWindow));
  for(const b of order){
    const list=S.actions.filter(a=>a&&a.bucket===b && !S.usedActionIds.has(a.id) && !recent.has(a.id));
    const candidates=list.length?list:S.actions.filter(a=>a&&a.bucket===b&&!S.usedActionIds.has(a.id));
    if(!candidates.length) continue;
    const weights=candidates.map(a=>{let w=1; if((a.risk_level|0)===0 && b==='safe') w+=.2; if(((a?.departments_hint||'')+'').toLowerCase().split(',').map(s=>s.trim()).includes((p?.department||'').toLowerCase())) w+=1.25; return w;});
    const act=weightedPick(candidates,weights,rng);
    return {act,usedBucket:b, fallback: act&&!list.includes(act)};
  }
  return {act:{id:'_',description:'…did some uneventful work.',risk_level:0,actually_suspicious:false},usedBucket:'safe',fallback:true};
}
function doActionsPhase(){
  const actions=document.getElementById('actions'); if(actions) actions.classList.remove('is-disabled');
  const items=[];
  for(const id of [...S.alive]){
    if(id===S.youId) continue;
    const pick=chooseActionFor(id,S.rng); const a=pick.act||{};
    if(a.id) S.usedActionIds.add(a.id);
    const hist=S.history[id]||(S.history[id]=[]); if(a.id){hist.push(a.id); if(hist.length>S.historyWindow) hist.shift();}
    const d=DIFF[S.difficulty]; const risk=Number.isFinite(a.risk_level)?a.risk_level:0; const sus=!!a.actually_suspicious;
    S.suspicion[id]=Math.max(0,(S.suspicion[id]||0)+ (risk*0.8)+(sus?1.2:0)*d.clarity);
    items.push({id,txt:a.description||'',risk,sus,fallback:pick.fallback});
  }
  const host=document.getElementById('actions');
  host.innerHTML=`<h2>Daily Activity</h2>
    <div class="actions-list">
      ${items.map(x=>{
        const cls=S.analysis?('r'+x.risk):'neutral';
        const hint=S.analysis?`<div class="note">${x.sus?'Looks truly risky.':(x.risk>0?'May look risky but could be benign.':'Safe.')} ${x.fallback?'· (pool fallback used)':''}</div>`:'';
        return `<div class="action-item ${cls}"><strong>${escapeHtml(nameOf(x.id))}</strong>: ${escapeHtml(x.txt)} ${hint}</div>`;
      }).join('')}
    </div>
    <div class="note" style="margin-top:8px">New round: review behaviours, then vote.</div>`;
  renderVotePanel();
}

/* =======================
   Voting
   ======================= */
function doVotingPhase(){
  const voting = document.getElementById('voting');
  if (!voting) return;

  // Build the voting panel
  voting.innerHTML = `
    <h2>Voting</h2>
    <div class="note">Click a player card to cast your vote. Then watch the votes roll in.</div>
    <div class="tally" id="tally"></div>
    <div id="voteFeed" class="note"></div>
  `;

  // Ensure each player card has a vote bubble & bind click
  document.querySelectorAll('#topbar .player-card').forEach(card => {
    const id = card.getAttribute('data-id');
    if (!id) return;

    let bubble = card.querySelector('.vote-bubble');
    if (!bubble) {
      bubble = document.createElement('div');
      bubble.className = 'vote-bubble';
      card.appendChild(bubble);
    }
    bubble.textContent = '0';

    if (S.alive.has(id) && id !== S.youId) {
      card.style.cursor = 'pointer';
      card.onclick = () => handlePlayerVote(id);
    } else {
      card.onclick = null;
      card.style.cursor = 'default';
    }
  });
}

function renderTline(tally){
  const t = document.getElementById('tally');
  if (!t) return;
  const entries = Object.entries(tally).sort((a,b) => b[1] - a[1]);
  t.innerHTML = entries.map(([id, v]) => `<span class="pill">${escapeHtml(nameOf(id))}: ${v}</span>`).join('');
  // update bubbles on the topbar
  document.querySelectorAll('#topbar .page||.player-card, #topbar .player-card').forEach(card => {
    const pid = card.getAttribute('data-id');
    const vb = card.querySelector('.vote-bubble');
    if (vb){
      const val = tally[pid] || 0;
      vb.textContent = String(val);
      card.classList.toggle('voting', !!val);
    }
  });
}

function renderTally(tally){
  // kept for compatibility with your existing code
  renderTline(tally);
}

function handlePlayerVote(targetId){
  // Reset existing vote bubbles and feed
  document.querySelectorAll('#topbar .vote-bubble').forEach(b => b.textContent = '0');
  const feed = document.getElementById('voteFeed');
  if (feed) feed.innerHTML = '';

  const tally = {};
  function bump(id, who){
    tally[id] = (tally[id] || 0) + 1;
    renderTline(tally);
    if (feed) {
      feed.innerHTML += `• ${escapeHtml(who)} voted ${escapeHtml(nameOf(id))}<br>`;
      feed.scrollTop = feed.scrollHeight;
    }
  }

  // Player votes first
  bump(targetId, 'You');

  const cfg       = DIFF[S.difficulty] || DIFF.Medium;
  const alive     = [...S.alive];
  const voters    = alive.filter(id => id !== S.youId);
  const candidates= alive.filter(id => id !== S.youId);
  const planned   = [];

  // Hint mode on Easy/Medium: exactly one traitor must vote for you; no others can pile on
  let forcedTraitor = null;
  if (S.youId && (S.difficulty === 'Easy' || S.difficulty === 'Medium')) {
    const traitorsAlive = voters.filter(id => S.traitors.has(id));
    if (traitorsAlive.length) {
      forcedTraitor = traitorsAlive[Math.floor(S.rng() * traitorsAlive length)];
      planned.push({ who: forcedTraitor, vote: S.youId, forced: true });
    }
  }

  // Plan AI votes
  voters.forEach(id => {
    if (id === forcedTraitor) return; // already planned

    const p = S.players.find(x => x.id === id) || {};
    const order = candidates
      .filter(x => x !== id)
      .sort((a, b) => (S.suspicion[b] || 0) - (S.suspicion[a] || 0));
    const base = order[0] ?? targetId;

    // Decide whether they follow your vote or their top suspect
    const follow = S.rng() < (p.influence ?? 0.5) * cfg.influence;
    let vote = follow ? targetId : (order.length ? order[0] : base);

    // On Easy/Medium, prevent *extra* votes on you (only the one forced traitor should vote you)
    if ((S.difficulty === 'Easy' || S.difficulty === 'Medium') && vote === S.youId) {
      if (id !== forcedTraitor) {
        const alt = order.find(x => x !== S.youId) || base;
        vote = alt;
      }
    }

    planned.push({ who: id, vote });
  });

  // Play out the voting animation
  let i = 0;
  (function step(){
    if (i < planned.length){
      const { who, vote } = planned[i++];
      bump(vote, nameOf(who));
      setTimeout(step, 550);
      return;
    }

    // Decide elimination (with tie-breaking by higher suspicion)
    let maxVotes = -1, eliminated = null;
    Object.entries(tally).forEach(([id, v]) => {
      if (v > maxVotes){ maxVotes = v; eliminated = id; }
      else if (v === maxVotes){
        if ((S.suspicion[id] || 0) > (S.suspicion[eliminated] || 0)) {
          eliminated = id;
        }
      }
    });
    const tie = Object.values(tally).filter(v => v === maxVotes).length > 1;

    // Grey out Daily Activity until the next scenario is answered
    const actionsEl = document.getElementById('actions');
    if (actionsEl) actionsEl.classList.add('is-disabled');

    const isTraitor = S.traitors.has(eliminated);
    eliminate(eliminated, isTraitor, 'VotedOut');
    renderAll();
    if (tie) logLine(`a deciding vote chose ${nameOf(eliminated)}.`);
    logLine(`Eliminated: ${nameOf(eliminated)} (${isTraitor ? 'Traitor' : 'Innocent'}).`);

    if (!isTraitor){
      // Night strike, then next round
      const pool = [...S.alive].filter(id => id !== S.youId && !S.traitors.has(id));
      if (pool.length){
        // Choose high-influence or high-suspicion target
        pool.sort((a,b)=>{
          const pa = S.players.find(p=>p.id===a), pb = S.players.find(p=>p.id===b);
          const sa = S.chase?0:(S.suspicion[a]||0), sb = S.chase?0:(S.suspicion[b]||0);
          return (pb?.influence ?? 0) - (pa?.influence ?? 0) || (sa - sb);
        });
        const struck = pool[0];
        setTimeout(()=>{
          eliminate(struck, false, 'NightStrike');
          renderAll();
          logLine(`Night strike: ${nameOf(struck)} was eliminated by traitors.`);
          if(!checkEnd()){
            S.round += 1;
            renderRoundInfo();     // pulses round header + flashes number; keeps #actions greyed
            doScenarioPhase();     // shows next scenario; #actions stays grey until answer
          }
        }, 600);
        return;
      }
    }

    // No night strike -> advance round immediately
    if (!checkEnd()){
      S.round += 1;
      renderRoundInfo();           // pulses round header + flashes number
      doScenarioPhase();           // shows next scenario; #actions stays grey until answer
    }
  })();
}
