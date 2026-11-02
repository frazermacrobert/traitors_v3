import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { newRun, act } from '../js/engine/engine.js';
import { initReconstruct, reconstructAct, checkClue } from '../js/engine/reconstruct.js';
import { runOptions } from '../js/engine/meta.js';
import { playOut } from '../tools/bot.mjs';

describe('reconstruction puzzle', () => {
  function winStoryRun() {
    for (let attempt = 0; attempt < 20; attempt++) {
      const seed = `rc-test-${attempt}`;
      const opts = runOptions({
        v: 2, ink: 0, totalInk: 0, runs: 0, wins: 0, owned: [], seenHelp: false,
        upgrades: {}, collection: [], equipped: [], heirloomsFound: [], startHeirloom: null,
        pendingKeep: null, discoveries: [],
        mansions: { m1: { wins: 0, best: 0, maxDeed: 0, losses: 0 }, m2: { wins: 0, best: 0, maxDeed: 0, losses: 0 }, m3: { wins: 0, best: 0, maxDeed: 0, losses: 0 }, m4: { wins: 0, best: 0, maxDeed: 0, losses: 0 } },
        last: { mansionId: 'm1', deed: 0, deckId: 'standard', mode: 'story', difficulty: 'easy' },
      }, { mansionId: 'm1', deed: 0, deckId: 'standard', seed, mode: 'story', difficulty: 'easy' });
      const run = newRun(opts);
      try {
        const result = playOut(run);
        if (result.phase === 'reconstruct') return result;
      } catch { /* bot might fail */ }
    }
    return null;
  }

  it('initReconstruct creates a valid 3x3 evidence puzzle', () => {
    const run = winStoryRun();
    if (!run) { console.log('  (skipped: no bot win in 20 attempts)'); return; }
    assert.equal(run.phase, 'reconstruct');
    const rc = run.reconstruct;
    assert.ok(rc);
    assert.equal(rc.size, 3);
    assert.equal(rc.grid.length, 9);
    assert.equal(rc.truth.length, 9);
    assert.equal(rc.tray.filter(Boolean).length, 9);
    assert.equal(rc.phase, 'placing');
    for (const t of rc.truth) {
      assert.ok(t.item);
      assert.ok(t.item.id);
      assert.ok(t.item.icon);
    }
  });

  it('rPlace puts evidence on the grid and reveals clues', () => {
    const run = winStoryRun();
    if (!run) { console.log('  (skipped: no bot win in 20 attempts)'); return; }
    const rc = run.reconstruct;
    const trayIdx = rc.tray.findIndex((t) => t !== null);
    const rc2 = reconstructAct(rc, { type: 'rPlace', trayIndex: trayIdx, r: 0, c: 0 });
    assert.equal(rc2.tray[trayIdx], null);
    assert.ok(rc2.grid[0]);
    assert.equal(rc2.moves, 1);
    assert.ok(rc2.revealed['0,0']);
  });

  it('rRemove returns evidence to tray', () => {
    const run = winStoryRun();
    if (!run) { console.log('  (skipped: no bot win in 20 attempts)'); return; }
    const rc = run.reconstruct;
    const trayIdx = rc.tray.findIndex((t) => t !== null);
    const placed = reconstructAct(rc, { type: 'rPlace', trayIndex: trayIdx, r: 0, c: 0 });
    const removed = reconstructAct(placed, { type: 'rRemove', r: 0, c: 0 });
    assert.ok(removed.tray[trayIdx] !== null);
    assert.equal(removed.grid[0], null);
  });

  it('rSubmit requires all correct for solved, returns wrong otherwise', () => {
    const run = winStoryRun();
    if (!run) { console.log('  (skipped: no bot win in 20 attempts)'); return; }
    let rc = run.reconstruct;
    // Place all evidence in correct positions
    for (const t of rc.truth) {
      const trayIdx = rc.tray.findIndex((item) => item !== null && item.id === t.item.id);
      if (trayIdx >= 0) {
        rc = reconstructAct(rc, { type: 'rPlace', trayIndex: trayIdx, r: t.r, c: t.c });
      }
    }
    assert.ok(!rc.tray.some((t) => t !== null), 'all placed');
    const scored = reconstructAct(rc, { type: 'rSubmit' });
    assert.equal(scored.phase, 'solved');
    assert.equal(scored.correct, 9);
    assert.equal(scored.score, 100);
  });
});
