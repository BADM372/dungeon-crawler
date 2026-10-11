// Portal travel without a cut: the next cube is built beside (or below / above) this one, and
// both slide past the camera while the character walks, falls or floats through. The new cube
// is the active one from the start; the player moves in its coordinates plus the slide offset,
// so when the slide ends everything is exactly where it belongs.
import * as THREE from 'three';
import { N, CUBE_H, BASE, STEP, SWIM_STEP, SNAP } from '../core/constants.js';
import { isFaceOpen, openedSides, boundaryArrival } from '../core/boundaries.js';
import { step, D6, OPP6, faceKey } from '../world/coords.js';
import { buildWorld, setWorldOpenFaces } from '../render/world.js';
import { setGlassFaces } from '../render/glass.js';
import { blockedAt, groundAt } from '../physics/collide.js';
import { detachNeighbors, buildNeighbors } from '../render/neighbors.js';
import { setFade } from '../render/fade.js';
import { setCut } from '../render/section.js';
import { player, state, setStatus } from './state.js';
import { whenReady } from './hud.js';
import { resetEnemies, detachEnemies, drawEnemies, allEnemies } from './enemies.js';
import { cancelSword } from './sword.js';
import { arrivalPoint, portalSeen, spawnAt, settleIn, visitedNeighbors } from './flow.js';
import { slideVisuals, endVisuals } from './travelfx.js';
import { fallPoint } from './fall.js';

const GAP = CUBE_H + BASE;   // vertical distance between strata while sliding
let tr = null;
const off = new THREE.Vector3(), oldOff = new THREE.Vector3();
const ease = t => t * t * (3 - 2 * t);

export const travelling = () => !!tr;

// the cube behind the portal may still be generating: wait for it (frozen in the portal)
export function startTravel(p) {
  if (state.transitioning || state.inventoryOpen) return;
  state.transitioning = true;
  cancelSword();
  const source = state.cubeKey, cubes = state.cubes, k = step(source, p.dir);
  whenReady(cubes.get(k)).then(c => {
    if (state.cubes === cubes && state.cubeKey === source) slide(p, c);
  }, () => {
    if (state.cubes !== cubes || state.cubeKey !== source) return;
    state.transitioning = false; setStatus('The portal does not open');
  });
}

function slide(p, c) {
  const k = c.key, m = c.map, oldKey = state.cubeKey;
  const oldWorld = state.world, oldMap = state.map;
  const crossing = p.kind === 'side' && isFaceOpen(state.openedFaces, oldKey, p.dir);
  // Only open-boundary travel preserves motion. Ordinary portal and fall travel is unchanged.
  const motion = crossing ? Object.fromEntries(['vx', 'vy', 'vz', 'grounded', 'swimming', 'fluid', 'airTime', 'coyote', 'jumpBuf', 'stun', 'layer'].map(key => [key, player[key]])) : null;
  state.map = m;   // arrivalPoint and collision queries read the destination map
  const arr = m.portals.find(q => q.dir === OPP6[p.dir]), fall = p.kind === 'fall' && fallPoint(m);
  const A = crossing ? boundaryArrival(player, p.dir) : fall ? fall.air : arrivalPoint(arr);
  // No route/safety adjustment: just respect solid terrain at the destination, as walking
  // would. A body-sized footprint also prevents sliding into a pillar or cliff beside it.
  if (crossing && [[0, 0], [player.r, 0], [-player.r, 0], [0, player.r], [0, -player.r]].some(([dx, dz]) =>
    blockedAt(A.x + dx, A.z + dz, A.y, player.swimming ? SWIM_STEP : STEP))) {
    state.map = oldMap; state.transitioning = false;
    setStatus('The way across is blocked');
    return;
  }
  if (p.kind === 'side') {
    state.openedFaces.add(faceKey(oldKey, p.dir));
    setWorldOpenFaces(oldWorld, openedSides(state.openedFaces, oldKey));
  }
  const D = new THREE.Vector3(D6[p.dir][0] * N, D6[p.dir][1] * GAP, D6[p.dir][2] * N);
  tr = { t: 0, D, kind: p.kind, k, oldKey, old: { world: oldWorld, enemies: detachEnemies(), ghosts: detachNeighbors() },
    S: new THREE.Vector3(player.x, player.y, player.z).sub(D), A: new THREE.Vector3(A.x, A.y, A.z), last: null, motion };
  tr.T = p.kind === 'side' ? THREE.MathUtils.clamp(tr.S.distanceTo(tr.A) / 2.2, 0.9, 1.4) : 1.3;
  setCut(Infinity, null, 0, 0, 0);
  c.visits++;
  state.cubeKey = k; state.arrival = fall ? fall.rest : A;
  state.portalLock = fall || p.kind === 'side' ? 0 : arr.id;
  state.boundaryLock = p.kind === 'side' ? OPP6[p.dir] : -1;
  tr.A0 = A;
  state.world = buildWorld(m, state.showPath, portalSeen(k, m), c.geo, openedSides(state.openedFaces, k));
  state.world.group.position.copy(D);
  setFade(state.world.group, 0);
  tr.ghosts = buildNeighbors(visitedNeighbors(k), tr.old.ghosts);   // common cubes stay visible
  // Reused proxies now use destination-local coordinates, but start beside the old cube.
  for (const g of tr.ghosts) g.group.position.copy(g.base).add(D);
  for (const g of tr.old.ghosts) {
    g.fade0 = g.group.userData.fade;
    setGlassFaces(g.glass, openedSides(state.openedFaces, g.key));
  }
  resetEnemies();
}


