// Door arrays: [N, E, S, W] — true means path exits that side
export const SHAPES = {
  I: [true, false, true, false],
  L: [true, true, false, false],
  T: [true, true, true, false],
  X: [true, true, true, true],
  D: [true, false, false, false],
};

export function rotateDoors(doors, rot) {
  const r = ((rot % 4) + 4) % 4;
  const d = [...doors];
  for (let i = 0; i < r; i++) { d.unshift(d.pop()); }
  return d;
}

function mk(name, shape, icon, mod, bonus) {
  return { name, shape, icon, mod: mod || null, bonus: bonus || null };
}

export const PATH_CARDS = [
  // Lanes (15) — I shape
  mk('Park Path', 'I', 'lane'),
  mk('Woodland Trail', 'I', 'lane'),
  mk('Canal Towpath', 'I', 'lane'),
  mk('Garden Walk', 'I', 'lane'),
  mk('Cobbled Lane', 'I', 'lane'),
  mk('Meadow Path', 'I', 'lane'),
  mk('Country Road', 'I', 'lane'),
  mk('Riverside Walk', 'I', 'lane'),
  mk('School Lane', 'I', 'lane'),
  mk('Shortcut', 'I', 'lane'),
  mk('High Street', 'I', 'lane', { type: 'pts', val: 1 }),
  mk('The Bridge', 'I', 'lane', { type: 'pts', val: 2 }),
  mk('Promenade', 'I', 'lane', { type: 'pts', val: 1 }),
  mk('Market Street', 'I', 'lane', { type: 'peek' }),
  mk('The Alleyway', 'I', 'lane', { type: 'peek' }),
  // Bends (16) — L shape
  mk('Rose Garden', 'L', 'bend'),
  mk('Pond Corner', 'L', 'bend'),
  mk('Church Turn', 'L', 'bend'),
  mk('Playground Bend', 'L', 'bend'),
  mk('Orchard Corner', 'L', 'bend'),
  mk('Hedge Maze', 'L', 'bend'),
  mk('Library Turn', 'L', 'bend'),
  mk('Statue Turn', 'L', 'bend'),
  mk('Post Box Corner', 'L', 'bend'),
  mk('Bus Stop Bend', 'L', 'bend'),
  mk('Duck Pond', 'L', 'bend'),
  mk('Café Corner', 'L', 'bend', { type: 'pts', val: 1 }),
  mk('Ice Cream Van', 'L', 'bend', { type: 'pts', val: 1 }),
  mk('Bandstand', 'L', 'bend', { type: 'pts', val: 1 }),
  mk('The Bakery', 'L', 'bend', { type: 'pts', val: 2 }),
  mk('Fountain', 'L', 'bend', { type: 'peek' }),
  // Forks (10) — T shape
  mk('Village Green', 'T', 'fork'),
  mk('Market Square', 'T', 'fork'),
  mk('Tennis Courts', 'T', 'fork'),
  mk('War Memorial', 'T', 'fork'),
  mk('Allotments', 'T', 'fork'),
  mk('Skate Park', 'T', 'fork'),
  mk('Crossroads Café', 'T', 'fork', { type: 'pts', val: 1 }),
  mk('Train Station', 'T', 'fork', { type: 'pts', val: 2 }),
  mk('Bowling Green', 'T', 'fork', { type: 'pts', val: 1 }),
  mk('Picnic Spot', 'T', 'fork', { type: 'fetch' }),
  // Dog Parks (6) — X shape
  mk('Riverside Dog Park', 'X', 'dogpark'),
  mk('Hilltop Dog Park', 'X', 'dogpark'),
  mk('Muddy Dog Park', 'X', 'dogpark'),
  mk('Fancy Dog Park', 'X', 'dogpark', { type: 'pts', val: 2 }),
  mk('Sandy Dog Park', 'X', 'dogpark', { type: 'dig' }),
  mk('Secret Dog Park', 'X', 'dogpark', { type: 'pts', val: 1 }),
  // Sniff Spots (4) — D shape
  mk('Fire Hydrant', 'D', 'sniff', { type: 'pts', val: 1 }),
  mk('Lamp Post', 'D', 'sniff'),
  mk('Old Oak Tree', 'D', 'sniff', { type: 'pts', val: 1 }),
  mk('Park Bench', 'D', 'sniff', { type: 'dig' }),
  // Roll Spots (4) — I shape + shuffle
  mk('Sunny Clearing', 'I', 'rollspot', null, 'shuffle'),
  mk('Shady Glade', 'I', 'rollspot', null, 'shuffle'),
  mk('Muddy Hollow', 'I', 'rollspot', null, 'shuffle'),
  mk('Lucky Clover Patch', 'I', 'rollspot', { type: 'pts', val: 1 }, 'shuffle'),
];

export const HAZARD_CARDS = [
  { name: 'Squirrel!', hazard: 'squirrel' },
  { name: 'Squirrel!', hazard: 'squirrel' },
  { name: 'Muddy Puddle', hazard: 'puddle' },
  { name: 'Muddy Puddle', hazard: 'puddle' },
  { name: 'Mean Cat', hazard: 'meancat' },
];

export function buildDeck() {
  const cards = [...PATH_CARDS, ...HAZARD_CARDS];
  cards.forEach((c, i) => { c.id = 'c' + i; });
  return cards;
}
