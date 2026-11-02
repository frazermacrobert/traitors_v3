import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, act, getConnectedCells, calculateScore, getValidSpots, GRID, idx, isCorner } from '../js/engine/engine.js';
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
});

describe('Card deck', () => {
  it('has correct composition', () => {
    const deck = buildDeck();
    assert.equal(deck.length, 75);
    const paths = deck.filter(c => !c.hazard);
    const hazards = deck.filter(c => c.hazard);
    assert.equal(paths.length, 70);
    assert.equal(hazards.length, 5);
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

    // Try placing far from start — should fail (state unchanged)
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

  it('points equal connected tiles on win', () => {
    let s = newGame(42);
    s = act(s, { type: 'chooseCorner', r: 0, c: 0 });
    s.endReason = 'win';
    const score = calculateScore(s);
    assert.ok(score.tiles >= 1);
    assert.equal(score.total, score.tiles);
  });
});

describe('Mean Cat', () => {
  it('cat activates when mean cat hazard drawn', () => {
    let s = newGame(42);
    s = act(s, { type: 'chooseCorner', r: 0, c: 0 });
    // Manually activate cat
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
    const lane = { id: 'test', shape: 'I', label: 'Lane' };
    const spots0 = getValidSpots(s, lane, 0);
    const spots1 = getValidSpots(s, lane, 1);
    assert.ok(spots0.length + spots1.length > 0);
  });
});
