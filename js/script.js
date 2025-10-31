// Seeded RNG + helpers
function mulberry32(a){return function(){var t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;}}
function seededShuffle(arr,rng){const a=arr.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function pickRandom(arr,rng){return arr[Math.floor(rng()*arr.length)];}
function weightedPick(items, weights, rng){
  const sum = weights.reduce((a,b)=>a+b,0) || 1;
  let r = rng()*sum;
  for (let i=0;i<items.length;i++){ r-=weights[i]; if(r<=0) return items[i]; }
  return items[items.length-1];
}

const DIFF={Easy:{innocent_error:.04,traitor_rate:.50,influence_scale:.7,vote_noise:.05,pattern_clarity:1.0},Medium:{innocent_error:.12,traitor_rate:.40,influence_scale:.5,vote_noise:.12,pattern_clarity:.7},Hard:{innocent_error:.20,traitor_rate:.30,influence_scale:.3,vote_noise:.18,pattern_clarity:.5}};

function defaultInfluence(d){const m={"CEO":.75,"CFO":.68,"Exec Assistant":.65,"Project Management":.62,"Consultant":.60,"Finance":.56,"HR":.56,"Legal":.56,"Design":.52,"Content":.52,"Motion":.52,"Ops":.54,"Marketing":.54,"Business Development":.54,"IT":.58};return m[d]??.55;}
function defaultBehaviour(d){const b={safe:.7,risky:.2,decoy:.1};if(d==="Finance")return{safe:.6,risky:.3,decoy:.1};if(d==="Design"||d==="Content"||d==="Motion")return{safe:.65,risky:.2,decoy:.15};if(d==="Project Management")return{safe:.62,risky:.25,decoy:.13};return b;}

const S={
  allEmployees:[],actions:[],scenarios:[],elimMsgs:{},
  players:[],round:0,rng:Math.random,youId:null,traitors:new Set(),
  analysis:true,difficulty:"Medium",numTraitors:3,
  log:[], suspicion:{}, alive:new Set(), eliminated:new Set(), elimReason:{},
  // NEW: anti-repetition state
  usedActionIds: new Set(),           // per-round uniqueness
  history: {},                        // id -> recent action ids
  historyWindow: 3                    // cooldown length
};

async function loadData(){
  const [emps,acts,scens,elim]=await Promise.all([
    fetch('data/employees.json').then(r=>r.json()),
    fetch('data/actions.json').then(r=>r.json()),
    fetch('data/scenarios.json').then(r=>r.json()),
    fetch('data/elimination_msgs.json').then(r=>r.json()),
  ]);
  S.allEmployees=emps; S.actions=acts; S.scenarios=scens; S.elimMsgs=elim;

  // validate buckets
  const VALID=new Set(["safe","risky_innocent","traitor_sabotage","decoy","red_herring"]);
  const bad=S.actions.filter(a=>!VALID.has(a.bucket));
  if(bad.length) logLine(`Data warning: unknown action buckets -> ${bad.map(b=>b.id).join(', ')}`);

  populatePlayerSelect(emps);
}

function populatePlayerSelect(emps){
  const sel=document.getElementById('playerSelect');
  sel.innerHTML=emps.map(e=>`<option value="${e.id}">${e.name} — ${e.department}</option>`).join('');
}

function startGame(){
  S.log=[]; S.round=1; S.players=[]; S.suspicion={};
  S.alive=new Set(); S.eliminated=new Set(); S.traitors=new Set(); S.elimReason={};
  S.usedActionIds = new Set(); S.history = {};  // reset anti-repetition

  const you=S.allEmployees.find(e=>e.id===S.youId);
  const others=seededShuffle(S.allEmployees.filter(e=>e.id!==S.youId), S.rng).slice(0,9);
  const roster=[you, ...others];

  S.players=roster.map(e=>({
    id:e.id, name:e.name, department:e.department,
    influence:defaultInfluence(e.department), behaviour:defaultBehaviour(e.department),
    role:"Innocent", status:"Alive",
    avatar:`assets/pngs/${e.id}.png`, avatarSad:`assets/avatars/${e.id}-sad.svg`,
  }));
  S.players.forEach(p=>{ S.alive.add(p.id); S.history[p.id]=[]; });

  // Assign traitors among bots (exclude you)
  const botIds=S.players.map(p=>p.id).filter(id=>id!==S.youId);
  seededShuffle(botIds, S.rng).slice(0, S.numTraitors).forEach(id=>S.traitors.add(id));
  S.players.forEach(p=>{ if(S.traitors.has(p.id)) p.role="Traitor"; });

  S.players.forEach(p=>S.suspicion[p.id]=0);

  logLine(`Game started. Traitors assigned. Difficulty: ${S.difficulty}.`);
  renderAll();
  nextRound();
}

function nextRound(){
  if(checkEnd()) return;
  // NEW: new round → clear per-round uniqueness and add light decay
  S.usedActionIds.clear();
  Object.keys(S.suspicion).forEach(id=> S.suspicion[id] = (S.suspicion[id]||0) * 0.9);

  renderRoundInfo();
  doScenarioPhase();
}

function checkEnd(){
  const alivePlayers=[...S.alive].map(id=>S.players.find(p=>p.id===id));
  const aliveTraitors=alivePlayers.filter(p=>S.traitors.has(p.id)).length;
  if(!S.alive.has(S.youId)){ announce(`You were eliminated. Traitors win.`); return true; }
  if(aliveTraitors===0){ announce(`All traitors eliminated. You win!`); return true; }
  if(aliveTraitors >= (alivePlayers.length - aliveTraitors)){ announce(`Traitors took control. You lose.`); return true; }
  return false;
}

function doScenarioPhase(){
  const container=document.getElementById('scenario');
  const sc=S.scenarios[Math.floor(S.rng()*S.scenarios.length)];
  container.innerHTML=`<h2>Scenario</h2>
    <div>${sc.prompt}</div>
    ${sc.options.map((opt,i)=>`<label class="option"><input type="radio" name="scopt" value="${String.fromCharCode(65+i)}"> <strong>${String.fromCharCode(65+i)}.</strong> ${opt}</label>`).join('')}
    <div class="footer" style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
      <button id="openLog" class="btn secondary" type="button">Game Log</button>
      <button id="answerBtn" class="btn">Submit</button>
    </div>`;
  document.getElementById('openLog').onclick=openLogModal;
  document.getElementById('answerBtn').onclick=()=>{
    const sel=document.querySelector('input[name=scopt]:checked'); if(!sel) return;
    const pick=sel.value;
    if(pick===sc.correct){
      logLine(`Scenario answered correctly.`);
      if(S.analysis){ logLine(`Analysis: ${sc.rationale_correct}`); }
      doActionsPhase();
    }else{
      logLine(`Scenario wrong: You picked ${pick}.`);
      if(S.analysis){ logLine(`Analysis: ${sc.rationale_wrong}`); }
      eliminate(S.youId,false,"VotedOut");
      renderAll(); checkEnd();
    }
  };
}

// ---------- Action generation with variety ----------
function poolBy(bucket){ return S.actions.filter(a=>a.bucket===bucket); }
function deptMatches(action, dept){
  if(!action.departments_hint) return false;
  // action.departments_hint may be "A, B"
  return action.departments_hint.split(',').map(s=>s.trim().toLowerCase()).includes(dept.toLowerCase());
}

function chooseActionFor(playerId, rng){
  const p=S.players.find(x=>x.id===playerId);
  const isTraitor=S.traitors.has(playerId);
  const d=DIFF[S.difficulty];

  // Primary bucket choice
  let candidates=[];
  if(isTraitor){
    const sabotage = rng() < d.traitor_rate;
    candidates = [ sabotage ? "traitor_sabotage" : (rng()<0.5 ? "decoy" : "safe") ];
  }else{
    const err = rng() < d.innocent_error;
    candidates = [ err ? "risky_innocent" : (rng()<p.behaviour.safe ? "safe" : "decoy") ];
  }

  // Fallback order ensures result even with tiny data
  const fallback = isTraitor
    ? ["traitor_sabotage","decoy","safe","risky_innocent","red_herring"]
    : ["safe","decoy","risky_innocent","red_herring","traitor_sabotage"];
  const tryOrder=[...candidates, ...fallback.filter(b=>!candidates.includes(b))];

  // Filter helpers
  const recent = new Set(S.history[playerId].slice(-S.historyWindow));
  function poolFilter(bucket){
    const pool = poolBy(bucket).filter(a=>!S.usedActionIds.has(a.id) && !recent.has(a.id));
    if(pool.length) return pool;
    // allow department-weighted even if recently used is blocking too much
    return poolBy(bucket).filter(a=>!S.usedActionIds.has(a.id)) || [];
  }

  for(const b of tryOrder){
    let pool = poolFilter(b);
    if(pool.length){
      // Department weighting to diversify descriptions
      const weights = pool.map(a=>{
        let w = 1;
        if(deptMatches(a, p.department)) w += 1.25; // prefer dept-adjacent
        if(a.risk_level===0 && b==="safe") w += 0.2; // slight spread among safes
        return w;
      });
      const act = weightedPick(pool, weights, rng);
      return { act, usedBucket:b, fellBack:(b!==candidates[0]) };
    }
  }

  // Last resort
  return { act:{ id:"_stub", description:"…did some uneventful work.", risk_level:0, actually_suspicious:false }, usedBucket:"safe", fellBack:true };
}

function doActionsPhase(){
  const aliveIds=[...S.alive];
  const items=[];

  aliveIds.filter(id=>id!==S.youId).forEach(id=>{
    const { act, usedBucket, fellBack } = chooseActionFor(id, S.rng);

    // Track anti-repetition
    if(act.id) S.usedActionIds.add(act.id);
    const h = S.history[id] || (S.history[id]=[]);
    h.push(act.id || "_stub"); if(h.length > S.historyWindow) h.shift();

    // Suspicion update
    const add=act.risk_level*0.8 + (act.actually_suspicious?1.2:0)*DIFF[S.difficulty].pattern_clarity;
    S.suspicion[id]=Math.max(0,(S.suspicion[id]||0)*0.75 + add);

    items.push({ player:id, text:act.description, risk:act.risk_level, suspicious:!!act.actually_suspicious, usedBucket, fellBack });
  });

  const actionsDiv=document.getElementById('actions');
  actionsDiv.innerHTML=`<h2>Daily Activity</h2>
    <div class="actions-list">
      ${items.map(a=>{
        const cls = S.analysis ? `r${a.risk}` : 'neutral';
        const hint = S.analysis ? `<div class="note">${a.suspicious?'Looks truly risky.':(a.risk>0?'May look risky but could be benign.':'Safe.')}${a.fellBack?' · (pool fallback used)':''}</div>` : '';
        return `<div class="action-item ${cls}"><strong>${nameOf(a.player)}</strong>: ${a.text} ${hint}</div>`;
      }).join('')}
    </div>
    <div class="note" style="margin-top:8px">Variety mode is on: actions won’t repeat in the same round and have a short cooldown per player.</div>`;
  doVotingPhase();
}

// ---------- Voting (unchanged except RNG normalization) ----------
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
  const t=document.getElementById('tally'); const entries=Object.entries(tally).sort((a,b)=>b[1]-a[1]);
  t.innerHTML=entries.map(([id,v])=>`<span class="pill">${nameOf(id)}: ${v}</span>`).join('');
  S.players.forEach(p=>{
    const card=document.querySelector(`.player-card[data-id="${p.id}"]`);
    if(!card) return; const vb=card.querySelector('.vote-bubble'); if(!vb) return;
    const val=tally[p.id]||0; vb.textContent=val; card.classList.toggle('voting', val>0);
  });
}

