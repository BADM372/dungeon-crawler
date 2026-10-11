// Drives the character's animation from the controller state: an idle/walk/run blend tree
// synced to ground speed, cross-faded jump / fall / land / sit one-shots, the ragdoll, and a
// blend from the ragdoll pose back into animation when getting up.
import * as THREE from 'three';
import { WALK_SPEED, RUN_SPEED, WALK_ANIM, RUN_ANIM, SIT_IMPACT } from '../core/constants.js';
import { clamp } from '../core/util.js';
import { player } from '../game/state.js';
import { character } from './character.js';
import { applyRagdollPose } from './ragdollpose.js';
import { stretchStride } from './stride.js';

const W = { idle: 1, walk: 0, run: 0, jump: 0, fall: 0, land: 0, sit: 0 };
const RATE = { loco: 10, jump: 18, fall: 7, land: 20, sit: 14 };   // cross-fade speeds
let mode = 'loco', modeT = 0, phase = 0, yaw = 0, slow = 0, stretch = 1;
const seen = { jump: 0, land: 0, getUp: 0 };
let getUp = null;   // { t, quats, hipsWorld, hips }

const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const angleTo = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;

function nextMode(speed) {
  const p = player;
  if (p.jumpCount !== seen.jump) { seen.jump = p.jumpCount; mode = 'jump'; modeT = 0; }
  if (p.landCount !== seen.land) {
    seen.land = p.landCount;
    if (p.landImpact > SIT_IMPACT) { mode = 'sit'; modeT = 0; }
    else if (mode !== 'loco' || p.landImpact > 5) { mode = 'land'; modeT = 0; }
  }
  if (mode === 'loco' && !p.grounded && !p.swimming && p.airTime > 0.15) { mode = 'fall'; modeT = 0; }
  if (mode === 'jump' && p.vy < -0.5) { mode = 'fall'; modeT = 0; }
  if ((mode === 'fall' || mode === 'jump') && (p.grounded || p.swimming) && modeT > 0.05) { mode = 'land'; modeT = 0; }
  if (mode === 'land' && (modeT > 0.5 || (speed > 0.4 && modeT > 0.12))) mode = 'loco';
  if (mode === 'sit' && modeT > character.actions.sit.getClip().duration + 0.2 && p.stun <= 0) { mode = 'loco'; slow = 0.8; }
  if (p.swimming && mode !== 'jump') mode = 'loco';
}

function setWeightsAndTimes(dt, speed, time) {
  const A = character.actions, T = { idle: 0, walk: 0, run: 0, jump: 0, fall: 0, land: 0, sit: 0 };
  if (mode === 'loco') {
    // blend tree: idle -> walk -> run by speed with one shared phase; the cycle plays at the
    // pace of WALK_ANIM / RUN_ANIM and longer strides make up the rest of the distance
    const loco = smooth(0.05, 0.35, speed), t = clamp((speed - WALK_SPEED) / (RUN_SPEED - WALK_SPEED), 0, 1);
    T.idle = 1 - loco; T.walk = loco * (1 - t); T.run = loco * t;
    const move = WALK_SPEED + (RUN_SPEED - WALK_SPEED) * t, anim = WALK_ANIM + (RUN_ANIM - WALK_ANIM) * t;
    const stride = character.walkStride + (character.runStride - character.walkStride) * t;
    phase = (phase + dt * speed * (anim / move) / stride) % 1;
    stretch = move / anim;
  } else T[mode] = 1;
  slow -= dt;
  const k = Math.min(1, dt * (slow > 0 ? 2.5 : RATE[mode]));   // standing up from sitting is slow
  for (const n in W) { W[n] += (T[n] - W[n]) * k; A[n].setEffectiveWeight(W[n]); }
  const dur = n => A[n].getClip().duration;
  A.walk.time = phase * dur('walk');
  A.run.time = phase * dur('run');
  if (mode === 'jump') A.jump.time = Math.min(modeT * 1.4, dur('jump'));
  A.fall.time = dur('fall') * (0.5 + 0.5 * Math.sin(time * 3));
  if (mode === 'land') A.land.time = Math.min(modeT, dur('land'));
  if (mode === 'sit') A.sit.time = Math.min(modeT, dur('sit'));
}

// remember the ragdoll pose so we can blend from it into the animation
function startGetUp() {
  const b = character.bones;
  getUp = { t: 0, list: Object.values(b), hipsWorld: b.hips.getWorldPosition(new THREE.Vector3()) };
  getUp.quats = getUp.list.map(x => x.quaternion.clone());
}

function blendFromGetUp(dt) {
  const hips = character.bones.hips;
  if (!getUp.hips) getUp.hips = hips.parent.worldToLocal(getUp.hipsWorld.clone());
  getUp.t += dt / 0.9;
  const e = smooth(0, 1, getUp.t);
  getUp.list.forEach((b, i) => b.quaternion.slerpQuaternions(getUp.quats[i], b.quaternion.clone(), e));
  hips.position.lerpVectors(getUp.hips, hips.position.clone(), e);
  if (getUp.t >= 1) getUp = null;
}

export function animateCharacter(dt, time) {
  const ch = character, p = player;
  if (!ch.ready) return;
  if (p.ragdoll) { applyRagdollPose(p.ragdoll.p); return; }
  if (p.getUpCount !== seen.getUp) { seen.getUp = p.getUpCount; startGetUp(); mode = 'loco'; }

  const speed = Math.hypot(p.vx, p.vz);
  if (speed > 0.2 && p.stun <= 0) yaw = angleTo(yaw, Math.atan2(p.vx, p.vz), Math.min(1, dt * 12));
  ch.group.position.set(p.x, p.visY, p.z);
  ch.group.rotation.y = yaw;
  ch.group.updateMatrixWorld(true);

  modeT += dt;
  nextMode(speed);
  setWeightsAndTimes(dt, speed, time);
  ch.mixer.update(0);
  stretchStride(stretch, W.walk + W.run);
  // breathing on top of the idle pose
  ch.bones.spine.rotateX(Math.sin(time * 2.2) * 0.025 * W.idle);
  if (getUp) blendFromGetUp(dt);
}

export const characterYaw = () => yaw;
