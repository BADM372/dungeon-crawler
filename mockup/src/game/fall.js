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

// where a fall comes out: same spot, a few units over the ground (a hard landing is the price)
export function fallPoint(m) {
  const g = groundAt(player.x, player.z, 99, 0);
  if (!isFinite(g.h)) return { air: { x: player.x, y: 3, z: player.z }, rest: arrivalPoint(m.portals.find(q => q.kind !== 'spawn')) };
  return { air: { x: player.x, y: Math.min(g.h + 5, CUBE_H - 2), z: player.z }, rest: { x: player.x, y: g.h, z: player.z } };
}

