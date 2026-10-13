// What a defeated enemy drops besides its coins: maybe a weapon, maybe a health potion. Seeded by
// the world seed and the enemy's id, so the same enemy always drops the same thing (also when
// it comes back after a death, like its coins). The item level is the enemy's level, so deeper
// drops hit harder (core/gear/stats.js).
//   ordinary enemies: a weapon 5% of the time and a potion 3%, both × √(its XP / 30): the
//     tougher the kind, the likelier (a spider 4% / 2.5%, a Stunder 8% / 5%, a Triangle 10% / 6%)
//   side guardians: one weapon, at least Uncommon (Rare from level 10), and a potion
//   descent guardians: two weapons, at least Uncommon (Rare from level 5, Epic from 14), and two
//     potions
// Guardians also roll with luck (rarer results) and are the only source of Ancient items.
import { mulberry32, hash32 } from '../util.js';
import { RARITY } from './rarities.js';
import { rollWeapon } from './generate.js';
import { HEALTH_POTION } from '../items.js';

// kids-docs: loot.html#drops (see kids-docs/README.md)
export const WEAPON_CHANCE = 0.05, POTION_CHANCE = 0.03;
// how much more an enemy of base XP `xp` (level 1) drops than a plain one
const worth = xp => Math.sqrt(Math.max(1, xp ?? 30) / 30);
export const dropChance = xp => Math.min(0.15, WEAPON_CHANCE * worth(xp));
export const potionChance = xp => Math.min(0.1, POTION_CHANCE * worth(xp));

// kids-docs: loot.html#drops (see kids-docs/README.md)
export function guardianDrops(role, level) {
  if (role === 'descent') return { count: 2, floor: RARITY[level >= 14 ? 'epic' : level >= 5 ? 'rare' : 'uncommon'].rank, luck: 0.2, ancient: true, potions: 2 };
  return { count: 1, floor: RARITY[level >= 10 ? 'rare' : 'uncommon'].rank, luck: 0.1, ancient: true, potions: 1 };
}

export function hashString(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}
const stream = (enemy, seed, salt) => mulberry32(hash32(hashString(String(enemy.id)) ^ Math.imul(seed >>> 0, 0x9e3779b1) ^ salt));

// enemy: { id, level, kind? (its level-1 profile), guardian?, guardianRole? }; seed: the world's
// kids-docs: code.html#loops (see kids-docs/README.md)
export function weaponDrops(enemy, seed = 0) {
  const R = stream(enemy, seed, 0x10075);
  const level = Math.max(1, enemy.level || 1);
  if (!enemy.guardian) return R() < dropChance(enemy.kind?.xp) ? [rollWeapon(R, level)] : [];
  const g = guardianDrops(enemy.guardianRole ?? 'descent', level), out = [];
  for (let i = 0; i < g.count; i++) out.push(rollWeapon(R, level, g));
  return out;
}
// health potions, on a stream of their own (so weapon drops do not depend on them)
export function potionDrops(enemy, seed = 0) {
  const n = enemy.guardian ? guardianDrops(enemy.guardianRole ?? 'descent', enemy.level || 1).potions
    : stream(enemy, seed, 0x9071)() < potionChance(enemy.kind?.xp) ? 1 : 0;
  return n ? [{ itemId: HEALTH_POTION.id, count: n }] : [];
}
// everything but the coins
export const enemyDrops = (enemy, seed = 0) => [...weaponDrops(enemy, seed), ...potionDrops(enemy, seed)];
