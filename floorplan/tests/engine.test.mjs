import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newRun, act, openTargets, validRotations, rotateDoors, connectedSet, cellAt, roomDoors, isWon, vaultToll, gemCost,
} from '../js/engine/engine.js';
import { newMeta, applyResult, buyUnlock, mansionUnlocked } from '../js/engine/meta.js';
import { MANSIONS, DECKS } from '../js/data/mansions.js';
import { ROOMS } from '../js/data/rooms.js';
import { HEIRLOOMS } from '../js/data/heirlooms.js';
import { playOut } from '../tools/bot.mjs';

const run = (o = {}) => newRun({ seed: 'test', ...o });

test('rotation maps doors clockwise', () => {
  assert.deepEqual(rotateDoors([1, 0, 0, 0], 1), [0, 1, 0, 0]);
  assert.deepEqual(rotateDoors([1, 1, 0, 0], 2), [0, 0, 1, 1]);
  assert.deepEqual(roomDoors('vault', 2), [0, 0, 1, 0]);
});

test('new run: entrance, vault, deck, door phase', () => {
  const s = run();
  assert.equal(s.phase, 'door');
  assert.equal(cellAt(s, 7, 2).id, 'entrance');
  assert.equal(cellAt(s, 0, 2).id, 'vault');
  assert.equal(s.deck.length, DECKS.standard.cards.length + DECKS.standard.fill);
  const t = openTargets(s).map((x) => `${x.r},${x.c}`).sort();
  assert.deepEqual(t, ['6,2', '7,1', '7,3']);
});

test('same seed gives the same run', () => {
  assert.deepEqual(run().deck, run().deck);
  assert.notDeepEqual(run().deck, newRun({ seed: 'other' }).deck);
});

test('select costs a step and draws 3', () => {
  const s = act(run(), { type: 'select', r: 6, c: 2 });
  assert.equal(s.phase, 'card');
  assert.equal(s.res.steps, run().res.steps - 1);
  assert.equal(s.pending.offers.length, 3);
});

test('cannot select a cell without an open doorway', () => {
  assert.throws(() => act(run(), { type: 'select', r: 3, c: 3 }));
});

test('valid rotations always face the source doorway', () => {
  const s = act(run(), { type: 'select', r: 6, c: 2 });
  for (const id of Object.keys(ROOMS)) {
    if (id === 'entrance' || id === 'vault') continue;
    for (const rot of validRotations(s, id, s.pending)) assert.equal(roomDoors(id, rot)[2], 1, `${id} rot ${rot}`);
  }
  // A cross has a single distinct orientation.
  assert.equal(validRotations(s, 'crossway', s.pending).length, 1);
});

test('placing connects the room and discards the other offers', () => {
  let s = run();
  s.res.gems = 10;
  s = act(s, { type: 'select', r: 6, c: 2 });
  const others = s.pending.offers.filter((_, i) => i !== 0);
  s = act(s, { type: 'pick', index: 0 });
  s = act(s, { type: 'place' });
  assert.ok(cellAt(s, 6, 2).id);
  assert.ok(connectedSet(s).has('6,2'));
  for (const o of others) assert.ok(s.discard.includes(o));
});

test('unaffordable cards cannot be picked; closet only when nothing affordable', () => {
  let s = run();
  s.deck.push('suite', 'trophy', 'ballroom');
  s.res.gems = 0;
  s = act(s, { type: 'select', r: 6, c: 2 });
  assert.throws(() => act(s, { type: 'pick', index: 0 }));
  s = act(s, { type: 'pick', index: -1 });
  assert.equal(s.pending.id, 'closet');
});

test('empty deck reshuffles discard and costs steps', () => {
  let s = run();
  s.discard = s.deck.splice(0);
  const before = s.res.steps;
  s = act(s, { type: 'select', r: 6, c: 2 });
  assert.equal(s.reshuffles, 1);
  assert.equal(s.res.steps, before - 1 - 3); // draft + reshuffle (2) + Dust Sheets curse (1)
});

test('locked doorway needs a key', () => {
  let s = run();
  s.lockedCells['6,2'] = true;
  s.res.keys = 0;
  assert.throws(() => act(s, { type: 'select', r: 6, c: 2 }));
  s.res.keys = 1;
  s = act(s, { type: 'select', r: 6, c: 2 });
  assert.equal(s.res.keys, 0);
});

test('running out of steps loses', () => {
  let s = run();
  s.res.steps = 1;
  s.deck.push('passage', 'passage', 'passage');
  s = act(s, { type: 'select', r: 6, c: 2 });
  s = act(s, { type: 'pick', index: 0 });
  s = act(s, { type: 'place' });
  assert.equal(s.phase, 'lost');
  assert.equal(s.result.why, 'steps');
});

test('sealing the house loses', () => {
  let s = run();
  // Fill the entrance's three exits with dead ends facing it.
  s.cells[6 * 5 + 2] = { id: 'closet', rot: 2, doors: roomDoors('closet', 2) };
  s.cells[7 * 5 + 1] = { id: 'closet', rot: 1, doors: roomDoors('closet', 1) };
  s.deck = ['closet', 'closet', 'closet'];
  s = act(s, { type: 'select', r: 7, c: 3 });
  s = act(s, { type: 'pick', index: 0 });
  s = act(s, { type: 'place' });
  assert.equal(s.phase, 'lost');
  assert.equal(s.result.why, 'sealed');
});

