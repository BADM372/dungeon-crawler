// Numerous light bodies, with depth-appropriate levels and a shared reward budget.
import { enemyKind } from './enemies.js';

export const HORDE = { hp: .6, damage: .55, speed: 1.15, attackers: 3, startGap: .18, reaction: .35, giveUp: 1.5 };
const kinds = new WeakMap();
export function swarmKind(base, rewardScale = 1) {
  let scales = kinds.get(base);
  if (!scales) { scales = new Map(); kinds.set(base, scales); }
  if (!scales.has(rewardScale)) scales.set(rewardScale, enemyKind(base, {
    mods: { hp: HORDE.hp, damage: HORDE.damage, speed: HORDE.speed, xp: rewardScale },
    swarm: true, knock: base.knock * .65, dropXP: base.xp, dropScale: rewardScale, leechScale: rewardScale,
  }));
  return scales.get(rewardScale);
}
