// Pure sword rules. Jumping / body contact never call damageEnemy.
// A swing is a quick wind-up, a short contact window and a recovery that a new swing
// (chaining) or movement can cut short. The Slash clip in character.glb is retimed to fit
// (swingClipTime): its own frames are SLASH_CLIP.
import { BASIC_SWORD, ITEMS } from './items.js';
import { equippedItem } from './inventory.js';
import { damageBonus } from './progression.js';

export const SLASH_CLIP = Object.freeze({ duration: 32 / 30, activeStart: 15 / 30, activeEnd: 21 / 30 });
// game time (s) for the basic sword; cooldown is the reference that weapon speeds scale by
export const SWORD = Object.freeze({
  damage: 30, range: 0.85, arc: Math.PI * 0.42,
  activeStart: 0.16, activeEnd: 0.27,   // the blade connects ~0.16 s after the click
  moveCancel: 0.3, chain: 0.42,         // walk out of the recovery / swing again from here
  duration: 0.62, cooldown: 1.12,
});
const TIMES = ['activeStart', 'activeEnd', 'moveCancel', 'chain', 'duration'];
// how far beyond blade reach the wind-up steps in towards a target (game/update.js)
export const LUNGE_REACH = 0.6;
// requested: an attack is queued (buffer: for how much longer); target: what it aims at
// (an enemy, a point {x, z} or null for straight ahead)
export const swordState = () => ({ active: false, requested: false, buffer: 0, target: null,
  t: 0, cool: 0, serial: 0, yaw: 0, stats: null, hits: new Set() });
export const equippedWeapon = p => p.inventory ? ITEMS[equippedItem(p.inventory)?.itemId] || null : BASIC_SWORD;
export const canChangeWeapon = p => !p.sword.active && !p.ragdoll && !p.climb && !p.swimming && p.stun <= 0 && p.hp > 0;
export function combatStats(p) {
  const weapon = equippedWeapon(p)?.weapon;
  if (!weapon) return null;
  const speed = weapon.cooldown / SWORD.cooldown;
  return { ...SWORD, ...weapon, damage: weapon.damage + damageBonus(p.level || 1),
    ...Object.fromEntries(TIMES.map(k => [k, SWORD[k] * speed])) };
}

// the Slash clip's time for swing time t: wind-up, contact and recovery are each mapped
// onto the clip's own parts, so the blade connects on the clip's contact frames
export function swingClipTime(stats, t) {
  const C = SLASH_CLIP, s = stats || SWORD;
  const seg = (t0, t1, c0, c1) => c0 + (c1 - c0) * Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
  if (t < s.activeStart) return seg(0, s.activeStart, 0, C.activeStart);
  if (t < s.activeEnd) return seg(s.activeStart, s.activeEnd, C.activeStart, C.activeEnd);
  return seg(s.activeEnd, s.duration, C.activeEnd, C.duration);
}

export function cancelSwing(p, resetCooldown = false) {
  p.sword.active = false;
  p.sword.requested = false; p.sword.buffer = 0;
  p.sword.hits.clear();
  if (resetCooldown) p.sword.cool = 0;
}
// a new swing may start when idle, or once the current one reaches its chain point (cool)
export function startSwing(p, yaw = p.yaw) {
  const s = p.sword, stats = combatStats(p);
  if (!stats || s.cool > 0 || p.ragdoll || p.swimming || p.climb || p.stun > 0 || p.hp <= 0) return false;
  // Snapshot this swing: a level-up or later equipment change cannot alter a hit midway.
  Object.assign(s, { active: true, t: 0, cool: stats.chain, yaw, serial: s.serial + 1, stats });
  s.hits.clear();
  return true;
}
// movement may cut the swing short once the blade has gone through
export const canMoveCancel = p => p.sword.active && p.sword.t >= (p.sword.stats || SWORD).moveCancel;
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
// Keyboard soft-targeting, like Diablo's controller scheme: the closest living enemy within
// blade reach plus `extra`, preferring those ahead along `yaw`.
// visible(e): line of sight, checked only for the candidates that would win.
export function softTarget(p, enemies, yaw = p.yaw, visible = () => true, extra = 0) {
  const range = (combatStats(p) || SWORD).range;
  let best = null, bestScore = Infinity;
  for (const e of enemies) {
    if (e.mode === 'dead' || Math.abs(e.y - p.y) >= 0.7) continue;
    const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
    if (d > range + e.profile.radius + extra) continue;
    const ahead = d > 0.01 ? Math.cos(Math.atan2(dx, dz) - yaw) : 1;
    const score = d * (1.5 - 0.5 * ahead);   // straight behind counts as twice as far
    if (score < bestScore && visible(e)) { best = e; bestScore = score; }
  }
  return best;
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
