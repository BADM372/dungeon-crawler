import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../src/core/util.js';
import { ITEMS, OLD_SWORD, WEAPONS } from '../src/core/items.js';
import { RARITIES, RARITY, rarityOdds, rollRarity } from '../src/core/gear/rarities.js';
import { AFFIXES, AFFIX, MAX_PREFIXES, MAX_SUFFIXES, MAX_TIER, affixTier, describeAffix } from '../src/core/gear/affixes.js';
import { BASES } from '../src/core/gear/bases.js';
import { rollWeapon, fixedWeapon, GEN_VERSION } from '../src/core/gear/generate.js';
import { weaponDrops, dropChance, guardianDrops } from '../src/core/gear/drops.js';
import { itemStats, displayName, baseLine, affixLines, ARC, CRIT_DAMAGE } from '../src/core/gear/stats.js';
import { createInventory, addInstance, takeItem, equipItem, equippedItem, hasRoom } from '../src/core/inventory.js';
import { createPlayerStats } from '../src/core/progression.js';
import { swordState, combatStats, startSwing, advanceSwing, swordHit } from '../src/core/combat.js';
import { STUNDER, makeEnemy } from '../src/core/enemies.js';

const many = (n, f) => Array.from({ length: n }, (_, i) => f(i));

test('rarities run from junk to ancient, each with its own colour and stronger than the last', () => {
  assert.deepEqual(RARITIES.map(r => r.id), ['junk', 'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'ancient']);
  assert.equal(new Set(RARITIES.map(r => r.css)).size, RARITIES.length);
  for (const r of RARITIES) assert.match(r.css, /^#[0-9a-f]{6}$/);
  for (let i = 1; i < RARITIES.length; i++) {
    const a = RARITIES[i - 1], b = RARITIES[i];
    assert.equal(b.rank, i);
    assert.ok(b.damage > a.damage && b.affixes >= a.affixes && (i < 2 || b.weight < a.weight));
    if (b.glow && a.glow) assert.ok(b.glow.ring >= a.glow.ring && b.glow.halo >= a.glow.halo && b.glow.beam >= a.glow.beam);
  }
  assert.equal(RARITY.junk.glow, null); assert.equal(RARITY.common.glow, null);
  for (const r of RARITIES.slice(2)) assert.ok(r.glow);
  assert.ok(RARITY.mythic.glow.light && RARITY.ancient.glow.light && !RARITY.legendary.glow.light, 'only the top tiers claim a pooled light');
});

test('rarity odds shift upwards with item level, respect gates, floors and the guardian-only tier', () => {
  for (const ilvl of [1, 3, 5, 9, 14, 20, 40]) for (const opts of [{}, { luck: 0.3, floor: 3, ancient: true }]) {
    const odds = rarityOdds(ilvl, opts);
    assert.ok(Math.abs(odds.reduce((a, b) => a + b, 0) - 1) < 1e-9);
    RARITIES.forEach((r, i) => { if (ilvl < r.minLevel || r.rank < (opts.floor ?? 0)) assert.equal(odds[i], 0); });
    if (!opts.ancient) assert.equal(odds[RARITY.ancient.rank], 0);
  }
  const low = rarityOdds(1), high = rarityOdds(12);
  assert.ok(high[RARITY.rare.rank] > low[RARITY.rare.rank] && high[RARITY.junk.rank] < low[RARITY.junk.rank]);
  assert.deepEqual(rarityOdds(1).map(p => p > 0), [true, true, true, true, false, false, false, false]);
  // the rolls follow the odds
  const R = mulberry32(5), n = 40000, seen = new Map();
  for (let i = 0; i < n; i++) { const r = rollRarity(R, 9).id; seen.set(r, (seen.get(r) || 0) + 1); }
  rarityOdds(9).forEach((p, i) => assert.ok(Math.abs((seen.get(RARITIES[i].id) || 0) / n - p) < 0.01, RARITIES[i].id));
});

test('generated weapons are deterministic, plain JSON, and valid for every rarity and level', () => {
  assert.deepEqual(rollWeapon(mulberry32(7), 6), rollWeapon(mulberry32(7), 6));
  const R = mulberry32(11);
  for (const r of RARITIES) for (const ilvl of [1, 4, 8, 13, 19, 30]) for (let k = 0; k < 20; k++) {
    const item = rollWeapon(R, ilvl, { rarity: r.id });
    assert.deepEqual(JSON.parse(JSON.stringify(item)), item);
    assert.equal(item.gen.v, GEN_VERSION); assert.equal(item.gen.rarity, r.id); assert.equal(item.count, 1);
    assert.ok(BASES.some(b => b.itemId === item.itemId && ilvl >= b.minLevel), 'a base allowed at this level');
    assert.equal(item.gen.affixes.length, r.affixes);
    assert.equal(new Set(item.gen.affixes.map(a => a.id)).size, item.gen.affixes.length, 'distinct affixes');
    const kinds = item.gen.affixes.map(a => AFFIX[a.id].kind);
    assert.ok(kinds.filter(k => k === 'prefix').length <= MAX_PREFIXES && kinds.filter(k => k === 'suffix').length <= MAX_SUFFIXES);
    for (const a of item.gen.affixes) {
      assert.equal(a.tier, Math.min(MAX_TIER, affixTier(ilvl) + r.tierBonus));
      const [lo, hi] = AFFIX[a.id].tiers[a.tier - 1];
      assert.ok(a.value >= lo && a.value <= hi, `${a.id} ${a.value} in [${lo}, ${hi}]`);
      assert.ok(describeAffix(a).length);
    }
    assert.ok(item.gen.name.length > 2);
    const s = itemStats(item);
    assert.ok(s.damage >= 1 && s.cooldown > 0.5 && s.range > 0.5 && s.arc >= ARC && s.crit >= 0 && s.crit < 0.5
      && s.critDamage >= CRIT_DAMAGE && s.leech >= 0 && s.knockback >= 1);
  }
});

test('every affix tier is an increasing range, and the pool covers the most affixes a rarity needs', () => {
  for (const a of AFFIXES) {
    assert.equal(a.tiers.length, MAX_TIER);
    a.tiers.forEach(([lo, hi], i) => { assert.ok(lo < hi); if (i) assert.ok(lo >= a.tiers[i - 1][0] && hi > a.tiers[i - 1][1]); });
  }
  const most = Math.max(...RARITIES.map(r => r.affixes));
  assert.ok(Math.min(MAX_PREFIXES, AFFIXES.filter(a => a.kind === 'prefix').length)
    + Math.min(MAX_SUFFIXES, AFFIXES.filter(a => a.kind === 'suffix').length) >= most);
  assert.deepEqual([1, 3, 4, 7, 8, 12, 13, 18, 19, 99].map(affixTier), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
});

test('names: generated for every rarity, the base under it unless the name says it', () => {
  const R = mulberry32(3);
  for (const r of RARITIES) {
    const item = rollWeapon(R, 20, { rarity: r.id, itemId: 'weapon_sword_long' });
    assert.ok(displayName(item));
    if (r.id === 'junk' || r.id === 'common') { assert.match(displayName(item), /Long Sword$/); assert.equal(baseLine(item), null); }
    else assert.equal(baseLine(item), 'Long Sword');
  }
  const names = new Set(many(3000, () => rollWeapon(R, 9, { rarity: 'rare' }).gen.name.toLowerCase()));
  for (const bad of ['thornthorn', 'hollowhollow', 'boneedge', 'starreaver', 'emberreaver'])
    assert.ok(!names.has(bad), bad);
  assert.ok(names.size > 200, 'plenty of different names');
});

test('stats: rarity scales base damage, affixes add on top', () => {
  const old = fixedWeapon(OLD_SWORD.id);
  assert.deepEqual(old.gen, { v: GEN_VERSION, rarity: 'common', ilvl: 1, affixes: [], name: 'Old Sword' });
  assert.deepEqual(itemStats(old), { damage: 30, cooldown: 1.12, range: 0.85, arc: ARC, crit: 0, critDamage: CRIT_DAMAGE, leech: 0, knockback: 1 });
  assert.deepEqual(itemStats({ itemId: OLD_SWORD.id }), itemStats(old), 'a weapon without gen is common');
  const gen = (rarity, affixes) => ({ itemId: 'weapon_sword_long', count: 1, gen: { v: 1, rarity, ilvl: 10, affixes, name: 'x' } });
  assert.equal(itemStats(gen('junk', [])).damage, 30);
  assert.equal(itemStats(gen('ancient', [])).damage, 52);
  const s = itemStats(gen('legendary', [{ id: 'sharp', tier: 3, value: 10 }, { id: 'brutal', tier: 3, value: 20 },
    { id: 'swift', tier: 3, value: 10 }, { id: 'reach', tier: 3, value: 0.15 }]));
  assert.equal(s.damage, Math.round((40 * 1.15 + 10) * 1.2));
  assert.equal(s.cooldown, 1.098); assert.equal(s.range, 1.2);
  const t = itemStats(gen('epic', [{ id: 'vicious', tier: 2, value: 6 }, { id: 'precision', tier: 2, value: 25 },
    { id: 'leech', tier: 2, value: 3 }, { id: 'force', tier: 2, value: 40 }, { id: 'sweeping', tier: 2, value: 20 }]));
  assert.deepEqual([t.crit, t.critDamage, t.leech, t.knockback, t.arc], [0.06, 1.75, 3, 1.4, ARC * 1.2]);
  assert.deepEqual(affixLines(gen('rare', [{ id: 'reach', tier: 1, value: 0.06 }])), ['+0.06 reach']);
  assert.equal(itemStats({ itemId: 'item_potion_health', count: 1 }), null);
});

test('drops: seeded per enemy and world, 8-12% from ordinary enemies, guardians always drop', () => {
  assert.equal(dropChance(1), 0.08); assert.equal(dropChance(11), 0.12); assert.equal(dropChance(30), 0.12);
  const e = { id: '0,-4,0:spider:17', level: 3 };
  assert.deepEqual(weaponDrops(e, 9), weaponDrops(e, 9));
  for (const level of [1, 6, 11]) {
    const n = 20000, got = many(n, i => weaponDrops({ id: `k:spider:${i}`, level }, 1).length).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(got / n - dropChance(level)) < 0.01, `level ${level}: ${got / n}`);
  }
  // the world seed matters: same ids in another world drop other things
  const ids = many(400, i => ({ id: `0,-2,0:snake:${i}`, level: 5 }));
  assert.notDeepEqual(ids.map(e => weaponDrops(e, 1)), ids.map(e => weaponDrops(e, 2)));
  for (const [role, level, count, least] of [['side', 7, 1, 'uncommon'], ['side', 15, 2, 'uncommon'], ['side', 18, 2, 'rare'],
    ['descent', 10, 2, 'rare'], ['descent', 20, 3, 'epic'], ['descent', 26, 3, 'epic']]) {
    assert.equal(guardianDrops(role, level).count, count);
    for (let i = 0; i < 50; i++) {
      const drops = weaponDrops({ id: `${i},0,0:guardian`, level, guardian: true, guardianRole: role }, 4);
      assert.equal(drops.length, count);
      for (const d of drops) assert.ok(RARITY[d.gen.rarity].rank >= RARITY[least].rank, `${role} L${level}: ${d.gen.rarity}`);
    }
  }
  // ancient only from guardians
  for (let i = 0; i < 3000; i++) for (const d of weaponDrops({ id: `x:${i}`, level: 40 }, 3)) assert.notEqual(d.gen.rarity, 'ancient');
});

test('instances: own slots, taken out whole, equipped ones unequip, and a full bag refuses', () => {
  const p = createPlayerStats(), inv = p.inventory, first = equippedItem(inv);
  assert.equal(first.itemId, OLD_SWORD.id); assert.equal(first.gen.name, 'Old Sword'); assert.equal(first.gen.rarity, 'common');
  const item = rollWeapon(mulberry32(1), 5, { rarity: 'epic' }), id = addInstance(inv, item);
  const slot = inv.slots.find(s => s?.instanceId === id);
  assert.deepEqual(slot.gen, item.gen); assert.equal(slot.count, 1);
  assert.ok(equipItem(inv, id)); assert.equal(combatStats(p).damage, itemStats(item).damage);
  assert.deepEqual(takeItem(inv, id), item);
  assert.equal(inv.equipped, null); assert.equal(combatStats(p), null, 'no weapon: no attacks');
  assert.equal(takeItem(inv, id), null);
  assert.deepEqual(takeItem(inv, first.instanceId), fixedWeapon(OLD_SWORD.id));
  const full = createInventory();
  for (let i = 0; i < full.slots.length; i++) assert.ok(addInstance(full, item));
  assert.ok(!hasRoom(full));
  const before = JSON.stringify(full);
  assert.equal(addInstance(full, item), null); assert.equal(JSON.stringify(full), before);
  assert.throws(() => addInstance(full, { itemId: 'item_coin_gold' }));
  assert.ok(WEAPONS.every(w => ITEMS[w.id] === w));
});

test('crits multiply damage, life on hit heals up to the maximum', () => {
  const p = { ...createPlayerStats(), x: 0, y: 0, z: 0, yaw: 0, stun: 0, sword: swordState() };
  const inv = p.inventory;
  equipItem(inv, addInstance(inv, { itemId: 'weapon_sword_long', count: 1, gen: { v: 1, rarity: 'common', ilvl: 5, name: 'x',
    affixes: [{ id: 'vicious', tier: 2, value: 10 }, { id: 'leech', tier: 2, value: 3 }, { id: 'precision', tier: 2, value: 50 }] } }));
  const stats = combatStats(p);
  assert.equal(stats.crit, 0.1); assert.equal(stats.critDamage, 2);
  const swing = () => { p.sword.cool = 0; startSwing(p); advanceSwing(p, stats.activeStart + .001); };
  p.hp = 50;
  swing(); let e = makeEnemy({ x: 0, y: 0, z: 0.8 }, STUNDER);
  assert.deepEqual(swordHit(p, e, 0.5), { damage: 40, crit: false }); assert.equal(p.hp, 53);
  advanceSwing(p, 5); swing(); e = makeEnemy({ x: 0, y: 0, z: 0.8 }, STUNDER);
  assert.deepEqual(swordHit(p, e, 0.05), { damage: 80, crit: true }); assert.equal(e.hp, STUNDER.hp - 80);
  p.hp = p.maxHp - 1; advanceSwing(p, 5); swing(); swordHit(p, makeEnemy({ x: 0, y: 0, z: 0.8 }, STUNDER), 0.9);
  assert.equal(p.hp, p.maxHp);
});
