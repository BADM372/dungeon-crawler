// What a defeated enemy drops besides its coins: maybe a weapon. Seeded by the world seed and
// the enemy's id, so the same enemy always drops the same thing (also when it comes back after
// a death, like its coins). The item level is the enemy's level.
//   ordinary enemies: 8% at level 1, +0.4% per level, at most 12%
//   side guardians: one weapon (two from level 15), at least Uncommon (Rare from level 18)
//   descent guardians: two (three from level 20), at least Rare (Epic from level 20)
// Guardians also roll with luck (rarer results) and are the only source of Ancient items.
import { mulberry32, hash32 } from '../util.js';
import { RARITY } from './rarities.js';
import { rollWeapon } from './generate.js';

export const dropChance = level => Math.min(0.12, 0.08 + 0.004 * (level - 1));

export function guardianDrops(role, level) {
  if (role === 'descent') return { count: level >= 20 ? 3 : 2, floor: RARITY[level >= 20 ? 'epic' : 'rare'].rank, luck: 0.3, ancient: true };
  return { count: level >= 15 ? 2 : 1, floor: RARITY[level >= 18 ? 'rare' : 'uncommon'].rank, luck: 0.15, ancient: true };
}

export function hashString(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

// enemy: { id, level, guardian?, guardianRole? }; seed: the world's seed
export function weaponDrops(enemy, seed = 0) {
  const R = mulberry32(hash32(hashString(String(enemy.id)) ^ Math.imul(seed >>> 0, 0x9e3779b1) ^ 0x10075));
  const level = Math.max(1, enemy.level || 1);
  if (!enemy.guardian) return R() < dropChance(level) ? [rollWeapon(R, level)] : [];
  const g = guardianDrops(enemy.guardianRole ?? 'descent', level), out = [];
  for (let i = 0; i < g.count; i++) out.push(rollWeapon(R, level, g));
  return out;
}
