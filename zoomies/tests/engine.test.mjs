import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, act, getConnectedCells, calculateScore, GRID, idx, isCorner } from '../js/engine/engine.js';
import { SHAPES, rotateDoors, buildDeck } from '../js/data/cards.js';

describe('RNG and board setup', () => {
  it('newGame creates a valid initial state', () => {
    const s = newGame(42);
    assert.equal(s.board.length, 36);
    assert.equal(s.phase, 'setup');
    assert.equal(s.treats, 5);
    assert.ok(s.beach.r >= 0 && s.beach.r < 6);
    assert.ok(s.beach.c >= 0 && s.beach.c < 6);
    assert.ok(!isCorner(s.beach.r, s.beach.c), 'Beach should not be on a corner');
    assert.ok(s.deck.length > 0);
  });

  it('same seed produces same game', () => {
    const a = newGame(123);
    const b = newGame(123);
    assert.deepEqual(a.beach, b.beach);
    assert.deepEqual(a.deck.map(c => c.id), b.deck.map(c => c.id));
  });

  it('different seeds produce different games', () => {
    const a = newGame(1);
    const b = newGame(999);
    const sameBeach = a.beach.r === b.beach.r && a.beach.c === b.beach.c;
    const sameDeck = a.deck[0].id === b.deck[0].id;
    assert.ok(!sameBeach || !sameDeck, 'Different seeds should differ');
  });
});

describe('Corner selection', () => {
  it('choosing a valid corner sets start and places start tile', () => {
    let s = newGame(42);
    const corner = [0, 0];
    if (s.beach.r === 0 && s.beach.c === 0) {
      corner[0] = 5; corner[1] = 5;
    }
    s = act(s, { type: 'chooseCorner', r: corner[0], c: corner[1] });
    assert.deepEqual(s.start, { r: corner[0], c: corner[1] });
    assert.equal(s.board[idx(corner[0], corner[1])].type, 'start');
    assert.equal(s.phase, 'roll');
  });

  it('rejects non-corner positions', () => {
    let s = newGame(42);
    const before = s.phase;
    s = act(s, { type: 'chooseCorner', r: 3, c: 3 });
    assert.equal(s.phase, before, 'Phase should not change');
  });
});

describe('Dice rolling', () => {
  it('roll sets dice and advances to draw phase', () => {
    let s = newGame(42);
    s = act(s, { type: 'chooseCorner', r: 0, c: 0 });
    s = act(s, { type: 'roll' });
    assert.equal(s.phase, 'draw');
    assert.ok(s.dice.row >= 0 && s.dice.row < 6);
    assert.ok(s.dice.col >= 0 && s.dice.col < 6);
  });
});

describe('Card drawing', () => {
  it('drawCards provides cards to pick from', () => {
    let s = newGame(55);
    s = act(s, { type: 'chooseCorner', r: 0, c: 0 });
    s = act(s, { type: 'roll' });
    const deckBefore = s.deck.length;
    s = act(s, { type: 'drawCards' });
    assert.ok(s.drawn.length > 0, 'Should have drawn cards');
    assert.equal(s.phase, 'pick');
  });
});

describe('Card placement', () => {
  it('pick then place puts a card on the board', () => {
    let s = newGame(55);
    s = act(s, { type: 'chooseCorner', r: 0, c: 0 });
    s = act(s, { type: 'roll' });
    s = act(s, { type: 'drawCards' });

    const card = s.drawn[0];
    s = act(s, { type: 'pickCard', cardId: card.id, fromHand: false });
    assert.equal(s.phase, 'place');

    const tr = s.dice.row;
    const tc = s.dice.col;
    if (s.board[idx(tr, tc)] === null && !(tr === s.beach.r && tc === s.beach.c)) {
      s = act(s, { type: 'placeCard', r: tr, c: tc, rot: 0 });
      assert.ok(s.board[idx(tr, tc)] !== null);
      assert.ok(s.phase === 'keepOrEnd' || s.phase === 'end');
    }
  });

  it('cannot place on an occupied cell', () => {
    let s = newGame(55);
    s = act(s, { type: 'chooseCorner', r: 0, c: 0 });
    // Try to place on the start cell
    s.phase = 'place';
    s.picked = { id: 'test', shape: 'I', label: 'Test' };
    const result = act(s, { type: 'placeCard', r: 0, c: 0, rot: 0 });
    assert.ok(result.board[idx(0, 0)].type === 'start', 'Should not overwrite start');
  });
});

describe('Nudge', () => {
  it('nudge shifts target and costs 1 treat', () => {
    let s = newGame(55);
    s = act(s, { type: 'chooseCorner', r: 0, c: 0 });
    s = act(s, { type: 'roll' });
    s = act(s, { type: 'drawCards' });

    const card = s.drawn[0];
    s = act(s, { type: 'pickCard', cardId: card.id, fromHand: false });

    const oldRow = s.dice.row;
    const treatsBefore = s.treats;

    if (oldRow < 5) {
      s = act(s, { type: 'nudge', axis: 'row', dir: 1 });
      assert.equal(s.dice.row, oldRow + 1);
      assert.equal(s.treats, treatsBefore - 1);
    }
  });

  it('nudge rejected with 0 treats', () => {
    let s = newGame(55);
    s = act(s, { type: 'chooseCorner', r: 0, c: 0 });
    s = act(s, { type: 'roll' });
    s = act(s, { type: 'drawCards' });
    s.treats = 0;
    s.phase = 'place';
    s.picked = { id: 'x', shape: 'I', label: 'X' };

    const oldRow = s.dice.row;
    s = act(s, { type: 'nudge', axis: 'row', dir: 1 });
    assert.equal(s.dice.row, oldRow);
  });
});

