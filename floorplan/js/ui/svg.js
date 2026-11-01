import { ROOMS, FAMILIES } from '../data/rooms.js';

const CORNERS = [[4, 4], [96, 4], [96, 96], [4, 96]]; // NW, NE, SE, SW
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const ln = (p, q, color) => `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke="${color}" stroke-width="5" stroke-linecap="round"/>`;
const lk = (p, q) => `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke="#ffd84a" stroke-width="7" stroke-dasharray="4 4"/>`;

// Draws a room tile: tinted floor, walls with door gaps, icon and (optionally) a label.
export function roomSvg(id, doors, { locks = [], label = true, extra = '' } = {}) {
  const room = ROOMS[id];
  const fam = FAMILIES[room.family];
  const color = id === 'vault' ? '#ffd84a' : fam.color;
  let walls = '';
  for (let d = 0; d < 4; d++) {
    const p = CORNERS[d], q = CORNERS[(d + 1) % 4];
    if (!doors[d]) { walls += ln(p, q, color); continue; }
    const a = lerp(p, q, 0.32), b = lerp(p, q, 0.68);
    walls += ln(p, a, color) + ln(b, q, color);
    if (locks[d]) walls += lk(a, b);
  }
  const icon = id === 'vault' ? '♛' : id === 'entrance' ? '⌂' : fam.icon;
  const words = room.name.split(' ');
  const lines = label ? (words.length > 1 && room.name.length > 9 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [room.name]) : [];
  const text = lines.map((l, i) => `<text fill="#e8f1ff" font-size="12.5" font-weight="600" text-anchor="middle" x="50" y="${lines.length === 2 ? 72 + i * 13 : 80}">${esc(l)}</text>`).join('');
  return `<svg viewBox="0 0 100 100" aria-label="${esc(room.name)}">
<rect x="4" y="4" width="92" height="92" rx="5" fill="${color}" fill-opacity="${id === 'vault' ? 0.22 : 0.14}"/>
${walls}<text fill="${color}" font-size="${label ? 30 : 40}" font-weight="700" text-anchor="middle" x="50" y="${label ? 52 : 63}">${icon}</text>${text}${extra}</svg>`;
}

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
