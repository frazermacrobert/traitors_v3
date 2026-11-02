// Art: rooms are drawn as architectural floor-plan tiles. Solid black walls (poché), door-swing arcs,
// and plan-symbol furniture in ink over a flat gouache wash, with comic halftone shading. All drawn in code.
import { ROOMS, FAMILIES } from '../data/rooms.js';

export const INK = '#1b1a1f';
const PAPER = '#fbf8ef';
const RED = '#c8322a';

const esc0 = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const esc = esc0;

// ---------- plan-symbol primitives (100×100 tile; interior ≈ 16..84) ----------
const sw = 'stroke="#1b1a1f" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"';
const R = (x, y, w, h, fill = PAPER, rx = 1.5) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${sw}/>`;
const C = (cx, cy, r, fill = PAPER) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${sw}/>`;
const L = (x1, y1, x2, y2, w = 2.4) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${INK}" stroke-width="${w}" stroke-linecap="round"/>`;
const P = (d, fill = PAPER) => `<path d="${d}" fill="${fill}" ${sw}/>`;

const A = {
  bed: (x, y, w = 26, h = 36) => R(x, y, w, h) + R(x + 3, y + 3, w - 6, h * 0.2, '#e9e4d4') + L(x, y + h * 0.48, x + w, y + h * 0.48) + L(x + w * 0.2, y + h * 0.48, x, y + h * 0.65, 1.6),
  dbed: (x, y, w = 36, h = 38) => R(x, y, w, h) + R(x + 3, y + 3, w / 2 - 5, h * 0.18, '#e9e4d4') + R(x + w / 2 + 2, y + 3, w / 2 - 5, h * 0.18, '#e9e4d4') + L(x, y + h * 0.45, x + w, y + h * 0.45),
  table: (cx, cy, r = 10) => [0, 90, 180, 270].map((a) => { const t = (a * Math.PI) / 180; return R(cx + Math.cos(t) * (r + 6) - 4, cy + Math.sin(t) * (r + 6) - 4, 8, 8); }).join('') + C(cx, cy, r),
  rtable: (x, y, w = 34, h = 16) => [0.25, 0.75].map((f) => R(x + w * f - 4, y - 9, 8, 7) + R(x + w * f - 4, y + h + 2, 8, 7)).join('') + R(x, y, w, h),
  sofa: (x, y, w = 34, h = 14) => R(x, y, w, h * 0.45) + R(x, y, w * 0.16, h) + R(x + w * 0.84, y, w * 0.16, h) + R(x + w * 0.16, y + h * 0.45, w * 0.68, h * 0.55),
  chair: (x, y, s = 12) => R(x, y, s, s * 0.35) + R(x, y + s * 0.35, s, s * 0.65),
  plant: (cx, cy, r = 9, fill = PAPER) => [0, 60, 120, 180, 240, 300].map((a) => `<ellipse cx="${cx}" cy="${cy - r * 0.55}" rx="${r * 0.32}" ry="${r * 0.55}" transform="rotate(${a} ${cx} ${cy})" fill="${fill}" ${sw}/>`).join('') + `<circle cx="${cx}" cy="${cy}" r="${r * 0.18}" fill="${INK}"/>`,
  tree: (cx, cy, r = 14, fill = PAPER) => [0, 72, 144, 216, 288].map((a) => { const t = (a * Math.PI) / 180; return `<circle cx="${cx + Math.cos(t) * r * 0.45}" cy="${cy + Math.sin(t) * r * 0.45}" r="${r * 0.55}" fill="${fill}" ${sw}/>`; }).join('') + `<circle cx="${cx}" cy="${cy}" r="${r * 0.2}" fill="${INK}"/>`,
  shelf: (x, y, w = 36, h = 8) => R(x, y, w, h) + [1, 2, 3].map((i) => L(x + (w * i) / 4, y, x + (w * i) / 4, y + h, 1.6)).join(''),
  stairs: (x, y, w = 20, h = 36, n = 7) => R(x, y, w, h) + Array.from({ length: n - 1 }, (_, i) => L(x, y + (h * (i + 1)) / n, x + w, y + (h * (i + 1)) / n, 1.6)).join('') + L(x + w / 2, y + h - 4, x + w / 2, y + 6, 1.8) + P(`M${x + w / 2 - 4} ${y + 10} L${x + w / 2} ${y + 4} L${x + w / 2 + 4} ${y + 10}`, 'none'),
  bath: (x, y, w = 20, h = 34) => R(x, y, w, h, PAPER, 5) + R(x + 3, y + 3, w - 6, h - 6, '#e9e4d4', 8) + `<circle cx="${x + w / 2}" cy="${y + h - 8}" r="1.6" fill="${INK}"/>`,
  stove: (x, y, s = 20) => R(x, y, s, s) + [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]].map(([a, b]) => `<circle cx="${x + s * a}" cy="${y + s * b}" r="${s * 0.13}" fill="none" ${sw}/>`).join(''),
  counter: (x, y, w = 44, h = 10) => R(x, y, w, h) + L(x + 4, y + h / 2, x + w - 4, y + h / 2, 1.2),
  rug: (x, y, w = 40, h = 26, fill = '#ffffff55') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${fill}" stroke="${INK}" stroke-width="1.6" stroke-dasharray="3 2.5"/>` + `<rect x="${x + 4}" y="${y + 4}" width="${w - 8}" height="${h - 8}" fill="none" stroke="${INK}" stroke-width="1.2"/>`,
  fire: (x, y, w = 26) => R(x, y, w, 9, '#e9e4d4') + R(x + w * 0.25, y + 9, w * 0.5, 6) + Array.from({ length: 4 }, (_, i) => L(x + 3 + i * (w - 6) / 3, y + 2, x + 1 + i * (w - 6) / 3, y + 7, 1.2)).join(''),
  crate: (x, y, s = 14) => R(x, y, s, s) + L(x, y, x + s, y + s, 1.6) + L(x + s, y, x, y + s, 1.6),
  statue: (cx, cy, r = 8) => R(cx - r - 3, cy - r - 3, 2 * r + 6, 2 * r + 6) + C(cx, cy, r, '#e9e4d4') + C(cx, cy, r * 0.35),
  desk: (x, y, w = 30, h = 14) => R(x, y, w, h) + R(x + 3, y + 3, 9, 6, '#e9e4d4') + A.chair(x + w / 2 - 6, y + h + 3, 12),
  fountain: (cx, cy, r = 16) => C(cx, cy, r, '#cfe7f2') + C(cx, cy, r * 0.55, '#e9f4f8') + C(cx, cy, r * 0.18) + [0, 90, 180, 270].map((a) => { const t = (a * Math.PI) / 180; return `<circle cx="${cx + Math.cos(t) * r * 0.78}" cy="${cy + Math.sin(t) * r * 0.78}" r="1.3" fill="${INK}"/>`; }).join(''),
  billiard: (x, y, w = 44, h = 26) => R(x, y, w, h, '#3f8f5a', 3) + [[0, 0], [0.5, 0], [1, 0], [0, 1], [0.5, 1], [1, 1]].map(([a, b]) => `<circle cx="${x + w * a}" cy="${y + h * b}" r="2.4" fill="${INK}"/>`).join('') + C(x + w * 0.3, y + h * 0.5, 2.6) + C(x + w * 0.65, y + h * 0.4, 2.6, RED),
  piano: (x, y) => P(`M${x} ${y} h30 v14 q0 18 -16 18 q-14 0 -14 -12 z`) + R(x, y, 30, 5, INK) + A.chair(x + 9, y - 13, 12),
  clock: (cx, cy, r = 11) => C(cx, cy, r) + L(cx, cy, cx, cy - r * 0.65) + L(cx, cy, cx + r * 0.5, cy) + `<circle cx="${cx}" cy="${cy}" r="1.6" fill="${INK}"/>`,
  coins: (cx, cy) => [[0, 6], [-7, 2], [6, 0], [0, -4]].map(([dx, dy]) => `<ellipse cx="${cx + dx}" cy="${cy + dy}" rx="7" ry="4.5" fill="#f2c94c" ${sw}/>`).join(''),
  cards: (cx, cy) => [-18, 0, 18].map((a) => `<rect x="${cx - 6}" y="${cy - 9}" width="12" height="18" rx="1.5" transform="rotate(${a} ${cx} ${cy + 10})" fill="${PAPER}" ${sw}/>`).join(''),
  column: (cx, cy, r = 6) => C(cx, cy, r, '#e9e4d4') + C(cx, cy, r * 0.45),
  key: (cx, cy) => C(cx - 7, cy, 6) + R(cx - 1, cy - 2, 16, 4) + R(cx + 9, cy + 2, 3, 5) + R(cx + 4, cy + 2, 3, 4),
  safe: (cx, cy, s = 26) => R(cx - s / 2, cy - s / 2, s, s, '#d9d4c5', 3) + C(cx, cy, s * 0.28) + [0, 60, 120].map((a) => { const t = (a * Math.PI) / 180; return L(cx - Math.cos(t) * s * 0.28, cy - Math.sin(t) * s * 0.28, cx + Math.cos(t) * s * 0.28, cy + Math.sin(t) * s * 0.28, 1.6); }).join(''),
  rubble: (cx, cy) => P(`M${cx - 14} ${cy + 6} l6 -9 l7 3 l5 -6 l8 5 l-2 9 l-9 4 z`, '#cfc8b6') + P(`M${cx - 6} ${cy - 10} l7 -3 l4 6 l-6 4 z`, '#cfc8b6') + P(`M${cx + 9} ${cy - 4} l6 2 l-1 6 l-6 -1 z`, '#cfc8b6'),
  hole: (cx, cy, r = 14) => `<path d="M${cx - r} ${cy} q${r * 0.2} ${-r} ${r} ${-r * 0.9} q${r} ${r * 0.1} ${r * 0.9} ${r} q${-r * 0.1} ${r} ${-r} ${r * 0.9} q${-r * 0.8} 0 ${-r * 0.9} ${-r} z" fill="${INK}"/>` + L(cx - r - 4, cy - 6, cx - r + 2, cy - 2, 1.4) + L(cx + r + 3, cy + 7, cx + r - 2, cy + 3, 1.4),
  water: (x, y, w = 50, n = 4) => Array.from({ length: n }, (_, i) => `<path d="M${x} ${y + i * 9} q${w / 8} -5 ${w / 4} 0 t${w / 4} 0 t${w / 4} 0 t${w / 4} 0" fill="none" stroke="#1b1a1f" stroke-width="1.8" stroke-linecap="round"/>`).join(''),
  mirror: (cx, cy) => `<ellipse cx="${cx}" cy="${cy}" rx="9" ry="15" fill="#d8eef3" ${sw}/>` + L(cx - 3, cy - 8, cx + 2, cy - 2, 1.6) + L(cx - 1, cy + 2, cx + 3, cy + 6, 1.6),
  bell: (cx, cy) => P(`M${cx - 10} ${cy + 8} q0 -18 10 -18 q10 0 10 18 z`, '#f2c94c') + L(cx - 13, cy + 8, cx + 13, cy + 8) + `<circle cx="${cx}" cy="${cy + 11}" r="2.6" fill="${INK}"/>`,
  candle: (cx, cy) => R(cx - 3, cy - 2, 6, 12) + P(`M${cx} ${cy - 10} q4 4 0 7 q-4 -3 0 -7 z`, '#f2c94c'),
  telescope: (cx, cy) => L(cx, cy, cx - 9, cy + 13) + L(cx, cy, cx + 9, cy + 13) + L(cx, cy, cx, cy + 14) + `<rect x="${cx - 4}" y="${cy - 18}" width="8" height="22" rx="2" transform="rotate(35 ${cx} ${cy})" fill="${PAPER}" ${sw}/>`,
  idol: (cx, cy) => R(cx - 9, cy - 12, 18, 24, '#9a958a', 4) + `<circle cx="${cx - 3.5}" cy="${cy - 4}" r="1.8" fill="${INK}"/><circle cx="${cx + 3.5}" cy="${cy - 4}" r="1.8" fill="${INK}"/>` + L(cx - 4, cy + 4, cx + 4, cy + 4, 1.8),
  ghost: (cx, cy) => P(`M${cx - 10} ${cy + 12} v-12 q0 -12 10 -12 q10 0 10 12 v12 l-4 -4 l-3 4 l-3 -4 l-3 4 l-3 -4 z`, '#ffffff') + `<circle cx="${cx - 4}" cy="${cy - 2}" r="1.8" fill="${INK}"/><circle cx="${cx + 4}" cy="${cy - 2}" r="1.8" fill="${INK}"/>`,
  ladder: (x, y, w = 18, h = 40) => L(x, y, x, y + h, 3) + L(x + w, y, x + w, y + h, 3) + Array.from({ length: 5 }, (_, i) => L(x, y + 4 + i * (h - 8) / 4, x + w, y + 4 + i * (h - 8) / 4, 2)).join(''),
  crown: (cx, cy) => P(`M${cx - 16} ${cy + 9} l-2 -18 l10 9 l8 -14 l8 14 l10 -9 l-2 18 z`, '#f2c94c') + `<circle cx="${cx}" cy="${cy + 2}" r="2.6" fill="${RED}"/>`,
  mat: (cx, cy) => R(cx - 12, cy - 5, 24, 10, '#c9b58f') + L(cx, cy + 9, cx, cy + 20, 2) + P(`M${cx - 5} ${cy + 15} L${cx} ${cy + 21} L${cx + 5} ${cy + 15}`, 'none'),
  gem: (cx, cy, s = 9) => P(`M${cx - s} ${cy - s * 0.3} l${s * 0.5} ${-s * 0.6} h${s} l${s * 0.5} ${s * 0.6} l${-s} ${s * 1.1} z`, '#7fd4e6') + L(cx - s, cy - s * 0.3, cx + s, cy - s * 0.3, 1.4),
  arrows: (cx, cy) => L(cx - 14, cy, cx + 14, cy) + L(cx, cy - 14, cx, cy + 14) + P(`M${cx + 9} ${cy - 4} L${cx + 14} ${cy} L${cx + 9} ${cy + 4}`, 'none') + P(`M${cx - 4} ${cy - 9} L${cx} ${cy - 14} L${cx + 4} ${cy - 9}`, 'none'),
  gear: (cx, cy, r = 11) => Array.from({ length: 8 }, (_, i) => `<rect x="${cx - 2.5}" y="${cy - r - 4}" width="5" height="7" transform="rotate(${i * 45} ${cx} ${cy})" fill="${PAPER}" ${sw}/>`).join('') + C(cx, cy, r) + C(cx, cy, r * 0.35, '#e9e4d4'),
  tub: (cx, cy) => C(cx, cy, 14, '#cfe7f2') + C(cx, cy, 9, '#e9f4f8'),
  dish: (cx, cy) => C(cx, cy, 10) + C(cx, cy, 5, '#e9e4d4'),
};

