import { ROOMS, FAMILIES } from '../data/rooms.js';

const CORNERS = [[7, 7], [93, 7], [93, 93], [7, 93]]; // NW, NE, SE, SW
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const ln = (p, q, color, w = 6) => `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;
const RARITY_DOT = { uncommon: '#c9d6f0', rare: '#ffcf5a', legendary: '#ff7ad9' };

// One shared set of gradients, referenced by every tile.
export function gradientDefs() {
  const grads = Object.entries(FAMILIES).map(([k, f]) => `<linearGradient id="g-${k}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${f.color}" stop-opacity=".42"/><stop offset="1" stop-color="${f.deep}" stop-opacity=".95"/></linearGradient>`).join('');
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${grads}
    <linearGradient id="g-vault" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe08a" stop-opacity=".6"/><stop offset="1" stop-color="#5a3d00"/></linearGradient>
  </defs></svg>`;
}

// A room tile: gradient floor, glowing walls with door gaps, emoji art, optional label.
export function roomSvg(id, doors, { locks = [], label = true, extra = '' } = {}) {
  const room = ROOMS[id];
  const fam = FAMILIES[room.family];
  const vault = id === 'vault';
  const color = vault ? '#ffcf5a' : fam.color;
  let walls = '';
  let gaps = '';
  for (let d = 0; d < 4; d++) {
    const p = CORNERS[d], q = CORNERS[(d + 1) % 4];
    if (!doors[d]) { walls += ln(p, q, color); continue; }
    const a = lerp(p, q, 0.3), b = lerp(p, q, 0.7);
    walls += ln(p, a, color) + ln(b, q, color);
    gaps += locks[d] ? ln(a, b, '#ffcf5a', 5).replace('/>', ' stroke-dasharray="3 5"/>') : ln(a, b, color, 2).replace('/>', ' opacity=".35"/>');
  }
  const words = room.name.split(' ');
  const two = label && words.length > 1 && room.name.length > 10;
  const lines = !label ? [] : two ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [room.name];
  const text = lines.map((l, i) => `<text fill="#eef3ff" font-size="11.5" font-weight="700" text-anchor="middle" font-family="Manrope, system-ui, sans-serif" x="50" y="${two ? 74 + i * 12 : 80}">${esc(l)}</text>`).join('');
  const dot = RARITY_DOT[room.rarity] && !vault ? `<circle cx="82" cy="18" r="5" fill="${RARITY_DOT[room.rarity]}"/>` : '';
  return `<svg viewBox="0 0 100 100" aria-label="${esc(room.name)}">
<rect x="7" y="7" width="86" height="86" rx="12" fill="url(#g-${vault ? 'vault' : room.family})"/>
<rect x="7" y="7" width="86" height="86" rx="12" fill="none" stroke="${color}" stroke-opacity=".18" stroke-width="10"/>
${walls}${gaps}${dot}<text font-size="${label ? 30 : 44}" text-anchor="middle" dominant-baseline="central" x="50" y="${label ? 42 : 52}">${room.icon}</text>${text}${extra}</svg>`;
}

// A small diagram of the door layout, for cards.
export function shapeSvg(doors, color) {
  let s = '';
  for (let d = 0; d < 4; d++) {
    const p = CORNERS[d], q = CORNERS[(d + 1) % 4];
    if (!doors[d]) s += ln(p, q, color, 12);
    else s += ln(p, lerp(p, q, 0.3), color, 12) + ln(lerp(p, q, 0.7), q, color, 12);
  }
  return `<svg class="shape" viewBox="0 0 100 100">${s}</svg>`;
}

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
