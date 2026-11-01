// Mansions (levels), their curses, deeds (cumulative difficulty) and starting decks.
// Coordinates are {r, c}; row 0 is the top (far end) of the house.

export const CURSES = {
  dust: { id: 'dust', name: 'Dust Sheets', text: 'The first reshuffle costs 1 extra Step.',
    reshufflePenalty: (n, s) => (s.reshuffles === 0 ? n + 1 : n) },
  overgrown: { id: 'overgrown', name: 'Overgrown', text: 'Gardens cost 1 more Gem.',
    gemCost: (c, room) => (room.family === 'green' ? c + 1 : c) },
  rusted: { id: 'rusted', name: 'Rusted Hinges', text: 'Shop prices are 1 higher.', shopPrice: (p) => p + 1 },
  damp: { id: 'damp', name: 'Rising Damp', text: 'Chambers restore 1 fewer Step.',
    gainAmount: (n, s, { res, room }) => (res === 'steps' && n > 0 && room && room.family === 'violet' ? n - 1 : n) },
};

const blocked = (list) => list.map(([r, c]) => ({ r, c }));

export const MANSIONS = [
  {
    id: 'm1', name: 'Hollow House', blurb: 'An empty plot. Learn the ropes.',
    w: 5, h: 8, entrance: { r: 7, c: 2, rot: 0 }, vault: { r: 0, c: 2, rot: 2 },
    blocked: [], presets: [], lockedCells: [], lockChance: (r) => (r <= 3 ? 0.12 : 0), curse: 'dust', toll: 7,
  },
  {
    id: 'm2', name: 'Crooked House', blurb: 'Rubble blocks the direct route.',
    w: 5, h: 8, entrance: { r: 7, c: 2, rot: 0 }, vault: { r: 0, c: 2, rot: 2 },
    blocked: blocked([[4, 1], [4, 2], [2, 3], [1, 1]]),
    presets: [{ r: 2, c: 2, id: 'passage', rot: 1 }, { r: 5, c: 4, id: 'guest', rot: 3 }],
    lockedCells: [], lockChance: (r) => (r <= 4 ? 0.15 : 0), curse: 'overgrown', toll: 6,
    start: (s) => { s.res.steps += 2; },
  },
  {
    id: 'm3', name: 'Locked Wing', blurb: 'The vault sits in a sealed corner wing.',
    w: 5, h: 8, entrance: { r: 7, c: 1, rot: 0 }, vault: { r: 0, c: 4, rot: 3 },
    blocked: blocked([[3, 2], [3, 3], [3, 4], [1, 2]]),
    presets: [{ r: 5, c: 3, id: 'furnace', rot: 0 }],
    lockedCells: blocked([[2, 0], [2, 1]]), lockChance: (r) => (r <= 3 ? 0.2 : 0.05), curse: 'rusted', toll: 7,
    start: (s) => { s.res.keys += 1; s.res.steps += 2; },
  },
  {
    id: 'm4', name: 'Flooded Manor', blurb: 'Bigger, wetter, and the bedrooms are damp.',
    w: 6, h: 9, entrance: { r: 8, c: 2, rot: 0 }, vault: { r: 0, c: 3, rot: 2 },
    blocked: blocked([[6, 0], [6, 1], [5, 4], [3, 2], [3, 3], [2, 5], [1, 0]]),
    presets: [{ r: 4, c: 3, id: 'crossway', rot: 0 }, { r: 2, c: 1, id: 'boarded', rot: 0 }],
    lockedCells: blocked([[1, 3]]), lockChance: (r) => (r <= 4 ? 0.2 : 0.05), curse: 'damp', toll: 8,
    start: (s) => { s.res.steps += 6; s.res.keys += 1; },
  },
];