// Furniture recipes per room (fallbacks by family below).
const ART = {
  entrance: () => A.mat(50, 44) + A.plant(26, 30, 7) + A.plant(74, 30, 7),
  vault: () => A.safe(50, 46, 34),
  stair: () => A.stairs(38, 22, 24, 50),
  closet: () => A.shelf(22, 22, 56, 8) + A.crate(40, 46, 16),
  rubble: () => A.rubble(50, 50),
  foyer: () => A.rug(28, 34, 44, 28) + A.plant(26, 26, 6) + A.plant(74, 26, 6),
  parlour: () => A.sofa(24, 24, 40, 14) + A.table(46, 58, 7) + A.chair(68, 56, 12),
  gallery: () => R(20, 20, 26, 5, '#e9e4d4') + R(54, 20, 26, 5, '#e9e4d4') + R(20, 75, 26, 5, '#e9e4d4') + A.statue(50, 50, 6),
  study: () => A.desk(26, 30, 34, 14) + A.shelf(22, 70, 56, 8),
  musicroom: () => A.piano(28, 36) + A.chair(66, 30, 12),
  cloakroom: () => A.shelf(20, 22, 60, 8) + [26, 38, 50, 62, 74].map((x) => L(x, 30, x, 46, 1.8)).join(''),
  library: () => A.shelf(20, 20, 60, 8) + A.shelf(20, 72, 60, 8) + A.table(50, 48, 8),
  atlas: () => A.rtable(28, 42, 44, 18) + A.clock(70, 26, 7),
  peephole: () => C(50, 48, 14, '#d8eef3') + C(50, 48, 6, INK),
  billiard: () => A.billiard(28, 34, 44, 28),
  guestbook: () => A.desk(30, 30, 40, 16) + A.candle(72, 66),
  copyroom: () => A.counter(22, 24, 56, 12) + A.cards(50, 56),
  drawingroom: () => A.sofa(22, 22, 34, 13) + A.sofa(44, 66, 34, 13) + A.table(50, 50, 6),
  archive: () => A.shelf(20, 22, 60, 8) + A.shelf(20, 40, 60, 8) + A.shelf(20, 58, 60, 8) + A.shelf(20, 76, 60, 6),
  vigil: () => A.candle(36, 46) + A.candle(50, 40) + A.candle(64, 46) + A.rug(30, 58, 40, 18),
  herb: () => A.plant(32, 34, 9) + A.plant(64, 34, 9) + A.plant(48, 62, 9),
  fern: () => A.plant(30, 50, 10) + A.plant(70, 50, 10),
  greenhouse: () => A.plant(32, 32, 8) + A.plant(66, 32, 8) + A.plant(32, 66, 8) + A.plant(66, 66, 8),
  terrace: () => A.table(50, 50, 9) + A.plant(26, 26, 6) + A.plant(74, 74, 6),
  rosegarden: () => [[30, 30], [50, 30], [70, 30], [30, 66], [50, 66], [70, 66]].map(([x, y]) => C(x, y, 5, '#f2a3a0')).join(''),
  courtyard: () => A.fountain(50, 50, 16) + A.plant(24, 24, 6) + A.plant(76, 76, 6),
  orchard: () => A.tree(32, 34, 12) + A.tree(66, 62, 12),
  pond: () => `<ellipse cx="50" cy="50" rx="26" ry="18" fill="#9fd1e0" ${sw}/>` + A.plant(42, 48, 5) + A.plant(60, 54, 4),
  vinery: () => [26, 42, 58, 74].map((x) => L(x, 22, x, 78, 1.6)).join('') + [30, 50, 66].map((y) => C(42, y, 4, '#8e5bb5')).join(''),
  mushroom: () => [[34, 40], [60, 34], [48, 62], [68, 64]].map(([x, y]) => P(`M${x - 8} ${y} q8 -12 16 0 z`, '#d9473a') + R(x - 2, y, 4, 6)).join(''),
  topiary: () => A.tree(30, 30, 9) + A.tree(70, 30, 9) + A.tree(30, 70, 9) + A.tree(70, 70, 9) + A.tree(50, 50, 9),
  arboretum: () => A.tree(34, 34, 13) + A.tree(66, 40, 11) + A.tree(46, 68, 11),
  glasshouse: () => [30, 50, 70].map((x) => L(x, 20, x, 80, 1.2)).join('') + [30, 50, 70].map((y) => L(20, y, 80, y, 1.2)).join('') + A.plant(50, 50, 9),
  guest: () => A.bed(34, 24, 30, 40) + A.chair(68, 66, 11),
  nursery: () => A.bed(26, 26, 22, 30) + A.rug(52, 52, 26, 22) + C(66, 32, 6, '#f2c94c'),
  dressing: () => A.shelf(20, 22, 60, 8) + A.mirror(50, 56),
  napnook: () => A.sofa(28, 40, 44, 18),
  kitchen: () => A.counter(20, 22, 60, 12) + A.stove(58, 50, 20) + A.rtable(24, 60, 24, 12),
  sunroom: () => A.chair(30, 32, 14) + A.chair(58, 32, 14) + A.plant(44, 64, 9),
  bathhouse: () => A.tub(50, 50),
  infirmary: () => A.bed(24, 26, 20, 34) + A.bed(56, 26, 20, 34) + R(44, 68, 12, 6, RED),
  garret: () => A.bed(30, 32, 24, 32) + A.candle(68, 40),
  bunkroom: () => A.bed(22, 24, 18, 30) + A.bed(42, 24, 18, 30) + A.bed(62, 24, 18, 30),
  suite: () => A.dbed(32, 22, 36, 40) + A.rug(26, 66, 48, 14),
  dormitory: () => [22, 40, 58].map((x) => A.bed(x, 22, 16, 26)).join('') + [22, 40, 58].map((x) => A.bed(x, 56, 16, 24)).join(''),
  hearth: () => A.fire(36, 18, 28) + A.chair(32, 54, 13) + A.chair(56, 54, 13),
  passage: () => A.rug(40, 20, 20, 60),
  bend: () => A.rug(40, 20, 20, 40) + A.rug(40, 40, 40, 20),
  junction: () => A.rug(20, 40, 60, 20) + A.rug(40, 20, 20, 20),
  servants: () => A.rug(40, 20, 20, 60) + A.crate(22, 22, 12) + A.crate(66, 66, 12),
  backstairs: () => A.stairs(38, 22, 24, 56),
  cloister: () => A.column(30, 30) + A.column(70, 30) + A.column(30, 70) + A.column(70, 70),
  crossway: () => A.arrows(50, 50),
  lamplit: () => A.rug(40, 20, 20, 60) + A.candle(28, 50) + A.candle(72, 50),
  colonnade: () => [24, 42, 60, 78].map((y) => A.column(32, y - 2, 5) + A.column(68, y - 2, 5)).join(''),
  gallerywalk: () => A.rug(40, 18, 20, 64) + R(22, 26, 5, 20, '#e9e4d4') + R(73, 54, 5, 20, '#e9e4d4'),
  lift: () => R(32, 30, 36, 36, '#d9d4c5') + L(50, 30, 50, 66) + P('M44 44 L50 38 L56 44', 'none') + P('M44 54 L50 60 L56 54', 'none'),
  skybridge: () => A.water(22, 26, 56, 2) + R(38, 20, 24, 60) + A.water(22, 66, 56, 2),
  rotunda: () => C(50, 50, 22, '#e9e4d4') + [0, 60, 120, 180, 240, 300].map((a) => { const t = (a * Math.PI) / 180; return A.column(50 + Math.cos(t) * 22, 50 + Math.sin(t) * 22, 4); }).join(''),
  tuckshop: () => A.counter(22, 26, 56, 12) + A.crate(28, 54, 14) + A.coins(62, 62),
  counting: () => A.desk(28, 26, 44, 16) + A.coins(50, 66),
  strongroom: () => A.safe(50, 48, 30),
  locksmith: () => A.counter(22, 24, 56, 10) + A.key(48, 54),
  keyrack: () => R(22, 22, 56, 6, '#e9e4d4') + A.key(38, 44) + A.key(48, 64),
  pawnshop: () => A.counter(20, 22, 60, 10) + A.clock(34, 56, 9) + A.gem(64, 58, 8),
  bank: () => A.safe(36, 40, 22) + A.coins(66, 62),
  commissary: () => A.shelf(20, 22, 60, 8) + A.crate(26, 52, 14) + A.crate(44, 58, 14) + A.crate(62, 52, 14),
  auction: () => R(36, 22, 28, 12) + [30, 44, 58, 72].map((x) => A.chair(x - 6, 54, 12)).join(''),
  mint: () => A.stove(24, 28, 22) + A.coins(62, 54),
  tollhouse: () => R(26, 40, 48, 8, '#f2c94c') + A.counter(30, 60, 40, 10),
  furnace: () => R(34, 30, 32, 34, '#9a958a', 3) + P('M44 56 q6 -10 0 -16 q10 6 6 16 z', '#e86a3c'),
  winecellar: () => [26, 42, 58].map((y) => A.shelf(20, y, 60, 8)).join('') + [32, 50, 68].map((x) => C(x, 74, 3, '#8e2b3a')).join(''),
  gambling: () => A.table(50, 48, 12) + A.cards(50, 44),
  boarded: () => A.crate(26, 26, 14) + L(20, 40, 80, 60, 5) + L(20, 60, 80, 40, 5),
  sinkhole: () => A.hole(50, 52, 15),
  flooded: () => A.water(22, 30, 56, 5),
  debtors: () => A.desk(28, 26, 44, 16) + R(30, 62, 40, 10, '#f2c94c'),
  haunted: () => A.bed(26, 26, 20, 28) + A.ghost(64, 54),
  mirror: () => A.mirror(50, 48) + L(42, 36, 58, 62, 1.6),
  idol: () => A.idol(50, 48) + A.candle(28, 66) + A.candle(72, 66),
  thieves: () => A.crate(26, 28, 16) + A.crate(46, 30, 12) + A.coins(62, 62),
  shrine: () => R(36, 26, 28, 22, '#e9e4d4') + A.candle(40, 64) + A.candle(60, 64),
  bellpull: () => A.bell(50, 46),
  trophy: () => R(22, 22, 56, 8, '#e9e4d4') + P('M42 44 h16 v6 q0 10 -8 10 q-8 0 -8 -10 z', '#f2c94c') + R(46, 60, 8, 8),
  secret: () => A.shelf(20, 22, 60, 8) + R(40, 30, 20, 50, '#00000022') + L(40, 30, 40, 80, 1.6),
  cartographer: () => A.rtable(26, 38, 48, 22) + A.gem(66, 70, 6),
  ballroom: () => A.rug(22, 22, 56, 56) + C(50, 50, 10, '#f2c94c'),
  clockwork: () => A.gear(40, 42, 11) + A.gear(62, 60, 8),
  architect: () => A.rtable(24, 30, 52, 26) + L(30, 38, 70, 50, 1.2) + L(30, 50, 70, 38, 1.2),
  belltower: () => A.bell(50, 48) + A.ladder(68, 28, 10, 36),
  observatory: () => C(50, 50, 24, '#e9e4d4') + A.telescope(50, 46),
  conservatory: () => C(50, 50, 24, '#d7ecd3') + A.plant(50, 50, 10) + A.plant(34, 36, 6) + A.plant(66, 64, 6),
  chapel: () => [30, 42, 54].map((y) => R(28, y, 44, 6, '#e9e4d4')).join('') + A.candle(50, 70),
  mirrors: () => A.mirror(30, 50) + A.mirror(50, 50) + A.mirror(70, 50),
};
const FAMILY_ART = {
  blue: () => A.rug(28, 30, 44, 30), green: () => A.plant(50, 50, 12), violet: () => A.bed(36, 26, 28, 40),
  amber: () => A.rug(40, 20, 20, 60), gold: () => A.coins(50, 50), crimson: () => A.rubble(50, 50), ivory: () => A.statue(50, 50, 10), special: () => '',
};

