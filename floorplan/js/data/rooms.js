// Room definitions. Doors are [N, E, S, W] in the base orientation (rot 0).
// Effects receive a ctx (see engine.js makeCtx). Keep effects small and data-like.

export const SHAPES = {
  D: { name: 'Dead End', doors: [1, 0, 0, 0] },
  I: { name: 'Straight', doors: [1, 0, 1, 0] },
  L: { name: 'Corner', doors: [1, 1, 0, 0] },
  T: { name: 'Tee', doors: [1, 1, 0, 1] },
  X: { name: 'Cross', doors: [1, 1, 1, 1] },
};

export const FAMILIES = {
  blue: { name: 'Hall', color: '#5aa9ff', icon: '⌂' },
  green: { name: 'Garden', color: '#4fd18b', icon: '❦' },
  violet: { name: 'Chamber', color: '#b48cff', icon: '☾' },
  amber: { name: 'Corridor', color: '#ffb347', icon: '⇄' },
  gold: { name: 'Shop', color: '#ffd84a', icon: '¤' },
  crimson: { name: 'Cursed', color: '#ff5d6c', icon: '✸' },
  ivory: { name: 'Rarity', color: '#f3ecd8', icon: '✦' },
  special: { name: 'Landmark', color: '#9fd3ff', icon: '◆' },
};

const countFamily = (ctx, fam) => ctx.neighbors().filter((n) => n.room && n.room.family === fam).length;

const R = (id, name, family, shape, cost, rarity, text, extra = {}) => ({
  id, name, family, shape, cost, rarity, text, ...extra,
});

