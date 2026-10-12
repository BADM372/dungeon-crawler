// A weapon instance's stats: its base type's, scaled by rarity, then changed by its affixes.
// Combat (core/combat.js) only ever reads these, never the base type directly.
//   damage: (base × rarity + flat) × (1 + percent), rounded
//   cooldown: shortened by `speed` percent (and every swing time with it)
//   range: + reach in cells; arc: × (1 + percent)
//   crit / critDamage: chance (0..1) and multiplier; leech: life on hit; knockback: multiplier
import { ITEMS } from '../items.js';
import { AFFIX, describeAffix } from './affixes.js';
import { rarityOf } from './rarities.js';
import { namesBase } from './names.js';

export const ARC = Math.PI * 0.42;   // the basic swing arc (core/combat.js SWORD.arc)
export const CRIT_DAMAGE = 1.5;      // a critical hit without affixes

export function itemStats(item) {
  const def = ITEMS[item?.itemId], w = def?.weapon;
  if (!w) return null;
  const sum = { damage: 0, damagePct: 0, speed: 0, arc: 0, crit: 0, critDamage: 0, range: 0, leech: 0, knockback: 0 };
  for (const a of item.gen?.affixes ?? []) {
    const { stat, op } = AFFIX[a.id];
    sum[stat === 'damage' && op === 'pct' ? 'damagePct' : stat] += a.value;
  }
  return {
    damage: Math.max(1, Math.round((w.damage * rarityOf(item).damage + sum.damage) * (1 + sum.damagePct / 100))),
    cooldown: Math.round(w.cooldown * (1 - sum.speed / 100) * 1000) / 1000,
    range: Math.round((w.range + sum.range) * 100) / 100,
    arc: ARC * (1 + sum.arc / 100),
    crit: sum.crit / 100,
    critDamage: CRIT_DAMAGE + sum.critDamage / 100,
    leech: sum.leech,
    knockback: 1 + sum.knockback / 100,
  };
}

// what to call it, and the base type to show under the name (null when the name says it)
export const displayName = item => item?.gen?.name ?? ITEMS[item?.itemId]?.name ?? '';
export const baseLine = item => item?.gen && !namesBase(item.gen.rarity) ? ITEMS[item.itemId].name : null;
export const affixLines = item => (item?.gen?.affixes ?? []).map(describeAffix);