// Shared defs: halftone dots for comic shading.
export function gradientDefs() {
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <pattern id="ht" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="2.5" cy="2.5" r="1.05" fill="#000" fill-opacity=".22"/></pattern>
  </defs></svg>`;
}

const WALL = 9; // poché thickness
const O = 5; // outer inset
function walls(doors, locks) {
  // Each side: thick ink bar with a gap for a door, plus a door-swing arc (architectural convention).
  let s = '';
  const sides = [
    { x: O, y: O, w: 100 - 2 * O, h: WALL, gap: (a, b) => [[O, O, a - O, WALL], [b, O, 100 - O - b, WALL]] },
    { x: 100 - O - WALL, y: O, w: WALL, h: 100 - 2 * O, gap: (a, b) => [[100 - O - WALL, O, WALL, a - O], [100 - O - WALL, b, WALL, 100 - O - b]] },
    { x: O, y: 100 - O - WALL, w: 100 - 2 * O, h: WALL, gap: (a, b) => [[O, 100 - O - WALL, a - O, WALL], [b, 100 - O - WALL, 100 - O - b, WALL]] },
    { x: O, y: O, w: WALL, h: 100 - 2 * O, gap: (a, b) => [[O, O, WALL, a - O], [O, b, WALL, 100 - O - b]] },
  ];
  const a = 36, b = 64;
  for (let d = 0; d < 4; d++) {
    const side = sides[d];
    if (!doors[d]) { s += `<rect x="${side.x}" y="${side.y}" width="${side.w}" height="${side.h}" fill="${INK}"/>`; continue; }
    for (const [x, y, w, h] of side.gap(a, b)) s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${INK}"/>`;
    // door leaf + swing arc into the room
    const inner = O + WALL;
    const arcs = [
      `M${a} ${inner} L${a} ${inner + 26} M${a} ${inner + 26} A26 26 0 0 0 ${a + 26} ${inner}`,
      `M${100 - inner} ${a} L${100 - inner - 26} ${a} M${100 - inner - 26} ${a} A26 26 0 0 0 ${100 - inner} ${a + 26}`,
      `M${b} ${100 - inner} L${b} ${100 - inner - 26} M${b} ${100 - inner - 26} A26 26 0 0 0 ${b - 26} ${100 - inner}`,
      `M${inner} ${b} L${inner + 26} ${b} M${inner + 26} ${b} A26 26 0 0 0 ${inner} ${b - 26}`,
    ];
    s += `<path d="${arcs[d]}" fill="none" stroke="${INK}" stroke-width="1.3" stroke-dasharray="${locks[d] ? '0' : '2.5 2'}" opacity=".55"/>`;
    if (locks[d]) {
      const pos = [[50, O + WALL / 2], [100 - O - WALL / 2, 50], [50, 100 - O - WALL / 2], [O + WALL / 2, 50]][d];
      s += `<g transform="translate(${pos[0]} ${pos[1]})"><path d="M-4 -2 v-4 a4 4 0 0 1 8 0 v4" fill="none" stroke="${RED}" stroke-width="2.4"/><rect x="-6.5" y="-2" width="13" height="10" rx="2" fill="${RED}" stroke="${INK}" stroke-width="1.6"/></g>`;
    }
  }
  return s;
}

