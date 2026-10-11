// One simulation step for the player.
import { N } from '../core/constants.js';
import { player, state } from './state.js';
import { inputDir } from './input.js';
import { nextCube } from './flow.js';
import { movePlayer, updateLayer } from '../physics/move.js';
import { applyHazards } from '../physics/hazards.js';

export function updatePlayer(dt) {
  let [dx, dz] = inputDir();
  const len = Math.hypot(dx, dz);
  if (len > 1) { dx /= len; dz /= len; }
  const gr = movePlayer(dt, dx, dz);
  updateLayer(gr);
  if (!applyHazards(dt, gr)) return;
  if (gr.s === state.map.exit.floor && player.x > N - 0.7) nextCube();
}
