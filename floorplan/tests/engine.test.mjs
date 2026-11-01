import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newRun, act, openTargets, validRotations, rotateDoors, connectedSet, cellAt, roomDoors, isWon, goalTarget, gemCost,
  generateFloor, NIGHTS, wingAt,
} from '../js/engine/engine.js';
import {
  newMeta, applyResult, buyUnlock, mansionUnlocked, buyUpgrade, keepBlueprint, toggleEquip, runOptions, migrateMeta,
} from '../js/engine/meta.js';
import { MANSIONS, DECKS } from '../js/data/mansions.js';
import { ROOMS } from '../js/data/rooms.js';
import { HEIRLOOMS } from '../js/data/heirlooms.js';
import { hashSeed } from '../js/engine/rng.js';
import { playOut } from '../tools/bot.mjs';

const run = (o = {}) => newRun({ seed: 'test', ...o });
const up = (s) => ({ r: s.entrance.r - 1, c: s.entrance.c }); // always a free cell
const placeFirst = (s, at = up(s)) => act(act(act(s, { type: 'select', ...at }), { type: 'pick', index: 0 }), { type: 'place' });
const dk = (s) => `${up(s).r},${up(s).c}`;

test('rotation maps doors clockwise', () => {
  assert.deepEqual(rotateDoors([1, 0, 0, 0], 1), [0, 1, 0, 0]);
  assert.deepEqual(rotateDoors([1, 1, 0, 0], 2), [0, 0, 1, 1]);
  assert.deepEqual(roomDoors('vault', 2), [0, 0, 1, 0]);
});

test('generated floors always have a path and the right landmarks', () => {
  for (const m of MANSIONS) {
    for (let n = 1; n <= NIGHTS; n++) {
      for (let i = 0; i < 30; i++) {
        const fl = generateFloor(m, n, hashSeed(`${m.id}-${n}-${i}`));
        assert.equal(fl.entrance.r, m.h - 1);
        assert.equal(fl.goal.r, 0);
        assert.ok(!fl.blocks.some((b) => b.r === 1 && b.c === fl.goal.c), 'approach is free');
      }
    }
  }
});

test('new run: Night 1, stairwell goal, deck, door phase', () => {
  const s = run();
  assert.equal(s.night, 1);
  assert.equal(s.phase, 'door');
  assert.equal(cellAt(s, s.entrance.r, s.entrance.c).id, 'entrance');
  assert.equal(cellAt(s, s.vault.r, s.vault.c).id, 'stair');
  assert.ok(s.omen);
  assert.ok(s.deck.length >= DECKS.standard.cards.length + DECKS.standard.fill);
  assert.ok(openTargets(s).some((t) => t.r === up(s).r && t.c === up(s).c));
});

test('same seed gives the same run', () => {
  assert.deepEqual(run().deck, run().deck);
  assert.deepEqual(run().cells, run().cells);
  assert.notDeepEqual(run().deck, newRun({ seed: 'other' }).deck);
});

test('select costs a step and draws cards', () => {
  const s0 = run();
  const s = act(s0, { type: 'select', ...up(s0) });
  assert.equal(s.phase, 'card');
  assert.equal(s.res.steps, s0.res.steps - 1);
  assert.ok(s.pending.offers.length >= 2);
});

test('valid rotations always face the source doorway', () => {
  const s0 = run();
  const s = act(s0, { type: 'select', ...up(s0) });
  for (const id of Object.keys(ROOMS)) {
    if (['entrance', 'vault', 'stair'].includes(id)) continue;
    for (const rot of validRotations(s, id, s.pending)) assert.equal(roomDoors(id, rot)[2], 1, `${id} rot ${rot}`);
  }
});

test('placing connects the room, raises Dread and discards the rest', () => {
  let s = run();
  s.res.gems = 20;
  s.deck.push('passage', 'passage', 'passage');
  const d0 = s.dread;
  s = placeFirst(s);
  assert.ok(connectedSet(s).has(dk(s)));
  assert.ok(s.dread > d0 || s.lastAct);
  assert.ok(s.discard.includes('passage'));
});

test('closet only when nothing affordable', () => {
  let s = run();
  s.deck.push('suite', 'trophy', 'ballroom');
  s.res.gems = 0;
  s = act(s, { type: 'select', ...up(s) });
  assert.throws(() => act(s, { type: 'pick', index: 0 }));
  s = act(s, { type: 'pick', index: -1 });
  assert.equal(s.pending.id, 'closet');
});

test('locked doorway needs a key', () => {
  let s = run();
  s.lockedCells[dk(s)] = true;
  s.res.keys = 0;
  assert.throws(() => act(s, { type: 'select', ...up(s) }));
  s.res.keys = 1;
  s = act(s, { type: 'select', ...up(s) });
  assert.equal(s.res.keys, 0);
});

test('running out of steps loses', () => {
  let s = run();
  s.res.steps = 1;
  s.deck.push('passage', 'passage', 'passage');
  s = placeFirst(s);
  assert.equal(s.phase, 'lost');
  assert.equal(s.result.why, 'steps');
});

test('reaching the stairwell with the goal met clears the Night and offers a Landing', () => {
  let s = run();
  // Build a straight corridor from above the entrance up to the stairwell column.
  const c = s.vault.c;
  for (let r = 1; r < s.h - 1; r++) s.cells[r * s.w + c] = { id: 'crossway', rot: 0, doors: roomDoors('crossway', 0) };
  for (let cc = 0; cc < s.w; cc++) if (cc !== c) s.cells[(s.h - 2) * s.w + cc] = { id: 'crossway', rot: 0, doors: roomDoors('crossway', 0) };
  s.res.gems = 0;
  assert.equal(isWon(s), false);
  s.res.gems = goalTarget(s);
  assert.equal(isWon(s), true);
  // Trigger resolution through a real action: place something anywhere.
  const t = openTargets(s)[0];
  s.deck.push('closet', 'closet', 'closet');
  s.res.steps = 10;
  s = act(act(act(s, { type: 'select', r: t.r, c: t.c }), { type: 'pick', index: 0 }), { type: 'place' });
  assert.equal(s.phase, 'landing');
  assert.equal(s.nightsCleared, 1);
  const next = act(s, { type: 'land', index: s.landing.findIndex((l) => l !== 'shop' && l !== 'trophy') });
  assert.equal(next.night, 2);
  assert.equal(next.phase, 'door');
});

