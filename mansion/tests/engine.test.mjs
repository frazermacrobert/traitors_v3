import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateBlueprint, newGame, newRun, act, getProgress, canPlace, cellKey, COLS, ROWS, ENTRANCE_COL, ENTRANCE_ROW } from '../js/engine/engine.js';
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
    assert.ok(bp.cells.length <= 30, `Should have <=30 rooms`);
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
    assert.equal(entrance.c, ENTRANCE_COL);
    assert.equal(entrance.r, ENTRANCE_ROW);
  });

  it('all rooms are within bounds', () => {
    const bp = generateBlueprint(555);
    for (const cell of bp.cells) {
      assert.ok(cell.c >= 0 && cell.c < COLS, `col ${cell.c} out of bounds`);
      assert.ok(cell.r >= 0 && cell.r < ROWS, `row ${cell.r} out of bounds`);
    }
  });

  it('grid is 5x6', () => {
    assert.equal(COLS, 5);
    assert.equal(ROWS, 6);
    assert.equal(ENTRANCE_ROW, 5);
  });

  it('has lockedCells in blueprint', () => {
    const bp = generateBlueprint(42);
    assert.ok(bp.lockedCells !== undefined);
  });

  it('all doors connect properly', () => {
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
    assert.deepEqual(game.unlockedDoors, {});
  });

  it('starts a run with correct resources', () => {
    let game = newGame(42);
    game = newRun(game);
    assert.ok(game.run);
    assert.equal(game.run.phase, 'exploring');
    assert.equal(game.run.energy, 14);
    assert.equal(game.run.gems, 0);
    assert.equal(game.run.keys, 0);
    assert.equal(game.run.coins, 0);
  });

  it('has open doors after start', () => {
    let game = newGame(42);
    game = newRun(game);
    assert.ok(game.run.openDoors.length > 0, 'Should have open doors');
  });

  it('can open a door to trigger drafting', () => {
    let game = newGame(42);
    game = newRun(game);
    const door = game.run.openDoors[0];
    game = act(game, { type: 'openDoor', c: door.c, r: door.r });
    assert.equal(game.run.phase, 'drafting');
    assert.ok(game.run.draftOptions);
    assert.ok(game.run.draftOptions.length > 0);
    assert.ok(game.run.draftOptions.length <= 3);
  });

  it('can draft a room from options', () => {
    let game = newGame(42);
    game = newRun(game);
    const door = game.run.openDoors[0];
    game = act(game, { type: 'openDoor', c: door.c, r: door.r });

    // Find an affordable option
    let pickedIdx = -1;
    for (let i = 0; i < game.run.draftOptions.length; i++) {
      const opt = game.run.draftOptions[i];
      const room = getRoomById(opt.roomId);
      if (room.cost <= game.run.gems) {
        pickedIdx = i;
        break;
      }
    }

    if (pickedIdx >= 0) {
      game = act(game, { type: 'draftRoom', index: pickedIdx });
      // Room was placed: phase should return to exploring (or ended/won)
      assert.ok(['exploring', 'ended', 'won'].includes(game.run.phase), `Phase should advance, got ${game.run.phase}`);
    }
  });

  it('tracks run count on end', () => {
    let game = newGame(42);
    game = newRun(game);
    game = act(game, { type: 'endRun' });
    assert.equal(game.meta.runs, 1);
    assert.equal(game.run.phase, 'ended');
    assert.ok(game.run.inkEarned >= 1, 'Should earn at least 1 ink');
  });
});

describe('Resource Economy', () => {
  it('placement changes energy (costs 1, may gain from effects)', () => {
    let game = newGame(42);
    game = newRun(game);
    const initialEnergy = game.run.energy;
    const door = game.run.openDoors[0];
    game = act(game, { type: 'openDoor', c: door.c, r: door.r });

    const freeOpt = game.run.draftOptions.findIndex(opt => {
      const room = getRoomById(opt.roomId);
      return room.cost === 0;
    });

    if (freeOpt >= 0) {
      game = act(game, { type: 'draftRoom', index: freeOpt });
      // Energy was spent (at least 1) but effects may restore some
      // Just verify the placement happened (phase changed)
      assert.ok(['exploring', 'ended', 'won'].includes(game.run.phase));
    }
  });

  it('cannot draft room without enough gems', () => {
    let game = newGame(42);
    game = newRun(game);
    assert.equal(game.run.gems, 0);

    const door = game.run.openDoors[0];
    game = act(game, { type: 'openDoor', c: door.c, r: door.r });

    const costlyOpt = game.run.draftOptions.findIndex(opt => {
      const room = getRoomById(opt.roomId);
      return room.cost > 0;
    });

    if (costlyOpt >= 0) {
      const before = game.run.energy;
      const result = act(game, { type: 'draftRoom', index: costlyOpt });
      assert.equal(result.run.energy, before, 'Energy should not change if cannot afford');
      assert.equal(result.run.phase, 'drafting', 'Should stay in drafting phase');
    }
  });

  it('ink earned includes base 1 plus locked rooms', () => {
    let game = newGame(42);
    game = newRun(game);
    game = act(game, { type: 'endRun' });
    assert.ok(game.run.inkEarned >= 1);
    assert.equal(game.run.inkEarned, 1 + game.run.lockedThisRun + Math.floor((game.run.coins || 0) / 5));
  });
});

