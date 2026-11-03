// Door arrays: [North, East, South, West] — 1 = door, 0 = wall
// Shapes: D=dead-end(1 door), I=corridor(2 opposite), L=corner(2 adjacent), T=tee(3), X=cross(4)

export const SHAPES = {
  D: { doors: [1,0,0,0], count: 1 },
  I: { doors: [1,0,1,0], count: 2 },
  L: { doors: [1,1,0,0], count: 2 },
  T: { doors: [1,1,0,1], count: 3 },
  X: { doors: [1,1,1,1], count: 4 },
};

export function rotateDoors(doors, rot) {
  const r = ((rot % 4) + 4) % 4;
  const d = doors.slice();
  for (let i = 0; i < r; i++) {
    d.unshift(d.pop());
  }
  return d;
}

export function getDoorsAt(room, rot) {
  return rotateDoors(room.doors, rot);
}

export const FAMILIES = [
  'Garden', 'Library', 'Kitchen', 'Bedroom', 'Gallery',
  'Study', 'Hall', 'Cellar', 'Tower', 'Chapel',
  'Armory', 'Treasury', 'Ballroom', 'Observatory', 'Dungeon'
];

export const FAMILY_COLORS = {
  Garden:      { color: '#7cc47a', deep: '#2f6b3a' },
  Library:     { color: '#6f9fe0', deep: '#2c4f8a' },
  Kitchen:     { color: '#f0b45a', deep: '#8a5a17' },
  Bedroom:     { color: '#b693e0', deep: '#5b3a8c' },
  Gallery:     { color: '#ec7062', deep: '#8a2a22' },
  Study:       { color: '#6f9fe0', deep: '#2c4f8a' },
  Hall:        { color: '#efe8d6', deep: '#6b6250' },
  Cellar:      { color: '#c9d3cf', deep: '#4a5552' },
  Tower:       { color: '#f6d861', deep: '#86701a' },
  Chapel:      { color: '#b693e0', deep: '#5b3a8c' },
  Armory:      { color: '#ec7062', deep: '#8a2a22' },
  Treasury:    { color: '#f6d861', deep: '#86701a' },
  Ballroom:    { color: '#f0b45a', deep: '#8a5a17' },
  Observatory: { color: '#c9d3cf', deep: '#4a5552' },
  Dungeon:     { color: '#c9d3cf', deep: '#4a5552' },
};

export const FAMILY_EFFECTS = {
  Garden:      { type: 'lush', desc: 'Rich in items' },
  Library:     { type: 'clue', desc: 'Reveals a neighbor clue' },
  Kitchen:     { type: 'food', desc: 'Always has food' },
  Bedroom:     { type: 'energy', value: 2, desc: 'Rest: +2 energy' },
  Gallery:     { type: 'costly', value: 2, desc: 'Draining: costs 2 energy' },
  Study:       { type: 'clue', desc: 'Reveals a neighbor clue' },
  Hall:        { type: 'passage', desc: 'Many doors' },
  Cellar:      { type: 'energy', value: 1, desc: '+1 energy' },
  Tower:       { type: 'oracle', desc: 'Reveals if correct' },
  Chapel:      { type: 'oracle', desc: 'Reveals if correct' },
  Armory:      { type: 'costly', value: 2, desc: 'Draining: costs 2 energy' },
  Treasury:    { type: 'gem', value: 1, desc: '+1 gem' },
  Ballroom:    { type: 'energy', value: 1, desc: '+1 energy' },
  Observatory: { type: 'clue', desc: 'Reveals a distant clue' },
  Dungeon:     { type: 'key', value: 1, desc: '+1 key' },
};