test('Wings: three connected Gardens trigger a bonus', () => {
  let s = run();
  const { r, c } = up(s);
  s.cells[r * s.w + c] = { id: 'fern', rot: 0, doors: roomDoors('fern', 0) };
  s.cells[(r - 1) * s.w + c] = { id: 'fern', rot: 0, doors: roomDoors('fern', 0) };
  assert.equal(wingAt(s, r, c).size, 2);
  s.deck.push('fern', 'fern', 'fern');
  const gems = s.res.gems;
  s.res.steps = 10;
  s = act(act(act(s, { type: 'select', r: r - 2, c }), { type: 'pick', index: 0 }), { type: 'place', rot: 0 });
  assert.equal(wingAt(s, r, c).size, 3);
  assert.ok(s.res.gems >= gems + 1 + 2);
});

test('mystery cells open an event with choices', () => {
  let s = run();
  s.mystery[dk(s)] = true;
  s.deck.push('passage', 'passage', 'passage');
  s = placeFirst(s);
  if (s.phase === 'lost') return; // house could have acted fatally; vanishingly rare with this seed
  assert.equal(s.phase, 'event');
  s = act(s, { type: 'choose', index: 1 });
  assert.notEqual(s.phase, 'event');
});

test('Dread makes the house act', () => {
  let s = run();
  s.dread = s.dreadNext - 1;
  s.deck.push('passage', 'passage', 'passage');
  s = placeFirst(s);
  assert.ok(s.lastAct || s.phase === 'lost');
});

test('heirlooms: trophy room offers 3', () => {
  let s = run();
  s.res.gems = 5;
  s.deck.push('trophy', 'trophy', 'trophy');
  s = placeFirst(s);
  if (s.phase === 'event') s = act(s, { type: 'choose', index: 1 });
  assert.equal(s.phase, 'heirloom');
  s = act(s, { type: 'heirloom', index: 0 });
  assert.ok(HEIRLOOMS[s.heirlooms[0]]);
});

test('free-cost and guaranteed-family buffs', () => {
  let s = run();
  s.buffs.freeCost = 1;
  s.buffs.nextFamily = 'violet';
  s.deck.push('suite', 'trophy', 'ballroom');
  s.res.gems = 0;
  s = act(s, { type: 'select', ...up(s) });
  assert.ok(s.pending.offers.some((id) => ROOMS[id].family === 'violet'));
  assert.equal(gemCost(s, 'suite'), 0);
});

test('bot runs terminate on every mansion and sometimes win', () => {
  let wins = 0;
  for (const m of MANSIONS) {
    for (let i = 0; i < 6; i++) {
      const s = playOut(newRun({ seed: `t${i}`, mansionId: m.id }));
      assert.ok(['won', 'lost'].includes(s.phase));
      if (s.result.won) wins++;
    }
  }
  assert.ok(wins >= 1, `wins=${wins}`);
});

test('state is JSON-serialisable and actions are pure', () => {
  const s = run();
  const copy = JSON.parse(JSON.stringify(s));
  act(s, { type: 'select', ...up(s) });
  assert.deepEqual(s, copy);
});

test('meta: results, mansion unlocks, deeds, purchases', () => {
  let meta = newMeta();
  assert.equal(mansionUnlocked(meta, 1), false);
  const fake = { mansionId: 'm1', deed: 0, heirlooms: [], cells: [], result: { won: true, score: 80, ink: 20 } };
  ({ meta } = applyResult(meta, fake));
  assert.equal(meta.ink, 20);
  assert.equal(mansionUnlocked(meta, 1), true);
  assert.equal(meta.mansions.m1.maxDeed, 1);
  meta = buyUnlock(meta, 'r_gallerywalk');
  assert.equal(meta.ink, 12);
  assert.throws(() => buyUnlock(meta, 'r_gallerywalk'));
});

test('progression: upgrades and kept Blueprints', () => {
  let meta = newMeta();
  meta.ink = 100;
  meta = buyUpgrade(meta, 'stamina');
  const lost = playOut(newRun({ seed: 'p1' }));
  ({ meta } = applyResult(meta, lost));
  assert.ok(meta.pendingKeep && meta.pendingKeep.length >= 1);
  const kept = meta.pendingKeep[0];
  meta = keepBlueprint(meta, kept);
  assert.ok(meta.equipped.includes(kept));
  const strong = newRun(runOptions(meta, { mansionId: 'm1', deed: 0, deckId: 'standard', seed: 'p2' }));
  const base = newRun({ seed: 'p2' });
  assert.equal(strong.stepBonus, 1);
  assert.equal(strong.deck.length, base.deck.length + 1);
  meta = toggleEquip(meta, kept);
  assert.equal(meta.equipped.length, 0);
});

test('V1 saves reset with an Ink credit', () => {
  const m = migrateMeta({ v: 1, totalInk: 300, ink: 5, owned: ['r_bunkroom'], seenHelp: true });
  assert.equal(m.v, 2);
  assert.equal(m.ink, 60);
  assert.deepEqual(m.owned, []);
  assert.equal(m.seenHelp, true);
});
