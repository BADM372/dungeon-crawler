// A weapon instance's stats: its base type's, grown by its item level and scaled by rarity, then
// changed by its affixes. Combat (core/combat.js) only ever reads these, never the base type.
//   damage: (base × item level growth × rarity + flat) × (1 + percent), rounded
//   interval: the time between swings, shortened by `speed` percent (every swing time with it)
//   range: + reach in cells; arc: the base's × (1 + percent)
//   crit / critDamage: chance (0..1, CRIT_CHANCE without affixes) and multiplier; leech: life on
//   hit; knockback: multiplier
import { ITEMS } from '../items.js';
import { AFFIX, describeAffix } from './affixes.js';
import { rarityOf } from './rarities.js';
import { namesBase } from './names.js';

export const ARC = Math.PI * 0.42;   // the basic swing arc (core/combat.js SWORD.arc)
// learn: combat.html#damage (see learn/README.md)
export const CRIT_CHANCE = 0.05;     // every weapon crits this often without affixes
// learn: combat.html#damage (see learn/README.md)
export const CRIT_DAMAGE = 1.5;      // a critical hit without affixes
// base damage grows by this share per item level: a weapon found ten depths further down hits
// half again as hard as the same one from the top (enemy health grows 12% a level; the
// player's level adds the rest, core/progression.js)
// learn: loot.html#stats-code (see learn/README.md)
export const ILVL_DAMAGE = 0.05;
// learn: loot.html#stats-code (see learn/README.md)
export const ilvlDamage = ilvl => 1 + ILVL_DAMAGE * (Math.max(1, ilvl || 1) - 1);

// learn: loot.html#stats-code, stronger.html#race (see learn/README.md)
export function itemStats(item) {
  const def = ITEMS[item?.itemId], w = def?.weapon;
  if (!w) return null;
  const sum = { damage: 0, damagePct: 0, speed: 0, arc: 0, crit: 0, critDamage: 0, range: 0, leech: 0, knockback: 0 };
  for (const a of item.gen?.affixes ?? []) {
    const { stat, op } = AFFIX[a.id];
    sum[stat === 'damage' && op === 'pct' ? 'damagePct' : stat] += a.value;
  }
  return {
    damage: Math.max(1, Math.round((w.damage * ilvlDamage(item.gen?.ilvl) * rarityOf(item).damage + sum.damage) * (1 + sum.damagePct / 100))),
    interval: Math.round(w.interval * (1 - sum.speed / 100) * 1000) / 1000,
    range: Math.round((w.range + sum.range) * 100) / 100,
    arc: ARC * w.arc * (1 + sum.arc / 100),
    crit: CRIT_CHANCE + sum.crit / 100,
    critDamage: CRIT_DAMAGE + sum.critDamage / 100,
    leech: sum.leech,
    knockback: 1 + sum.knockback / 100,
  };
}

// what to call it, and the base type to show under the name (null when the name says it)
export const displayName = item => item?.gen?.name ?? ITEMS[item?.itemId]?.name ?? '';
export const baseLine = item => item?.gen && !namesBase(item.gen.rarity) ? ITEMS[item.itemId].name : null;
export const affixLines = item => (item?.gen?.affixes ?? []).map(describeAffix);
// damage per second, counting crits: what to compare weapons by
export const weaponDps = s => s.damage * (1 + s.crit * (s.critDamage - 1)) / s.interval;
