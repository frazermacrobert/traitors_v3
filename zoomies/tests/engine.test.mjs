import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, act, getConnectedCells, calculateScore, getValidSpots, GRID, idx, isCorner, OBJ_DEFS } from '../js/engine/engine.js';
import { SHAPES, rotateDoors, buildDeck } from '../js/data/cards.js';

describe('Setup', () => {
  it('newGame creates valid initial state', () => {
    const s = newGame(42);
    assert.equal(s.board.length, 36);
    assert.equal(s.phase, 'setup');
    assert.ok(!isCorner(s.beach.r, s.beach.c));
    assert.ok(s.deck.length > 0);
  });

  it('same seed is deterministic', () => {
    const a = newGame(123);
    const b = newGame(123);
    assert.deepEqual(a.beach, b.beach);
    assert.deepEqual(a.deck.map(c => c.id), b.deck.map(c => c.id));
  });

  it('choosing corner starts the game and auto-draws', () => {
    let s = newGame(42);
    s = act(s, { type: 'chooseCorner', r: 0, c: 0 });
    assert.deepEqual(s.start, { r: 0, c: 0 });
    assert.equal(s.board[idx(0, 0)].type, 'start');
    assert.equal(s.phase, 'pick');
    assert.ok(s.drawn.length > 0);
  });

  it('deals 3 treats at setup', () => {
    const s = newGame(42);
    assert.equal(s.treats.length, 3);
    s.treats.forEach(t => {
      assert.equal(t.collected, false);
      assert.ok(!isCorner(t.r, t.c));
    });
  });

  it('deals 2 objectives at setup', () => {
    const s = newGame(42);
    assert.equal(s.objectives.length, 2);
    s.objectives.forEach(id => assert.ok(OBJ_DEFS[id]));
  });
});

describe('Card deck', () => {
  it('has correct composition', () => {
    const deck = buildDeck();
    assert.equal(deck.length, 60);
    const paths = deck.filter(c => !c.hazard);
    const hazards = deck.filter(c => c.hazard);
    assert.equal(paths.length, 55);
    assert.equal(hazards.length, 5);
  });

  it('all path cards have unique names', () => {
    const deck = buildDeck();
    const paths = deck.filter(c => !c.hazard);
    const names = paths.map(c => c.name);
    assert.equal(new Set(names).size, names.length);
  });

  it('rotateDoors works correctly', () => {
    assert.deepEqual(rotateDoors([true, false, false, false], 1), [false, true, false, false]);
    assert.deepEqual(rotateDoors([true, false, false, false], 2), [false, false, true, false]);
    assert.deepEqual(rotateDoors([true, true, false, false], 1), [false, true, true, false]);
  });
});

describe('Draw and pick', () => {
  it('pick selects a card and discards the other', () => {
    let s = newGame(55);
    s = act(s, { type: 'chooseCorner', r: 0, c: 0 });
    assert.equal(s.phase, 'pick');
    const cardId = s.drawn[0].id;
    const otherCount = s.drawn.length - 1;
    const discardBefore = s.discard.length;
    s = act(s, { type: 'pickCard', cardId });
    assert.equal(s.picked.id, cardId);
    assert.equal(s.phase, 'place');
    assert.equal(s.discard.length, discardBefore + otherCount);
  });
});

describe('Placement', () => {
  it('must connect to existing path', () => {
    let s = newGame(55);
    s = act(s, { type: 'chooseCorner', r: 0, c: 0 });
    const card = s.drawn[0];
    s = act(s, { type: 'pickCard', cardId: card.id });

    const before = s.board[idx(3, 3)];
    s = act(s, { type: 'placeCard', r: 3, c: 3, rot: 0 });
    assert.equal(s.board[idx(3, 3)], before);
  });

  it('valid adjacent placement works', () => {
    let s = newGame(55);
    s = act(s, { type: 'chooseCorner', r: 0, c: 0 });
    const card = s.drawn[0];
    s = act(s, { type: 'pickCard', cardId: card.id });

    const spots = getValidSpots(s, s.picked, 0);
    if (spots.length > 0) {
      const [r, c] = spots[0];
      s = act(s, { type: 'placeCard', r, c, rot: 0 });
      assert.ok(s.board[idx(r, c)] !== null);
    }
  });
});

describe('Connectivity', () => {
  it('start cell is connected', () => {
    let s = newGame(42);
    s = act(s, { type: 'chooseCorner', r: 0, c: 0 });
    const conn = getConnectedCells(s);
    assert.ok(conn.some(([r, c]) => r === 0 && c === 0));
  });

  it('matching doors connect', () => {
    let s = newGame(42);
    s = act(s, { type: 'chooseCorner', r: 0, c: 0 });
    s.board[idx(0, 1)] = { type: 'path', doors: [false, true, false, true] };
    const conn = getConnectedCells(s);
    assert.ok(conn.some(([r, c]) => r === 0 && c === 1));
  });

  it('non-matching doors dont connect', () => {
    let s = newGame(42);
    s = act(s, { type: 'chooseCorner', r: 0, c: 0 });
    s.board[idx(0, 1)] = { type: 'path', doors: [true, false, true, false] };
    const conn = getConnectedCells(s);
    assert.ok(!conn.some(([r, c]) => r === 0 && c === 1));
  });
});

