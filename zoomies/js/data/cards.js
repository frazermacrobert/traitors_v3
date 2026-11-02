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

export const PATH_CARDS = [
  ...Array(18).fill(null).map((_, i) => ({ id: `lane_${i}`, shape: 'I', label: 'Lane', icon: 'lane' })),
  ...Array(20).fill(null).map((_, i) => ({ id: `bend_${i}`, shape: 'L', label: 'Bend', icon: 'bend' })),
  ...Array(14).fill(null).map((_, i) => ({ id: `fork_${i}`, shape: 'T', label: 'Fork', icon: 'fork' })),
  ...Array(8).fill(null).map((_, i) => ({ id: `dogpark_${i}`, shape: 'X', label: 'Dog Park', icon: 'dogpark' })),
  ...Array(6).fill(null).map((_, i) => ({ id: `sniff_${i}`, shape: 'D', label: 'Sniff Spot', icon: 'sniff' })),
  ...Array(4).fill(null).map((_, i) => ({ id: `rollspot_${i}`, shape: 'I', label: 'Roll Spot', icon: 'rollspot', bonus: 'shuffle' })),
];

export const HAZARD_CARDS = [
  { id: 'squirrel_0', hazard: 'squirrel', label: 'Squirrel!' },
  { id: 'squirrel_1', hazard: 'squirrel', label: 'Squirrel!' },
  { id: 'puddle_0', hazard: 'puddle', label: 'Muddy Puddle' },
  { id: 'puddle_1', hazard: 'puddle', label: 'Muddy Puddle' },
  { id: 'meancat_0', hazard: 'meancat', label: 'Mean Cat' },
];

export function buildDeck() {
  return [...PATH_CARDS, ...HAZARD_CARDS];
}
