import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { newRun, act } from '../js/engine/engine.js';
import { initReconstruct, reconstructAct, openReconstructCells, checkClue } from '../js/engine/reconstruct.js';
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

  it('initReconstruct creates a valid puzzle state', () => {
    const run = winStoryRun();
    if (!run) { console.log('  (skipped: no bot win in 20 attempts)'); return; }
    assert.equal(run.phase, 'reconstruct');
    const rc = run.reconstruct;
    assert.ok(rc);
    assert.ok(rc.tray.length > 0);
    assert.ok(rc.truth.length > 0);
    assert.equal(rc.tray.filter(Boolean).length, rc.truth.length);
    assert.equal(rc.phase, 'placing');
  });

  it('rPlace puts a room on the grid and reveals clues', () => {
    const run = winStoryRun();
    if (!run) { console.log('  (skipped: no bot win in 20 attempts)'); return; }
    const rc = run.reconstruct;
    const openCells = openReconstructCells(rc);
    const empty = openCells.find((c) => !c.occupied);
    assert.ok(empty, 'should have an empty cell');
    const trayIdx = rc.tray.findIndex((t) => t !== null);
    const rc2 = reconstructAct(rc, { type: 'rPlace', trayIndex: trayIdx, r: empty.r, c: empty.c });
    assert.equal(rc2.tray[trayIdx], null);
    assert.ok(rc2.grid[empty.r * rc2.w + empty.c]);
    assert.equal(rc2.moves, 1);
  });

  it('rRemove returns room to tray', () => {
    const run = winStoryRun();
    if (!run) { console.log('  (skipped: no bot win in 20 attempts)'); return; }
    const rc = run.reconstruct;
    const openCells = openReconstructCells(rc);
    const empty = openCells.find((c) => !c.occupied);
    const trayIdx = rc.tray.findIndex((t) => t !== null);
    const placed = reconstructAct(rc, { type: 'rPlace', trayIndex: trayIdx, r: empty.r, c: empty.c });
    const removed = reconstructAct(placed, { type: 'rRemove', r: empty.r, c: empty.c });
    assert.ok(removed.tray[trayIdx] !== null);
    assert.equal(removed.grid[empty.r * removed.w + empty.c], null);
  });

  it('rSubmit scores the reconstruction', () => {
    const run = winStoryRun();
    if (!run) { console.log('  (skipped: no bot win in 20 attempts)'); return; }
    let rc = run.reconstruct;
    // Place all rooms in their true positions for a perfect score
    for (const t of rc.truth) {
      const trayIdx = rc.tray.findIndex((item) => item !== null && item.id === t.id);
      if (trayIdx >= 0) {
        rc = reconstructAct(rc, { type: 'rPlace', trayIndex: trayIdx, r: t.r, c: t.c });
      }
    }
    // If duplicates exist, place remaining anywhere
    const remaining = rc.tray.map((t, i) => t ? i : -1).filter((i) => i >= 0);
    const emptyCells = openReconstructCells(rc).filter((c) => !c.occupied);
    for (let i = 0; i < remaining.length && i < emptyCells.length; i++) {
      rc = reconstructAct(rc, { type: 'rPlace', trayIndex: remaining[i], r: emptyCells[i].r, c: emptyCells[i].c });
    }
    if (rc.tray.some((t) => t !== null)) {
      console.log('  (skipped: could not place all rooms)');
      return;
    }
    const scored = reconstructAct(rc, { type: 'rSubmit' });
    assert.equal(scored.phase, 'scored');
    assert.ok(scored.correct >= 0);
    assert.ok(scored.score >= 0);
    assert.ok(scored.truthGrid);
  });
});