export const ITEM_TABLES = {
  Garden:      [{ item: 'gem', chance: 0.45 }, { item: 'food', chance: 0.25 }, { item: 'coin', chance: 0.15 }],
  Library:     [{ item: 'coin', chance: 0.25 }],
  Kitchen:     [{ item: 'coin', chance: 0.30 }],
  Bedroom:     [{ item: 'food', chance: 0.30 }, { item: 'key', chance: 0.15 }],
  Gallery:     [{ item: 'coin', chance: 0.10 }],
  Study:       [{ item: 'coin', chance: 0.20 }, { item: 'gem', chance: 0.10 }],
  Hall:        [{ item: 'coin', chance: 0.30 }],
  Cellar:      [{ item: 'coin', chance: 0.30 }, { item: 'food', chance: 0.15 }],
  Tower:       [{ item: 'key', chance: 0.20 }, { item: 'coin', chance: 0.15 }],
  Chapel:      [{ item: 'key', chance: 0.20 }, { item: 'coin', chance: 0.15 }],
  Armory:      [{ item: 'coin', chance: 0.10 }],
  Treasury:    [{ item: 'gem', chance: 0.50 }, { item: 'coin', chance: 0.30 }],
  Ballroom:    [{ item: 'coin', chance: 0.30 }, { item: 'food', chance: 0.10 }],
  Observatory: [{ item: 'gem', chance: 0.15 }, { item: 'coin', chance: 0.20 }],
  Dungeon:     [{ item: 'key', chance: 0.30 }, { item: 'gem', chance: 0.15 }],
};

const ICONS = {
  Garden:      '🌿', Library:     '📚', Kitchen:     '🍳',
  Bedroom:     '🛏️', Gallery:     '🖼️', Study:       '📝',
  Hall:        '🏛️', Cellar:      '🪣', Tower:       '🗼',
  Chapel:      '⛪', Armory:      '⚔️', Treasury:    '💰',
  Ballroom:    '💃', Observatory: '🔭', Dungeon:     '⛓️',
};

let _id = 0;
function room(name, family, shape, cost, rarity, text) {
  const s = SHAPES[shape];
  return {
    id: _id++,
    name, family, shape,
    doors: s.doors.slice(),
    doorCount: s.count,
    cost, rarity,
    icon: ICONS[family] || '🏠',
    text: text || '',
  };
}