export function updateTravel(dt) {
  tr.t = Math.min(1, tr.t + dt / tr.T);
  const t = tr.t, e = ease(t), p = player;
  off.copy(tr.D).multiplyScalar(1 - e); oldOff.copy(off).sub(tr.D);
  // the path in the new cube's coordinates: walk straight through, fall, or rise
  const u = tr.kind === 'side' ? t : tr.kind === 'up' ? 1 - (1 - t) ** 2 : t * t;
  const x = tr.S.x + (tr.A.x - tr.S.x) * t, z = tr.S.z + (tr.A.z - tr.S.z) * t, y = tr.S.y + (tr.A.y - tr.S.y) * u;
  if (tr.last) { p.vx = (x - tr.last.x) / dt; p.vz = (z - tr.last.z) / dt; p.vy = (y - tr.last.y) / dt; }
  tr.last = { x, y, z };
  Object.assign(p, { x: x + off.x, y: y + off.y, visY: y + off.y, z: z + off.z,
    grounded: tr.motion ? tr.motion.grounded : tr.kind === 'side', swimming: tr.motion?.swimming ?? false });
  p.airTime = p.grounded ? 0 : p.airTime + dt;
  slideVisuals(tr, t, off, oldOff);
  if (t >= 1) finish();
}

export function drawTravelEnemies(dt) {
  drawEnemies(dt, tr ? off : undefined);
  if (tr) for (const e of allEnemies()) if (e.view) e.view.group.visible = tr.fadeNew > 0.5 && e.view.group.visible;
}

function finish() {
  endVisuals(tr);
  const landed = tr.kind === 'down', falling = tr.kind === 'fall', hp = player.hp, A = tr.A0, motion = tr.motion;
  tr = null;
  spawnAt(A.x, A.y, A.z);
  player.hp = hp;
  if (motion) {
    const gr = groundAt(A.x, A.z, A.y, motion.swimming ? SWIM_STEP : STEP);
    Object.assign(player, motion);
    player.support = gr.s;
    player.grounded = motion.grounded && Math.abs(gr.h - A.y) <= SNAP;
    if (player.grounded && gr.s) player.layer = gr.s.kind ? gr.s.run.layer : gr.s.layer;
  }
  if (falling) { player.safe = { ...state.arrival }; Object.assign(player, { grounded: false, vy: -6, support: null }); }
  if (landed) { player.landImpact = 4; player.landCount++; }
  settleIn();   // reconcile toggles made during travel; unchanged proxies are reused
  state.transitioning = false;
}
