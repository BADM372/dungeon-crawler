import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPIDER, STUNDER, makeEnemy } from '../src/core/enemies.js';
import { SWORD, swordState, startSwing, advanceSwing, cancelSwing, inSwordArc, swordHit } from '../src/core/combat.js';

const hero = () => ({ x: 0, y: 0, z: 0, yaw: 0, hp: 100, stun: 0, sword: swordState() });
const enemy = (profile = SPIDER) => makeEnemy({ x: 0, y: 0, z: 0.8, yaw: Math.PI }, profile);
function swing(p) { assert.ok(startSwing(p)); advanceSwing(p, SWORD.activeStart + 0.01); }

test('sword is a timed, one-press attack with wind-up and recovery', () => {
  const p = hero(), e = enemy();
  assert.ok(startSwing(p));
  assert.equal(startSwing(p), false);
  assert.equal(swordHit(p, e), false);
  advanceSwing(p, SWORD.activeStart + 0.01);
  assert.ok(swordHit(p, e));
  advanceSwing(p, SWORD.duration);
  assert.equal(p.sword.active, false);
  assert.equal(p.sword.cool, 0);
});
test('one enemy is hit at most once per swing', () => {
  const p = hero(), e = enemy(STUNDER);
  swing(p);
  for (let i = 0; i < 30; i++) swordHit(p, e);
  assert.equal(e.hp, 90);
  assert.equal(e.mode, 'chase');
  assert.ok(e.stun > 0);
});
test('spider dies in one slash; Stunder takes four and does more damage', () => {
  const p = hero(), spider = enemy(), stunder = enemy(STUNDER);
  assert.ok(STUNDER.damage > SPIDER.damage);
  swing(p); swordHit(p, spider); swordHit(p, stunder);
  assert.equal(spider.mode, 'dead'); assert.equal(spider.hp, 0);
  assert.equal(stunder.hp, 90);
  for (let i = 0; i < 3; i++) {
    advanceSwing(p, 2); swing(p); swordHit(p, stunder);
    assert.equal(stunder.hp, 60 - 30 * i);
  }
  assert.equal(stunder.mode, 'dead');
  assert.equal(stunder.deadT, 0);
  assert.equal(swordHit(p, stunder), false);
});
test('blade cannot hit behind, too far away, or through another floor', () => {
  const p = hero(); swing(p);
  for (const extra of [{ z: -0.8 }, { z: 3 }, { y: -2 }, { y: 2 }, { x: 1, z: -0.2 }]) {
    const e = Object.assign(enemy(), extra);
    assert.equal(inSwordArc(p, e), false, JSON.stringify(extra));
    assert.equal(e.hp, 30);
  }
});
test('one slash can sweep multiple enemies, but only during the active interval', () => {
  const p = hero(), left = enemy(), right = enemy();
  left.x = -0.3; right.x = 0.3;
  swing(p); assert.ok(swordHit(p, left)); assert.ok(swordHit(p, right));
  const late = enemy();
  advanceSwing(p, SWORD.activeEnd);
  assert.equal(swordHit(p, late), false);
});
test('jumping without a sword press never starts an attack or kills an enemy', () => {
  const p = hero(), e = enemy();
  for (const y of [0, 0.2, 0.6, 1, 0.6, 0.2, 0]) {
    p.y = y; p.vy = -4; advanceSwing(p, 1 / 60);
    assert.equal(swordHit(p, e), false);
  }
  assert.equal(e.hp, SPIDER.hp); assert.notEqual(e.mode, 'dead');
});
test('swimming, ladders, knockdown, death and stun block / cancel sword attacks', () => {
  for (const extra of [{ swimming: true }, { climb: {} }, { ragdoll: {} }, { hp: 0 }, { stun: 0.1 }]) {
    const blocked = Object.assign(hero(), extra);
    assert.equal(startSwing(blocked), false);
    const p = hero(); swing(p); Object.assign(p, extra); advanceSwing(p, 0.01);
    assert.equal(p.sword.active, false);
  }
});
test('travel cancellation clears queued input and previous targets', () => {
  const p = hero(); swing(p); swordHit(p, enemy(STUNDER)); p.sword.requested = true;
  cancelSwing(p, true);
  assert.equal(p.sword.active, false); assert.equal(p.sword.requested, false);
  assert.equal(p.sword.hits.size, 0); assert.equal(p.sword.cool, 0);
});
