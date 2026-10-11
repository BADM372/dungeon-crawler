// Portal travel without a cut: the next cube is built beside (or below / above) this one, and
// both slide past the camera while the character walks, falls or floats through. The new cube
// is the active one from the start; the player moves in its coordinates plus the slide offset,
// so when the slide ends everything is exactly where it belongs.
import * as THREE from 'three';
import { N, CUBE_H, BASE } from '../core/constants.js';
import { step, D6, OPP6 } from '../world/coords.js';
import { buildWorld } from '../render/world.js';
import { detachNeighbors, buildNeighbors } from '../render/neighbors.js';
import { setFade } from '../render/fade.js';
import { setCut } from '../render/section.js';
import { player, state, setStatus } from './state.js';
import { whenReady } from './hud.js';
import { resetSpiders, detachSpiders, drawSpiders, spiders } from './spiders.js';
import { arrivalPoint, portalSeen, spawnAt, settleIn, visitedNeighbors } from './flow.js';
import { slideVisuals, endVisuals } from './travelfx.js';

const GAP = CUBE_H + BASE;   // vertical distance between strata while sliding
let tr = null;
const off = new THREE.Vector3(), oldOff = new THREE.Vector3();
const ease = t => t * t * (3 - 2 * t);

export const travelling = () => !!tr;

// the cube behind the portal may still be generating: wait for it (frozen in the portal)
export function startTravel(p) {
  if (state.transitioning) return;
  state.transitioning = true;
  const k = step(state.cubeKey, p.dir);
  whenReady(state.cubes.get(k)).then(c => slide(p, c), () => { state.transitioning = false; setStatus('The portal does not open'); });
}

function slide(p, c) {
  const k = c.key, m = c.map, oldKey = state.cubeKey;
  const oldWorld = state.world;
  state.map = m;   // from here on the new cube is the active one (arrivalPoint reads it)
  const arr = m.portals.find(q => q.dir === OPP6[p.dir]), A = arrivalPoint(arr);
  const D = new THREE.Vector3(D6[p.dir][0] * N, D6[p.dir][1] * GAP, D6[p.dir][2] * N);
  tr = { t: 0, D, kind: p.kind, k, oldKey, old: { world: oldWorld, spiders: detachSpiders(), ghosts: detachNeighbors() },
    S: new THREE.Vector3(player.x, player.y, player.z).sub(D), A: new THREE.Vector3(A.x, A.y, A.z), last: null };
  tr.T = p.kind === 'side' ? THREE.MathUtils.clamp(tr.S.distanceTo(tr.A) / 2.2, 0.9, 1.4) : 1.3;
  setCut(Infinity, null, 0, 0, 0);
  c.visits++;
  state.cubeKey = k; state.arrival = A; state.portalLock = arr.id;
  state.world = buildWorld(m, state.showPath, portalSeen(k, m), c.geo);
  state.world.group.position.copy(D);
  setFade(state.world.group, 0);
  tr.ghosts = buildNeighbors(visitedNeighbors(k));   // includes the cube we are leaving
  for (const g of tr.old.ghosts) g.fade0 = g.group.userData.fade;
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
  slideVisuals(tr, t, off, oldOff);
  if (t >= 1) finish();
}

export function drawTravelSpiders(dt) {
  drawSpiders(dt, tr ? off : undefined);
  if (tr) for (const s of spiders) if (s.view) s.view.group.visible = tr.fadeNew > 0.5;
}

function finish() {
  endVisuals(tr);
  const landed = tr.kind === 'down', hp = player.hp;
  tr = null;
  spawnAt(state.arrival.x, state.arrival.y, state.arrival.z);
  player.hp = hp;
  if (landed) { player.landImpact = 4; player.landCount++; }
  settleIn(false);
  state.transitioning = false;
}
