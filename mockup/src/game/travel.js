// Portal travel without a cut: the next cube is built beside (or below / above) this one, and
// both slide past the camera while the character walks, falls or floats through. The new cube
// is the active one from the start; the player moves in its coordinates plus the slide offset,
// so when the slide ends everything is exactly where it belongs.
import * as THREE from 'three';
import { N, CUBE_H, BASE } from '../core/constants.js';
import { step, D6, OPP6 } from '../world/coords.js';
import { buildWorld, disposeWorld } from '../render/world.js';
import { removeSpiderViews, animateSpiders } from '../render/spiders.js';
import { clearNeighbors } from '../render/neighbors.js';
import { setCut } from '../render/section.js';
import { player, state } from './state.js';
import { resetSpiders, detachSpiders, drawSpiders } from './spiders.js';
import { arrivalPoint, portalSeen, spawnAt, settleIn } from './flow.js';

const GAP = CUBE_H + BASE;   // vertical distance between strata while sliding
let tr = null;
const off = new THREE.Vector3(), oldOff = new THREE.Vector3();
const ease = t => t * t * (3 - 2 * t);

export const travelling = () => !!tr;

export function startTravel(p) {
  if (state.transitioning) return;
  const k = step(state.cubeKey, p.dir), c = state.cubes.cube(k), m = c.map;
  const oldWorld = state.world;
  state.map = m;   // from here on the new cube is the active one (arrivalPoint reads it)
  const arr = m.portals.find(q => q.dir === OPP6[p.dir]), A = arrivalPoint(arr);
  const D = new THREE.Vector3(D6[p.dir][0] * N, D6[p.dir][1] * GAP, D6[p.dir][2] * N);
  tr = { t: 0, D, kind: p.kind, old: { world: oldWorld, spiders: detachSpiders() },
    S: new THREE.Vector3(player.x, player.y, player.z).sub(D), A: new THREE.Vector3(A.x, A.y, A.z), last: null };
  tr.T = p.kind === 'side' ? THREE.MathUtils.clamp(tr.S.distanceTo(tr.A) / 2.2, 0.9, 1.4) : 1.3;
  state.transitioning = true;
  clearNeighbors();
  setCut(Infinity, null, 0, 0, 0);
  c.visits++;
  state.cubeKey = k; state.arrival = A; state.portalLock = arr.id;
  state.world = buildWorld(m, state.showPath, portalSeen(k, m));
  state.world.group.position.copy(D);
  resetSpiders();
}

export function updateTravel(dt) {
  tr.t = Math.min(1, tr.t + dt / tr.T);
  const t = tr.t, e = ease(t), p = player;
  off.copy(tr.D).multiplyScalar(1 - e); oldOff.copy(off).sub(tr.D);
  // the path in the new cube's coordinates: walk straight through, fall, or rise
  const u = tr.kind === 'side' ? t : tr.kind === 'down' ? t * t : 1 - (1 - t) ** 2;
  const x = tr.S.x + (tr.A.x - tr.S.x) * t, z = tr.S.z + (tr.A.z - tr.S.z) * t, y = tr.S.y + (tr.A.y - tr.S.y) * u;
  if (tr.last) { p.vx = (x - tr.last.x) / dt; p.vz = (z - tr.last.z) / dt; p.vy = (y - tr.last.y) / dt; }
  tr.last = { x, y, z };
  Object.assign(p, { x: x + off.x, y: y + off.y, visY: y + off.y, z: z + off.z, grounded: tr.kind === 'side', swimming: false });
  p.airTime = p.grounded ? 0 : p.airTime + dt;
  state.world.group.position.copy(off);
  tr.old.world.group.position.copy(oldOff);
  animateSpiders(tr.old.spiders, 0, oldOff);
  if (t >= 1) finish();
}

export const drawTravelSpiders = dt => drawSpiders(dt, tr ? off : undefined);

function finish() {
  disposeWorld(tr.old.world);
  removeSpiderViews(tr.old.spiders);
  state.world.group.position.set(0, 0, 0);
  const landed = tr.kind === 'down', hp = player.hp;
  tr = null;
  spawnAt(state.arrival.x, state.arrival.y, state.arrival.z);
  player.hp = hp;
  if (landed) { player.landImpact = 4; player.landCount++; }
  settleIn();
  state.transitioning = false;
}
