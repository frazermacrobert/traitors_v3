// Heirlooms: run-long passives. Hooks:
//   drawCount(n,s) gemCost(cost,room,s) shopPrice(p,s) reshufflePenalty(n,s)
//   draftCost(n,s,info) gainAmount(n,s,{res,room}) freeLock(s) -> bool
//   onPlace(ctx) after the room's own effect; onGain(s) once when acquired.

export const MAX_HEIRLOOMS = 5;

export const HEIRLOOMS = {
  spyglass: { id: 'spyglass', name: 'Spyglass', icon: '🔭', text: 'Every draft shows 4 cards.', drawCount: (n) => n + 1 },
  luckydie: { id: 'luckydie', name: 'Lucky Die', icon: '🎲', text: '+2 Rerolls now. +1 Reroll whenever the deck reshuffles.',
    onGain: (s) => { s.res.rerolls += 2; }, onReshuffle: (s) => { s.res.rerolls += 1; } },
  skeleton: { id: 'skeleton', name: 'Skeleton Key', icon: '🗝️', text: 'Your next 2 locked doorways open for free.',
    freeLock: (s) => { const u = s.counters.skeleton || 0; if (u < 2) { s.counters.skeleton = u + 1; return true; } return false; } },
  redledger: { id: 'redledger', name: 'Red Ledger', icon: '📕', text: 'Cursed rooms make you lose 1 fewer Step.',
    gainAmount: (n, s, { res, room }) => (res === 'steps' && n < 0 && room && room.family === 'crimson' ? n + 1 : n) },
  pedometer: { id: 'pedometer', name: 'Pedometer', icon: '⌚', text: 'Corner rooms give +1 Step.',
    onPlace: (c) => { if (c.room.shape === 'L') c.gain('steps', 1); } },
  seedpouch: { id: 'seedpouch', name: 'Seed Pouch', icon: '🌱', text: 'Gardens give +1 Gem.',
    onPlace: (c) => { if (c.room.family === 'green') c.gain('gems', 1); } },
  silvertray: { id: 'silvertray', name: 'Silver Tray', icon: '🍽️', text: 'Shop prices are 1 lower.', shopPrice: (p) => Math.max(0, p - 1) },
  coinpurse: { id: 'coinpurse', name: 'Coin Purse', icon: '👛', text: 'Corridors give +1 Coin.',
    onPlace: (c) => { if (c.room.family === 'amber') c.gain('coins', 1); } },
  compass: { id: 'compass', name: 'Compass', icon: '🧭', text: 'Every 3rd draft northward costs no Step.',
    draftCost: (n, s, info) => {
      if (info.dir !== 0) return n;
      s.counters.compass = (s.counters.compass || 0) + 1;
      return s.counters.compass % 3 === 0 ? 0 : n;
    } },
  pocketwatch: { id: 'pocketwatch', name: 'Pocket Watch', icon: '⏱️', text: '+4 Steps now. Reshuffles cost 1 fewer Step.',
    onGain: (s) => { s.res.steps += 4; }, reshufflePenalty: (n) => Math.max(0, n - 1) },
  blueprintcase: { id: 'blueprintcase', name: 'Blueprint Case', icon: '📐', text: 'Rarities cost 1 fewer Gem.',
    gemCost: (c, room) => (room.family === 'ivory' ? Math.max(0, c - 1) : c) },
  lantern: { id: 'lantern', name: 'Lantern', icon: '🏮', text: 'Dead-end rooms give +1 Step.',
    onPlace: (c) => { if (c.room.shape === 'D') c.gain('steps', 1); } },
  teaset: { id: 'teaset', name: 'Tea Set', icon: '🫖', text: 'Chambers give +1 Step.',
    onPlace: (c) => { if (c.room.family === 'violet') c.gain('steps', 1); } },
  hourglass: { id: 'hourglass', name: 'Hourglass', icon: '⌛', text: 'Every 5th draft costs no Step.',
    draftCost: (n, s) => ((s.drafts + 1) % 5 === 0 ? 0 : n) },
};
