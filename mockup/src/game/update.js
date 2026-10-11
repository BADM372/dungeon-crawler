// One simulation step for the player.
import { N, SIT_IMPACT, RAGDOLL_IMPACT } from '../core/constants.js';
import { player, state } from './state.js';
import { inputDir, wantsRun, takeJump } from './input.js';
import { nextCube } from './flow.js';
import { knockDown, stepRagdoll } from './ragdoll.js';
import { movePlayer, updateLayer } from '../physics/move.js';
import { applyHazards } from '../physics/hazards.js';

export function updatePlayer(dt) {
  if (player.ragdoll) { stepRagdoll(dt); return; }
  let [dx, dz] = inputDir();
  const len = Math.hypot(dx, dz);
  if (len > 1) { dx /= len; dz /= len; }
  const gr = movePlayer(dt, dx, dz, wantsRun(), takeJump());
  updateLayer(gr);

  // hard landings: tumble over as a ragdoll (and get hurt), or land on your bottom
  if (gr.landed > RAGDOLL_IMPACT) {
    knockDown({ damage: Math.min(60, (gr.landed - RAGDOLL_IMPACT) * 6), reason: 'Hard landing!' });
    return;
  }
  if (gr.landed > SIT_IMPACT) player.stun = 1.5;

  if (!applyHazards(dt, gr)) return;
  if (gr.s === state.map.exit.floor && player.x > N - 0.7) nextCube();
}
