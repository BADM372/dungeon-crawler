// Drives the character from the controller state: places and turns the model, runs the
// blend trees (render/blendtree.js), poses the ragdoll, and blends from the ragdoll pose back
// into animation when getting up.
import * as THREE from 'three';
import { clamp } from '../core/util.js';
import { DIRS } from '../core/constants.js';
import { player } from '../game/state.js';
import { SWORD, swingClipTime } from '../core/combat.js';
import { character } from './character.js';
import { applyRagdollPose } from './ragdollpose.js';
import { stretchStride } from './stride.js';
import { W, blend, updateBlend, resetMode } from './blendtree.js';

let seenGetUp = 0;
let getUp = null;   // { t, list, quats, hipsWorld, hips }

const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const angleTo = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;

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
  if (p.getUpCount !== seenGetUp) { seenGetUp = p.getUpCount; startGetUp(); resetMode(); }

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
  for (const n in W) ch.actions[n].setEffectiveWeight(W[n] * (1 - ch.swordWeight));
  slash.time = swingClipTime(p.sword.stats, p.sword.t); slash.setEffectiveWeight(ch.swordWeight);
  if (ch.sword) ch.sword.visible = !p.swimming && !p.climb;
  ch.mixer.update(0);
  stretchStride(blend.stretch, (W.walk + W.run) * (1 - ch.swordWeight));
  // breathing on top of the idle pose
  ch.bones.spine.rotateX(Math.sin(time * 2.2) * 0.025 * W.idle * (1 - ch.swordWeight));
  if (getUp) blendFromGetUp(dt);
}

export const characterYaw = () => player.yaw;
