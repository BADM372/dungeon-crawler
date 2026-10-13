// Sword input/timing and geometry-gated damage. Jumping is never an attack.
// Attacks are queued with a target (an enemy, a point, or null for straight ahead) and stay
// queued for a moment, so a click during a swing chains into the next one.
import { player, state, setStatus } from './state.js';
import { startSwing, advanceSwing, cancelSwing, inSwordArc, swordHit, combatStats } from '../core/combat.js';
import { clearLine } from '../physics/enemynav.js';
import { enemyHitFx, swingFx } from './juice.js';

const BUFFER = 0.3;   // s a queued attack waits for the current swing to allow the next
// the critical-hit roll of each blade hit, in 0..1 (browser checks pin it to keep numbers exact)
export const rolls = { crit: () => Math.random() };

export function queueAttack(target = null) {
  const s = player.sword;
  s.requested = true; s.buffer = BUFFER; s.target = target;
}

function aimYaw(target) {
  if (!target) return player.yaw;
  const dx = target.x - player.x, dz = target.z - player.z;
  return Math.hypot(dx, dz) > 0.05 ? Math.atan2(dx, dz) : player.yaw;
}

// learn: architecture.html#swing-journey (see learn/README.md)
export function updateSword(dt) {
  if (state.inventoryOpen) return;
  if (state.transitioning) { cancelSwing(player); return; }
  advanceSwing(player, dt);
  const s = player.sword;
  if (!s.requested) return;
  if ((s.buffer -= dt) < 0) { s.requested = false; return; }
  const target = s.target;
  if (!combatStats(player)) { s.requested = false; setStatus('No weapon equipped'); return; }
  if (!startSwing(player, aimYaw(target))) return;
  s.requested = false; s.target = target;
  setStatus('Sword slash');
  swingFx();
}

// learn: architecture.html#swing-journey, space.html#unit (see learn/README.md)
export function hitWithSword(list) {
  const p = player;
  if (state.inventoryOpen || state.transitioning || p.ragdoll || p.stun > 0 || p.hp <= 0) return;
  for (const e of list) {
    if (!inSwordArc(p, e)) continue;
    const y = Math.max(e.y + 0.1, Math.min(p.y + 0.4, e.y + e.profile.bodyHeight - 0.05));
    if (!clearLine(p.x, p.y + 0.4, p.z, e.x, y, e.z)) continue;
    const before = e.hp, hit = swordHit(p, e, rolls.crit());
    if (!hit) continue;
    state.enemyGrace = 0;   // you started it
    // knocked back along the blow, heavier bodies less (knockback affixes push harder); a
    // poised enemy that shrugs the blow off barely moves
    const dx = e.x - p.x, dz = e.z - p.z, l = Math.hypot(dx, dz) || 1;
    const push = (e.hp ? e.staggered ? 2.6 : 0.6 : 3.6) * (p.sword.stats?.knockback ?? 1) / e.profile.mass;
    e.kbx = dx / l * push; e.kbz = dz / l * push;
    enemyHitFx(e, before - e.hp, !e.hp, dx, dz, hit.crit);
    if (e.hp) setStatus(`Slashed Lv ${e.level} ${e.profile.label} (${e.hp}/${e.profile.hp})`);
  }
}
export const cancelSword = (resetCooldown = false) => cancelSwing(player, resetCooldown);
