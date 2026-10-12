// One simulation step for the player.
import { SIT_IMPACT, RAGDOLL_IMPACT, FALL_DAMAGE } from '../core/constants.js';
import { player, state } from './state.js';
import { inputDir, wantsRun, takeJump } from './input.js';
import { updateSword, cancelSword } from './sword.js';
import { holdPointer, followOrder, clearOrder } from './orders.js';
import { canMoveCancel, cancelSwing } from '../core/combat.js';
import { checkPortals } from './portals.js';
import { knockDown, stepRagdoll } from './ragdoll.js';
import { movePlayer, updateLayer } from '../physics/move.js';
import { applyHazards } from '../physics/hazards.js';
import { climb } from '../physics/climb.js';
import { landFall } from './fall.js';

// during the wind-up, step in towards an enemy that is just out of reach
function lunge(s) {
  const e = s.target, stats = s.stats;
  if (!e?.profile || e.mode === 'dead' || s.t >= stats.activeStart) return [0, 0];
  const d = Math.hypot(e.x - player.x, e.z - player.z);
  return d > (stats.range + e.profile.radius) * 0.7 && d < stats.range + e.profile.radius + 0.6
    ? [Math.sin(s.yaw), Math.cos(s.yaw)] : [0, 0];
}

export function updatePlayer(dt) {
  if (state.inventoryOpen || state.transitioning) return;
  // a ring's charge only carries over while checkPortals sees us standing in it
  const charge = state.portalCharge;
  state.portalCharge = null;
  if (player.ragdoll) { cancelSword(); clearOrder(); stepRagdoll(dt); return; }
  // keys win over mouse orders
  const keys = inputDir();
  if (keys[0] || keys[1]) clearOrder(); else holdPointer(dt);
  const order = followOrder(dt);   // may queue an attack on its target
  updateSword(dt);
  let [dx, dz] = order ? [order.dx, order.dz] : keys;
  const len = Math.hypot(dx, dz);
  if (len > 1) { dx /= len; dz /= len; }
  const jump = takeJump();
  if (climb(dt, dx, dz, jump)) { cancelSword(); clearOrder(); return; }   // on a ladder
  // Slash is a planted swing: no walking until the blade went through, then moving cuts it short
  const s = player.sword;
  if (s.active) {
    if ((dx || dz) && canMoveCancel(player)) cancelSwing(player);
    else [dx, dz] = lunge(s);
  }
  const gr = movePlayer(dt, dx, dz, (order ? order.run : wantsRun()) && !s.active, jump);
  updateLayer(gr);

  // Fluid contact takes priority over landing damage (even a high fall into water).
  if (!applyHazards(dt, gr)) return;
  // a fall through cubes ends on the first landing, however soft
  if (state.fallFrom && player.grounded) { landFall(); return; }

  // hard landings: tumble over as a ragdoll (and get hurt), or land on your bottom
  if (gr.landed > RAGDOLL_IMPACT) {
    knockDown({ damage: Math.min(FALL_DAMAGE, (gr.landed - RAGDOLL_IMPACT) * 6), reason: 'Hard landing!' });
    return;
  }
  if (gr.landed > SIT_IMPACT) player.stun = 1.5;

  checkPortals(dx, dz, dt, charge);
}
