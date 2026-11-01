// Tiny synthesized sound kit (Web Audio). Muted by default; starts only after a tap.
let ctx = null;
let enabled = false;

export function setSound(on) { enabled = on; if (on) ensure(); }
export const soundOn = () => enabled;

function ensure() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; } }
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq, { dur = 0.12, type = 'sine', gain = 0.08, at = 0, slide = 0 } = {}) {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

const SFX = {
  tap: () => tone(660, { dur: 0.05, type: 'triangle', gain: 0.04 }),
  deal: () => { tone(420, { dur: 0.06, type: 'triangle', gain: 0.04 }); tone(520, { dur: 0.06, type: 'triangle', gain: 0.04, at: 0.05 }); },
  place: () => { tone(180, { dur: 0.16, type: 'sine', gain: 0.12, slide: -60 }); tone(900, { dur: 0.05, type: 'triangle', gain: 0.03, at: 0.02 }); },
  gain: () => { tone(880, { dur: 0.08, type: 'sine', gain: 0.05 }); tone(1320, { dur: 0.1, type: 'sine', gain: 0.04, at: 0.06 }); },
  wing: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, { dur: 0.16, type: 'triangle', gain: 0.05, at: i * 0.07 })),
  dread: () => { tone(90, { dur: 0.6, type: 'sawtooth', gain: 0.05, slide: -30 }); tone(95, { dur: 0.6, type: 'sine', gain: 0.06, at: 0.05 }); },
  mystery: () => [392, 466, 554].forEach((f, i) => tone(f, { dur: 0.25, type: 'sine', gain: 0.04, at: i * 0.1 })),
  clear: () => [392, 523, 659, 784].forEach((f, i) => tone(f, { dur: 0.22, type: 'triangle', gain: 0.06, at: i * 0.09 })),
  win: () => [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, { dur: 0.35, type: 'triangle', gain: 0.07, at: i * 0.11 })),
  lose: () => [330, 294, 247, 196].forEach((f, i) => tone(f, { dur: 0.3, type: 'sine', gain: 0.06, at: i * 0.14 })),
  error: () => tone(140, { dur: 0.12, type: 'square', gain: 0.03 }),
};

export function sfx(name) { if (enabled && SFX[name]) { try { SFX[name](); } catch { /* ignore */ } } }
