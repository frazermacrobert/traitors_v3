// Room definitions. Doors are [N, E, S, W] in the base orientation (rot 0).
// Effects receive a ctx (see engine.js makeCtx). Keep effects small and data-like.

export const SHAPES = {
  D: { name: 'Dead End', doors: [1, 0, 0, 0] },
  I: { name: 'Straight', doors: [1, 0, 1, 0] },
  L: { name: 'Corner', doors: [1, 1, 0, 0] },
  T: { name: 'Tee', doors: [1, 1, 0, 1] },
  X: { name: 'Cross', doors: [1, 1, 1, 1] },
};

// Each family has its own job.
export const FAMILIES = {
  blue: { name: 'Hall', color: '#6f9fe0', deep: '#2c4f8a', role: 'Bend the draft: see more, pick better, shape your deck.' },
  green: { name: 'Garden', color: '#7cc47a', deep: '#2f6b3a', role: 'Grow Gems, especially next to other Gardens.' },
  violet: { name: 'Chamber', color: '#b693e0', deep: '#5b3a8c', role: 'Restore Steps.' },
  amber: { name: 'Corridor', color: '#f0b45a', deep: '#8a5a17', role: 'Cheap routing, free moves.' },
  gold: { name: 'Shop', color: '#f6d861', deep: '#86701a', role: 'Coins, Keys, trades and shops.' },
  crimson: { name: 'Cursed', color: '#ec7062', deep: '#8a2a22', role: 'Big rewards with a sting.' },
  ivory: { name: 'Wonder', color: '#efe8d6', deep: '#6b6250', role: 'Rare rule-breakers.' },
  special: { name: 'Landmark', color: '#c9d3cf', deep: '#4a5552', role: '' },
};

export const RARITIES = {
  common: { name: 'Common', weight: 10 },
  uncommon: { name: 'Uncommon', weight: 6 },
  rare: { name: 'Rare', weight: 2.5 },
  legendary: { name: 'Legendary', weight: 0.8 },
};

const adj = (ctx, fam) => ctx.neighbors().filter((n) => n.room && n.room.family === fam).length;
const conn = (ctx) => ctx.neighbors().filter((n) => n.connected).length;

const R = (id, name, family, shape, cost, rarity, icon, text, extra = {}) => ({
  id, name, family, shape, cost, rarity, icon, text, ...extra,
});