// A room tile.
export function roomSvg(id, doors, { locks = [], label = true, extra = '' } = {}) {
  const room = ROOMS[id];
  const fam = FAMILIES[room.family];
  const floor = (id === 'vault' || id === 'vault_side' || id === 'vault_open') ? '#f2c94c' : id === 'stair' ? '#c9d3cf' : fam.color;
  const art = (ART[id] || FAMILY_ART[room.family])();
  const words = room.name.split(' ');
  const two = label && words.length > 1 && room.name.length > 10;
  const lines = !label ? [] : two ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [room.name];
  const text = lines.length ? `<g font-family="'Architects Daughter', 'Comic Sans MS', cursive" font-size="11" font-weight="700" text-anchor="middle" fill="${INK}" paint-order="stroke" stroke="${PAPER}" stroke-width="3.2" stroke-linejoin="round">${lines.map((l, i) => `<text x="50" y="${two ? 74 + i * 11 : 82}">${esc0(l)}</text>`).join('')}</g>` : '';
  const dim = label ? 'opacity=".9"' : '';
  return `<svg viewBox="0 0 100 100" aria-label="${esc0(room.name)}">
<rect x="${O}" y="${O}" width="${100 - 2 * O}" height="${100 - 2 * O}" fill="${floor}"/>
<polygon points="${O + 30},${100 - O} ${100 - O},${100 - O} ${100 - O},${O + 30}" fill="url(#ht)"/>
<g ${dim}>${art}</g>
${walls(doors, locks)}${text}${extra}</svg>`;
}