export const ROOMS = {
  // ---- Landmarks (never drafted) ----
  entrance: R('entrance', 'Entrance Hall', 'special', 'T', 0, 'common', 'Where every visit begins.'),
  vault: R('vault', 'The Vault', 'special', 'D', 0, 'rare', 'Connect a doorway to it to win.'),
  closet: R('closet', 'Broom Closet', 'blue', 'D', 0, 'common', 'Fallback. Does nothing.'),
  rubble: R('rubble', 'Rubble Heap', 'crimson', 'D', 0, 'common', 'Lose 1 Step.', {
    onPlace: (ctx) => ctx.gain('steps', -1),
  }),

  // ---- Blue Halls ----
  foyer: R('foyer', 'Foyer', 'blue', 'T', 0, 'common', 'A plain junction.'),
  parlour: R('parlour', 'Parlour', 'blue', 'L', 0, 'common', '+1 Coin.', { onPlace: (c) => c.gain('coins', 1) }),
  gallery: R('gallery', 'Gallery', 'blue', 'I', 0, 'common', '+1 Coin.', { onPlace: (c) => c.gain('coins', 1) }),
  study: R('study', 'Study', 'blue', 'D', 0, 'common', '+3 Coins.', { onPlace: (c) => c.gain('coins', 3) }),
  library: R('library', 'Library', 'blue', 'T', 1, 'uncommon', 'Your next 2 drafts show +1 card.', {
    onPlace: (c) => c.buff('extraDraw', 2),
  }),
  atlas: R('atlas', 'Atlas Room', 'blue', 'L', 1, 'uncommon', '+1 Reroll.', { onPlace: (c) => c.gain('rerolls', 1) }),
  drawingroom: R('drawingroom', 'Drawing Room', 'blue', 'X', 2, 'uncommon', '+1 Coin per connected neighbour.', {
    onPlace: (c) => c.gain('coins', c.neighbors().filter((n) => n.connected).length),
  }),

  // ---- Green Gardens ----
  herb: R('herb', 'Herb Garden', 'green', 'D', 0, 'common', '+1 Gem, +1 more per adjacent Garden.', {
    onPlace: (c) => c.gain('gems', 1 + countFamily(c, 'green')),
  }),
  fern: R('fern', 'Fern Walk', 'green', 'I', 0, 'common', '+1 Gem.', { onPlace: (c) => c.gain('gems', 1) }),
  courtyard: R('courtyard', 'Courtyard', 'green', 'X', 1, 'uncommon', '+1 Gem.', { onPlace: (c) => c.gain('gems', 1) }),
  greenhouse: R('greenhouse', 'Greenhouse', 'green', 'L', 0, 'common', '+1 Gem per adjacent Garden (min 1).', {
    onPlace: (c) => c.gain('gems', Math.max(1, countFamily(c, 'green'))),
  }),
  orchard: R('orchard', 'Orchard', 'green', 'T', 1, 'uncommon', '+2 Gems.', { onPlace: (c) => c.gain('gems', 2) }),
  topiary: R('topiary', 'Topiary Maze', 'green', 'X', 0, 'uncommon', '+1 Gem. Lose 1 Step.', {
    unlock: true, onPlace: (c) => { c.gain('gems', 1); c.gain('steps', -1); },
  }),

  // ---- Violet Chambers ----
  guest: R('guest', 'Guest Room', 'violet', 'D', 0, 'common', '+3 Steps.', { onPlace: (c) => c.gain('steps', 3) }),
  nursery: R('nursery', 'Nursery', 'violet', 'L', 0, 'common', '+2 Steps.', { onPlace: (c) => c.gain('steps', 2) }),
  dressing: R('dressing', 'Dressing Room', 'violet', 'I', 0, 'common', '+1 Step, +1 Coin.', {
    onPlace: (c) => { c.gain('steps', 1); c.gain('coins', 1); },
  }),
  sunroom: R('sunroom', 'Sunroom', 'violet', 'T', 1, 'uncommon', '+2 Steps.', { onPlace: (c) => c.gain('steps', 2) }),
  suite: R('suite', 'Master Suite', 'violet', 'D', 2, 'rare', '+5 Steps.', { onPlace: (c) => c.gain('steps', 5) }),
  bunkroom: R('bunkroom', 'Bunk Room', 'violet', 'I', 1, 'uncommon', '+1 Step per adjacent Chamber, +1.', {
    unlock: true, onPlace: (c) => c.gain('steps', 1 + countFamily(c, 'violet')),
  }),

  // ---- Amber Corridors ----
  passage: R('passage', 'Passage', 'amber', 'I', 0, 'common', 'Just a corridor.'),
  bend: R('bend', 'Bend', 'amber', 'L', 0, 'common', 'Just a corner.'),
  junction: R('junction', 'Junction', 'amber', 'T', 0, 'common', 'Three ways on.'),
  crossway: R('crossway', 'Crossway', 'amber', 'X', 1, 'uncommon', 'Four ways on.'),
  backstairs: R('backstairs', 'Back Stairs', 'amber', 'I', 0, 'common', '+1 Step if connected to another Corridor.', {
    onPlace: (c) => { if (c.neighbors().some((n) => n.connected && n.room.family === 'amber')) c.gain('steps', 1); },
  }),
  gallerywalk: R('gallerywalk', 'Long Gallery', 'amber', 'I', 0, 'uncommon', 'Your next draft costs no Step.', {
    unlock: true, onPlace: (c) => c.buff('freeDraft', 1),
  }),

  // ---- Gold Shops ----
  tuckshop: R('tuckshop', 'Tuck Shop', 'gold', 'D', 0, 'common', 'Opens a shop.', { onPlace: (c) => c.queue('shop') }),
  commissary: R('commissary', 'Commissary', 'gold', 'L', 1, 'uncommon', '+2 Coins, then opens a shop.', {
    unlock: true, onPlace: (c) => { c.gain('coins', 2); c.queue('shop'); },
  }),
  counting: R('counting', 'Counting House', 'gold', 'D', 0, 'common', '+4 Coins.', { onPlace: (c) => c.gain('coins', 4) }),
  locksmith: R('locksmith', 'Locksmith', 'gold', 'L', 1, 'uncommon', '+1 Key.', { onPlace: (c) => c.gain('keys', 1) }),
  strongroom: R('strongroom', 'Strongroom', 'gold', 'D', 0, 'common', '+1 Key.', { onPlace: (c) => c.gain('keys', 1) }),

  // ---- Crimson (powerful with drawbacks) ----
  furnace: R('furnace', 'Furnace Room', 'crimson', 'X', 0, 'common', 'Lose 2 Steps.', { onPlace: (c) => c.gain('steps', -2) }),
  winecellar: R('winecellar', 'Wine Cellar', 'crimson', 'L', 0, 'uncommon', '+3 Gems. Lose 2 Steps.', {
    onPlace: (c) => { c.gain('gems', 3); c.gain('steps', -2); },
  }),
  gambling: R('gambling', 'Card Room', 'crimson', 'T', 0, 'uncommon', 'Coin flip: +5 Coins, or lose 2 Steps.', {
    onPlace: (c) => { if (c.rand() < 0.5) c.gain('coins', 5); else c.gain('steps', -2); },
  }),
  boarded: R('boarded', 'Boarded Room', 'crimson', 'X', 0, 'uncommon', '+2 Gems. All its exits are locked.', {
    lockExits: true, onPlace: (c) => c.gain('gems', 2),
  }),
  shrine: R('shrine', 'Old Shrine', 'crimson', 'D', 0, 'rare', 'Lose 3 Steps. Choose an Heirloom.', {
    unlock: true, onPlace: (c) => { c.gain('steps', -3); c.queue('heirloom'); },
  }),

  // ---- Ivory Rarities ----
  trophy: R('trophy', 'Trophy Room', 'ivory', 'D', 2, 'rare', 'Choose an Heirloom.', { onPlace: (c) => c.queue('heirloom') }),
  secret: R('secret', 'Secret Passage', 'ivory', 'I', 1, 'rare', 'Your next 2 drafts cost no Steps.', {
    onPlace: (c) => c.buff('freeDraft', 2),
  }),
  observatory: R('observatory', 'Observatory', 'ivory', 'D', 2, 'rare', 'While it stands, every draft shows +1 card.', {
    unlock: true, passive: { drawCount: (n) => n + 1 },
  }),
  ballroom: R('ballroom', 'Ballroom', 'ivory', 'X', 3, 'rare', '+3 Steps, +2 Coins.', {
    unlock: true, onPlace: (c) => { c.gain('steps', 3); c.gain('coins', 2); },
  }),
  clockwork: R('clockwork', 'Clockwork Room', 'ivory', 'L', 2, 'rare', '+1 Step per Corridor in the house (max 5).', {
    unlock: true, onPlace: (c) => c.gain('steps', Math.min(5, c.placed((r) => r.family === 'amber').length)),
  }),
  architect: R('architect', "Architect's Office", 'ivory', 'T', 2, 'rare', 'Remove every Cursed card from your deck and discard.', {
    unlock: true, onPlace: (c) => c.purge((r) => r.family === 'crimson'),
  }),
};

export const isDraftable = (id) => !['entrance', 'vault', 'closet'].includes(id);