export const ROOMS = {
  // ---- Landmarks (never drafted) ----
  entrance: R('entrance', 'Entrance Hall', 'special', 'T', 0, 'common', '🚪', 'Where every visit begins.'),
  vault: R('vault', 'The Vault', 'special', 'D', 0, 'legendary', '👑', 'Night 3’s goal. Connect a door to it and meet the goal to win.'),
  stair: R('stair', 'Stairwell', 'special', 'D', 0, 'rare', '🪜', 'The way up. Connect a door to it and meet the goal to clear the Night.'),
  closet: R('closet', 'Broom Closet', 'blue', 'D', 0, 'common', '🧹', 'Fallback. Does nothing.'),
  rubble: R('rubble', 'Rubble Heap', 'crimson', 'D', 0, 'common', '🧱', 'Lose 1 Step.', { onPlace: (c) => c.gain('steps', -1) }),

  // ---- Blue Halls: draft & deck control ----
  foyer: R('foyer', 'Foyer', 'blue', 'T', 0, 'common', '🪞', 'A plain junction.'),
  parlour: R('parlour', 'Parlour', 'blue', 'L', 0, 'common', '🛋️', '+1 Coin.', { onPlace: (c) => c.gain('coins', 1) }),
  gallery: R('gallery', 'Gallery', 'blue', 'I', 0, 'common', '🖼️', '+1 Coin.', { onPlace: (c) => c.gain('coins', 1) }),
  study: R('study', 'Study', 'blue', 'D', 0, 'common', '📜', '+3 Coins.', { onPlace: (c) => c.gain('coins', 3) }),
  musicroom: R('musicroom', 'Music Room', 'blue', 'L', 0, 'common', '🎻', '+1 Coin, +1 more per adjacent Hall.', {
    onPlace: (c) => c.gain('coins', 1 + adj(c, 'blue')),
  }),
  cloakroom: R('cloakroom', 'Cloakroom', 'blue', 'D', 0, 'common', '🧥', 'Burn the worst card in your deck.', { onPlace: (c) => c.burn(1) }),
  library: R('library', 'Library', 'blue', 'T', 1, 'uncommon', '📚', 'Your next 2 drafts show +1 card.', { onPlace: (c) => c.buff('extraDraw', 2) }),
  atlas: R('atlas', 'Atlas Room', 'blue', 'L', 1, 'uncommon', '🗺️', '+1 Reroll.', { onPlace: (c) => c.gain('rerolls', 1) }),
  peephole: R('peephole', 'Spy Hole', 'blue', 'D', 0, 'uncommon', '🔍', 'Your next draft shows 2 extra cards.', { onPlace: (c) => c.buff('bigDraw', 1) }),
  billiard: R('billiard', 'Billiard Room', 'blue', 'X', 1, 'uncommon', '🎱', 'Your next draft: every card costs 0 Gems.', { onPlace: (c) => c.buff('freeCost', 1) }),
  guestbook: R('guestbook', 'Writing Room', 'blue', 'T', 0, 'uncommon', '✒️', 'Your next draft always includes a Chamber.', { onPlace: (c) => c.buff('nextFamily', 'violet') }),
  copyroom: R('copyroom', 'Copy Room', 'blue', 'D', 1, 'uncommon', '📠', 'Add a copy of the last room you placed to your discard pile.', {
    onPlace: (c) => { if (c.s.lastPlaced) c.addCards([c.s.lastPlaced]); },
  }),
  drawingroom: R('drawingroom', 'Drawing Room', 'blue', 'X', 2, 'uncommon', '🎨', '+1 Coin per connected neighbour.', { onPlace: (c) => c.gain('coins', conn(c)) }),
  archive: R('archive', 'Map Archive', 'blue', 'I', 1, 'rare', '🗄️', 'Add 2 random Rare rooms to your discard pile.', {
    onPlace: (c) => c.addRandom(2, (r) => r.rarity === 'rare'),
  }),

  vigil: R('vigil', 'Vigil Room', 'blue', 'D', 0, 'uncommon', '🙏', 'Calms the house: −5 Dread.', { calm: 5 }),

  // ---- Green Gardens: gems & adjacency ----
  herb: R('herb', 'Herb Garden', 'green', 'D', 0, 'common', '🌿', '+1 Gem, +1 more per adjacent Garden.', { onPlace: (c) => c.gain('gems', 1 + adj(c, 'green')) }),
  fern: R('fern', 'Fern Walk', 'green', 'I', 0, 'common', '🌱', '+1 Gem.', { onPlace: (c) => c.gain('gems', 1) }),
  greenhouse: R('greenhouse', 'Greenhouse', 'green', 'L', 0, 'common', '🪴', '+1 Gem per adjacent Garden (min 1).', { onPlace: (c) => c.gain('gems', Math.max(1, adj(c, 'green'))) }),
  terrace: R('terrace', 'Terrace', 'green', 'L', 0, 'common', '☀️', '+1 Gem, +1 Step.', { onPlace: (c) => { c.gain('gems', 1); c.gain('steps', 1); } }),
  rosegarden: R('rosegarden', 'Rose Garden', 'green', 'T', 0, 'common', '🌹', '+1 Gem. +2 more if it touches the outer wall.', {
    onPlace: (c) => c.gain('gems', c.onEdge() ? 3 : 1),
  }),
  courtyard: R('courtyard', 'Courtyard', 'green', 'X', 1, 'uncommon', '⛲', '+2 Gems.', { onPlace: (c) => c.gain('gems', 2) }),
  orchard: R('orchard', 'Orchard', 'green', 'T', 1, 'uncommon', '🍎', '+3 Gems.', { onPlace: (c) => c.gain('gems', 3) }),
  pond: R('pond', 'Lily Pond', 'green', 'D', 0, 'uncommon', '🪷', '+1 Gem per Garden in the house (max 4).', {
    onPlace: (c) => c.gain('gems', Math.min(4, c.placed((r) => r.family === 'green').length)),
  }),
  vinery: R('vinery', 'Vinery', 'green', 'I', 0, 'uncommon', '🍇', '+1 Gem per connected neighbour.', { onPlace: (c) => c.gain('gems', conn(c)) }),
  mushroom: R('mushroom', 'Mushroom Cellar', 'green', 'D', 0, 'uncommon', '🍄', '+3 Gems in the bottom half of the house, otherwise +1.', {
    onPlace: (c) => c.gain('gems', c.r >= c.s.h / 2 ? 3 : 1),
  }),
  topiary: R('topiary', 'Topiary Maze', 'green', 'X', 0, 'uncommon', '🌳', '+2 Gems. Lose 1 Step.', {
    unlock: true, onPlace: (c) => { c.gain('gems', 2); c.gain('steps', -1); },
  }),
  arboretum: R('arboretum', 'Arboretum', 'green', 'X', 2, 'rare', '🌲', '+2 Gems per adjacent Garden, +1.', { onPlace: (c) => c.gain('gems', 1 + 2 * adj(c, 'green')) }),
  glasshouse: R('glasshouse', 'Glasshouse', 'green', 'T', 1, 'rare', '💠', 'Your next 3 Gardens give double Gems.', { onPlace: (c) => c.buff('gardenDouble', 3) }),

  // ---- Violet Chambers: steps ----
  guest: R('guest', 'Guest Room', 'violet', 'D', 0, 'common', '🛏️', '+3 Steps.', { onPlace: (c) => c.gain('steps', 3) }),
  nursery: R('nursery', 'Nursery', 'violet', 'L', 0, 'common', '🧸', '+2 Steps.', { onPlace: (c) => c.gain('steps', 2) }),
  hearth: R('hearth', 'Hearth Room', 'violet', 'L', 0, 'common', '🔥', '+1 Step. Calms the house: −3 Dread.', { calm: 3, onPlace: (c) => c.gain('steps', 1) }),
  dressing: R('dressing', 'Dressing Room', 'violet', 'I', 0, 'common', '👗', '+1 Step, +1 Coin.', { onPlace: (c) => { c.gain('steps', 1); c.gain('coins', 1); } }),
  napnook: R('napnook', 'Nap Nook', 'violet', 'D', 0, 'common', '💤', '+2 Steps, or +4 if you have 3 or fewer.', {
    onPlace: (c) => c.gain('steps', c.s.res.steps <= 3 ? 4 : 2),
  }),
  kitchen: R('kitchen', 'Kitchen', 'violet', 'L', 0, 'common', '🍳', '+1 Step per adjacent room (max 3).', { onPlace: (c) => c.gain('steps', Math.min(3, c.neighbors().length)) }),
  sunroom: R('sunroom', 'Sunroom', 'violet', 'T', 1, 'uncommon', '🌤️', '+3 Steps.', { onPlace: (c) => c.gain('steps', 3) }),
  bathhouse: R('bathhouse', 'Bathhouse', 'violet', 'T', 0, 'uncommon', '🛁', '+1 Step per connected neighbour.', { onPlace: (c) => c.gain('steps', conn(c)) }),
  infirmary: R('infirmary', 'Infirmary', 'violet', 'L', 1, 'uncommon', '🩺', '+6 Steps if you have 5 or fewer, otherwise +1.', {
    onPlace: (c) => c.gain('steps', c.s.res.steps <= 5 ? 6 : 1),
  }),
  garret: R('garret', 'Garret', 'violet', 'X', 0, 'uncommon', '🕯️', '+3 Steps in the far half of the house, otherwise +0.', {
    onPlace: (c) => { if (c.r < c.s.h / 2) c.gain('steps', 3); },
  }),
  bunkroom: R('bunkroom', 'Bunk Room', 'violet', 'I', 1, 'uncommon', '🏕️', '+1 Step, +1 more per adjacent Chamber.', {
    unlock: true, onPlace: (c) => c.gain('steps', 1 + adj(c, 'violet')),
  }),
  suite: R('suite', 'Master Suite', 'violet', 'D', 2, 'rare', '🛌', '+6 Steps.', { onPlace: (c) => c.gain('steps', 6) }),
  dormitory: R('dormitory', 'Dormitory', 'violet', 'X', 2, 'rare', '🏨', '+1 Step per Chamber in the house (max 6).', {
    onPlace: (c) => c.gain('steps', Math.min(6, c.placed((r) => r.family === 'violet').length)),
  }),

  // ---- Amber Corridors: routing ----
  passage: R('passage', 'Passage', 'amber', 'I', 0, 'common', '🚶', 'Just a corridor.'),
  bend: R('bend', 'Bend', 'amber', 'L', 0, 'common', '↪️', 'Just a corner.'),
  junction: R('junction', 'Junction', 'amber', 'T', 0, 'common', '🔀', 'Three ways on.'),
  servants: R('servants', "Servants' Hall", 'amber', 'X', 0, 'common', '🧺', 'Four ways on. Lose 1 Coin if you have one.', { onPlace: (c) => c.gain('coins', -1) }),
  backstairs: R('backstairs', 'Back Stairs', 'amber', 'I', 0, 'common', '🛤️', '+1 Step if connected to another Corridor.', {
    onPlace: (c) => { if (c.neighbors().some((n) => n.connected && n.room.family === 'amber')) c.gain('steps', 1); },
  }),
  cloister: R('cloister', 'Cloister', 'amber', 'L', 0, 'common', '🏛️', '+1 Coin per connected Corridor.', {
    onPlace: (c) => c.gain('coins', c.neighbors().filter((n) => n.connected && n.room.family === 'amber').length),
  }),
  crossway: R('crossway', 'Crossway', 'amber', 'X', 1, 'uncommon', '✳️', 'Four ways on.'),
  lamplit: R('lamplit', 'Lamplit Hall', 'amber', 'I', 0, 'common', '🏮', 'Calms the house: −2 Dread.', { calm: 2 }),
  colonnade: R('colonnade', 'Colonnade', 'amber', 'I', 0, 'uncommon', '🏺', '+2 Steps if both its doors connect when placed.', {
    onPlace: (c) => { if (conn(c) >= 2) c.gain('steps', 2); },
  }),
  gallerywalk: R('gallerywalk', 'Long Gallery', 'amber', 'I', 0, 'uncommon', '🏃', 'Your next draft costs no Step.', { unlock: true, onPlace: (c) => c.buff('freeDraft', 1) }),
  lift: R('lift', 'Lift Shaft', 'amber', 'D', 1, 'uncommon', '🛗', 'Your next 2 drafts cost no Steps.', { onPlace: (c) => c.buff('freeDraft', 2) }),
  skybridge: R('skybridge', 'Sky Bridge', 'amber', 'I', 1, 'rare', '🌉', 'Unlocks every locked doorway next to it. Its own exits never lock.', {
    noLock: true, onPlace: (c) => c.unlockAround(),
  }),
  rotunda: R('rotunda', 'Rotunda', 'amber', 'X', 2, 'rare', '🎡', '+1 Step and +1 Coin per connected neighbour.', {
    onPlace: (c) => { const n = conn(c); c.gain('steps', n); c.gain('coins', n); },
  }),

  // ---- Gold Shops: economy ----
  tuckshop: R('tuckshop', 'Tuck Shop', 'gold', 'D', 0, 'common', '🍬', 'Opens a shop.', { onPlace: (c) => c.queue('shop') }),
  counting: R('counting', 'Counting House', 'gold', 'D', 0, 'common', '🧮', '+4 Coins.', { onPlace: (c) => c.gain('coins', 4) }),
  strongroom: R('strongroom', 'Strongroom', 'gold', 'D', 0, 'common', '🔐', '+1 Key.', { onPlace: (c) => c.gain('keys', 1) }),
  porter: R('porter', "Porter's Lodge", 'gold', 'I', 0, 'common', '🚪', '+1 Key, +1 Coin.', { onPlace: (c) => { c.gain('keys', 1); c.gain('coins', 1); } }),
  locksmith: R('locksmith', 'Locksmith', 'gold', 'L', 1, 'uncommon', '🔧', '+1 Key, +2 Coins.', { onPlace: (c) => { c.gain('keys', 1); c.gain('coins', 2); } }),
  keyrack: R('keyrack', 'Key Rack', 'gold', 'L', 0, 'uncommon', '🗝️', '+2 Keys. Lose 1 Step.', { onPlace: (c) => { c.gain('keys', 2); c.gain('steps', -1); } }),
  pawnshop: R('pawnshop', 'Pawnbroker', 'gold', 'T', 0, 'uncommon', '💱', 'Trade every 3 Coins you hold for 1 Gem.', {
    onPlace: (c) => { const n = Math.floor(c.s.res.coins / 3); c.gain('coins', -3 * n); c.gain('gems', n); },
  }),
  bank: R('bank', 'Bank', 'gold', 'D', 1, 'uncommon', '🏦', 'Interest: +1 Coin for every 2 you hold (max 5).', {
    onPlace: (c) => c.gain('coins', Math.min(5, Math.floor(c.s.res.coins / 2))),
  }),
  commissary: R('commissary', 'Commissary', 'gold', 'L', 1, 'uncommon', '🛒', '+2 Coins, then opens a shop.', {
    unlock: true, onPlace: (c) => { c.gain('coins', 2); c.queue('shop'); },
  }),
  auction: R('auction', 'Auction House', 'gold', 'X', 2, 'rare', '🔨', '+3 Coins, then opens a shop.', { onPlace: (c) => { c.gain('coins', 3); c.queue('shop'); } }),
  mint: R('mint', 'Mint', 'gold', 'I', 1, 'rare', '🪙', '+2 Coins, +2 more per Shop in the house.', {
    onPlace: (c) => c.gain('coins', 2 + 2 * (c.placed((r) => r.family === 'gold').length - 1)),
  }),
  tollhouse: R('tollhouse', 'Toll House', 'gold', 'D', 1, 'rare', '🏷️', 'The current goal drops by 2.', { onPlace: (c) => c.toll(-2) }),

  // ---- Crimson: big rewards, real costs ----
  furnace: R('furnace', 'Furnace Room', 'crimson', 'X', 0, 'common', '♨️', 'Four ways on. Lose 2 Steps.', { onPlace: (c) => c.gain('steps', -2) }),
  bellpull: R('bellpull', 'Bell-Pull Room', 'crimson', 'L', 0, 'uncommon', '🛎️', '+4 Coins, +2 Gems. The house wakes: +4 Dread.', {
    onPlace: (c) => { c.gain('coins', 4); c.gain('gems', 2); c.dread(4); },
  }),
  winecellar: R('winecellar', 'Wine Cellar', 'crimson', 'L', 0, 'uncommon', '🍷', '+3 Gems. Lose 2 Steps.', { onPlace: (c) => { c.gain('gems', 3); c.gain('steps', -2); } }),
  gambling: R('gambling', 'Card Room', 'crimson', 'T', 0, 'uncommon', '🃏', 'Coin flip: +6 Coins, or lose 2 Steps.', {
    onPlace: (c) => { if (c.rand() < 0.5) c.gain('coins', 6); else c.gain('steps', -2); },
  }),
  boarded: R('boarded', 'Boarded Room', 'crimson', 'X', 0, 'uncommon', '🪵', '+2 Gems. All its exits are locked.', { lockExits: true, onPlace: (c) => c.gain('gems', 2) }),
  sinkhole: R('sinkhole', 'Sinkhole', 'crimson', 'T', 0, 'uncommon', '🕳️', '+3 Steps. A random empty cell next to it collapses.', {
    onPlace: (c) => { c.gain('steps', 3); c.collapse(1); },
  }),
  flooded: R('flooded', 'Flooded Cellar', 'crimson', 'D', 0, 'uncommon', '🌊', '+4 Gems. Every empty cell next to it floods.', {
    onPlace: (c) => { c.gain('gems', 4); c.collapse(4); },
  }),
  debtors: R('debtors', "Debtors' Office", 'crimson', 'I', 0, 'uncommon', '💸', '+6 Coins. The current goal rises by 1.', { onPlace: (c) => { c.gain('coins', 6); c.toll(1); } }),
  haunted: R('haunted', 'Haunted Nursery', 'crimson', 'L', 0, 'uncommon', '👻', '+4 Steps. A Rubble Heap joins your discard pile.', {
    onPlace: (c) => { c.gain('steps', 4); c.addCards(['rubble']); },
  }),
  mirror: R('mirror', 'Cracked Mirror', 'crimson', 'I', 0, 'uncommon', '🔮', 'Repeats a random connected neighbour’s effect. Lose 1 Step.', {
    echo: true, onPlace: (c) => { c.echo(1); c.gain('steps', -1); },
  }),
  idol: R('idol', 'Idol Room', 'crimson', 'D', 0, 'rare', '🗿', '+5 Gems. Your next 2 drafts show 1 fewer card.', {
    onPlace: (c) => { c.gain('gems', 5); c.buff('smallDraw', 2); },
  }),
  thieves: R('thieves', "Thieves' Den", 'crimson', 'T', 0, 'rare', '🦝', 'Lose all Coins. Choose an Heirloom.', {
    onPlace: (c) => { c.gain('coins', -c.s.res.coins); c.queue('heirloom'); },
  }),
  shrine: R('shrine', 'Old Shrine', 'crimson', 'D', 0, 'rare', '⛩️', 'Lose 3 Steps. Choose an Heirloom.', {
    unlock: true, onPlace: (c) => { c.gain('steps', -3); c.queue('heirloom'); },
  }),

  // ---- Ivory Wonders: rare rule-breakers ----
  trophy: R('trophy', 'Trophy Room', 'ivory', 'D', 2, 'rare', '🏆', 'Choose an Heirloom.', { onPlace: (c) => c.queue('heirloom') }),
  secret: R('secret', 'Secret Passage', 'ivory', 'I', 1, 'rare', '🕵️', 'Your next 2 drafts cost no Steps.', { onPlace: (c) => c.buff('freeDraft', 2) }),
  cartographer: R('cartographer', "Cartographer's Loft", 'ivory', 'L', 2, 'rare', '🧭', 'The current goal drops by 1. Your next 3 drafts show +1 card.', {
    onPlace: (c) => { c.toll(-1); c.buff('extraDraw', 3); },
  }),
  ballroom: R('ballroom', 'Ballroom', 'ivory', 'X', 3, 'rare', '💃', '+4 Steps, +3 Coins.', { unlock: true, onPlace: (c) => { c.gain('steps', 4); c.gain('coins', 3); } }),
  clockwork: R('clockwork', 'Clockwork Room', 'ivory', 'L', 2, 'rare', '⚙️', '+1 Step per Corridor in the house (max 5).', {
    unlock: true, onPlace: (c) => c.gain('steps', Math.min(5, c.placed((r) => r.family === 'amber').length)),
  }),
  architect: R('architect', "Architect's Office", 'ivory', 'T', 2, 'rare', '📐', 'Remove every Cursed card from your deck and discard pile.', {
    unlock: true, onPlace: (c) => c.purge((r) => r.family === 'crimson'),
  }),
  belltower: R('belltower', 'Bell Tower', 'ivory', 'D', 2, 'legendary', '🔔', '+1 Step for every row between it and the Entrance.', {
    onPlace: (c) => c.gain('steps', Math.max(0, c.s.entrance.r - c.r)),
  }),
  observatory: R('observatory', 'Observatory', 'ivory', 'D', 2, 'legendary', '🔭', 'While it stands, every draft shows +1 card.', {
    unlock: true, passive: { drawCount: (n) => n + 1 },
  }),
  conservatory: R('conservatory', 'Conservatory', 'ivory', 'X', 3, 'legendary', '🏵️', 'While it stands, Gardens give +1 Gem.', {
    unlock: true, passive: { onPlace: (c) => { if (c.room.family === 'green') c.gain('gems', 1); } },
  }),
  chapel: R('chapel', 'Chapel of Keys', 'ivory', 'T', 2, 'legendary', '🕍', 'While it stands, locked doorways open for free.', {
    unlock: true, passive: { freeLock: () => true, canFreeLock: () => true },
  }),
  mirrors: R('mirrors', 'Hall of Mirrors', 'ivory', 'X', 3, 'legendary', '🪩', 'Repeats the effect of every connected neighbour.', {
    echo: true, unlock: true, onPlace: (c) => c.echo(4),
  }),

  // ---- Discovery rooms: found via "!" cells on the map ----
  kitchen: R('kitchen', 'Kitchen', 'violet', 'I', 0, 'common', '🍳', '+2 Steps. Pantries you place later give +2 more.', {
    discover: true,
    onPlace: (c) => c.gain('steps', 2),
    passive: { onPlace: (c) => { if (c.room.id === 'pantry') c.gain('steps', 2); } },
  }),
  dining: R('dining', 'Dining Hall', 'violet', 'L', 1, 'uncommon', '🍽️', '+1 Step. +3 more if Kitchen is on this floor.', {
    discover: true,
    onPlace: (c) => { c.gain('steps', 1); if (c.s.cells.some((x) => x && x.id === 'kitchen')) c.gain('steps', 3); },
  }),
  pantry: R('pantry', 'Pantry', 'green', 'D', 0, 'common', '🫙', '+1 Gem. +2 Coins if Kitchen placed. Dead end.', {
    discover: true,
    onPlace: (c) => { c.gain('gems', 1); if (c.s.cells.some((x) => x && x.id === 'kitchen')) c.gain('coins', 2); },
  }),
  armory: R('armory', 'Armory', 'gold', 'T', 1, 'uncommon', '⚔️', '+1 Key. Unlocks adjacent locked doorways.', {
    discover: true,
    onPlace: (c) => { c.gain('keys', 1); c.unlockAround(); },
  }),
  gatehouse: R('gatehouse', 'Gatehouse', 'gold', 'I', 0, 'common', '🏰', '+1 Key. +1 more if 2+ doorways are locked.', {
    discover: true,
    onPlace: (c) => { c.gain('keys', 1); if (Object.keys(c.s.lockedCells).length >= 2) c.gain('keys', 1); },
  }),
  maproom: R('maproom', 'Map Room', 'blue', 'L', 0, 'uncommon', '🗺️', '+1 Reroll. If Study placed, +1 card for 2 drafts.', {
    discover: true,
    onPlace: (c) => { c.gain('rerolls', 1); if (c.s.cells.some((x) => x && x.id === 'study')) c.buff('extraDraw', 2); },
  }),
  cloister: R('cloister', 'Cloister', 'ivory', 'L', 1, 'rare', '⛪', 'Calm 6. +1 Key, +1 Gem.', {
    discover: true, calm: 6,
    onPlace: (c) => { c.gain('keys', 1); c.gain('gems', 1); },
  }),
};

export const isDraftable = (id) => !['entrance', 'vault', 'stair', 'closet', 'rubble'].includes(id);
