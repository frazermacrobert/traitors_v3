import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateBlueprint, newGame, newRun, act, getProgress, canPlace, cellKey, COLS, ROWS } from '../js/engine/engine.js';
import { getRoomById, rotateDoors } from '../js/data/rooms.js';
import { generateClue } from '../js/engine/clues.js';
import { mulberry32 } from '../js/engine/rng.js';

describe('RNG', () => {
  it('is deterministic with the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      assert.equal(a(), b());
    }
  });

  it('produces different values for different seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    let same = 0;
    for (let i = 0; i < 50; i++) {
      if (a() === b()) same++;
    }
    assert.ok(same < 5);
  });
});

describe('Blueprint Generation', () => {
  it('generates a valid blueprint', () => {
    const bp = generateBlueprint(12345);
    assert.ok(bp.cells.length > 10, `Should have >10 rooms, got ${bp.cells.length}`);
    assert.ok(bp.cells.length <= 45, `Should have <=45 rooms`);
    assert.equal(bp.seed, 12345);
  });

  it('is deterministic', () => {
    const a = generateBlueprint(99);
    const b = generateBlueprint(99);
    assert.equal(a.cells.length, b.cells.length);
    for (let i = 0; i < a.cells.length; i++) {
      assert.equal(a.cells[i].roomId, b.cells[i].roomId);
      assert.equal(a.cells[i].rot, b.cells[i].rot);
      assert.equal(a.cells[i].c, b.cells[i].c);
      assert.equal(a.cells[i].r, b.cells[i].r);
    }
  });

  it('includes the entrance at bottom-center', () => {
    const bp = generateBlueprint(42);
    const entrance = bp.cells.find(c => c.roomId === 999);
    assert.ok(entrance, 'Should have entrance');
    assert.equal(entrance.c, 2);
    assert.equal(entrance.r, 6);
  });

  it('all rooms are within bounds', () => {
    const bp = generateBlueprint(555);
    for (const cell of bp.cells) {
      assert.ok(cell.c >= 0 && cell.c < COLS, `col ${cell.c} out of bounds`);
      assert.ok(cell.r >= 0 && cell.r < ROWS, `row ${cell.r} out of bounds`);
    }
  });

  it('all doors connect properly (no dangling doors into placed neighbors)', () => {
    const bp = generateBlueprint(777);
    const placed = new Map();
    for (const cell of bp.cells) {
      placed.set(cellKey(cell.c, cell.r), cell);
    }
    const DIR = [[0,-1],[1,0],[0,1],[-1,0]];
    const OPP = [2,3,0,1];
    for (const cell of bp.cells) {
      const room = getRoomById(cell.roomId);
      const doors = rotateDoors(room.doors, cell.rot);
      for (let d = 0; d < 4; d++) {
        const nc = cell.c + DIR[d][0];
        const nr = cell.r + DIR[d][1];
        const nk = cellKey(nc, nr);
        const neighbor = placed.get(nk);
        if (neighbor) {
          const nRoom = getRoomById(neighbor.roomId);
          const nDoors = rotateDoors(nRoom.doors, neighbor.rot);
          if (doors[d]) {
            assert.ok(nDoors[OPP[d]], `Door mismatch at ${cell.c},${cell.r} dir ${d} -> ${nc},${nr}`);
          }
        }
      }
    }
  });

  it('different seeds produce different blueprints', () => {
    const a = generateBlueprint(1);
    const b = generateBlueprint(2);
    const sameCount = a.cells.filter((c, i) =>
      i < b.cells.length && c.roomId === b.cells[i].roomId && c.c === b.cells[i].c && c.r === b.cells[i].r
    ).length;
    assert.ok(sameCount < a.cells.length, 'Different seeds should produce different layouts');
  });
});