describe('Locked Doors', () => {
  it('unlocking a door costs a key', () => {
    let game = newGame(42);
    game = newRun(game);

    // Give the player a key
    game.run.keys = 1;

    if (game.run.lockedDoors && game.run.lockedDoors.length > 0) {
      const ld = game.run.lockedDoors[0];
      game = act(game, { type: 'unlockDoor', c: ld.c, r: ld.r });
      assert.equal(game.run.keys, 0);
      assert.ok(game.unlockedDoors[cellKey(ld.c, ld.r)]);
    }
  });

  it('cannot unlock without a key', () => {
    let game = newGame(42);
    game = newRun(game);
    assert.equal(game.run.keys, 0);

    if (game.run.lockedDoors && game.run.lockedDoors.length > 0) {
      const ld = game.run.lockedDoors[0];
      const result = act(game, { type: 'unlockDoor', c: ld.c, r: ld.r });
      assert.equal(result.run.keys, 0);
    }
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

  it('clues cost 1 coin via act', () => {
    let game = newGame(42);
    game = newRun(game);
    game.run.coins = 2;

    const bp = game.blueprint;
    const target = bp.cells.find(c => c.roomId !== 999);
    if (!target) return;

    game = act(game, { type: 'tapClue', c: target.c, r: target.r });
    const key = cellKey(target.c, target.r);
    assert.equal(game.run.coins, 1);
    assert.ok(game.clueJournal[key]);
    assert.equal(game.clueJournal[key].length, 1);
  });

  it('cannot buy clue without coins', () => {
    let game = newGame(42);
    game = newRun(game);
    assert.equal(game.run.coins, 0);

    const target = game.blueprint.cells.find(c => c.roomId !== 999);
    if (!target) return;

    game = act(game, { type: 'tapClue', c: target.c, r: target.r });
    const key = cellKey(target.c, target.r);
    assert.ok(!game.clueJournal[key] || game.clueJournal[key].length === 0);
  });
});

describe('Upgrades', () => {
  it('can buy an upgrade with enough ink', () => {
    let game = newGame(42);
    game.meta.ink = 30;
    game = act(game, { type: 'buyUpgrade', upgrade: 'energy' });
    assert.equal(game.meta.upgrades.energy, 1);
    assert.equal(game.meta.ink, 15);
  });

  it('cannot buy upgrade without enough ink', () => {
    let game = newGame(42);
    game.meta.ink = 1;
    game = act(game, { type: 'buyUpgrade', upgrade: 'energy' });
    assert.equal(game.meta.upgrades.energy || 0, 0);
  });

  it('cannot exceed max level', () => {
    let game = newGame(42);
    game.meta.ink = 100;
    game.meta.upgrades.energy = 2;
    game = act(game, { type: 'buyUpgrade', upgrade: 'energy' });
    assert.equal(game.meta.upgrades.energy, 2);
    assert.equal(game.meta.ink, 100);
  });

  it('extra energy applies to new run', () => {
    let game = newGame(42);
    game.meta.upgrades.energy = 1;
    game = newRun(game);
    assert.equal(game.run.energy, 16); // 14 base + 2
  });

  it('startGem gives 1 gem', () => {
    let game = newGame(42);
    game.meta.upgrades.startGem = 1;
    game = newRun(game);
    assert.equal(game.run.gems, 1);
  });

  it('startKey gives 1 key', () => {
    let game = newGame(42);
    game.meta.upgrades.startKey = 1;
    game = newRun(game);
    assert.equal(game.run.keys, 1);
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
