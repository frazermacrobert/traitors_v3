import { getRoomById, rotateDoors, FAMILIES } from '../data/rooms.js';

const DIR_NAMES = ['North', 'East', 'South', 'West'];
const SHAPE_NAMES = { D: 'Dead End', I: 'Corridor', L: 'Corner', T: 'T-junction', X: 'Crossroads' };

export function generateClue(bpCell, blueprint, rng, existingClues) {
  const room = getRoomById(bpCell.roomId);
  const doors = rotateDoors(room.doors, bpCell.rot);
  const usedTypes = new Set(existingClues.map(c => c.type));

  const generators = [
    { type: 'family', fn: () => familyClue(room) },
    { type: 'shape', fn: () => shapeClue(room) },
    { type: 'doors', fn: () => doorClue(doors) },
    { type: 'cost', fn: () => costClue(room) },
    { type: 'neighbor', fn: () => neighborClue(bpCell, blueprint) },
    { type: 'name', fn: () => nameClue(room) },
  ];

  const available = generators.filter(g => !usedTypes.has(g.type));
  const gen = available.length > 0
    ? available[Math.floor(rng() * available.length)]
    : generators[Math.floor(rng() * generators.length)];

  return { type: gen.type, text: gen.fn() };
}

function familyClue(room) {
  return `This cell wants a **${room.family}** room`;
}

function shapeClue(room) {
  return `A **${SHAPE_NAMES[room.shape]}** piece belongs here`;
}

function doorClue(doors) {
  const dirs = [];
  for (let i = 0; i < 4; i++) {
    if (doors[i]) dirs.push(DIR_NAMES[i]);
  }
  return `This cell faces **${dirs.join(' and ')}**`;
}

function costClue(room) {
  return `The room here costs **${room.cost} Gem${room.cost !== 1 ? 's' : ''}**`;
}

function neighborClue(bpCell, blueprint) {
  const DIR = [[0,-1],[1,0],[0,1],[-1,0]];
  const neighbors = [];
  for (const [dx, dy] of DIR) {
    const nc = bpCell.c + dx;
    const nr = bpCell.r + dy;
    const n = blueprint.cells.find(cell => cell.c === nc && cell.r === nr);
    if (n) {
      const nRoom = getRoomById(n.roomId);
      neighbors.push(nRoom.name);
    }
  }
  if (neighbors.length === 0) return familyClue(getRoomById(bpCell.roomId));
  const name = neighbors[Math.floor(Math.random() * neighbors.length)];
  return `This room is **adjacent to the ${name}**`;
}

function nameClue(room) {
  const firstWord = room.name.split(' ')[0];
  return `The room here starts with "**${firstWord}...**"`;
}