export const ROOMS = [
  // Gardens (green — rich in items)
  room('Rose Garden',    'Garden',  'L', 1, 'common', 'Thorns guard beauty'),
  room('Hedge Maze',     'Garden',  'T', 2, 'uncommon', 'Which way is out?'),
  room('Greenhouse',     'Garden',  'I', 1, 'common', 'Glass and greenery'),
  room('Topiary Court',  'Garden',  'X', 3, 'rare', 'Sculpted nature'),
  room('Herb Patch',     'Garden',  'D', 1, 'common', 'Fragrant and useful'),

  // Libraries (blue — reveal clues)
  room('Reading Room',   'Library', 'L', 0, 'common', 'Quiet, please'),
  room('Archive',        'Library', 'I', 1, 'uncommon', 'Dusty records'),
  room('Map Room',       'Library', 'T', 2, 'uncommon', 'Charts and atlases'),
  room('Grand Library',  'Library', 'X', 3, 'rare', 'Floor to ceiling'),
  room('Scriptorium',    'Library', 'D', 0, 'common', 'Ink-stained desks'),

  // Kitchens (warm — guaranteed food)
  room('Pantry',         'Kitchen', 'D', 0, 'common', 'Well-stocked shelves'),
  room('Scullery',       'Kitchen', 'I', 0, 'common', 'Scrub and rinse'),
  room('Great Kitchen',  'Kitchen', 'T', 1, 'uncommon', 'Fires always burning'),
  room('Wine Cellar',    'Kitchen', 'L', 1, 'uncommon', 'Vintage collection'),
  room('Feast Hall',     'Kitchen', 'X', 2, 'rare', 'A table for fifty'),

  // Bedrooms (purple — energy from rest)
  room('Guest Room',     'Bedroom', 'D', 0, 'common', 'Modest but warm'),
  room('Master Suite',   'Bedroom', 'L', 1, 'uncommon', 'Fit for the lord'),
  room('Servant Quarters','Bedroom','I', 0, 'common', 'Simple bunks'),
  room('Royal Chamber',  'Bedroom', 'T', 2, 'rare', 'Crown on the pillow'),
  room('Nursery',        'Bedroom', 'D', 0, 'common', 'Cradle and toys'),

  // Gallery (red — costly but well-connected)
  room('Portrait Hall',  'Gallery', 'I', 0, 'common', 'Ancestors watching'),
  room('Sculpture Wing', 'Gallery', 'L', 1, 'uncommon', 'Marble and bronze'),
  room('Exhibition',     'Gallery', 'T', 1, 'uncommon', 'Rotating works'),
  room('Grand Gallery',  'Gallery', 'X', 2, 'rare', 'A cathedral of art'),

  // Study (blue — reveal clues)
  room('Writing Desk',   'Study',   'D', 0, 'common', 'Letters unsent'),
  room('Smoking Room',   'Study',   'L', 0, 'common', 'Leather and oak'),
  room('War Room',       'Study',   'T', 1, 'uncommon', 'Strategy and maps'),

  // Halls (neutral — many doors)
  room('Entrance Hall',  'Hall',    'T', 0, 'common', 'Welcome home'),
  room('Grand Foyer',    'Hall',    'X', 1, 'uncommon', 'The heart of the mansion'),
  room('Long Corridor',  'Hall',    'I', 0, 'common', 'Echoing footsteps'),
  room('Vestibule',      'Hall',    'L', 0, 'common', 'Between worlds'),

  // Cellar
  room('Root Cellar',    'Cellar',  'D', 0, 'common', 'Cool and dark'),
  room('Crypt',          'Cellar',  'L', 1, 'uncommon', 'Rest in peace'),
  room('Tunnels',        'Cellar',  'I', 0, 'common', 'Where do they lead?'),

  // Tower (oracle)
  room('Lookout',        'Tower',   'D', 1, 'uncommon', 'See for miles'),
  room('Bell Tower',     'Tower',   'I', 1, 'uncommon', 'Ring at midnight'),
  room('Turret',         'Tower',   'L', 0, 'common', 'Spiral stair'),

  // Chapel (oracle)
  room('Prayer Room',    'Chapel',  'D', 0, 'common', 'Candlelit silence'),
  room('Nave',           'Chapel',  'I', 1, 'uncommon', 'Stained glass light'),
  room('Sanctuary',      'Chapel',  'T', 2, 'rare', 'Sacred ground'),

  // Armory (red — costly but well-connected)
  room('Weapon Rack',    'Armory',  'D', 0, 'common', 'Swords and shields'),
  room('Training Yard',  'Armory',  'L', 1, 'uncommon', 'Practice makes perfect'),
  room('Arsenal',        'Armory',  'T', 1, 'uncommon', 'Ready for siege'),

  // Treasury (gems)
  room('Vault',          'Treasury','D', 1, 'uncommon', 'Locked tight'),
  room('Counting Room',  'Treasury','L', 1, 'uncommon', 'Coins and ledgers'),
  room('Crown Jewels',   'Treasury','T', 3, 'rare', 'Priceless gems'),

  // Ballroom
  room('Dance Floor',    'Ballroom','I', 0, 'common', 'Music fills the air'),
  room('Grand Ballroom', 'Ballroom','X', 2, 'rare', 'Chandeliers ablaze'),
  room('Music Room',     'Ballroom','L', 0, 'common', 'Piano and strings'),

  // Observatory (clue)
  room('Star Chamber',   'Observatory','D', 1, 'uncommon', 'Maps of the sky'),
  room('Telescope Room', 'Observatory','L', 1, 'uncommon', 'Gaze at the heavens'),

  // Dungeon (keys)
  room('Cell Block',     'Dungeon', 'I', 0, 'common', 'Cold iron bars'),
  room('Torture Room',   'Dungeon', 'D', 0, 'common', 'Best left forgotten'),
  room('Oubliette',      'Dungeon', 'L', 1, 'uncommon', 'Forgotten below'),
];

export const ENTRANCE = room('Grand Entrance', 'Hall', 'T', 0, 'common', 'The front door');
ENTRANCE.id = 999;

export function getRoomById(id) {
  if (id === 999) return ENTRANCE;
  return ROOMS.find(r => r.id === id);
}
