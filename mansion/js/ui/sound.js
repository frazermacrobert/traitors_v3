let ctx;
function getCtx() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
  }
  return ctx;
}

function tone(freq, duration, type = 'sine', volume = 0.15) {
  const c = getCtx();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = volume;
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  o.connect(g);
  g.connect(c.destination);
  o.start();
  o.stop(c.currentTime + duration);
}

export function playPlace() { tone(440, 0.12, 'triangle', 0.1); }
export function playLock() {
  tone(523, 0.15, 'sine', 0.15);
  setTimeout(() => tone(659, 0.15, 'sine', 0.15), 80);
  setTimeout(() => tone(784, 0.25, 'sine', 0.12), 160);
}
export function playClue() { tone(330, 0.2, 'triangle', 0.08); }
export function playDraft() { tone(392, 0.08, 'triangle', 0.06); }
export function playError() { tone(220, 0.3, 'sawtooth', 0.05); }
export function playWin() {
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sine', 0.12), i * 150));
}
export function playEndRun() { tone(262, 0.4, 'triangle', 0.08); }
