import { SHAPES, rotateDoors } from '../data/cards.js';

const SIZE = 60;
const PAD = 2;
const PATH_W = 14;
const CENTER = SIZE / 2;

const COLORS = {
  grass: '#90c96d',
  grassDark: '#7ab85a',
  path: '#d4a86a',
  pathStroke: '#b8864e',
  beach: '#f5d99a',
  beachWave: '#7ec8e3',
  squirrel: '#c0392b',
  muddy: '#795548',
  start: '#fff3e0',
  empty: '#a8d870',
  highlight: 'rgba(255, 215, 0, 0.4)',
  connected: 'rgba(76, 175, 80, 0.25)',
  target: 'rgba(255, 87, 34, 0.5)',
};

export function renderCell(cell, opts = {}) {
  const { isTarget, isConnected, showDots } = opts;
  let bg = COLORS.grass;
  let content = '';

  if (!cell) {
    const checker = opts.r !== undefined && (opts.r + opts.c) % 2 === 0;
    bg = checker ? COLORS.grass : COLORS.grassDark;
    if (showDots) {
      content = `<circle cx="${CENTER}" cy="${CENTER}" r="2" fill="rgba(0,0,0,0.1)"/>`;
    }
  } else if (cell.type === 'start') {
    bg = COLORS.start;
    content = renderPathways([true, true, true, true]) + renderDog();
  } else if (cell.type === 'path') {
    bg = COLORS.grass;
    const doors = cell.mudBlocked
      ? cell.doors.map((d, i) => d && !cell.mudBlocked.includes(i))
      : cell.doors;
    content = renderPathways(doors, cell.tunnel);
  } else if (cell.type === 'hazard') {
    bg = COLORS.grass;
    content = renderHazard(cell.hazard);
  } else if (cell.type === 'beach') {
    bg = COLORS.beach;
    content = renderBeach();
  }

  let overlays = '';
  if (isTarget) overlays += `<rect x="1" y="1" width="${SIZE - 2}" height="${SIZE - 2}" fill="${COLORS.target}" rx="4"/>`;
  if (isConnected) overlays += `<rect x="1" y="1" width="${SIZE - 2}" height="${SIZE - 2}" fill="${COLORS.connected}" rx="4"/>`;

  return `<svg viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
    <rect width="${SIZE}" height="${SIZE}" fill="${bg}" rx="3"/>
    ${content}
    ${overlays}
  </svg>`;
}

