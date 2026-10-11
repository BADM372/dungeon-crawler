// Pure sword rules. Jumping / body contact never call damageEnemy.
// Timings match character.glb's Slash (32 frames at 30 fps).
import { BASIC_SWORD, ITEMS } from './items.js';
import { equippedItem } from './inventory.js';
import { damageBonus } from './progression.js';

export const SWORD = Object.freeze({
  damage: 30, range: 0.85, arc: Math.PI * 0.42,
  duration: 32 / 30, activeStart: 15 / 30, activeEnd: 21 / 30, cooldown: 1.12,
});
export const swordState = () => ({ active: false, requested: false, t: 0, cool: 0, serial: 0, yaw: 0, stats: null, hits: new Set() });
export const equippedWeapon = p => p.inventory ? ITEMS[equippedItem(p.inventory)?.itemId] || null : BASIC_SWORD;
export const canChangeWeapon = p => !p.sword.active && !p.ragdoll && !p.climb && !p.swimming && p.stun <= 0 && p.hp > 0;
export function combatStats(p) {
  const weapon = equippedWeapon(p)?.weapon;
  if (!weapon) return null;
  const speed = weapon.cooldown / SWORD.cooldown;
  return { ...SWORD, ...weapon, damage: weapon.damage + damageBonus(p.level || 1),
    duration: SWORD.duration * speed, activeStart: SWORD.activeStart * speed, activeEnd: SWORD.activeEnd * speed };
}

export function cancelSwing(p, resetCooldown = false) {
  p.sword.active = false;
  p.sword.requested = false;
  p.sword.hits.clear();
  if (resetCooldown) p.sword.cool = 0;
}
export function startSwing(p) {
  const s = p.sword, stats = combatStats(p);
  if (!stats || s.active || s.cool > 0 || p.ragdoll || p.swimming || p.climb || p.stun > 0 || p.hp <= 0) return false;
  // Snapshot this swing: a level-up or later equipment change cannot alter a hit midway.
  Object.assign(s, { active: true, t: 0, cool: stats.cooldown, yaw: p.yaw, serial: s.serial + 1, stats });
  s.hits.clear();
  return true;
}
export function advanceSwing(p, dt) {
  const s = p.sword;
  s.cool = Math.max(0, s.cool - dt);
  if (!s.active) return;
  if (p.ragdoll || p.swimming || p.climb || p.stun > 0 || p.hp <= 0) { cancelSwing(p); return; }
  s.t += dt;
  if (s.t >= (s.stats || SWORD).duration) cancelSwing(p);
}

export function inSwordArc(p, enemy) {
  const s = p.sword, stats = s.stats || SWORD;
  if (!s.active || s.t < stats.activeStart || s.t > stats.activeEnd
      || enemy.mode === 'dead' || s.hits.has(enemy)) return false;
  const dx = enemy.x - p.x, dz = enemy.z - p.z, distance = Math.hypot(dx, dz);
  if (distance > stats.range + enemy.profile.radius) return false;
  if (distance > 0.01 && Math.cos(Math.atan2(dx, dz) - s.yaw) < Math.cos(stats.arc)) return false;
  // A blade sweeps around knee-to-chest height, not through a floor below us.
  const bottom = p.y + 0.08, top = p.y + 0.85;
  return enemy.y + enemy.profile.bodyHeight > bottom && enemy.y < top;
}
export function damageEnemy(enemy, amount) {
  if (enemy.mode === 'dead') return false;
  enemy.hp = Math.max(0, enemy.hp - amount);
  enemy.hurtT = 0.22;
  enemy.speed = 0;
  if (!enemy.hp) {
    enemy.mode = 'dead'; enemy.deadT = 0; enemy.path = null;
  } else {
    // A hit interrupts a wind-up, but each swing can hit this enemy only once.
    enemy.mode = 'chase'; enemy.stun = enemy.profile.hitStun;
    enemy.cool = Math.max(enemy.cool, 0.45);
    enemy.think = 0;
  }
  return true;
}
export function swordHit(p, enemy) {
  if (!inSwordArc(p, enemy)) return false;
  p.sword.hits.add(enemy);
  return damageEnemy(enemy, (p.sword.stats || SWORD).damage);
}
