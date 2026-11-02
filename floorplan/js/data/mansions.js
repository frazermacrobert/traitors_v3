// Mansions are difficulty tiers. Each run is 3 Nights; every Night's floor is generated from the seed.
// Row 0 is the far end of the floor.

// goals: per Night, the kind of goal and its base amount. 'toll' = hold N of a resource when you reach the stairs/Vault.
// 'wing' = have a Wing of N connected rooms of one family when you reach the stairs.
export const MANSIONS = [
  {
    id: 'm1', name: 'Hollow House', blurb: 'Three quiet floors. The house is only half awake.',
    w: 5, h: 7, nightSteps: [13, 12, 12], blocks: [1, 2, 3], mystery: [2, 2, 2], lockedCells: [0, 0, 1],
    lockChance: [0.04, 0.07, 0.1], dreadEvery: [8, 7, 7], omenTier: [1, 1, 2], discoveries: [1, 1, 0],
    goals: [{ kind: 'toll', res: 'gems', n: 3 }, { kind: 'toll', res: 'gems', n: 5 }, { kind: 'toll', res: 'gems', n: 8 }],
  },
  {
    id: 'm2', name: 'Crooked House', blurb: 'Rubble, odd angles, and a Steward who wants paying.',
    w: 5, h: 8, nightSteps: [13, 13, 12], blocks: [2, 3, 4], mystery: [2, 2, 3], lockedCells: [0, 1, 1],
    lockChance: [0.06, 0.09, 0.11], dreadEvery: [8, 7, 7], omenTier: [1, 2, 2], discoveries: [1, 1, 1],
    goals: [{ kind: 'toll', res: 'gems', n: 4 }, { kind: 'toll', res: 'coins', n: 8 }, { kind: 'toll', res: 'gems', n: 8 }],
  },
  {
    id: 'm3', name: 'Locked Wing', blurb: 'Keys matter here. So does the shape of what you build.',
    w: 5, h: 8, nightSteps: [14, 14, 13], blocks: [2, 3, 4], mystery: [2, 3, 3], lockedCells: [1, 1, 2],
    lockChance: [0.08, 0.1, 0.12], dreadEvery: [8, 7, 7], omenTier: [2, 2, 3], discoveries: [1, 1, 1],
    goals: [{ kind: 'wing', n: 3 }, { kind: 'toll', res: 'keys', n: 2 }, { kind: 'toll', res: 'gems', n: 9 }],
  },
  {
    id: 'm4', name: 'Flooded Manor', blurb: 'Wide, wet and wide awake.',
    w: 6, h: 9, nightSteps: [15, 15, 14], blocks: [4, 5, 7], mystery: [3, 3, 3], lockedCells: [1, 1, 2],
    lockChance: [0.08, 0.1, 0.12], dreadEvery: [8, 7, 6], omenTier: [2, 3, 3], discoveries: [1, 1, 1],
    goals: [{ kind: 'wing', n: 3 }, { kind: 'toll', res: 'coins', n: 10 }, { kind: 'toll', res: 'gems', n: 10 }],
  },
];

// Deeds: cumulative handicaps. Deed N applies levels 1..N.
export const DEEDS = [
  null,
  { level: 1, text: 'The house acts 1 Dread sooner.', dreadEvery: (n) => n - 1 },
  { level: 2, text: '1 fewer Step every Night.', nightSteps: (n) => n - 1 },
  { level: 3, text: 'A Rubble Heap joins your deck.', start: (s) => { s.deck.push('rubble'); } },
  { level: 4, text: 'Shop prices are 1 higher.', shopPrice: (p) => p + 1 },
  { level: 5, text: 'Omens are one tier nastier.', omenTier: (n) => n + 1 },
  { level: 6, text: 'Goals ask for 1 more.', goalAmount: (n) => n + 1 },
  { level: 7, text: 'Rare rooms cost 1 more Gem.', gemCost: (c, room) => (room.rarity === 'rare' || room.rarity === 'legendary' ? c + 1 : c) },
  { level: 8, text: '1 fewer Step every Night.', nightSteps: (n) => n - 1 },
  { level: 9, text: 'The house acts 1 Dread sooner.', dreadEvery: (n) => n - 1 },
  { level: 10, text: 'Doorways lock far more often.', lockBonus: (n) => n + 0.1 },
];
export const MAX_DEED = DEEDS.length - 1;

const rep = (obj) => Object.entries(obj).flatMap(([id, n]) => Array(n).fill(id));

