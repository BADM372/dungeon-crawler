import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { assetsRoot } from './paths.js';
import { ITEMS, WEAPONS, BASIC_SWORD, COINS } from '../src/core/items.js';
import { createInventory, addItem, removeItem, equipItem, equippedItem, addCopper, spendCopper, copperTotal, coinCounts } from '../src/core/inventory.js';
import { createPlayerStats, createRun, xpForLevel, xpToNext, levelFromXP, xpProgress, awardXP, awardKill, takeDamage, regenerate } from '../src/core/progression.js';
import { SPIDER, STUNDER, enemyProfile, enemyRoll, makeEnemy } from '../src/core/enemies.js';
import { swordState, combatStats, startSwing, advanceSwing, swordHit, cancelSwing, damageEnemy, canChangeWeapon } from '../src/core/combat.js';

const assetPath = url => resolve(assetsRoot, url);
const hero = () => ({ ...createPlayerStats(), x: 0, y: 0, z: 0, yaw: 0, stun: 0, sword: swordState() });
function equip(p, id) {
  addItem(p.inventory, id);
  equipItem(p.inventory, p.inventory.slots.find(s => s?.itemId === id).instanceId);
}

test('a new player has one owned, equipped basic sword and empty reserved currency slots', () => {
  const p = createPlayerStats();
  assert.deepEqual([p.xp, p.level, p.hp, p.maxHp], [0, 1, 100, 100]);
  assert.equal(p.inventory.slots.length, 24); assert.equal(p.inventory.slots.filter(Boolean).length, 1);
  assert.equal(equippedItem(p.inventory).itemId, BASIC_SWORD.id);
  assert.deepEqual(p.inventory.currency.map(s => s.itemId), COINS.map(c => c.id));
  assert.deepEqual(p.inventory.currency.map(s => s.count), [0, 0, 0]);
});
test('stacking, overflow into multiple slots, and weapon instances preserve counts', () => {
  const inv = createInventory();
  assert.ok(addItem(inv, 'item_potion_health', 150));
  assert.deepEqual(inv.slots.filter(Boolean).map(s => s.count), [99, 51]);
  assert.ok(addItem(inv, 'item_potion_health', 70));
  assert.deepEqual(inv.slots.filter(Boolean).map(s => s.count), [99, 99, 22]);
  assert.ok(addItem(inv, BASIC_SWORD.id, 2));
  const swords = inv.slots.filter(s => s?.itemId === BASIC_SWORD.id);
  assert.notEqual(swords[0].instanceId, swords[1].instanceId);
  assert.ok(equipItem(inv, swords[1].instanceId));
  assert.equal(equippedItem(inv), swords[1]); assert.equal(swords[1].count, 1);
  assert.equal(equipItem(inv, inv.slots[0].instanceId), false);
  assert.equal(equipItem(inv, 'missing'), false);
  assert.ok(removeItem(inv, inv.slots[0].instanceId, 99));
  assert.ok(addItem(inv, 'item_crystal_ruby'));
  assert.equal(equippedItem(inv), swords[1]); // slot insertion cannot change equipped identity
  assert.ok(removeItem(inv, swords[1].instanceId));
  assert.equal(inv.equipped, null);
});
test('a full bag is atomic, while currency is never blocked by capacity', () => {
  const inv = createInventory(); addItem(inv, BASIC_SWORD.id, 23); addItem(inv, 'item_potion_health', 98);
  const before = JSON.stringify(inv);
  assert.equal(addItem(inv, 'item_potion_health', 2), false);
  assert.equal(JSON.stringify(inv), before);
  assert.ok(addItem(inv, 'item_coin_copper', 1237));
  assert.deepEqual(inv.currency.map(s => s.count), [1, 23, 7]);
});
test('coins roll up, make change when spent, and never use floating gold', () => {
  const inv = createInventory();
  for (const [amount, counts] of [[9, [0,0,9]], [1, [0,1,0]], [990, [1,0,0]], [237, [1,23,7]]]) {
    addCopper(inv, amount); assert.deepEqual(inv.currency.map(s => s.count), counts);
  }
  addItem(inv, 'item_coin_silver', 77); addItem(inv, 'item_coin_gold', 200);
  assert.equal(copperTotal(inv), 202007);
  assert.deepEqual(inv.currency.map(s => s.count), [202, 0, 7]);
  assert.ok(spendCopper(inv, 8)); assert.deepEqual(inv.currency.map(s => s.count), [201, 99, 9]);
  const before = JSON.stringify(inv);
  assert.equal(spendCopper(inv, 999999), false); assert.equal(JSON.stringify(inv), before);
  for (let n = 0; n < 10000; n++) {
    const c = coinCounts(n); assert.ok(c[1] < 100 && c[2] < 10);
    assert.equal(c[0] * 1000 + c[1] * 10 + c[2], n);
  }
});
test('invalid counts and unsafe integer currency cannot corrupt inventory', () => {
  const inv = createInventory(), before = JSON.stringify(inv);
  for (const n of [-1, .5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => addItem(inv, BASIC_SWORD.id, n));
    assert.throws(() => addCopper(inv, n)); assert.throws(() => spendCopper(inv, n));
  }
  assert.throws(() => addItem(inv, 'unknown'));
  assert.throws(() => addItem(inv, 'item_coin_gold', Number.MAX_SAFE_INTEGER));
  assert.equal(JSON.stringify(inv), before);
  addCopper(inv, Number.MAX_SAFE_INTEGER);
  assert.throws(() => addCopper(inv, 1)); assert.equal(copperTotal(inv), Number.MAX_SAFE_INTEGER);
});
test('XP thresholds are exact, increasing, and support multiple level-ups', () => {
  assert.deepEqual([1,2,3,4,5].map(xpForLevel), [0,100,250,450,700]);
  for (let level = 1; level <= 500; level++) {
    assert.equal(levelFromXP(xpForLevel(level)), level);
    assert.equal(xpForLevel(level + 1) - xpForLevel(level), xpToNext(level));
    assert.equal(levelFromXP(xpForLevel(level + 1) - 1), level);
  }
  const p = createPlayerStats(); p.hp = 60;
  assert.equal(awardXP(p, 700), 4);
  assert.deepEqual([p.level, p.hp, p.maxHp], [5,100,140]);
  assert.deepEqual(xpProgress(p), { current: 0, required: 300 });
  assert.throws(() => awardXP(p, -1)); assert.equal(p.xp, 700);
  p.hp = 0; awardXP(p, 300); assert.equal(p.hp, 0); // no resurrection from a reward
});
test('scaled species remain distinct without changing navigation or animation timing', () => {
  for (const level of [0, -1, .5, Infinity]) assert.throws(() => enemyProfile(SPIDER, level));
  for (const [p, hp, damage, xp] of [[SPIDER,46,23,40],[STUNDER,176,42,160]]) {
    const scaled = enemyProfile(p, 5);
    assert.deepEqual([scaled.hp, scaled.damage, scaled.xp], [hp,damage,xp]);
    for (const key of ['height','radius','chase','hitAt','attackTime','knock']) assert.equal(scaled[key], p[key]);
    const e = makeEnemy({ level: 5 }, p);
    assert.equal(e.hp, hp); assert.equal(e.level, 5); assert.equal(e.profile.damage, damage);
    assert.equal(p.hp, p === SPIDER ? 30 : 120);
  }
});
test('enemy levels and rewards are deterministic, depth-based and independent of spawn RNG', () => {
  const variations = new Set();
  for (let seed = 0; seed < 64; seed++) for (let depth = 0; depth <= 20; depth++) for (const p of [SPIDER,STUNDER]) {
    const map = { seed, depth, key: `0,${-depth},0` }, a = enemyRoll(map, p, 17);
    assert.deepEqual(a, enemyRoll(map, p, 17));
    const base = 1 + Math.floor(depth / 2);
    assert.ok(a.level >= Math.max(1, base - 1) && a.level <= base + 1);
    if (depth < 2) assert.equal(a.level, 1);
    else variations.add(a.level - base);
    const factor = 1 + .25 * (a.level - 1);
    assert.ok(a.coinDrop >= Math.round(p.coins[0] * factor) && a.coinDrop <= Math.round(p.coins[1] * factor));
    assert.notEqual(a.id, enemyRoll(map, p, 18).id);
    assert.notEqual(a.id, enemyRoll(map, p === SPIDER ? STUNDER : SPIDER, 17).id);
  }
  assert.deepEqual([...variations].sort(), [-1,0,1]);
});
test('death rewards occur once per stable enemy ID, including reconstructed enemies', () => {
  const p = createPlayerStats(), run = createRun(), roll = enemyRoll({ seed: 8, depth: 4, key: '0,-4,0' }, STUNDER, 12);
  const e = makeEnemy(roll, STUNDER);
  assert.equal(awardKill(p, run, e), null);
  damageEnemy(e, e.hp); const reward = awardKill(p, run, e);
  assert.equal(p.xp, e.profile.xp); assert.equal(copperTotal(p.inventory), e.coinDrop);
  assert.ok(reward && run.defeated.has(e.id));
  assert.equal(awardKill(p, run, e), null);
  const copy = makeEnemy(roll, STUNDER); damageEnemy(copy, copy.hp);
  assert.equal(awardKill(p, run, copy), null);
  assert.equal(p.xp, e.profile.xp); assert.equal(copperTotal(p.inventory), e.coinDrop);
  const fresh = createPlayerStats(), nextRun = createRun();
  assert.ok(awardKill(fresh, nextRun, copy));
});
test('health regeneration waits five hit-free seconds and respects level-scaled max HP', () => {
  const p = createPlayerStats(); awardXP(p, 100); takeDamage(p, 30, 10);
  assert.equal(p.hp, 80); regenerate(p, 1, 14.99); assert.equal(p.hp, 80);
  regenerate(p, 1, 15); assert.equal(p.hp, 86);
  takeDamage(p, .5, 16); regenerate(p, 1, 20); assert.equal(p.hp, 85.5);
  regenerate(p, 99, 21); assert.equal(p.hp, 110);
  takeDamage(p, 1000, 22); regenerate(p, 99, 30); assert.equal(p.hp, 0);
});
test('every sword has real assets, damage, reach and synchronized attack timing', () => {
  for (const w of WEAPONS) {
    assert.ok(existsSync(assetPath(w.model)));
    assert.ok(existsSync(assetPath(w.icon)));
    const p = hero(); equip(p, w.id); awardXP(p, 700);
    const stats = combatStats(p);
    assert.equal(stats.damage, w.weapon.damage + 8); assert.equal(stats.range, w.weapon.range);
    assert.ok(startSwing(p));
    const e = makeEnemy({ x: 0, y: 0, z: w.weapon.range + SPIDER.radius - .01 }, STUNDER);
    assert.equal(swordHit(p, e), false);
    advanceSwing(p, stats.activeStart + .001); assert.equal(swordHit(p, e), true);
    assert.equal(e.hp, STUNDER.hp - stats.damage);
    assert.equal(swordHit(p, e), false);
    advanceSwing(p, stats.duration); assert.equal(p.sword.active, false);
  }
});
test('equipment guards current actions, and an active swing snapshots its damage', () => {
  const p = hero(); assert.ok(canChangeWeapon(p)); startSwing(p);
  assert.equal(canChangeWeapon(p), false); assert.equal(p.sword.stats.damage, 30);
  awardXP(p, 100); assert.equal(combatStats(p).damage, 32); assert.equal(p.sword.stats.damage, 30);
  const e = makeEnemy({ x: 0, y: 0, z: .8 }, STUNDER);
  advanceSwing(p, p.sword.stats.activeStart + .001); swordHit(p, e); assert.equal(e.hp, 90);
  cancelSwing(p, true);
  for (const extra of [{ragdoll:{}},{climb:{}},{swimming:true},{stun:1},{hp:0}]) assert.equal(canChangeWeapon(Object.assign(hero(), extra)), false);
  removeItem(p.inventory, p.inventory.equipped);
  assert.equal(combatStats(p), null); assert.equal(startSwing(p), false);
});
