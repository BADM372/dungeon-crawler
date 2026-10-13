// Drives the character from the controller state: places and turns the model, runs the
// blend trees (render/blendtree.js), poses the ragdoll, and plays the get-up clip
// (GetUpBack / GetUpFront), morphing from the ragdoll pose into it.
import * as THREE from 'three';
import { clamp } from '../core/util.js';
import { DIRS } from '../core/constants.js';
import { player } from '../game/state.js';
import { SWORD, swingClipTime } from '../core/combat.js';
import { character } from './character.js';
import { applyRagdollPose } from './ragdollpose.js';
import { stretchStride } from './stride.js';
import { W, blend, updateBlend, resetMode } from './blendtree.js';

// learn: animation.html#getup (see learn/README.md)
const MORPH = 0.3;       // s from the ragdoll pose into the get-up clip
const GET_UP_OUT = 10;   // fade-out rate of a get-up cut short by walking
let clean = null;        // [bone, quaternion, position]: the pose the mixer produced last
let getUp = null;        // the player.getUp being played
let upAction = null;     // ... and its clip (kept while it fades out)
let morph = null;        // { t, list, quats, hips }: the ragdoll pose (world space)

const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const angleTo = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
const _q = new THREE.Quaternion(), _w = new THREE.Quaternion(), _v = new THREE.Vector3();

// three's mixer only writes a bone when its blended value changed since the last update, so
// whatever is posed on top (breathing, strides, the ragdoll, the morph) would otherwise stick:
// put the mixer's last pose back before every update and remember the new one after it
function restorePose() { for (const [b, q, p] of clean) { b.quaternion.copy(q); b.position.copy(p); } }
function keepPose() { for (const [b, q, p] of clean) { q.copy(b.quaternion); p.copy(b.position); } }

// remember the ragdoll pose in world space; the model is turned and moved under it
// learn: animation.html#getup (see learn/README.md)
function startMorph() {
  const list = Object.values(character.bones);   // parents first
  character.group.updateMatrixWorld(true);
  morph = { t: 0, list, quats: list.map(b => b.getWorldQuaternion(new THREE.Quaternion())),
    hips: character.bones.hips.getWorldPosition(new THREE.Vector3()) };
}

// blend from the remembered ragdoll pose into the animated one, bone by bone in world space
// learn: animation.html#getup (see learn/README.md)
function applyMorph(dt) {
  morph.t += dt;
  const k = 1 - smooth(0, MORPH, morph.t), hips = character.bones.hips;
  hips.position.copy(hips.parent.worldToLocal(hips.getWorldPosition(_v).lerp(morph.hips, k)));
  morph.list.forEach((b, i) => {
    b.parent.getWorldQuaternion(_q);   // already morphed
    _w.copy(_q).multiply(b.quaternion).slerp(morph.quats[i], k);
    b.quaternion.copy(_q.invert().multiply(_w));
  });
  if (k <= 0) morph = null;
}

export function animateCharacter(dt, time) {
  const ch = character, p = player;
  if (!ch.ready) return;
  clean ??= Object.values(ch.bones).map(b => [b, b.quaternion.clone(), b.position.clone()]);
  if (p.ragdoll) { applyRagdollPose(p.ragdoll.p); getUp = upAction = morph = null; ch.getUpWeight = 0; return; }
  if (p.getUp !== getUp) {
    getUp = p.getUp;
    if (getUp) {
      startMorph(); resetMode();
      if (upAction) upAction.setEffectiveWeight(0);
      upAction = ch.getUps[getUp.side].action; ch.getUpWeight = 1;
    }
  }
  restorePose();

  // Ladder motion is driven separately by signed vertical speed in the blend tree.
  const speed = Math.hypot(p.vx, p.vz);
  let yaw = p.yaw;
  if (p.sword.active) yaw = angleTo(yaw, p.sword.yaw, Math.min(1, dt * 30));   // snap round into the swing
  else if (p.climb) { const [dx, dz] = DIRS[p.climb.l.d]; yaw = angleTo(yaw, Math.atan2(dx, dz), Math.min(1, dt * 12)); }
  else if (speed > 0.2 && p.stun <= 0) yaw = angleTo(yaw, Math.atan2(p.vx, p.vz), Math.min(1, dt * (p.swimming ? 5 : 12)));
  p.yaw = yaw;
  ch.group.position.set(p.x, p.visY, p.z);
  ch.group.rotation.y = yaw;
  ch.group.updateMatrixWorld(true);

  updateBlend(dt, speed, time);
  const slash = ch.actions.slash, duration = (p.sword.stats || SWORD).duration;
  const target = p.sword.active ? Math.min(1, p.sword.t / 0.04, (duration - p.sword.t) / 0.12) : 0;
  ch.swordWeight += (Math.max(0, target) - ch.swordWeight) * Math.min(1, dt * 22);
  if (!getUp) ch.getUpWeight = Math.max(0, ch.getUpWeight - dt * GET_UP_OUT);
  const sw = ch.swordWeight, gw = upAction ? ch.getUpWeight : 0, rest = (1 - sw) * (1 - gw);
  for (const n in W) ch.actions[n].setEffectiveWeight(W[n] * rest);
  if (upAction) {
    if (getUp) upAction.time = clamp(getUp.t / getUp.duration, 0, 1) * upAction.getClip().duration;
    upAction.setEffectiveWeight(gw * (1 - sw));
    if (gw <= 0) upAction = null;
  }
  slash.time = swingClipTime(p.sword.stats, p.sword.t); slash.setEffectiveWeight(sw);
  if (ch.sword) ch.sword.visible = !p.swimming && !p.climb;
  ch.mixer.update(0);
  keepPose();
  stretchStride(blend.stretch, (W.walk + W.run) * rest);
  // breathing on top of the idle pose
  ch.bones.spine.rotateX(Math.sin(time * 2.2) * 0.025 * W.idle * rest);
  if (morph) applyMorph(dt);
}

export const characterYaw = () => player.yaw;
