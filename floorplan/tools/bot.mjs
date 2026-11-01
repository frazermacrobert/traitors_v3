// A simple greedy bot used by the balance simulator and tests.
import {
  act, openTargets, vaultToll, vaultConnected, gemCost, validRotations, rotationScore, cellAt, DIRS,
} from '../js/engine/engine.js';
import { ROOMS } from '../js/data/rooms.js';

// BFS distance (through empty cells) from each cell to the cell in front of the vault door.
function distanceMap(s) {
  const v = cellAt(s, s.vault.r, s.vault.c);
  const d = v.doors.findIndex(Boolean);
  const goal = { r: s.vault.r + DIRS[d][0], c: s.vault.c + DIRS[d][1] };
  const dist = new Map([[`${goal.r},${goal.c}`, 0]]);
  const q = [goal];
  while (q.length) {
    const cur = q.shift();
    const k = dist.get(`${cur.r},${cur.c}`);
    for (const [dr, dc] of DIRS) {
      const r = cur.r + dr, c = cur.c + dc;
      const cell = cellAt(s, r, c);
      if (cell === undefined || cell !== null || dist.has(`${r},${c}`)) continue;
      dist.set(`${r},${c}`, k + 1);
      q.push({ r, c });
    }
  }
  return dist;
}

export function botStep(s) {
  switch (s.phase) {
    case 'door': {
      const dm = distanceMap(s);
      const ts = openTargets(s).filter((t) => !t.locked || s.res.keys > 0);
      ts.sort((a, b) => (dm.get(`${a.r},${a.c}`) ?? 99) + (a.locked ? 1.5 : 0) - ((dm.get(`${b.r},${b.c}`) ?? 99) + (b.locked ? 1.5 : 0)));
      const t = ts[0] || openTargets(s)[0];
      return act(s, { type: 'select', r: t.r, c: t.c });
    }
    case 'card': {
      const p = s.pending;
      let best = -1, bestV = -Infinity;
      p.offers.forEach((id, i) => {
        if (gemCost(s, id) > s.res.gems) return;
        const room = ROOMS[id];
        const rots = validRotations(s, id, p);
        let v = Math.max(...rots.map((r) => rotationScore(s, id, p, r))) * 2;
        if (room.family === 'violet') v += s.res.steps < 8 ? 4 : 1.5;
        const need = vaultToll(s) - s.res.gems + gemCost(s, id);
        if (room.family === 'green' || id === 'winecellar' || id === 'boarded') v += need > 0 ? (vaultConnected(s) ? 6 : 2) : 0.5;
        if (room.family === 'gold') v += 0.5;
        if (need > 0 && gemCost(s, id) > 0 && room.family !== 'green') v -= 2;
        if (room.family === 'ivory') v += 1.5;
        if (['furnace', 'winecellar', 'rubble'].includes(id)) v -= s.res.steps < 6 ? 4 : 1;
        if (v > bestV) { bestV = v; best = i; }
      });
      if (best === -1) {
        if (s.res.rerolls > 0) return act(s, { type: 'reroll' });
        return act(s, { type: 'pick', index: -1 });
      }
      if (bestV < 1 && s.res.rerolls > 0 && p.offers.length) return act(s, { type: 'reroll' });
      return act(s, { type: 'pick', index: best });
    }
    case 'place':
      return act(s, { type: 'place' });
    case 'shop': {
      const order = s.res.gems < vaultToll(s) ? ['gems', 'steps', 'keys', 'heirloom'] : ['steps', 'keys', 'heirloom', 'remove', 'gems', 'rerolls'];
      for (const kind of order) {
        const i = s.shop.items.findIndex((it) => it.kind === kind && !it.sold && it.price <= s.res.coins && (kind !== 'keys' || s.res.keys < 2));
        if (i >= 0) return act(s, { type: 'buy', index: i });
      }
      return act(s, { type: 'leave' });
    }
    case 'heirloom':
      return act(s, { type: 'heirloom', index: 0 });
    default:
      throw new Error(`bot: unexpected phase ${s.phase}`);
  }
}

export function playOut(s, maxSteps = 2000) {
  let n = 0;
  while (s.phase !== 'won' && s.phase !== 'lost') {
    s = botStep(s);
    if (++n > maxSteps) throw new Error('bot: run did not terminate');
  }
  return s;
}