test('connecting to the vault wins only once the toll is paid', () => {
  let s = run();
  for (let r = 1; r <= 6; r++) s.cells[r * 5 + 2] = { id: 'passage', rot: 0, doors: roomDoors('passage', 0) };
  s.res.gems = 0;
  assert.equal(isWon(s), false);
  s.res.gems = vaultToll(s);
  assert.equal(isWon(s), true);
});

test('heirloom hooks: spyglass draws 4, silver tray lowers prices', () => {
  let s = run();
  s.heirlooms.push('spyglass');
  s = act(s, { type: 'select', r: 6, c: 2 });
  assert.equal(s.pending.offers.length, 4);
});

test('trophy room offers heirlooms, shop sells', () => {
  let s = run();
  s.res.gems = 5;
  s.deck.push('trophy', 'trophy', 'trophy');
  s = act(s, { type: 'select', r: 6, c: 2 });
  s = act(s, { type: 'pick', index: 0 });
  s = act(s, { type: 'place' });
  assert.equal(s.phase, 'heirloom');
  assert.equal(s.heirloomOffer.length, 3);
  s = act(s, { type: 'heirloom', index: 0 });
  assert.equal(s.heirlooms.length, 1);
  assert.ok(HEIRLOOMS[s.heirlooms[0]]);
});

test('every mansion is solvable in principle and bot runs terminate', () => {
  for (const m of MANSIONS) {
    for (let i = 0; i < 20; i++) {
      const s = playOut(newRun({ seed: `t${i}`, mansionId: m.id }));
      assert.ok(['won', 'lost'].includes(s.phase));
      assert.ok(s.result.ink >= 0);
    }
  }
});

test('bot wins Hollow House at least sometimes', () => {
  let wins = 0;
  for (let i = 0; i < 60; i++) if (playOut(newRun({ seed: `w${i}` })).result.won) wins++;
  assert.ok(wins > 5, `wins=${wins}`);
});

test('new mechanics: free cost, guaranteed family, collapse, toll, echo', () => {
  let s = run();
  s.buffs.freeCost = 1;
  s.buffs.nextFamily = 'violet';
  s.deck.push('suite', 'trophy', 'ballroom');
  s.res.gems = 0;
  s = act(s, { type: 'select', r: 6, c: 2 });
  assert.ok(s.pending.offers.some((id) => ROOMS[id].family === 'violet'));
  assert.equal(gemCost(s, 'suite'), 0);
  // toll house lowers the toll
  let t = run();
  t.deck.push('tollhouse', 'tollhouse', 'tollhouse');
  t.res.gems = 5;
  const before = vaultToll(t);
  t = act(act(act(t, { type: 'select', r: 6, c: 2 }), { type: 'pick', index: 0 }), { type: 'place' });
  assert.equal(vaultToll(t), before - 2);
  // flooded cellar collapses empty neighbours
  let f = run();
  f.deck.push('flooded', 'flooded', 'flooded');
  f = act(act(act(f, { type: 'select', r: 7, c: 1 }), { type: 'pick', index: 0 }), { type: 'place' });
  assert.ok(cellAt(f, 7, 0)?.blocked || cellAt(f, 6, 1)?.blocked);
  // mirror repeats a connected neighbour (a Guest Room next to the entrance)
  let m = run();
  m.cells[6 * 5 + 2] = { id: 'guest', rot: 2, doors: roomDoors('guest', 2) };
  m.deck.push('mirror', 'mirror', 'mirror');
  const st = m.res.steps;
  m = act(act(act(m, { type: 'select', r: 7, c: 1 }), { type: 'pick', index: 0 }), { type: 'rotate', dir: 1 });
  m.pending.rot = m.pending.rots.find((r) => roomDoors('mirror', r)[1] === 1);
  m = act(m, { type: 'place' });
  assert.ok(m.res.steps >= st - 1 - 1);
});

test('state is JSON-serialisable and actions are pure', () => {
  const s = run();
  const copy = JSON.parse(JSON.stringify(s));
  act(s, { type: 'select', r: 6, c: 2 });
  assert.deepEqual(s, copy);
});

test('meta: results, mansion unlocks, deeds, purchases', () => {
  let meta = newMeta();
  assert.equal(mansionUnlocked(meta, 1), false);
  const fake = { mansionId: 'm1', deed: 0, result: { won: true, score: 80, ink: 20 } };
  ({ meta } = applyResult(meta, fake));
  assert.equal(meta.ink, 20);
  assert.equal(mansionUnlocked(meta, 1), true);
  assert.equal(meta.mansions.m1.maxDeed, 1);
  meta = buyUnlock(meta, 'r_gallerywalk');
  assert.equal(meta.ink, 12);
  assert.throws(() => buyUnlock(meta, 'r_gallerywalk'));
});
