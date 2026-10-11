// Shared enemy tuning, in game cells / seconds. Stunder is a slow, heavy threat.
export const SPIDER = Object.freeze({
  type: 'spider', label: 'Spider', hp: 30, damage: 20, knock: 4.5,
  radius: 0.3, height: 0.9, bodyHeight: 0.45, mass: 1,
  aggro: 3, giveUp: 6, chase: 2.6, wander: 0.6, homeSpeed: 1.2,
  reach: 0.85, hitReach: 1.15, hitAt: 0.42, trackUntil: 0.42, attackTime: 1.07, cooldown: 1.2,
  hitStun: 0.18, deathTime: 2, corpseTime: 3.5,
  seedSalt: 0x5b1d3a, minCount: 1, maxCount: 7, spacing: 3,
});
export const STUNDER = Object.freeze({
  type: 'stunder', label: 'Stunder', hp: 120, damage: 40, knock: 7,
  radius: 0.48, height: 2.8, bodyHeight: 2.15, mass: 4,
  aggro: 4.5, giveUp: 8, chase: 1.05, wander: 0.45, homeSpeed: 0.65,
  reach: 1.15, hitReach: 1.55, hitAt: 16 / 30, trackUntil: 0.3, attackTime: 1.6, cooldown: 1.6,
  hitStun: 0.25, deathTime: 2.4, corpseTime: 4,
  seedSalt: 0x57a4de2, minCount: 0, maxCount: 2, spacing: 5,
});

export function makeEnemy(spot, profile, i = 0) {
  return {
    ...spot, profile, type: profile.type, hp: profile.hp, home: spot.f,
    mode: 'idle', t: 1 + i * 0.7, think: i * 0.05, speed: 0,
    path: null, lost: 0, cool: 0, attacks: 0, bit: false,
    deadT: 0, hurtT: 0, stun: 0, phase: (i * 0.37) % 1,
  };
}