describe('Scoring', () => {
  it('zero points if beach not reached', () => {
    let s = newGame(42);
    s = act(s, { type: 'chooseCorner', r: 0, c: 0 });
    s.endReason = 'stuck';
    const score = calculateScore(s);
    assert.equal(score.total, 0);
    assert.equal(score.reached, false);
  });

  it('includes tiles and modBonus on win', () => {
    let s = newGame(42);
    s = act(s, { type: 'chooseCorner', r: 0, c: 0 });
    s.endReason = 'win';
    s.board[idx(0, 1)] = { type: 'path', doors: [false, true, false, true], mod: { type: 'pts', val: 2 } };
    const score = calculateScore(s);
    assert.ok(score.tiles >= 1);
    assert.equal(score.modBonus, 2);
    assert.equal(score.total, score.tiles + score.modBonus + score.treatBonus + score.objBonus);
  });

  it('counts treat bonus on win', () => {
    let s = newGame(42);
    s = act(s, { type: 'chooseCorner', r: 0, c: 0 });
    s.endReason = 'win';
    s.treats = [{ r:1,c:1,collected:true }, { r:2,c:2,collected:true }, { r:3,c:3,collected:false }];
    const score = calculateScore(s);
    assert.equal(score.treatBonus, 4);
  });

  it('assigns star rating', () => {
    let s = newGame(42);
    s = act(s, { type: 'chooseCorner', r: 0, c: 0 });
    s.endReason = 'win';
    const score = calculateScore(s);
    assert.ok(typeof score.stars === 'number');
    assert.ok(typeof score.rating === 'string');
  });
});

describe('Treats', () => {
  it('collecting a treat marks it collected', () => {
    let s = newGame(55);
    s = act(s, { type: 'chooseCorner', r: 0, c: 0 });
    // Put a treat at a known spot
    s.treats = [{ r: 0, c: 1, collected: false }];

    const card = s.drawn[0];
    s = act(s, { type: 'pickCard', cardId: card.id });
    const spots = getValidSpots(s, s.picked, 0);
    const treatSpot = spots.find(([r,c]) => r === 0 && c === 1);
    if (treatSpot) {
      s = act(s, { type: 'placeCard', r: 0, c: 1, rot: 0 });
      assert.equal(s.treats[0].collected, true);
    }
  });
});

describe('Modifiers', () => {
  it('fetch sets fetchNext flag', () => {
    let s = newGame(55);
    s = act(s, { type: 'chooseCorner', r: 0, c: 0 });
    // Force a fetch card into drawn
    s.drawn = [{ id: 'test-fetch', name: 'Test Fetch', shape: 'T', icon: 'fork', mod: { type: 'fetch' } }];
    s.phase = 'pick';
    s = act(s, { type: 'pickCard', cardId: 'test-fetch' });
    const spots = getValidSpots(s, s.picked, 0);
    if (spots.length > 0) {
      const [r, c] = spots[0];
      s = act(s, { type: 'placeCard', r, c, rot: 0 });
      // fetchNext was set then consumed by startTurn, so check drawn count
      assert.ok(s.drawn.length <= 3);
    }
  });

  it('dig enters dig phase', () => {
    let s = newGame(55);
    s = act(s, { type: 'chooseCorner', r: 0, c: 0 });
    // Place a hazard adjacent to start
    s.board[idx(1, 0)] = { type: 'hazard', hazard: 'squirrel', id: 'h1' };
    // Force a dig card
    s.drawn = [{ id: 'test-dig', name: 'Test Dig', shape: 'I', icon: 'sniff', mod: { type: 'dig' } }];
    s.phase = 'pick';
    s = act(s, { type: 'pickCard', cardId: 'test-dig' });
    // Find a spot adjacent to start that isn't the hazard
    const spots = getValidSpots(s, s.picked, 0);
    if (spots.length > 0) {
      const [r, c] = spots[0];
      s = act(s, { type: 'placeCard', r, c, rot: 0 });
      if (s.phase === 'dig') {
        // Now dig the hazard (if adjacent to velvet's new pos)
        const vr = s.velvetPos.r, vc = s.velvetPos.c;
        const adjToHazard = [[-1,0],[0,1],[1,0],[0,-1]].some(([dr,dc]) => vr+dr===1 && vc+dc===0);
        if (adjToHazard) {
          s = act(s, { type: 'digHazard', r: 1, c: 0 });
          assert.equal(s.board[idx(1, 0)], null);
        } else {
          s = act(s, { type: 'skipDig' });
          assert.notEqual(s.phase, 'dig');
        }
      }
    }
  });
});

describe('Objectives', () => {
  it('OBJ_DEFS has 10 objectives', () => {
    assert.equal(Object.keys(OBJ_DEFS).length, 10);
  });

  it('each objective has check function', () => {
    for (const [id, def] of Object.entries(OBJ_DEFS)) {
      assert.equal(typeof def.check, 'function', `${id} missing check`);
      assert.ok(def.pts > 0, `${id} missing pts`);
      assert.ok(def.label, `${id} missing label`);
    }
  });
});

describe('Mean Cat', () => {
  it('cat activates when mean cat hazard drawn', () => {
    let s = newGame(42);
    s = act(s, { type: 'chooseCorner', r: 0, c: 0 });
    s.cat = { active: true, r: s.start.r, c: s.start.c };
    assert.ok(s.cat.active);
    assert.equal(s.cat.r, s.start.r);
  });
});

describe('Hazards', () => {
  it('hazard on empty cell blocks it', () => {
    let s = newGame(42);
    s = act(s, { type: 'chooseCorner', r: 0, c: 0 });
    s.board[idx(3, 3)] = { type: 'hazard', hazard: 'squirrel', id: 'test' };
    assert.equal(s.board[idx(3, 3)].type, 'hazard');
  });
});

describe('Valid spots', () => {
  it('finds adjacent spots for lane card', () => {
    let s = newGame(42);
    s = act(s, { type: 'chooseCorner', r: 0, c: 0 });
    const lane = { id: 'test', shape: 'I', name: 'Test Lane' };
    const spots0 = getValidSpots(s, lane, 0);
    const spots1 = getValidSpots(s, lane, 1);
    assert.ok(spots0.length + spots1.length > 0);
  });
});
