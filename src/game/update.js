// One simulation step for the player.
import { SIT_IMPACT, RAGDOLL_IMPACT, FALL_DAMAGE } from '../core/constants.js';
import { player, state } from './state.js';
import { sfx } from '../audio/sfx.js';
import { inputDir, wantsWalk, takeJump, autoAttackHeld, autoAttack } from './input.js';
import { updateSword, cancelSword } from './sword.js';
import { holdPointer, followOrder, clearOrder } from './orders.js';
import { canMoveCancel, cancelSwing, LUNGE_REACH } from '../core/combat.js';
import { checkPortals } from './portals.js';
import { knockDown, stepRagdoll, tickGetUp } from './ragdoll.js';
import { movePlayer, updateLayer } from '../physics/move.js';
import { applyHazards } from '../physics/hazards.js';
import { climb } from '../physics/climb.js';
import { landFall } from './fall.js';
import { tickCast, cancelCast } from './townportal.js';

// during the wind-up, step in towards an enemy that is just out of reach
// kids-docs: combat.html#chain (see kids-docs/README.md)
function lunge(s) {
  const e = s.target, stats = s.stats;
  if (!e?.profile || e.mode === 'dead' || s.t >= stats.activeStart) return [0, 0];
  const d = Math.hypot(e.x - player.x, e.z - player.z);
  return d > (stats.range + e.profile.radius) * 0.7 && d < stats.range + e.profile.radius + LUNGE_REACH
    ? [Math.sin(s.yaw), Math.cos(s.yaw)] : [0, 0];
}

// kids-docs: physics.html#landing (see kids-docs/README.md)
export function updatePlayer(dt) {
  if (state.inventoryOpen || state.transitioning) return;
  // a portal's charge only carries over while checkPortals sees us standing in it
  const charge = state.portalCharge;
  state.portalCharge = null;
  if (player.ragdoll) { cancelSword(); cancelCast('Portal interrupted'); clearOrder(); stepRagdoll(dt); return; }
  if (player.getUp) tickGetUp(dt);
  // keys win over mouse orders
  const keys = inputDir();
  if (keys[0] || keys[1]) clearOrder(); else holdPointer(dt);
  // held Shift: swing whenever an enemy is in reach, re-picking the target each time
  if (autoAttackHeld()) autoAttack();
  const order = followOrder(dt);   // may queue an attack on its target
  updateSword(dt);
  let [dx, dz] = order ? [order.dx, order.dz] : keys;
  const len = Math.hypot(dx, dz);
  if (len > 1) { dx /= len; dz /= len; }
  const jump = takeJump();
  tickCast(dt, len > 0 || jump);   // reading the town portal scroll: moving interrupts it
  if (climb(dt, dx, dz, jump)) { cancelSword(); clearOrder(); return; }   // on a ladder
  // Slash is a planted swing: no walking until the blade went through, then moving cuts it short
  const s = player.sword;
  if (s.active) {
    if ((dx || dz) && canMoveCancel(player)) cancelSwing(player);
    else [dx, dz] = lunge(s);
  }
  // always run (mouse orders too), unless Ctrl is held or a swing plants the feet
  const gr = movePlayer(dt, dx, dz, !wantsWalk() && !s.active, jump);
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
  if (gr.landed > SIT_IMPACT) { player.stun = 1.5; sfx('dizzy'); }

  checkPortals(dx, dz, dt, charge);
}