// Deeds: cumulative handicaps. Deed N applies levels 1..N.
export const DEEDS = [
  null,
  { level: 1, text: 'Start with 2 fewer Steps.', start: (s) => { s.res.steps -= 2; } },
  { level: 2, text: 'Reshuffles cost 1 more Step.', reshufflePenalty: (n) => n + 1 },
  { level: 3, text: 'A Rubble Heap joins your deck.', start: (s) => { s.deck.push('rubble'); } },
  { level: 4, text: 'Shop prices are 1 higher.', shopPrice: (p) => p + 1 },
  { level: 5, text: 'Start with 1 fewer Key.', start: (s) => { s.res.keys = Math.max(0, s.res.keys - 1); } },
  { level: 6, text: 'Start with 2 fewer Steps.', start: (s) => { s.res.steps -= 2; } },
  { level: 7, text: 'Rare rooms cost 1 more Gem.', gemCost: (c, room) => (room.rarity === 'rare' ? c + 1 : c) },
  { level: 8, text: 'The Vault toll is 2 Gems higher.', toll: (t) => t + 2 },
  { level: 9, text: 'Another Rubble Heap joins your deck.', start: (s) => { s.deck.push('rubble'); } },
  { level: 10, text: 'Doorways lock more often.', lockBonus: 0.1 },
];
export const MAX_DEED = DEEDS.length - 1;

const rep = (obj) => Object.entries(obj).flatMap(([id, n]) => Array(n).fill(id));

export const DECKS = {
  standard: {
    id: 'standard', name: 'Standard Plans', text: 'A balanced set of rooms.',
    cards: rep({
      foyer: 2, parlour: 1, gallery: 1, study: 1, library: 1, atlas: 1,
      herb: 2, fern: 1, courtyard: 1, greenhouse: 1, orchard: 1,
      guest: 2, nursery: 1, dressing: 1, sunroom: 1, suite: 1,
      passage: 2, bend: 2, junction: 2, crossway: 1, backstairs: 1,
      tuckshop: 1, counting: 1, locksmith: 1, strongroom: 1,
      furnace: 1, winecellar: 1, gambling: 1, boarded: 1,
      trophy: 1, secret: 1,
    }),
  },
  gardener: {
    id: 'gardener', name: "Gardener's Plans", text: 'Lots of Gardens and rich rooms; fewer Corridors.',
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
    id: 'architect', name: "Architect's Plans", text: 'Every draft shows 4 cards, but start with 3 fewer Steps.',
    drawCount: (n) => n + 1, start: (s) => { s.res.steps -= 3; },
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
    id: 'nightwatch', name: 'Night Watch Plans', text: 'Start with +2 Keys and +2 Coins. More Cursed rooms.',
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
  { id: 'p_satchel', kind: 'perk', ref: 'satchel', cost: 15, name: 'Satchel', text: 'Start every run with +1 Gem.' },
  { id: 'r_clockwork', kind: 'room', ref: 'clockwork', cost: 18 },
  { id: 'd_gardener', kind: 'deck', ref: 'gardener', cost: 20 },
  { id: 'r_shrine', kind: 'room', ref: 'shrine', cost: 18 },
  { id: 'p_die', kind: 'perk', ref: 'die', cost: 25, name: 'Loaded Die', text: 'Start every run with +1 Reroll.' },
  { id: 'r_ballroom', kind: 'room', ref: 'ballroom', cost: 25 },
  { id: 'd_nightwatch', kind: 'deck', ref: 'nightwatch', cost: 30 },
  { id: 'r_observatory', kind: 'room', ref: 'observatory', cost: 30 },
  { id: 'p_heirloom', kind: 'perk', ref: 'heirloom', cost: 40, name: 'Family Chest', text: 'Start every run by choosing 1 of 3 Heirlooms.' },
  { id: 'r_architect', kind: 'room', ref: 'architect', cost: 35 },
  { id: 'd_architect', kind: 'deck', ref: 'architect', cost: 45 },
];

export const PERKS = {
  satchel: { start: (s) => { s.res.gems += 1; } },
  die: { start: (s) => { s.res.rerolls += 1; } },
  heirloom: { start: (s) => { s.queue.push('heirloom'); } },
};
