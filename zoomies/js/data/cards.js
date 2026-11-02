// Door arrays: [N, E, S, W] — true means path exits that side
export const SHAPES = {
  I: [true, false, true, false],   // Straight N-S
  L: [true, true, false, false],   // Corner N-E
  T: [true, true, true, false],    // T-junction N-E-S
  X: [true, true, true, true],     // Crossroads
  D: [true, false, false, false],  // Dead end N
};

export function rotateDoors(doors, rot) {
  const r = ((rot % 4) + 4) % 4;
  const d = [...doors];
  for (let i = 0; i < r; i++) {
    const last = d.pop();
    d.unshift(last);
  }
  return d;
}

export const PATH_CARDS = [
  ...Array(10).fill(null).map((_, i) => ({ id: `straight_${i}`, shape: 'I', label: 'Straight' })),
  ...Array(12).fill(null).map((_, i) => ({ id: `corner_${i}`, shape: 'L', label: 'Corner' })),
  ...Array(8).fill(null).map((_, i) => ({ id: `tjunction_${i}`, shape: 'T', label: 'T-junction' })),
  ...Array(4).fill(null).map((_, i) => ({ id: `crossroads_${i}`, shape: 'X', label: 'Crossroads' })),
  ...Array(4).fill(null).map((_, i) => ({ id: `deadend_${i}`, shape: 'D', label: 'Dead End', treatBonus: 1 })),
  { id: 'tunnel_0', shape: 'I', label: 'Tunnel', tunnel: true },
  { id: 'tunnel_1', shape: 'I', label: 'Tunnel', tunnel: true },
];

export const HAZARD_CARDS = [
  { id: 'squirrel_0', hazard: 'squirrel', label: 'Squirrel!' },
  { id: 'squirrel_1', hazard: 'squirrel', label: 'Squirrel!' },
  { id: 'squirrel_2', hazard: 'squirrel', label: 'Squirrel!' },
  { id: 'muddy_0', hazard: 'muddy', label: 'Muddy Puddle' },
  { id: 'muddy_1', hazard: 'muddy', label: 'Muddy Puddle' },
  { id: 'muddy_2', hazard: 'muddy', label: 'Muddy Puddle' },
  { id: 'whistle_0', hazard: 'whistle', label: 'Recall Whistle' },
  { id: 'whistle_1', hazard: 'whistle', label: 'Recall Whistle' },
];

export function buildDeck() {
  return [...PATH_CARDS, ...HAZARD_CARDS];
}
