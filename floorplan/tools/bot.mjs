// A one-ply lookahead bot for balance testing: it simulates every card × rotation and scores the resulting state.
import {
  act, openTargets, goalTarget, goalProgress, gemCost, cellAt, DIRS, vaultConnected,
} from '../js/engine/engine.js';
import { EVENTS } from '../js/data/nights.js';

function approaches(s) {
  const v = cellAt(s, s.vault.r, s.vault.c);
  const out = [];
  for (let d = 0; d < 4; d++) {
    if (!v.doors[d]) continue;
    const r = s.vault.r + DIRS[d][0], c = s.vault.c + DIRS[d][1];
    if (cellAt(s, r, c) === null) out.push({ r, c });
  }
  return out;
}
function distanceMap(s) {
  const goals = approaches(s);
  const dist = new Map();
  const q = [];
  for (const goal of goals) {
    if (cellAt(s, goal.r, goal.c) !== null) continue;
    dist.set(`${goal.r},${goal.c}`, 0);
    q.push(goal);
  }
  if (!q.length) return dist;
  while (q.length) {
    const cur = q.shift();
    const k = dist.get(`${cur.r},${cur.c}`);
    for (const [dr, dc] of DIRS) {
      const r = cur.r + dr, c = cur.c + dc;
      if (cellAt(s, r, c) !== null || dist.has(`${r},${c}`)) continue;
      dist.set(`${r},${c}`, k + 1);
      q.push({ r, c });
    }
  }
  return dist;
}

export function evaluate(s) {
  if (s.phase === 'won') return 1e6;
  if (s.phase === 'lost') return -1e5 + s.nightsCleared * 1000;
  let v = s.nightsCleared * 1000;
  if (s.phase === 'landing' || s.between) return v + 500 + s.res.steps * 2;
  const need = Math.max(0, goalTarget(s) - goalProgress(s));
  let d = 0;
  if (!vaultConnected(s)) {
    const dm = distanceMap(s);
    const ts = openTargets(s).filter((t) => !t.locked || s.res.keys > 0);
    d = Math.min(Infinity, ...ts.map((t) => (dm.get(`${t.r},${t.c}`) ?? Infinity) + 1 + (t.locked ? 1 : 0)));
    if (!Number.isFinite(d)) return v - 3000 + s.res.steps;
  }
  const open = openTargets(s).length;
  v += -7 * d - 4 * need + 1.3 * s.res.steps + 0.8 * s.res.keys + 0.25 * s.res.coins + 0.5 * s.res.rerolls
    - 0.3 * Math.max(0, s.dread - s.dreadNext + 4) + 0.8 * Math.min(open, 4);
  if (s.res.steps < d + need * 0.7) v -= 25 * (d + need * 0.7 - s.res.steps);
  return v;
}

export function botStep(s) {
  switch (s.phase) {
    case 'door': {
      const dm = distanceMap(s);
      const need = Math.max(0, goalTarget(s) - goalProgress(s));
      const ts = openTargets(s).filter((t) => !t.locked || s.res.keys > 0);
      const score = (t) => (dm.get(`${t.r},${t.c}`) ?? 30) + (t.locked ? 1.5 : 0) - (t.mystery ? 0.8 : 0) - (need > 0 && (dm.get(`${t.r},${t.c}`) ?? 30) <= 1 ? -1 : 0);
      ts.sort((a, b) => score(a) - score(b));
      const t = ts[0] || openTargets(s)[0];
      return act(s, { type: 'select', r: t.r, c: t.c });
    }
    case 'card': {
      let best = null, bestV = -Infinity;
      s.pending.offers.forEach((id, i) => {
        if (gemCost(s, id) > s.res.gems) return;
        const s1 = act(s, { type: 'pick', index: i });
        for (const rot of s1.pending.rots) {
          const v = evaluate(act(s1, { type: 'place', rot }));
          if (v > bestV) { bestV = v; best = { i, rot }; }
        }
      });
      if (!best) {
        if (s.res.rerolls > 0) return act(s, { type: 'reroll' });
        return act(act(s, { type: 'pick', index: -1 }), { type: 'place' });
      }
      if (bestV < evaluate(s) - 40 && s.res.rerolls > 0) return act(s, { type: 'reroll' });
      return act(act(s, { type: 'pick', index: best.i }), { type: 'place', rot: best.rot });
    }
    case 'place':
      return act(s, { type: 'place' });
    case 'event': {
      const ev = EVENTS.find((e) => e.id === s.event.id);
      let bi = 0, bv = -Infinity;
      ev.options.forEach((o, i) => {
        if (o.need && !o.need(s)) return;
        const v = evaluate(act(s, { type: 'choose', index: i }));
        if (v > bv) { bv = v; bi = i; }
      });
      return act(s, { type: 'choose', index: bi });
    }
    case 'landing': {
      let bi = 0, bv = -Infinity;
      s.landing.forEach((_, i) => {
        const v = evaluate(act(s, { type: 'land', index: i })) + (s.landing[i] === 'trophy' ? 15 : 0);
        if (v > bv) { bv = v; bi = i; }
      });
      return act(s, { type: 'land', index: bi });
    }
    case 'shop': {
      const need = Math.max(0, goalTarget(s) - goalProgress(s));
      const order = [
        s.res.steps < 6 && 'steps', need > 0 && s.goal.res === 'gems' && 'gems', s.res.keys < 1 && 'keys',
        'heirloom', s.dread > s.dreadNext - 3 && 'calm', 'steps', 'remove', 'rerolls',
      ].filter(Boolean);
      for (const kind of order) {
        const i = s.shop.items.findIndex((it) => it.kind === kind && !it.sold && it.price <= s.res.coins
          && !(s.goal.res === 'coins' && s.res.coins - it.price < goalTarget(s)));
        if (i >= 0) return act(s, { type: 'buy', index: i });
      }
      return act(s, { type: 'leave' });
    }
    case 'heirloom':
      return act(s, { type: 'heirloom', index: 0 });
    case 'discovery':
      return act(s, { type: 'discover', index: 0 });
    default:
      throw new Error(`bot: unexpected phase ${s.phase}`);
  }
}

export function playOut(s, maxSteps = 3000) {
  let n = 0;
  while (s.phase !== 'won' && s.phase !== 'lost' && s.phase !== 'reconstruct') {
    s = botStep(s);
    if (++n > maxSteps) throw new Error('bot: run did not terminate');
  }
  return s;
}
