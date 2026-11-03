import { getRoomById, rotateDoors, FAMILY_COLORS } from '../data/rooms.js';

const SIZE = 60;
const HALF = SIZE / 2;
const DOOR_GAP = 14;
const WALL_T = 5;
const SWING_R = 10;

function familyFill(family) {
  const fc = FAMILY_COLORS[family];
  return fc ? fc.color : '#efe8d6';
}
function familyDeep(family) {
  const fc = FAMILY_COLORS[family];
  return fc ? fc.deep : '#6b6250';
}

function halftonePattern(id, color) {
  return `<defs><pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="0.7" fill="${color}" opacity="0.18"/></pattern></defs>`;
}

export function roomSvg(roomId, rot, options = {}) {
  const room = getRoomById(roomId);
  if (!room) return emptyCellSvg(options);

  const doors = rotateDoors(room.doors, rot);
  const { locked, ghosted, highlighted } = options;

  const floorColor = locked ? 'var(--gold)' : (ghosted ? 'rgba(122,154,109,0.12)' : familyFill(room.family));
  const wallColor = locked ? 'var(--ink)' : familyDeep(room.family);
  const patId = `ht-${roomId}-${rot}`;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" class="room-tile${locked ? ' locked' : ''}${highlighted ? ' highlighted' : ''}">`;

  // halftone pattern
  if (!ghosted) {
    svg += halftonePattern(patId, wallColor);
  }

  // Floor fill
  svg += `<rect x="${WALL_T/2}" y="${WALL_T/2}" width="${SIZE-WALL_T}" height="${SIZE-WALL_T}" fill="${floorColor}"/>`;
  if (!ghosted) {
    svg += `<rect x="${WALL_T/2}" y="${WALL_T/2}" width="${SIZE-WALL_T}" height="${SIZE-WALL_T}" fill="url(#${patId})"/>`;
  }

  // Poché walls — thick bars on non-door sides
  const wallSegs = [
    // North wall
    { d: 0, x: 0, y: 0, w: SIZE, h: WALL_T },
    // East wall
    { d: 1, x: SIZE - WALL_T, y: 0, w: WALL_T, h: SIZE },
    // South wall
    { d: 2, x: 0, y: SIZE - WALL_T, w: SIZE, h: WALL_T },
    // West wall
    { d: 3, x: 0, y: 0, w: WALL_T, h: SIZE },
  ];

  for (const ws of wallSegs) {
    if (doors[ws.d]) {
      // Draw wall segments on either side of door gap
      if (ws.d === 0) { // North
        svg += `<rect x="0" y="0" width="${HALF - DOOR_GAP/2}" height="${WALL_T}" fill="${wallColor}"/>`;
        svg += `<rect x="${HALF + DOOR_GAP/2}" y="0" width="${HALF - DOOR_GAP/2}" height="${WALL_T}" fill="${wallColor}"/>`;
        // Door swing arc
        svg += `<path d="M${HALF - DOOR_GAP/2} ${WALL_T} A${SWING_R} ${SWING_R} 0 0 1 ${HALF - DOOR_GAP/2 + SWING_R} ${WALL_T + SWING_R}" fill="none" stroke="${wallColor}" stroke-width="0.6" opacity="0.4"/>`;
      } else if (ws.d === 2) { // South
        svg += `<rect x="0" y="${SIZE - WALL_T}" width="${HALF - DOOR_GAP/2}" height="${WALL_T}" fill="${wallColor}"/>`;
        svg += `<rect x="${HALF + DOOR_GAP/2}" y="${SIZE - WALL_T}" width="${HALF - DOOR_GAP/2}" height="${WALL_T}" fill="${wallColor}"/>`;
        svg += `<path d="M${HALF - DOOR_GAP/2} ${SIZE - WALL_T} A${SWING_R} ${SWING_R} 0 0 0 ${HALF - DOOR_GAP/2 + SWING_R} ${SIZE - WALL_T - SWING_R}" fill="none" stroke="${wallColor}" stroke-width="0.6" opacity="0.4"/>`;
      } else if (ws.d === 1) { // East
        svg += `<rect x="${SIZE - WALL_T}" y="0" width="${WALL_T}" height="${HALF - DOOR_GAP/2}" fill="${wallColor}"/>`;
        svg += `<rect x="${SIZE - WALL_T}" y="${HALF + DOOR_GAP/2}" width="${WALL_T}" height="${HALF - DOOR_GAP/2}" fill="${wallColor}"/>`;
        svg += `<path d="M${SIZE - WALL_T} ${HALF - DOOR_GAP/2} A${SWING_R} ${SWING_R} 0 0 0 ${SIZE - WALL_T - SWING_R} ${HALF - DOOR_GAP/2 + SWING_R}" fill="none" stroke="${wallColor}" stroke-width="0.6" opacity="0.4"/>`;
      } else { // West
        svg += `<rect x="0" y="0" width="${WALL_T}" height="${HALF - DOOR_GAP/2}" fill="${wallColor}"/>`;
        svg += `<rect x="0" y="${HALF + DOOR_GAP/2}" width="${WALL_T}" height="${HALF - DOOR_GAP/2}" fill="${wallColor}"/>`;
        svg += `<path d="M${WALL_T} ${HALF - DOOR_GAP/2} A${SWING_R} ${SWING_R} 0 0 1 ${WALL_T + SWING_R} ${HALF - DOOR_GAP/2 + SWING_R}" fill="none" stroke="${wallColor}" stroke-width="0.6" opacity="0.4"/>`;
      }
    } else {
      svg += `<rect x="${ws.x}" y="${ws.y}" width="${ws.w}" height="${ws.h}" fill="${wallColor}"/>`;
    }
  }

  // Room name — stroke halo text
  const shortName = room.name.length > 10 ? room.name.slice(0, 9) + '…' : room.name;
  const textY = HALF + 2;
  svg += `<text x="${HALF}" y="${textY}" text-anchor="middle" dominant-baseline="central" font-size="7" font-family="'Archivo',sans-serif" font-weight="600" fill="${floorColor}" stroke="${floorColor}" stroke-width="2.5" paint-order="stroke" opacity="0.95">${shortName}</text>`;
  svg += `<text x="${HALF}" y="${textY}" text-anchor="middle" dominant-baseline="central" font-size="7" font-family="'Archivo',sans-serif" font-weight="600" fill="${wallColor}">${shortName}</text>`;

  svg += '</svg>';
  return svg;
}

