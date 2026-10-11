// Falling through the void into the cube below (a shortcut with a price: you come out a few
// units over the ground there and land hard).
import { CUBE_H } from '../core/constants.js';
import { step } from '../world/coords.js';
import { depthOf } from '../world/depth.js';
import { groundAt } from '../physics/collide.js';
import { player, state } from './state.js';
import { startTravel } from './travel.js';
import { arrivalPoint } from './flow.js';

// fell through the void: into the cube below, if there is one there (else: false)
export function startFall() {
  const below = step(state.cubeKey, 4);
  if (!state.cubes.layout(depthOf(below)).exists.has(below)) return false;
  startTravel({ kind: 'fall', dir: 4 });
  return true;
}

// a spot that does not lead on (a sealed pit, lava, acid): the nearest top floor that does
function safeSpot(m, x, z) {
  let best = null, bd = Infinity;
  for (const col of m.cols) {
    const f = col[col.length - 1];
    if (!f || f.fluid || f.prot || !m.safe[f.id]) continue;
    const d = Math.hypot(f.x + 0.5 - x, f.z + 0.5 - z);
    if (d < bd) { bd = d; best = f; }
  }
  return best;
}

// where a fall comes out: same spot, a few units over the ground (a hard landing is the price)
export function fallPoint(m) {
  let x = player.x, z = player.z, g = groundAt(x, z, 99, 0);
  if (!isFinite(g.h)) return { air: { x, y: 3, z }, rest: arrivalPoint(m.portals.find(q => q.kind !== 'spawn')) };
  const f = !g.s?.kind && g.s && !m.safe[g.s.id] && safeSpot(m, x, z);
  if (f) { x = f.x + 0.5; z = f.z + 0.5; g = groundAt(x, z, 99, 0); }
  return { air: { x, y: Math.min(g.h + 5, CUBE_H - 2), z }, rest: { x, y: g.h, z } };
}
