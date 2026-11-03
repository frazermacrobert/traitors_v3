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
  Kitchen:     { type: 'food', desc: '+2 energy (food)' },
  Bedroom:     { type: 'energy', value: 2, desc: '+2 energy (rest)' },
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
  Garden:      [{ item: 'gem', chance: 0.50 }, { item: 'coin', chance: 0.40 }, { item: 'food', chance: 0.30 }],
  Library:     [{ item: 'coin', chance: 0.40 }, { item: 'gem', chance: 0.15 }],
  Kitchen:     [{ item: 'coin', chance: 0.40 }, { item: 'gem', chance: 0.10 }],
  Bedroom:     [{ item: 'food', chance: 0.35 }, { item: 'key', chance: 0.20 }, { item: 'coin', chance: 0.20 }],
  Gallery:     [{ item: 'coin', chance: 0.30 }, { item: 'gem', chance: 0.10 }],
  Study:       [{ item: 'coin', chance: 0.35 }, { item: 'gem', chance: 0.20 }],
  Hall:        [{ item: 'coin', chance: 0.40 }, { item: 'gem', chance: 0.15 }],
  Cellar:      [{ item: 'coin', chance: 0.40 }, { item: 'key', chance: 0.15 }],
  Tower:       [{ item: 'key', chance: 0.30 }, { item: 'coin', chance: 0.25 }],
  Chapel:      [{ item: 'key', chance: 0.30 }, { item: 'coin', chance: 0.25 }],
  Armory:      [{ item: 'coin', chance: 0.25 }, { item: 'key', chance: 0.15 }],
  Treasury:    [{ item: 'gem', chance: 0.60 }, { item: 'coin', chance: 0.40 }],
  Ballroom:    [{ item: 'coin', chance: 0.40 }, { item: 'gem', chance: 0.15 }],
  Observatory: [{ item: 'gem', chance: 0.25 }, { item: 'coin', chance: 0.30 }],
  Dungeon:     [{ item: 'key', chance: 0.40 }, { item: 'gem', chance: 0.20 }],
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
  room('Herb Garden',    'Garden',  'L', 0, 'common', 'Fragrant and useful'),
  room('Rose Garden',    'Garden',  'T', 1, 'uncommon', 'Thorns guard beauty'),
  room('Greenhouse',     'Garden',  'I', 0, 'common', 'Glass and greenery'),
  room('Topiary Court',  'Garden',  'X', 2, 'rare', 'Sculpted nature'),
  room('Hedge Maze',     'Garden',  'T', 2, 'uncommon', 'Which way is out?'),

  // Libraries (blue — reveal clues)
  room('Reading Room',   'Library', 'L', 0, 'common', 'Quiet, please'),
  room('Archive',        'Library', 'T', 0, 'common', 'Dusty records'),
  room('Map Room',       'Library', 'I', 1, 'uncommon', 'Charts and atlases'),
  room('Grand Library',  'Library', 'X', 2, 'rare', 'Floor to ceiling'),
  room('Scriptorium',    'Library', 'D', 0, 'common', 'Ink-stained desks'),

  // Kitchens (warm — guaranteed food)
  room('Pantry',         'Kitchen', 'D', 0, 'common', 'Well-stocked shelves'),
  room('Scullery',       'Kitchen', 'L', 0, 'common', 'Scrub and rinse'),
  room('Great Kitchen',  'Kitchen', 'T', 0, 'common', 'Fires always burning'),
  room('Wine Cellar',    'Kitchen', 'I', 0, 'common', 'Vintage collection'),
  room('Feast Hall',     'Kitchen', 'X', 2, 'rare', 'A table for fifty'),

  // Bedrooms (purple — energy from rest)
  room('Guest Room',     'Bedroom', 'L', 0, 'common', 'Modest but warm'),
  room('Master Suite',   'Bedroom', 'T', 1, 'uncommon', 'Fit for the lord'),
  room('Servant Quarters','Bedroom','I', 0, 'common', 'Simple bunks'),
  room('Royal Chamber',  'Bedroom', 'X', 2, 'rare', 'Crown on the pillow'),
  room('Nursery',        'Bedroom', 'D', 0, 'common', 'Cradle and toys'),

  // Gallery (red — costly but well-connected)
  room('Portrait Hall',  'Gallery', 'I', 0, 'common', 'Ancestors watching'),
  room('Sculpture Wing', 'Gallery', 'L', 0, 'common', 'Marble and bronze'),
  room('Exhibition',     'Gallery', 'T', 1, 'uncommon', 'Rotating works'),
  room('Grand Gallery',  'Gallery', 'X', 2, 'rare', 'A cathedral of art'),

  // Study (blue — reveal clues)
  room('Writing Desk',   'Study',   'D', 0, 'common', 'Letters unsent'),
  room('Smoking Room',   'Study',   'L', 0, 'common', 'Leather and oak'),
  room('War Room',       'Study',   'T', 1, 'uncommon', 'Strategy and maps'),

  // Halls (neutral — many doors, always free)
  room('Entrance Hall',  'Hall',    'T', 0, 'common', 'Welcome home'),
  room('Grand Foyer',    'Hall',    'X', 0, 'common', 'The heart of the mansion'),
  room('Long Corridor',  'Hall',    'I', 0, 'common', 'Echoing footsteps'),
  room('Vestibule',      'Hall',    'L', 0, 'common', 'Between worlds'),
  room('Gallery Walk',   'Hall',    'T', 0, 'common', 'Portraits line the way'),

  // Cellar (+1 energy)
  room('Root Cellar',    'Cellar',  'D', 0, 'common', 'Cool and dark'),
  room('Crypt',          'Cellar',  'L', 0, 'common', 'Rest in peace'),
  room('Tunnels',        'Cellar',  'I', 0, 'common', 'Where do they lead?'),

  // Tower (oracle)
  room('Lookout',        'Tower',   'D', 0, 'common', 'See for miles'),
  room('Bell Tower',     'Tower',   'I', 1, 'uncommon', 'Ring at midnight'),
  room('Turret',         'Tower',   'L', 0, 'common', 'Spiral stair'),

  // Chapel (oracle)
  room('Prayer Room',    'Chapel',  'D', 0, 'common', 'Candlelit silence'),
  room('Nave',           'Chapel',  'I', 0, 'common', 'Stained glass light'),
  room('Sanctuary',      'Chapel',  'T', 2, 'rare', 'Sacred ground'),

  // Armory (red — costly but well-connected)
  room('Weapon Rack',    'Armory',  'D', 0, 'common', 'Swords and shields'),
  room('Training Yard',  'Armory',  'L', 0, 'common', 'Practice makes perfect'),
  room('Arsenal',        'Armory',  'T', 1, 'uncommon', 'Ready for siege'),

  // Treasury (gems — the key resource family)
  room('Coin Purse',     'Treasury','D', 0, 'common', 'A few coins inside'),
  room('Vault',          'Treasury','L', 1, 'uncommon', 'Locked tight'),
  room('Counting Room',  'Treasury','T', 1, 'uncommon', 'Coins and ledgers'),
  room('Crown Jewels',   'Treasury','X', 3, 'rare', 'Priceless gems'),

  // Ballroom (+1 energy)
  room('Dance Floor',    'Ballroom','I', 0, 'common', 'Music fills the air'),
  room('Grand Ballroom', 'Ballroom','X', 2, 'rare', 'Chandeliers ablaze'),
  room('Music Room',     'Ballroom','L', 0, 'common', 'Piano and strings'),

  // Observatory (clue)
  room('Star Chamber',   'Observatory','D', 0, 'common', 'Maps of the sky'),
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
