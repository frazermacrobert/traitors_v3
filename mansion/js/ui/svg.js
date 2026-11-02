import { getRoomById, rotateDoors } from '../data/rooms.js';

const SIZE = 60;
const HALF = SIZE / 2;
const DOOR_W = 14;
const WALL_COLOR = 'var(--ink)';
const FLOOR_COLOR = 'var(--card)';
const GOLD_COLOR = 'var(--gold)';
const DOOR_COLOR = 'var(--sage)';

export function roomSvg(roomId, rot, options = {}) {
  const room = getRoomById(roomId);
  if (!room) return emptyCellSvg(options);

  const doors = rotateDoors(room.doors, rot);
  const { locked, ghosted, highlighted } = options;

  const fill = locked ? GOLD_COLOR : (ghosted ? 'var(--ghost)' : FLOOR_COLOR);
  const strokeW = 2;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" class="room-tile${locked ? ' locked' : ''}${highlighted ? ' highlighted' : ''}">`;

  // Floor
  svg += `<rect x="2" y="2" width="${SIZE-4}" height="${SIZE-4}" rx="3" fill="${fill}" stroke="${WALL_COLOR}" stroke-width="${strokeW}"/>`;

  // Draw doors as gaps in the walls
  const doorPositions = [
    { x: HALF - DOOR_W/2, y: 0, w: DOOR_W, h: 4 },       // N
    { x: SIZE - 4, y: HALF - DOOR_W/2, w: 4, h: DOOR_W }, // E
    { x: HALF - DOOR_W/2, y: SIZE - 4, w: DOOR_W, h: 4 }, // S
    { x: 0, y: HALF - DOOR_W/2, w: 4, h: DOOR_W },        // W
  ];

  for (let d = 0; d < 4; d++) {
    if (doors[d]) {
      const dp = doorPositions[d];
      svg += `<rect x="${dp.x}" y="${dp.y}" width="${dp.w}" height="${dp.h}" fill="${fill}" stroke="none"/>`;
      // Door frame marks
      if (d === 0 || d === 2) {
        const y = d === 0 ? 1 : SIZE - 3;
        svg += `<line x1="${HALF - DOOR_W/2}" y1="${y}" x2="${HALF - DOOR_W/2}" y2="${y+2}" stroke="${DOOR_COLOR}" stroke-width="1.5"/>`;
        svg += `<line x1="${HALF + DOOR_W/2}" y1="${y}" x2="${HALF + DOOR_W/2}" y2="${y+2}" stroke="${DOOR_COLOR}" stroke-width="1.5"/>`;
      } else {
        const x = d === 3 ? 1 : SIZE - 3;
        svg += `<line x1="${x}" y1="${HALF - DOOR_W/2}" x2="${x+2}" y2="${HALF - DOOR_W/2}" stroke="${DOOR_COLOR}" stroke-width="1.5"/>`;
        svg += `<line x1="${x}" y1="${HALF + DOOR_W/2}" x2="${x+2}" y2="${HALF + DOOR_W/2}" stroke="${DOOR_COLOR}" stroke-width="1.5"/>`;
      }
    }
  }

  // Icon in center
  svg += `<text x="${HALF}" y="${HALF + 1}" text-anchor="middle" dominant-baseline="central" font-size="18">${room.icon}</text>`;

  // Room name below icon (small)
  const shortName = room.name.length > 10 ? room.name.slice(0, 9) + '…' : room.name;
  svg += `<text x="${HALF}" y="${HALF + 16}" text-anchor="middle" font-size="6" fill="${WALL_COLOR}" font-family="var(--font-body)" opacity="0.7">${shortName}</text>`;

  svg += '</svg>';
  return svg;
}

export function emptyCellSvg(options = {}) {
  const { openDoor, hasClue } = options;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" class="room-tile empty${openDoor ? ' open-door' : ''}">`;

  if (openDoor) {
    svg += `<rect x="2" y="2" width="${SIZE-4}" height="${SIZE-4}" rx="3" fill="none" stroke="var(--sage)" stroke-width="1.5" stroke-dasharray="4 3"/>`;
    svg += `<text x="${HALF}" y="${HALF}" text-anchor="middle" dominant-baseline="central" font-size="16" fill="var(--sage)" opacity="0.6">+</text>`;
  } else {
    svg += `<rect x="2" y="2" width="${SIZE-4}" height="${SIZE-4}" rx="3" fill="var(--paper)" stroke="var(--ink)" stroke-width="0.5" opacity="0.15"/>`;
  }

  if (hasClue) {
    svg += `<circle cx="${SIZE-8}" cy="8" r="4" fill="var(--mustard)" opacity="0.8"/>`;
  }

  svg += '</svg>';
  return svg;
}

export function miniCellSvg(state, c, r) {
  const key = `${c},${r}`;
  const locked = state.locked[key];
  const bpCell = state.blueprint.cells.find(cell => cell.c === c && cell.r === r);
  const hasClue = (state.clueJournal[key] || []).length > 0;

  const S = 20;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" class="mini-cell">`;

  if (locked) {
    svg += `<rect x="1" y="1" width="${S-2}" height="${S-2}" rx="2" fill="var(--gold)" stroke="var(--ink)" stroke-width="0.5"/>`;
  } else if (bpCell) {
    if (hasClue) {
      svg += `<rect x="1" y="1" width="${S-2}" height="${S-2}" rx="2" fill="var(--mustard)" stroke="var(--ink)" stroke-width="0.5" opacity="0.6"/>`;
    } else {
      svg += `<rect x="1" y="1" width="${S-2}" height="${S-2}" rx="2" fill="var(--card)" stroke="var(--ink)" stroke-width="0.5" opacity="0.3"/>`;
    }
  } else {
    svg += `<rect x="1" y="1" width="${S-2}" height="${S-2}" rx="2" fill="none" stroke="var(--ink)" stroke-width="0.3" opacity="0.1"/>`;
  }

  svg += '</svg>';
  return svg;
}
