// Sword input/timing and geometry-gated damage. Jumping is never an attack.
import { player, state, setStatus } from './state.js';
import { startSwing, advanceSwing, cancelSwing, inSwordArc, swordHit } from '../core/combat.js';
import { clearLine } from '../physics/enemynav.js';

export function updateSword(dt, pressed) {
  if (state.transitioning) { cancelSwing(player); return; }
  advanceSwing(player, dt);
  if (pressed && startSwing(player)) setStatus('Sword slash');
}
export function hitWithSword(list) {
  const p = player;
  if (state.transitioning || p.ragdoll || p.stun > 0 || p.hp <= 0) return;
  for (const e of list) {
    if (!inSwordArc(p, e)) continue;
    const y = Math.max(e.y + 0.1, Math.min(p.y + 0.4, e.y + e.profile.bodyHeight - 0.05));
    if (!clearLine(p.x, p.y + 0.4, p.z, e.x, y, e.z)) continue;
    if (swordHit(p, e)) setStatus(e.hp ? `Slashed ${e.profile.label} (${e.hp}/${e.profile.hp})` : `Defeated ${e.profile.label}`);
  }
}
export const cancelSword = (resetCooldown = false) => cancelSwing(player, resetCooldown);
