// Permanent upgrades bought with Ink. Kept deliberately small: progression should widen options, not trivialise runs.
export const UPGRADES = [
  { id: 'stamina', name: 'Stamina', icon: '👣', max: 2, costs: [15, 35], text: (n) => `+${n} Step${n === 1 ? '' : 's'} every Night.`,
    start: (s, n) => { s.stepBonus += n; } },
  { id: 'pockets', name: 'Deep Pockets', icon: '💎', max: 2, costs: [12, 30], text: (n) => `Start with +${n} Gem${n === 1 ? '' : 's'}.`,
    start: (s, n) => { s.res.gems += n; } },
  { id: 'dice', name: 'Loaded Dice', icon: '🎲', max: 2, costs: [12, 30], text: (n) => `Start with +${n} Reroll${n === 1 ? '' : 's'}.`,
    start: (s, n) => { s.res.rerolls += n; } },
  { id: 'sight', name: 'Foresight', icon: '👁️', max: 2, costs: [18, 40], text: (n) => `Your first ${2 * n} drafts show +1 card.`,
    start: (s, n) => { s.buffs.extraDraw += 2 * n; } },
  { id: 'keyring', name: 'Keyring', icon: '🗝️', max: 1, costs: [20], text: () => 'Start with +1 Key.',
    start: (s) => { s.res.keys += 1; } },
  { id: 'purse', name: 'Purse', icon: '🪙', max: 2, costs: [8, 20], text: (n) => `Start with +${3 * n} Coins.`,
    start: (s, n) => { s.res.coins += 3 * n; } },
  { id: 'secondwind', name: 'Second Wind', icon: '🫁', max: 1, costs: [45], text: () => 'Once per run, when you run out of Steps, recover 3.',
    start: (s) => { s.counters.secondWind = 1; } },
  { id: 'table', name: 'Drafting Table', icon: '📐', max: 3, costs: [15, 30, 50], text: (n) => `+${n} Blueprint slot${n === 1 ? '' : 's'} (${BASE_SLOTS + n} total).` },
];
export const BASE_SLOTS = 3;
export const upgradeById = (id) => UPGRADES.find((u) => u.id === id);