export function emptyCellSvg(options = {}) {
  const { openDoor, hasClue } = options;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" class="room-tile empty${openDoor ? ' open-door' : ''}">`;

  if (openDoor) {
    svg += `<rect x="2" y="2" width="${SIZE-4}" height="${SIZE-4}" fill="none" stroke="var(--sage)" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.5"/>`;
    svg += `<line x1="${HALF-6}" y1="${HALF}" x2="${HALF+6}" y2="${HALF}" stroke="var(--sage)" stroke-width="1.5" opacity="0.4"/>`;
    svg += `<line x1="${HALF}" y1="${HALF-6}" x2="${HALF}" y2="${HALF+6}" stroke="var(--sage)" stroke-width="1.5" opacity="0.4"/>`;
  } else {
    svg += `<rect x="2" y="2" width="${SIZE-4}" height="${SIZE-4}" fill="var(--paper)" stroke="var(--ink)" stroke-width="0.5" opacity="0.12"/>`;
  }

  if (hasClue) {
    svg += `<circle cx="${SIZE-8}" cy="8" r="3.5" fill="var(--mustard)" opacity="0.8"/>`;
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
    const room = getRoomById(locked.roomId);
    const fc = familyFill(room.family);
    svg += `<rect x="1" y="1" width="${S-2}" height="${S-2}" rx="2" fill="${fc}" stroke="var(--gold)" stroke-width="1.5"/>`;
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