// Small door-layout diagram for cards.
export function shapeSvg(doors) {
  const segs = [[[10, 10], [90, 10]], [[90, 10], [90, 90]], [[90, 90], [10, 90]], [[10, 90], [10, 10]]];
  let s = '';
  segs.forEach(([p, q], d) => {
    const mid = (t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    if (!doors[d]) s += `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke="${INK}" stroke-width="14" stroke-linecap="square"/>`;
    else {
      const a = mid(0.32), b = mid(0.68);
      s += `<line x1="${p[0]}" y1="${p[1]}" x2="${a[0]}" y2="${a[1]}" stroke="${INK}" stroke-width="14" stroke-linecap="square"/><line x1="${b[0]}" y1="${b[1]}" x2="${q[0]}" y2="${q[1]}" stroke="${INK}" stroke-width="14" stroke-linecap="square"/>`;
    }
  });
  return `<svg class="shape" viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" fill="#fbf8ef"/>${s}</svg>`;
}

// ---------- UI icons (ink glyphs; no emoji in the chrome) ----------
const ICONS = {
  steps: '<path d="M7 3c2 0 3 2 3 5s-1 5-3 5-3-2-3-5 1-5 3-5zM5 14h4v2a2 2 0 0 1-4 0zM17 7c2 0 3 2 3 5s-1 5-3 5-3-2-3-5 1-5 3-5zM15 18h4v2a2 2 0 0 1-4 0z"/>',
  gems: '<path d="M6 4h12l4 5-10 12L2 9z"/><path d="M2 9h20M9 4l3 17M15 4l-3 17" fill="none" stroke="#1b1a1f" stroke-width="1.4"/>',
  keys: '<circle cx="7" cy="12" r="4.5"/><path d="M11 10.5h11v3h-2v3h-3v-3h-6z"/>',
  coins: '<ellipse cx="12" cy="16" rx="8" ry="4"/><ellipse cx="12" cy="11" rx="8" ry="4"/><ellipse cx="12" cy="6.5" rx="8" ry="3.5"/>',
  rerolls: '<rect x="3" y="3" width="18" height="18" rx="4"/><g fill="#1b1a1f" stroke="none"><circle cx="8" cy="8" r="1.8"/><circle cx="16" cy="16" r="1.8"/><circle cx="12" cy="12" r="1.8"/></g>',
  ink: '<path d="M12 2l6 9-6 11-6-11z"/><circle cx="12" cy="11" r="1.8" fill="#fbf8ef" stroke="none"/>',
  dread: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3.5" fill="#fbf8ef"/><circle cx="12" cy="12" r="1.6" stroke="none"/>',
  deck: '<rect x="4" y="5" width="12" height="16" rx="2" transform="rotate(-10 10 13)"/><rect x="8" y="3" width="12" height="16" rx="2"/>',
  wing: '<path d="M3 21V9l9-6 9 6v12h-6v-7H9v7z"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18" fill="none" stroke-width="2.6"/>',
  stair: '<path d="M3 21h5v-5h5v-5h5V6h3" fill="none" stroke-width="2.6"/>',
  vault: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill="#fbf8ef"/><path d="M12 3v6M12 15v6M3 12h6M15 12h6" stroke="#fbf8ef" stroke-width="1.6"/>',
  sound: '<path d="M3 9h4l5-4v14l-5-4H3z"/><path d="M16 8c2 2 2 6 0 8M19 5c4 4 4 10 0 14" fill="none" stroke-width="2"/>',
  mute: '<path d="M3 9h4l5-4v14l-5-4H3z"/><path d="M16 9l5 6M21 9l-5 6" fill="none" stroke-width="2.2"/>',
};
export function icon(name, cls = '') {
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" stroke="#1b1a1f" stroke-width="1.4" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
}