describe('Connectivity', () => {
  it('start cell is always connected', () => {
    let s = newGame(42);
    s = act(s, { type: 'chooseCorner', r: 0, c: 0 });
    const connected = getConnectedCells(s);
    assert.ok(connected.length >= 1);
    assert.ok(connected.some(([r, c]) => r === 0 && c === 0));
  });

  it('adjacent path with matching doors connects', () => {
    let s = newGame(42);
    s = act(s, { type: 'chooseCorner', r: 0, c: 0 });
    // Manually place a card at (0,1) with west door open
    s.board[idx(0, 1)] = { type: 'path', cardId: 'test', shape: 'I', rot: 1, doors: [false, true, false, true] };
    const connected = getConnectedCells(s);
    assert.ok(connected.some(([r, c]) => r === 0 && c === 1), 'Adjacent card with matching doors should connect');
  });

  it('adjacent path without matching doors does not connect', () => {
    let s = newGame(42);
    s = act(s, { type: 'chooseCorner', r: 0, c: 0 });
    // Place card at (0,1) with only N-S doors (no west door)
    s.board[idx(0, 1)] = { type: 'path', cardId: 'test', shape: 'I', rot: 0, doors: [true, false, true, false] };
    const connected = getConnectedCells(s);
    assert.ok(!connected.some(([r, c]) => r === 0 && c === 1), 'No matching door should not connect');
  });
});

describe('Scoring', () => {
  it('calculates score with path and treats', () => {
    let s = newGame(42);
    s = act(s, { type: 'chooseCorner', r: 0, c: 0 });
    s.treats = 3;
    const score = calculateScore(s);
    assert.ok(score.total > 0);
    assert.equal(score.treatPoints, 15);
    assert.ok(score.pathPoints >= 3);
  });
});

describe('Card definitions', () => {
  it('deck has correct size', () => {
    const deck = buildDeck();
    assert.equal(deck.length, 48);
    const paths = deck.filter(c => !c.hazard);
    const hazards = deck.filter(c => c.hazard);
    assert.equal(paths.length, 40);
    assert.equal(hazards.length, 8);
  });

  it('rotateDoors rotates correctly', () => {
    const doors = [true, false, false, false]; // N only
    assert.deepEqual(rotateDoors(doors, 1), [false, true, false, false]); // E only
    assert.deepEqual(rotateDoors(doors, 2), [false, false, true, false]); // S only
    assert.deepEqual(rotateDoors(doors, 3), [false, false, false, true]); // W only
    assert.deepEqual(rotateDoors(doors, 4), [true, false, false, false]); // Back to N
  });

  it('all shapes have 4 door values', () => {
    for (const [name, doors] of Object.entries(SHAPES)) {
      assert.equal(doors.length, 4, `Shape ${name} should have 4 doors`);
    }
  });
});

describe('Hand management', () => {
  it('keepCard adds to hand and ends turn', () => {
    let s = newGame(55);
    s = act(s, { type: 'chooseCorner', r: 0, c: 0 });
    s = act(s, { type: 'roll' });
    s = act(s, { type: 'drawCards' });

    const card = s.drawn[0];
    s = act(s, { type: 'pickCard', cardId: card.id, fromHand: false });

    // Find empty target
    let tr = s.dice.row;
    let tc = s.dice.col;
    if (s.board[idx(tr, tc)] !== null || (tr === s.beach.r && tc === s.beach.c)) {
      // nudge or skip
      s = act(s, { type: 'skipTurn' });
      return;
    }

    s = act(s, { type: 'placeCard', r: tr, c: tc, rot: 0 });

    if (s.phase === 'keepOrEnd' && s.drawn.length > 0) {
      const keepId = s.drawn[0].id;
      s = act(s, { type: 'keepCard', cardId: keepId });
      assert.ok(s.hand.some(c => c.id === keepId));
      assert.equal(s.phase, 'roll');
    }
  });
});

describe('Skip turn', () => {
  it('skipTurn discards and advances', () => {
    let s = newGame(55);
    s = act(s, { type: 'chooseCorner', r: 0, c: 0 });
    s = act(s, { type: 'roll' });
    s = act(s, { type: 'drawCards' });

    const card = s.drawn[0];
    s = act(s, { type: 'pickCard', cardId: card.id, fromHand: false });

    const turnBefore = s.turn;
    s = act(s, { type: 'skipTurn' });
    assert.equal(s.phase, 'roll');
    assert.equal(s.turn, turnBefore + 1);
  });
});