export const DECKS = {
  standard: {
    id: 'standard', name: 'Standard Plans', text: 'A balanced core of 28 rooms, plus 18 random rooms from the pool each run.', fill: 18,
    cards: rep({
      foyer: 2, parlour: 1, study: 1, library: 1,
      herb: 2, fern: 1, greenhouse: 1, terrace: 1,
      guest: 2, nursery: 1, napnook: 1, hearth: 1,
      passage: 2, bend: 2, junction: 2, crossway: 1, lamplit: 1,
      tuckshop: 1, strongroom: 2, porter: 1, counting: 1,
      furnace: 1, winecellar: 1, trophy: 1,
    }),
  },
  gardener: {
    id: 'gardener', name: "Gardener's Plans", text: 'Lots of Gardens and rich rooms; fewer Corridors.', bias: { green: 2.5, amber: 0.5 },
    cards: rep({
      foyer: 2, parlour: 1, study: 1, library: 1,
      herb: 3, fern: 2, courtyard: 2, greenhouse: 2, orchard: 2,
      guest: 2, nursery: 1, sunroom: 1, suite: 1,
      passage: 1, bend: 1, junction: 1, crossway: 1,
      tuckshop: 1, counting: 1, strongroom: 1,
      winecellar: 1, gambling: 1, trophy: 1, secret: 1,
    }),
  },
  architect: {
    id: 'architect', name: "Architect's Plans", text: 'Every draft shows 4 cards, but 2 fewer Steps every Night.', bias: { amber: 1.5, ivory: 1.5 },
    drawCount: (n) => n + 1, nightSteps: (n) => n - 2,
    cards: rep({
      foyer: 2, gallery: 1, study: 1, atlas: 1, drawingroom: 1,
      herb: 1, fern: 1, courtyard: 1, orchard: 1,
      guest: 2, nursery: 1, dressing: 1, sunroom: 1,
      passage: 2, bend: 2, junction: 3, crossway: 2,
      tuckshop: 1, counting: 1, locksmith: 1,
      furnace: 2, gambling: 1, trophy: 1, secret: 1,
    }),
  },
  nightwatch: {
    id: 'nightwatch', name: 'Night Watch Plans', text: 'Start with +2 Keys and +2 Coins. More Cursed rooms.', bias: { crimson: 2.5, gold: 1.5 },
    start: (s) => { s.res.keys += 2; s.res.coins += 2; },
    cards: rep({
      foyer: 2, parlour: 1, gallery: 1, study: 1, library: 1,
      herb: 2, fern: 1, greenhouse: 1, orchard: 1,
      guest: 2, nursery: 2, dressing: 1, suite: 1,
      passage: 2, bend: 2, junction: 2, crossway: 1,
      tuckshop: 2, counting: 1,
      furnace: 2, winecellar: 2, gambling: 2, boarded: 2,
      trophy: 1, secret: 1,
    }),
  },
};

// Things bought with Ink between runs.
export const UNLOCKS = [
  { id: 'r_gallerywalk', kind: 'room', ref: 'gallerywalk', cost: 8 },
  { id: 'r_bunkroom', kind: 'room', ref: 'bunkroom', cost: 10 },
  { id: 'r_commissary', kind: 'room', ref: 'commissary', cost: 12 },
  { id: 'r_topiary', kind: 'room', ref: 'topiary', cost: 10 },
  { id: 'r_clockwork', kind: 'room', ref: 'clockwork', cost: 18 },
  { id: 'd_gardener', kind: 'deck', ref: 'gardener', cost: 20 },
  { id: 'r_shrine', kind: 'room', ref: 'shrine', cost: 18 },
  { id: 'r_ballroom', kind: 'room', ref: 'ballroom', cost: 25 },
  { id: 'd_nightwatch', kind: 'deck', ref: 'nightwatch', cost: 30 },
  { id: 'r_observatory', kind: 'room', ref: 'observatory', cost: 30 },
  { id: 'p_heirloom', kind: 'perk', ref: 'heirloom', cost: 30, name: 'Family Chest', text: 'Start every run with an Heirloom you have found before. Choose it before the run.' },
  { id: 'r_architect', kind: 'room', ref: 'architect', cost: 35 },
  { id: 'r_conservatory', kind: 'room', ref: 'conservatory', cost: 40 },
  { id: 'r_chapel', kind: 'room', ref: 'chapel', cost: 40 },
  { id: 'r_mirrors', kind: 'room', ref: 'mirrors', cost: 50 },
  { id: 'd_architect', kind: 'deck', ref: 'architect', cost: 45 },
];

export const PERKS = {
  heirloom: { start: () => {} }, // handled by runOptions.startHeirloom
};
