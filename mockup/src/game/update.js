// One simulation step for the player.
import { SIT_IMPACT, RAGDOLL_IMPACT } from '../core/constants.js';
import { player, state } from './state.js';
import { inputDir, wantsRun, takeJump } from './input.js';
import { checkPortals } from './portals.js';
import { knockDown, stepRagdoll } from './ragdoll.js';
import { movePlayer, updateLayer } from '../physics/move.js';
import { applyHazards } from '../physics/hazards.js';
import { climb } from '../physics/climb.js';

export function updatePlayer(dt) {
  if (player.ragdoll) { stepRagdoll(dt); return; }
  let [dx, dz] = inputDir();
  const len = Math.hypot(dx, dz);
  if (len > 1) { dx /= len; dz /= len; }
  const jump = takeJump();
  if (climb(dt, dx, dz, jump)) return;   // on a ladder
  const gr = movePlayer(dt, dx, dz, wantsRun(), jump);
  updateLayer(gr);

  // hard landings: tumble over as a ragdoll (and get hurt), or land on your bottom
  if (gr.landed > RAGDOLL_IMPACT) {
    knockDown({ damage: Math.min(60, (gr.landed - RAGDOLL_IMPACT) * 6), reason: 'Hard landing!' });
    return;
  }
  if (gr.landed > SIT_IMPACT) player.stun = 1.5;

  if (!applyHazards(dt, gr)) return;
  checkPortals();
}
