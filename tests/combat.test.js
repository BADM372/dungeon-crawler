import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPIDER, STUNDER, SNAKE, OCTONAUT, FIREFACE, TRIANGLE, FIRECAT, makeEnemy, attackOf, pickAttack,
  blowOf, lungeDistance, lungeAt } from '../src/core/enemies.js';
import { launch, touches, stepProjectile, ignite, burnStep, burntOut } from '../src/core/projectiles.js';
import { SWORD, swordState, startSwing, advanceSwing, cancelSwing, inSwordArc, swordHit, softTarget } from '../src/core/combat.js';

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
test('soft-targeting picks the closest reachable living enemy, preferring those ahead', () => {
  const p = hero(), at = (x, z, profile = SPIDER) => makeEnemy({ x, y: 0, z, yaw: 0 }, profile);
  const ahead = at(0, 1), behind = at(0, -0.9), side = at(0.5, 0), farSide = at(0.95, 0);
  assert.equal(softTarget(p, [ahead, behind]), ahead, 'ahead wins against slightly closer behind');
  assert.equal(softTarget(p, [ahead, behind], Math.PI), behind, 'the intended direction decides');
  assert.equal(softTarget(p, [ahead, side]), side, 'a much closer enemy wins over one ahead');
  assert.equal(softTarget(p, [ahead, farSide]), ahead, 'at similar distance the one ahead wins');
  const edge = SWORD.range + SPIDER.radius;
  assert.notEqual(softTarget(p, [at(0, edge - 0.01)]), null);
  assert.equal(softTarget(p, [at(0, edge + 0.01)]), null, 'out of blade reach');
  assert.notEqual(softTarget(p, [at(0, edge + 1.9)], 0, undefined, 2), null, 'extra acquisition range');
  const dead = at(0, 0.5); dead.mode = 'dead';
  const below = at(0, 0.5); below.y = -1;
  assert.equal(softTarget(p, [dead, below]), null, 'dead and other-floor enemies are ignored');
  const hidden = at(0, 0.5);
  assert.equal(softTarget(p, [hidden, ahead], 0, e => e !== hidden), ahead, 'line of sight required');
  const d = SWORD.range + STUNDER.radius - 0.05;
  const big = at(0, d, STUNDER);
  assert.equal(softTarget(p, [big]), big, 'reach includes the body radius');
  assert.equal(softTarget(p, [at(0, d)]), null, 'a smaller body at that distance is out of reach');
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

test('Octonaut picks slaps about twice as often as spin kicks; single-attack species keep their profile', () => {
  const picks = [0, 0];
  for (let i = 0; i < 300; i++) picks[pickAttack(OCTONAUT, i / 300)]++;
  assert.deepEqual(picks, [200, 100]);
  assert.equal(pickAttack(SPIDER, 0.9), 0);
  const e = enemy(SNAKE);
  assert.equal(attackOf(e), e.profile);
  const o = enemy(OCTONAUT);
  o.attack = 1;
  assert.equal(attackOf(o).name, 'spin');
  assert.ok(attackOf(o).arc < 0 && attackOf(o).knockDown && attackOf(o).power > 1);
  o.attack = 0;
  assert.equal(attackOf(o).name, 'slap');
  assert.equal(attackOf(o).knockDown, false);
});

test('the fire species and the Triangle outclass every older enemy', () => {
  for (const strong of [FIREFACE, TRIANGLE, FIRECAT]) for (const old of [SPIDER, STUNDER, SNAKE, OCTONAUT]) {
    assert.ok(strong.xp > old.xp && strong.coins[1] > old.coins[1], strong.type + ' vs ' + old.type);
    if (old !== STUNDER) assert.ok(strong.hp > old.hp && strong.damage > old.damage, strong.type + ' vs ' + old.type);
  }
  // the basic sword (30) needs at least four hits on any of them
  for (const p of [FIREFACE, TRIANGLE, FIRECAT]) assert.ok(p.hp > 90);
});
test('a projectile leaves the muzzle along the heading, pitched at the target', () => {
  const e = { x: 5, y: 1, z: 5, yaw: Math.PI / 2 };   // facing +x
  const pr = launch(e, FIREFACE.projectile, { x: 9, y: 2, z: 7 });
  const [mx, my, mz] = FIREFACE.projectile.muzzle;
  assert.ok(Math.abs(pr.x - (5 + mz)) < 1e-9 && Math.abs(pr.z - (5 - mx)) < 1e-9 && Math.abs(pr.y - (1 + my)) < 1e-9);
  assert.ok(Math.abs(Math.hypot(pr.vx, pr.vy, pr.vz) - FIREFACE.projectile.speed) < 1e-9);
  assert.ok(Math.abs(pr.vz) < 1e-9 && pr.vx > 0, 'flies along the heading, not at the player');
  assert.ok(pr.vy > 0, 'pitched up towards the chest height');
  const steep = launch(e, FIREFACE.projectile, { x: 6, y: 9, z: 5 });
  assert.ok(steep.vy / Math.hypot(steep.vx, steep.vz) <= 0.45 + 1e-9);
});
test('projectiles hit the player, stop at walls and fizzle out of range', () => {
  const p = { x: 5, y: 0, z: 0, r: 0.22, h: 0.85 }, none = () => false;
  const e = { x: 0, y: 0, z: 0, yaw: Math.PI / 2 };
  let pr = launch(e, TRIANGLE.projectile, { x: 5, y: 0.45, z: 0 }), end = null, t = 0;
  for (; !end && t < 3; t += 1 / 60) end = stepProjectile(pr, 1 / 60, p, none);
  assert.equal(end, 'hit');
  assert.ok(Math.abs(t - (5 - TRIANGLE.projectile.muzzle[2] - p.r - TRIANGLE.projectile.radius) / TRIANGLE.projectile.speed) < 0.05);
  assert.ok(touches(pr, p));
  pr = launch(e, TRIANGLE.projectile, { x: 5, y: 0.45, z: 0 }); end = null;
  for (let i = 0; !end && i < 200; i++) end = stepProjectile(pr, 1 / 60, p, x => x > 2.5);
  assert.equal(end, 'blocked'); assert.ok(pr.x > 2.5 && pr.x < 2.7);
  pr = launch(e, TRIANGLE.projectile, { x: 5, y: 0.45, z: 0 }); end = null;
  for (let i = 0; !end && i < 200; i++) end = stepProjectile(pr, 1 / 60, null, none);
  assert.equal(end, 'spent'); assert.ok(Math.abs(pr.travelled - TRIANGLE.projectile.range) < 0.15);
  // a big step cannot tunnel through the player
  pr = launch(e, TRIANGLE.projectile, { x: 5, y: 0.45, z: 0 });
  assert.equal(stepProjectile(pr, 1, p, none), 'hit');
});
test('a fireball burns for half a second; the Triangle punch knocks down instead', () => {
  const fire = blowOf(FIREFACE, FIREFACE), punch = blowOf(TRIANGLE, TRIANGLE);
  assert.equal(fire.damage, 22); assert.equal(fire.knockDown, false); assert.equal(fire.burn.time, 0.5);
  assert.equal(punch.damage, 28); assert.equal(punch.knockDown, true); assert.equal(punch.burn, null);
  assert.equal(blowOf(FIRECAT, FIRECAT).burn, null, 'the Fire-cat is on fire, but its bite is not');
  const b = ignite(fire.burn, fire.reason);
  let total = 0, t = 0;
  for (; !burntOut(b); t += 1 / 60) total += burnStep(b, 1 / 60);
  assert.equal(total, FIREFACE.projectile.burn.damage);
  assert.ok(Math.abs(t - 0.5) < 1.5 / 60, 'burns out after half a second: ' + t);
});
test('the Fire-cat pounce stops short of its target and eases through the leap', () => {
  const { lunge } = FIRECAT;
  assert.equal(lungeDistance(lunge, 0.3), 0);
  assert.ok(Math.abs(lungeDistance(lunge, 1.6) - 1.05) < 1e-9);
  assert.equal(lungeDistance(lunge, 9), lunge.max);
  assert.ok(FIRECAT.reach <= lunge.max + lunge.stop + 0.05, 'it never pounces from further than it can leap');
  assert.equal(lungeAt(lunge, 0), 0); assert.equal(lungeAt(lunge, lunge.to), 1);
  assert.ok(lunge.to < FIRECAT.hitAt && lunge.from > FIRECAT.trackUntil, 'commits to a heading, lands, then bites');
});