describe('Game Lifecycle', () => {
  it('creates a new game', () => {
    const game = newGame(42);
    assert.ok(game.blueprint);
    assert.ok(game.clueJournal);
    assert.ok(game.meta);
    assert.equal(game.meta.runs, 0);
  });

  it('starts a run', () => {
    let game = newGame(42);
    game = newRun(game);
    assert.ok(game.run);
    assert.equal(game.run.phase, 'drafting');
    assert.ok(game.run.steps > 0);
    assert.ok(game.run.keys > 0);
    assert.ok(game.run.draft.length > 0);
  });

  it('can select a draft card', () => {
    let game = newGame(42);
    game = newRun(game);
    game = act(game, { type: 'selectDraft', index: 0 });
    assert.equal(game.run.phase, 'placing');
    assert.equal(game.run.selectedDraft, 0);
  });

  it('can preview and cancel a placement', () => {
    let game = newGame(42);
    game = newRun(game);
    game = act(game, { type: 'selectDraft', index: 0 });
    assert.equal(game.run.phase, 'placing');
    const openDoors = game.run.openDoors;
    if (openDoors.length > 0) {
      const { c, r } = openDoors[0];
      const prev = act(game, { type: 'previewCell', c, r });
      if (prev.run.phase === 'previewing') {
        assert.ok(prev.run.preview);
        const cancelled = act(prev, { type: 'cancelPreview' });
        assert.equal(cancelled.run.phase, 'placing');
        assert.equal(cancelled.run.preview, null);
      }
    }
  });

  it('tracks run count on end', () => {
    let game = newGame(42);
    game = newRun(game);
    game = act(game, { type: 'endRun' });
    assert.equal(game.meta.runs, 1);
    assert.equal(game.run.phase, 'ended');
  });
});

describe('Placement', () => {
  it('entrance is auto-locked', () => {
    let game = newGame(42);
    game = newRun(game);
    const ek = cellKey(2, 6);
    assert.ok(game.locked[ek], 'Entrance should be locked');
  });

  it('has open doors after start', () => {
    let game = newGame(42);
    game = newRun(game);
    assert.ok(game.run.openDoors.length > 0, 'Should have open doors');
  });
});

describe('Clue System', () => {
  it('generates a clue for a blueprint cell', () => {
    const bp = generateBlueprint(42);
    const cell = bp.cells.find(c => c.roomId !== 999);
    const rng = mulberry32(1);
    const clue = generateClue(cell, bp, rng, []);
    assert.ok(clue.type);
    assert.ok(clue.text);
    assert.ok(clue.text.length > 0);
  });

  it('generates different clue types', () => {
    const bp = generateBlueprint(42);
    const cell = bp.cells.find(c => c.roomId !== 999);
    const types = new Set();
    for (let i = 0; i < 20; i++) {
      const rng = mulberry32(i * 7);
      const clue = generateClue(cell, bp, rng, []);
      types.add(clue.type);
    }
    assert.ok(types.size >= 3, `Should have at least 3 clue types, got ${types.size}`);
  });

  it('avoids duplicate clue types', () => {
    const bp = generateBlueprint(42);
    const cell = bp.cells.find(c => c.roomId !== 999);
    const existing = [{ type: 'family', text: 'test' }];
    const rng = mulberry32(1);
    const clue = generateClue(cell, bp, rng, existing);
    assert.notEqual(clue.type, 'family');
  });

  it('spending a key reveals a clue via act', () => {
    let game = newGame(42);
    game = newRun(game);
    const bp = game.blueprint;
    const target = bp.cells.find(c => c.roomId !== 999);
    if (!target) return;
    const keysBefore = game.run.keys;
    game = act(game, { type: 'tapClue', c: target.c, r: target.r });
    const key = cellKey(target.c, target.r);
    assert.equal(game.run.keys, keysBefore - 1);
    assert.ok(game.clueJournal[key]);
    assert.ok(game.clueJournal[key].length === 1);
  });
});

describe('Upgrades', () => {
  it('can buy an upgrade with enough ink', () => {
    let game = newGame(42);
    game.meta.ink = 20;
    game = act(game, { type: 'buyUpgrade', upgrade: 'steps' });
    assert.equal(game.meta.upgrades.steps, 1);
    assert.equal(game.meta.ink, 15);
  });

  it('cannot buy upgrade without enough ink', () => {
    let game = newGame(42);
    game.meta.ink = 1;
    game = act(game, { type: 'buyUpgrade', upgrade: 'steps' });
    assert.equal(game.meta.upgrades.steps || 0, 0);
  });

  it('cannot exceed max level', () => {
    let game = newGame(42);
    game.meta.ink = 100;
    game.meta.upgrades.steps = 3;
    game = act(game, { type: 'buyUpgrade', upgrade: 'steps' });
    assert.equal(game.meta.upgrades.steps, 3);
    assert.equal(game.meta.ink, 100);
  });
});

describe('Progress', () => {
  it('reports progress correctly', () => {
    let game = newGame(42);
    const progress = getProgress(game);
    assert.equal(progress.locked, 0);
    assert.ok(progress.total > 0);
    assert.equal(progress.percent, 0);
  });
});