function handlePlayerVote(targetId){
  document.querySelectorAll('.vote-bubble').forEach(v=>v.textContent='0');
  const feed=document.getElementById('voteFeed'); feed.innerHTML='';
  const tally={};
  function addVote(id, who){ tally[id]=(tally[id]||0)+1; renderTally(tally); feed.innerHTML+=`• ${who} voted ${nameOf(id)}<br>`; feed.scrollTop=feed.scrollHeight; }
  addVote(targetId, "You");

  const diff=DIFF[S.difficulty];
  const aliveIds=[...S.alive];
  const voters=aliveIds.filter(id=>id!==S.youId);
  const candidates=aliveIds.filter(id=>id!==S.youId);
  const planned=[];

  voters.forEach(id=>{
    const p=S.players.find(x=>x.id===id);
    const sorted=candidates.filter(x=>x!==id).sort((a,b)=>(S.suspicion[b]||0)-(S.suspicion[a]||0));
    const baseTarget=sorted[0]??targetId;
    const follow = S.rng() < (p.influence * diff.influence_scale);
    let vote;
    if(follow) vote=targetId;
    else {
      if(S.rng() < diff.vote_noise){
        vote = sorted[Math.floor(S.rng()*Math.max(1,sorted.length))] || baseTarget;
      } else {
        vote = baseTarget;
      }
    }
    planned.push({who:id, vote});
  });

  let i=0;
  (function step(){
    if(i<planned.length){
      const {who, vote}=planned[i++]; addVote(vote, nameOf(who)); setTimeout(step, 550);
    }else{
      let maxVotes=-1, eliminated=null;
      Object.entries(tally).forEach(([id,v])=>{
        if(v>maxVotes){ maxVotes=v; eliminated=id; }
        else if(v===maxVotes){
          if((S.suspicion[id]||0)>(S.suspicion[eliminated]||0)) eliminated=id;
        }
      });
      const isTraitor=S.traitors.has(eliminated);
      eliminate(eliminated, isTraitor, "VotedOut");
      renderAll();
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
            eliminate(struck, false, "NightStrike");
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

function eliminate(id, wasTraitorFlag, reason){
  if(!S.alive.has(id)) return;
  S.alive.delete(id); S.eliminated.add(id); S.elimReason[id]=reason;
  const p=S.players.find(x=>x.id===id); p.status="Eliminated";
  const card=document.querySelector(`.player-card[data-id="${id}"]`);
  if(card){
    card.classList.add('eliminated');
    card.classList.toggle('traitor', S.traitors.has(id));
    card.classList.toggle('innocent', !S.traitors.has(id));
    card.classList.remove('by-vote','by-traitors');
    card.classList.add(reason==="NightStrike" ? 'by-traitors' : 'by-vote');
    const img=card.querySelector('img'); if(img) img.src=p.avatarSad;
    const x=card.querySelector('.xmark'); if(x) x.textContent='✕';
  }
  const msg=S.elimMsgs[p.department] || `${p.department} in turmoil.`;
  if(reason==="NightStrike") logLine(`${msg}`);
}

function nameOf(id){ return S.players.find(p=>p.id===id)?.name || id; }

function renderRoundInfo(){
  const el=document.getElementById('roundInfo');
  el.innerHTML=`<h2>Round ${S.round}</h2>
    <div class="note">Alive: ${S.alive.size} · Traitors unknown · Keep your wits about you.</div>
    <div style="margin-top:8px"><button class="btn secondary" id="openLogTop" type="button">Open Game Log</button></div>`;
  document.getElementById('openLogTop').onclick=openLogModal;
}

function renderTopbar(){
  const top=document.getElementById('topbar');
  top.innerHTML=S.players.map(p=>{
    const cls=['player-card'];
    if(S.eliminated.has(p.id)) cls.push('eliminated');
    if(S.eliminated.has(p.id)){
      cls.push(S.traitors.has(p.id)?'traitor':'innocent');
      cls.push(S.elimReason[p.id]==="NightStrike"?'by-traitors':'by-vote');
    }
    const tag=p.id===S.youId?`<div class="tag">You</div>`:'';
    const img=S.eliminated.has(p.id)?p.avatarSad:p.avatar;
    return `<div class="${cls.join(' ')}" data-id="${p.id}">
      ${tag}
      <img src="${img}" alt="${p.name} avatar">
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
  body.innerHTML=S.log.map(x=>`• ${x}`).join('<br>');
  modal.classList.add('open');
}
document.getElementById('closeLog').onclick=()=>document.getElementById('logModal').classList.remove('open');

function announce(msg){
  const scenario=document.getElementById('scenario');
  scenario.innerHTML=`<h2>Outcome</h2><div>${msg}</div>
    <div class="footer" style="display:flex;justify-content:flex-end"><button class="btn" onclick="location.reload()">Play Again</button></div>`;
}

function renderAll(){ renderTopbar(); }

document.getElementById('restartBtn').onclick=()=>location.reload();

window.addEventListener('DOMContentLoaded', async ()=>{
  await loadData();
  const startModal=document.getElementById('startModal');
  document.getElementById('startBtn').onclick=()=>{
    const you=document.getElementById('playerSelect').value;
    const diff=document.getElementById('difficulty').value;
    const analysis=document.getElementById('analysisMode').value==='true';
    const numT=parseInt(document.getElementById('numTraitors').value,10)||3;
    const seedStr=document.getElementById('seed').value.trim();
    let seed=0;
    if(seedStr){ seed=0; for(let i=0;i<seedStr.length;i++){ seed=((seed<<5)-seed)+seedStr.charCodeAt(i); seed|=0; } if(seed<0) seed=-seed; }
    else { seed=Math.floor(Math.random()*1e9); }
    S.rng=mulberry32(seed); S.youId=you; S.difficulty=diff; S.analysis=analysis; S.numTraitors=numT;
    startModal.classList.remove('open'); startGame();
  };
  window.addEventListener('keydown', (e)=>{ if(e.key==='Escape'){ document.getElementById('logModal').classList.remove('open'); }});
});
