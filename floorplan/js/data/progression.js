// Permanent upgrades bought with Ink. Each level applies at the start of every run.
export const UPGRADES = [
  { id: 'stamina', name: 'Stamina', icon: '👣', max: 5, costs: [8, 14, 22, 32, 45], text: (n) => `Start with +${n} Step${n === 1 ? '' : 's'}.`,
    start: (s, n) => { s.res.steps += n; } },
  { id: 'pockets', name: 'Deep Pockets', icon: '💎', max: 3, costs: [12, 22, 36], text: (n) => `Start with +${n} Gem${n === 1 ? '' : 's'}.`,
    start: (s, n) => { s.res.gems += n; } },
  { id: 'dice', name: 'Loaded Dice', icon: '🎲', max: 3, costs: [10, 20, 34], text: (n) => `Start with +${n} Reroll${n === 1 ? '' : 's'}.`,
    start: (s, n) => { s.res.rerolls += n; } },
  { id: 'sight', name: 'Foresight', icon: '👁️', max: 3, costs: [14, 26, 40], text: (n) => `Your first ${2 * n} drafts show +1 card.`,
    start: (s, n) => { s.buffs.extraDraw += 2 * n; } },
  { id: 'keyring', name: 'Keyring', icon: '🗝️', max: 2, costs: [12, 28], text: (n) => `Start with +${n} Key${n === 1 ? '' : 's'}.`,
    start: (s, n) => { s.res.keys += n; } },
  { id: 'purse', name: 'Purse', icon: '🪙', max: 3, costs: [6, 12, 20], text: (n) => `Start with +${3 * n} Coins.`,
    start: (s, n) => { s.res.coins += 3 * n; } },
  { id: 'secondwind', name: 'Second Wind', icon: '🫁', max: 2, costs: [25, 50], text: (n) => `The first ${n === 1 ? 'time' : `${n} times`} you run out of Steps, recover 4.`,
    start: (s, n) => { s.counters.secondWind = n; } },
  { id: 'table', name: 'Drafting Table', icon: '📐', max: 3, costs: [15, 30, 50], text: (n) => `+${n} Blueprint slot${n === 1 ? '' : 's'} (start with ${BASE_SLOTS + n}).` },
];
export const BASE_SLOTS = 3;
export const upgradeById = (id) => UPGRADES.find((u) => u.id === id);
