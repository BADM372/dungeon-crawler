// Shared enemy tuning, in game cells / seconds. Stunder is a slow, heavy threat.
// A strike's timing / reach / effect lives on the profile; a species with several
// attacks lists them in `attacks` (`clip` names its animation, `weight` how often it
// is picked). `arc` is the minimum cosine to the target (-1: hits all around),
// `power` scales the profile's damage, `knockDown` floors the player.
import { hash32, mulberry32 } from './util.js';

export const SPIDER = Object.freeze({
  type: 'spider', label: 'Spider', hp: 30, damage: 15, knock: 4.5,
  hpPerLevel: 4, damagePerLevel: 2, xp: 20, xpPerLevel: 5, coins: Object.freeze([4, 8]),
  radius: 0.3, height: 0.9, bodyHeight: 0.45, mass: 1,
  aggro: 3, giveUp: 6, chase: 2.6, wander: 0.6, homeSpeed: 1.2,
  reach: 0.85, hitReach: 1.15, hitAt: 0.42, trackUntil: 0.42, attackTime: 1.07, cooldown: 1.2,
  arc: 0.5, knockDown: false, hop: 3.5, reason: 'Bitten by a spider!', ichor: Object.freeze(['#a6d84e', '#5f8f22']), pitch: 1.1,
  hitStun: 0.18, deathTime: 2, corpseTime: 3.5,
  seedSalt: 0x5b1d3a, minCount: 4, maxCount: 14, spacing: 3,
});
export const STUNDER = Object.freeze({
  type: 'stunder', label: 'Stunder', hp: 120, damage: 30, knock: 7,
  hpPerLevel: 14, damagePerLevel: 3, xp: 80, xpPerLevel: 20, coins: Object.freeze([20, 35]),
  radius: 0.48, height: 2.8, bodyHeight: 2.15, mass: 4,
  aggro: 4.5, giveUp: 8, chase: 1.05, wander: 0.45, homeSpeed: 0.65,
  reach: 1.15, hitReach: 1.55, hitAt: 16 / 30, trackUntil: 0.3, attackTime: 1.6, cooldown: 1.6,
  arc: 0.5, knockDown: true, hop: 4, reason: 'Rammed by a Stunder!', ichor: Object.freeze(['#d0503a', '#7a2418']), pitch: 0.8,
  hitStun: 0.25, deathTime: 2.4, corpseTime: 4,
  seedSalt: 0x57a4de2, minCount: 0, maxCount: 2, spacing: 5,
});
// Slithers in with its head raised and lunges forward and down to bite (clip frame 12).
export const SNAKE = Object.freeze({
  type: 'snake', label: 'Snake', hp: 40, damage: 16, knock: 4,
  hpPerLevel: 5, damagePerLevel: 2, xp: 30, xpPerLevel: 7, coins: Object.freeze([6, 12]),
  radius: 0.3, height: 0.8, bodyHeight: 0.6, mass: 1.2,
  aggro: 3.5, giveUp: 6, chase: 2.2, wander: 0.6, homeSpeed: 1.1,
  reach: 0.95, hitReach: 1.25, hitAt: 12 / 30, trackUntil: 0.26, attackTime: 1, cooldown: 1.3,
  arc: 0.5, knockDown: false, hop: 3.5, reason: 'Bitten by a snake!', ichor: Object.freeze(['#b4e67e', '#4f8f2a']), pitch: 1.25,
  hitStun: 0.18, deathTime: 2, corpseTime: 3.5,
  seedSalt: 0x5a4e7c1, minCount: 0, maxCount: 3, spacing: 3,
});
// Slaps with both arms (clip frame 13), or spins on five legs and sweeps the sixth
// all around it (clip frame 19): a harder kick that knocks the player over.
const OCTO_SLAP = Object.freeze({
  name: 'slap', clip: 'slap', weight: 2, hitAt: 13 / 30, trackUntil: 0.3, attackTime: 1.1, hitReach: 1.35,
  arc: 0.5, power: 1, knock: 5, knockDown: false, hop: 3.5, reason: 'Slapped by an Octonaut!',
});
const OCTO_SPIN = Object.freeze({
  name: 'spin', clip: 'spin', weight: 1, hitAt: 19 / 30, trackUntil: 0.15, attackTime: 1.4, hitReach: 1.5,
  arc: -1, power: 1.4, knock: 7, knockDown: true, hop: 3.8, reason: 'Kicked by an Octonaut!',
});
export const OCTONAUT = Object.freeze({
  type: 'octonaut', label: 'Octonaut', hp: 80, damage: 20, knock: 5,
  hpPerLevel: 9, damagePerLevel: 3, xp: 55, xpPerLevel: 13, coins: Object.freeze([12, 22]),
  radius: 0.42, height: 1.7, bodyHeight: 1.2, mass: 2.5,
  aggro: 4, giveUp: 7, chase: 1.5, wander: 0.5, homeSpeed: 0.8,
  reach: 1, ...OCTO_SLAP, cooldown: 1.4, ichor: Object.freeze(['#8fd0ff', '#2f6f9f']), pitch: 0.95,
  attacks: Object.freeze([OCTO_SLAP, OCTO_SPIN]),
  hitStun: 0.22, deathTime: 2.2, corpseTime: 4,
  seedSalt: 0x0c7a9a5, minCount: 0, maxCount: 2, spacing: 4,
});
export const ENEMY_PROFILES = Object.freeze([SPIDER, STUNDER, SNAKE, OCTONAUT]);

// the attack e is performing (or about to perform): one of profile.attacks, else the profile
export const attackOf = e => e.profile.attacks?.[e.attack] ?? e.profile;
export function pickAttack(profile, r = Math.random()) {
  const list = profile.attacks;
  if (!list) return 0;
  let w = r * list.reduce((n, a) => n + a.weight, 0);
  for (let i = 0; i < list.length; i++) if ((w -= list[i].weight) < 0) return i;
  return list.length - 1;
}

export function enemyProfile(profile, level) {
  if (!Number.isSafeInteger(level) || level < 1) throw new RangeError('Invalid enemy level');
  const n = level - 1;
  return Object.freeze({ ...profile, hp: profile.hp + profile.hpPerLevel * n,
    damage: profile.damage + profile.damagePerLevel * n, xp: profile.xp + profile.xpPerLevel * n });
}
export function enemyRoll(map, profile, floorId) {
  const R = mulberry32(hash32(map.seed ^ profile.seedSalt ^ Math.imul(floorId, 7919) ^ 0x1007));
  const depth = Math.max(0, map.depth || 0), r = R();
  const level = Math.max(1, 1 + Math.floor(depth / 2) + (depth >= 2 ? r < .25 ? -1 : r >= .75 ? 1 : 0 : 0));
  const factor = 1 + .25 * (level - 1), lo = Math.round(profile.coins[0] * factor), hi = Math.round(profile.coins[1] * factor);
  return { id: `${map.key ?? map.seed}:${profile.type}:${floorId}`, level, coinDrop: lo + Math.floor(R() * (hi - lo + 1)) };
}
export function makeEnemy(spot, profile, i = 0) {
  profile = enemyProfile(profile, spot.level || 1);
  return {
    ...spot, level: spot.level || 1, profile, type: profile.type, hp: profile.hp, home: spot.f,
    mode: 'idle', t: 1 + i * 0.7, think: i * 0.05, speed: 0,
    path: null, lost: 0, cool: 0, attacks: 0, attack: 0, bit: false,
    deadT: 0, hurtT: 0, stun: 0, phase: (i * 0.37) % 1,
  };
}
