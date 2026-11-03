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
  Garden:      { type: 'freePlace', desc: 'No step cost if wrong' },
  Library:     { type: 'clue', desc: 'Reveals a clue about a neighbor' },
  Kitchen:     { type: 'steps', value: 2, desc: '+2 steps' },
  Bedroom:     { type: 'keys', value: 1, desc: '+1 key' },
  Gallery:     { type: 'clue', desc: 'Reveals a pattern clue' },
  Study:       { type: 'clue', desc: 'Contains a safe puzzle' },
  Hall:        { type: 'freePlace', desc: 'No step cost if wrong' },
  Cellar:      { type: 'steps', value: 1, desc: '+1 step' },
  Tower:       { type: 'oracle', desc: 'Reveals if placement is correct' },
  Chapel:      { type: 'oracle', desc: 'Reveals if placement is correct' },
  Armory:      { type: 'shield', desc: 'Next wrong placement is free' },
  Treasury:    { type: 'ink', value: 1, desc: '+1 ink at run end' },
  Ballroom:    { type: 'steps', value: 1, desc: '+1 step' },
  Observatory: { type: 'clue', desc: 'Reveals a clue about a neighbor' },
  Dungeon:     { type: 'keys', value: 1, desc: '+1 key' },
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
    givesKey: cost >= 3 ? 1 : 0,
  };
}

export const ROOMS = [
  // Gardens (green wing)
  room('Rose Garden',    'Garden',  'L', 1, 'common', 'Thorns guard beauty'),
  room('Hedge Maze',     'Garden',  'T', 2, 'uncommon', 'Which way is out?'),
  room('Greenhouse',     'Garden',  'I', 1, 'common', 'Glass and greenery'),
  room('Topiary Court',  'Garden',  'X', 3, 'rare', 'Sculpted nature'),
  room('Herb Patch',     'Garden',  'D', 1, 'common', 'Fragrant and useful'),

  // Libraries (blue wing)
  room('Reading Room',   'Library', 'L', 1, 'common', 'Quiet, please'),
  room('Archive',        'Library', 'I', 2, 'uncommon', 'Dusty records'),
  room('Map Room',       'Library', 'T', 2, 'uncommon', 'Charts and atlases'),
  room('Grand Library',  'Library', 'X', 3, 'rare', 'Floor to ceiling'),
  room('Scriptorium',    'Library', 'D', 1, 'common', 'Ink-stained desks'),

  // Kitchens
  room('Pantry',         'Kitchen', 'D', 1, 'common', 'Well-stocked shelves'),
  room('Scullery',       'Kitchen', 'I', 1, 'common', 'Scrub and rinse'),
  room('Great Kitchen',  'Kitchen', 'T', 2, 'uncommon', 'Fires always burning'),
  room('Wine Cellar',    'Kitchen', 'L', 2, 'uncommon', 'Vintage collection'),
  room('Feast Hall',     'Kitchen', 'X', 3, 'rare', 'A table for fifty'),

  // Bedrooms
  room('Guest Room',     'Bedroom', 'D', 1, 'common', 'Modest but warm'),
  room('Master Suite',   'Bedroom', 'L', 2, 'uncommon', 'Fit for the lord'),
  room('Servant Quarters','Bedroom','I', 1, 'common', 'Simple bunks'),
  room('Royal Chamber',  'Bedroom', 'T', 3, 'rare', 'Crown on the pillow'),
  room('Nursery',        'Bedroom', 'D', 1, 'common', 'Cradle and toys'),

  // Gallery
  room('Portrait Hall',  'Gallery', 'I', 1, 'common', 'Ancestors watching'),
  room('Sculpture Wing', 'Gallery', 'L', 2, 'uncommon', 'Marble and bronze'),
  room('Exhibition',     'Gallery', 'T', 2, 'uncommon', 'Rotating works'),
  room('Grand Gallery',  'Gallery', 'X', 3, 'rare', 'A cathedral of art'),

  // Study
  room('Writing Desk',   'Study',   'D', 1, 'common', 'Letters unsent'),
  room('Smoking Room',   'Study',   'L', 1, 'common', 'Leather and oak'),
  room('War Room',       'Study',   'T', 2, 'uncommon', 'Strategy and maps'),

  // Halls
  room('Entrance Hall',  'Hall',    'T', 0, 'common', 'Welcome home'),
  room('Grand Foyer',    'Hall',    'X', 2, 'uncommon', 'The heart of the mansion'),
  room('Long Corridor',  'Hall',    'I', 1, 'common', 'Echoing footsteps'),
  room('Vestibule',      'Hall',    'L', 1, 'common', 'Between worlds'),

  // Cellar
  room('Root Cellar',    'Cellar',  'D', 1, 'common', 'Cool and dark'),
  room('Crypt',          'Cellar',  'L', 2, 'uncommon', 'Rest in peace'),
  room('Tunnels',        'Cellar',  'I', 1, 'common', 'Where do they lead?'),

  // Tower
  room('Lookout',        'Tower',   'D', 2, 'uncommon', 'See for miles'),
  room('Bell Tower',     'Tower',   'I', 2, 'uncommon', 'Ring at midnight'),
  room('Turret',         'Tower',   'L', 1, 'common', 'Spiral stair'),

  // Chapel
  room('Prayer Room',    'Chapel',  'D', 1, 'common', 'Candlelit silence'),
  room('Nave',           'Chapel',  'I', 2, 'uncommon', 'Stained glass light'),
  room('Sanctuary',      'Chapel',  'T', 3, 'rare', 'Sacred ground'),

  // Armory
  room('Weapon Rack',    'Armory',  'D', 1, 'common', 'Swords and shields'),
  room('Training Yard',  'Armory',  'L', 2, 'uncommon', 'Practice makes perfect'),
  room('Arsenal',        'Armory',  'T', 2, 'uncommon', 'Ready for siege'),

  // Treasury
  room('Vault',          'Treasury','D', 2, 'uncommon', 'Locked tight'),
  room('Counting Room',  'Treasury','L', 2, 'uncommon', 'Coins and ledgers'),
  room('Crown Jewels',   'Treasury','T', 3, 'rare', 'Priceless gems'),

  // Ballroom
  room('Dance Floor',    'Ballroom','I', 1, 'common', 'Music fills the air'),
  room('Grand Ballroom', 'Ballroom','X', 3, 'rare', 'Chandeliers ablaze'),
  room('Music Room',     'Ballroom','L', 1, 'common', 'Piano and strings'),

  // Observatory
  room('Star Chamber',   'Observatory','D', 2, 'uncommon', 'Maps of the sky'),
  room('Telescope Room', 'Observatory','L', 2, 'uncommon', 'Gaze at the heavens'),

  // Dungeon
  room('Cell Block',     'Dungeon', 'I', 1, 'common', 'Cold iron bars'),
  room('Torture Room',   'Dungeon', 'D', 1, 'common', 'Best left forgotten'),
  room('Oubliette',      'Dungeon', 'L', 2, 'uncommon', 'Forgotten below'),
];

export const ENTRANCE = room('Grand Entrance', 'Hall', 'T', 0, 'common', 'The front door');
ENTRANCE.id = 999;

export function getRoomById(id) {
  if (id === 999) return ENTRANCE;
  return ROOMS.find(r => r.id === id);
}
