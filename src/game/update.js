// One simulation step for the player.
import { SIT_IMPACT, RAGDOLL_IMPACT } from '../core/constants.js';
import { player, state } from './state.js';
import { inputDir, wantsRun, takeJump, takeAttack } from './input.js';
import { updateSword, cancelSword } from './sword.js';
import { checkPortals } from './portals.js';
import { knockDown, stepRagdoll } from './ragdoll.js';
import { movePlayer, updateLayer } from '../physics/move.js';
import { applyHazards } from '../physics/hazards.js';
import { climb } from '../physics/climb.js';

export function updatePlayer(dt) {
  if (state.inventoryOpen || state.transitioning) return;
  const attack = takeAttack();
  if (player.ragdoll) { cancelSword(); stepRagdoll(dt); return; }
  updateSword(dt, attack);
  let [dx, dz] = inputDir();
  const len = Math.hypot(dx, dz);
  if (len > 1) { dx /= len; dz /= len; }
  const jump = takeJump();
  if (climb(dt, dx, dz, jump)) { cancelSword(); return; }   // on a ladder
  // Slash is a full-body planted swing; do not slide a walking pose through it.
  if (player.sword.active) dx = dz = 0;
  const gr = movePlayer(dt, dx, dz, wantsRun() && !player.sword.active, jump);
  updateLayer(gr);

  // Fluid contact takes priority over landing damage (even a high fall into water).
  if (!applyHazards(dt, gr)) return;

  // hard landings: tumble over as a ragdoll (and get hurt), or land on your bottom
  if (gr.landed > RAGDOLL_IMPACT) {
    knockDown({ damage: Math.min(60, (gr.landed - RAGDOLL_IMPACT) * 6), reason: 'Hard landing!' });
    return;
  }
  if (gr.landed > SIT_IMPACT) player.stun = 1.5;

  checkPortals(dx, dz);
}