function renderPathways(doors, isTunnel) {
  let paths = '';
  const half = PATH_W / 2;

  if (isTunnel) {
    if (doors[0] && doors[2]) {
      paths += `<rect x="${CENTER - half}" y="0" width="${PATH_W}" height="${SIZE}" fill="${COLORS.path}" rx="2"/>`;
      paths += `<line x1="${CENTER - half}" y1="0" x2="${CENTER - half}" y2="${SIZE}" stroke="${COLORS.pathStroke}" stroke-width="1.5"/>`;
      paths += `<line x1="${CENTER + half}" y1="0" x2="${CENTER + half}" y2="${SIZE}" stroke="${COLORS.pathStroke}" stroke-width="1.5"/>`;
    } else if (doors[1] && doors[3]) {
      paths += `<rect x="0" y="${CENTER - half}" width="${SIZE}" height="${PATH_W}" fill="${COLORS.path}" rx="2"/>`;
      paths += `<line x1="0" y1="${CENTER - half}" x2="${SIZE}" y2="${CENTER - half}" stroke="${COLORS.pathStroke}" stroke-width="1.5"/>`;
      paths += `<line x1="0" y1="${CENTER + half}" x2="${SIZE}" y2="${CENTER + half}" stroke="${COLORS.pathStroke}" stroke-width="1.5"/>`;
    }
    paths += `<text x="${CENTER}" y="${CENTER + 1}" text-anchor="middle" dominant-baseline="middle" font-size="8" fill="${COLORS.pathStroke}" font-weight="bold">T</text>`;
    return paths;
  }

  paths += `<rect x="${CENTER - half}" y="${CENTER - half}" width="${PATH_W}" height="${PATH_W}" fill="${COLORS.path}" rx="2"/>`;

  if (doors[0]) {
    paths += `<rect x="${CENTER - half}" y="0" width="${PATH_W}" height="${CENTER}" fill="${COLORS.path}"/>`;
    paths += `<line x1="${CENTER - half}" y1="0" x2="${CENTER - half}" y2="${CENTER}" stroke="${COLORS.pathStroke}" stroke-width="1"/>`;
    paths += `<line x1="${CENTER + half}" y1="0" x2="${CENTER + half}" y2="${CENTER}" stroke="${COLORS.pathStroke}" stroke-width="1"/>`;
  }
  if (doors[2]) {
    paths += `<rect x="${CENTER - half}" y="${CENTER}" width="${PATH_W}" height="${CENTER}" fill="${COLORS.path}"/>`;
    paths += `<line x1="${CENTER - half}" y1="${CENTER}" x2="${CENTER - half}" y2="${SIZE}" stroke="${COLORS.pathStroke}" stroke-width="1"/>`;
    paths += `<line x1="${CENTER + half}" y1="${CENTER}" x2="${CENTER + half}" y2="${SIZE}" stroke="${COLORS.pathStroke}" stroke-width="1"/>`;
  }
  if (doors[1]) {
    paths += `<rect x="${CENTER}" y="${CENTER - half}" width="${CENTER}" height="${PATH_W}" fill="${COLORS.path}"/>`;
    paths += `<line x1="${CENTER}" y1="${CENTER - half}" x2="${SIZE}" y2="${CENTER - half}" stroke="${COLORS.pathStroke}" stroke-width="1"/>`;
    paths += `<line x1="${CENTER}" y1="${CENTER + half}" x2="${SIZE}" y2="${CENTER + half}" stroke="${COLORS.pathStroke}" stroke-width="1"/>`;
  }
  if (doors[3]) {
    paths += `<rect x="0" y="${CENTER - half}" width="${CENTER}" height="${PATH_W}" fill="${COLORS.path}"/>`;
    paths += `<line x1="0" y1="${CENTER - half}" x2="${CENTER}" y2="${CENTER - half}" stroke="${COLORS.pathStroke}" stroke-width="1"/>`;
    paths += `<line x1="0" y1="${CENTER + half}" x2="${CENTER}" y2="${CENTER + half}" stroke="${COLORS.pathStroke}" stroke-width="1"/>`;
  }

  // Paw prints
  const pawDirs = [];
  if (doors[0]) pawDirs.push([CENTER, CENTER - 12]);
  if (doors[2]) pawDirs.push([CENTER, CENTER + 12]);
  if (doors[1]) pawDirs.push([CENTER + 12, CENTER]);
  if (doors[3]) pawDirs.push([CENTER - 12, CENTER]);
  for (const [px, py] of pawDirs.slice(0, 2)) {
    paths += `<circle cx="${px - 2}" cy="${py - 2}" r="1.5" fill="rgba(0,0,0,0.15)"/>`;
    paths += `<circle cx="${px + 2}" cy="${py - 2}" r="1.5" fill="rgba(0,0,0,0.15)"/>`;
    paths += `<ellipse cx="${px}" cy="${py + 1}" rx="2.5" ry="2" fill="rgba(0,0,0,0.15)"/>`;
  }

  return paths;
}

function renderDog() {
  return `<text x="${CENTER}" y="${CENTER + 2}" text-anchor="middle" dominant-baseline="middle" font-size="22">🐕</text>`;
}

function renderHazard(type) {
  const icons = { squirrel: '🐿️', muddy: '💧', whistle: '📢' };
  const bgs = { squirrel: '#ffebee', muddy: '#efebe9', whistle: '#fff3e0' };
  return `<rect x="4" y="4" width="${SIZE - 8}" height="${SIZE - 8}" fill="${bgs[type] || '#eee'}" rx="8" stroke="#d32f2f" stroke-width="1.5" stroke-dasharray="3,2"/>
    <text x="${CENTER}" y="${CENTER + 2}" text-anchor="middle" dominant-baseline="middle" font-size="20">${icons[type] || '⚠️'}</text>`;
}

function renderBeach() {
  return `<rect x="3" y="3" width="${SIZE - 6}" height="${SIZE - 6}" fill="#f5d99a" rx="6"/>
    <path d="M5,${SIZE - 15} Q${CENTER},${SIZE - 22} ${SIZE - 5},${SIZE - 15}" fill="none" stroke="${COLORS.beachWave}" stroke-width="2"/>
    <path d="M5,${SIZE - 10} Q${CENTER},${SIZE - 17} ${SIZE - 5},${SIZE - 10}" fill="none" stroke="${COLORS.beachWave}" stroke-width="1.5" opacity="0.6"/>
    <text x="${CENTER}" y="${CENTER - 2}" text-anchor="middle" dominant-baseline="middle" font-size="18">🏖️</text>`;
}

export function renderCardPreview(card, rot = 0, size = 50) {
  const baseDoors = SHAPES[card.shape];
  const doors = rotateDoors(baseDoors, rot);
  const scale = size / SIZE;

  let content;
  if (card.hazard) {
    content = renderHazard(card.hazard);
  } else {
    content = renderPathways(doors, card.tunnel);
  }

  return `<svg viewBox="0 0 ${SIZE} ${SIZE}" width="${size}" height="${size}">
    <rect width="${SIZE}" height="${SIZE}" fill="#fef9ef" rx="5" stroke="#d4a86a" stroke-width="2"/>
    ${content}
  </svg>`;
}

export { SIZE, COLORS };
