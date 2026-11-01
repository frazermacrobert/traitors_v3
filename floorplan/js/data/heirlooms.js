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
    canFreeLock: (s) => (s.counters.skeleton || 0) < 2,
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
  astrolabe: { id: 'astrolabe', name: 'Astrolabe', icon: '🌌', text: 'The Vault toll is 1 lower.', toll: (t) => t - 1 },
  velvetbag: { id: 'velvetbag', name: 'Velvet Bag', icon: '💰', text: '+1 Coin every time you place a room.', onPlace: (c) => c.gain('coins', 1) },
  quill: { id: 'quill', name: 'Golden Quill', icon: '🪶', text: 'Every 3rd Hall you place gives +1 Reroll.',
    onPlace: (c) => { if (c.room.family === 'blue') { c.s.counters.quill = (c.s.counters.quill || 0) + 1; if (c.s.counters.quill % 3 === 0) c.gain('rerolls', 1); } } },
  horseshoe: { id: 'horseshoe', name: 'Horseshoe', icon: '🧲', text: 'Cursed rooms also give +2 Coins.', onPlace: (c) => { if (c.room.family === 'crimson') c.gain('coins', 2); } },
  almanac: { id: 'almanac', name: "Gardener's Almanac", icon: '📗', text: 'Every Garden Wing you form makes all Gardens give +1 Gem for the rest of the run.',
    onWing: (c, w) => { if (w.family === 'green') c.s.counters.almanac = (c.s.counters.almanac || 0) + 1; },
    onPlace: (c) => { if (c.room.family === 'green' && c.s.counters.almanac) c.gain('gems', c.s.counters.almanac); } },
  omenbook: { id: 'omenbook', name: 'Book of Omens', icon: '📓', text: 'Each time the house acts, gain 2 Gems and 1 Coin.',
    onHouseAct: (s) => { s.res.gems += 2; s.res.coins += 1; } },
  nightcap: { id: 'nightcap', name: 'Nightcap', icon: '🍸', text: 'Clearing a Night grants +2 Steps next Night for every Night cleared so far.',
    onNightClear: (s) => { s.carryBonus += 2 * s.nightsCleared; } },
  compassrose: { id: 'compassrose', name: 'Compass Rose', icon: '🧿', text: 'Wings of any colour also give +1 Step and +1 Coin.',
    onWing: (c) => { c.gain('steps', 1); c.gain('coins', 1); } },
  hourglass: { id: 'hourglass', name: 'Hourglass', icon: '⌛', text: 'Every 5th draft costs no Step.',
    draftCost: (n, s) => ((s.drafts + 1) % 5 === 0 ? 0 : n) },
};
