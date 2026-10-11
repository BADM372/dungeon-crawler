// Maps between the character skeleton and the ragdoll particles.
import * as THREE from 'three';
import { character } from './character.js';

// [bone, length (rig units) or 0 for the bone head] -> particle, in ragdoll order
const POINTS = [
  ['hips', 0], ['spine', 0], ['head', 0], ['head', 0.5],
  ['upper_arm.L', 0], ['forearm.L', 0], ['hand.L', 0],
  ['upper_arm.R', 0], ['forearm.R', 0], ['hand.R', 0],
  ['thigh.L', 0], ['shin.L', 0], ['shin.L', 0.37],
  ['thigh.R', 0], ['shin.R', 0], ['shin.R', 0.37],
];
// bones driven by the ragdoll: [bone, head particle, tail particle, side pair for twist]
// listed parents first
const DRIVE = [
  ['hips', 0, 1, [10, 13]], ['spine', 1, 2, [4, 7]], ['head', 2, 3],
  ['upper_arm.L', 4, 5], ['forearm.L', 5, 6], ['upper_arm.R', 7, 8], ['forearm.R', 8, 9],
  ['thigh.L', 10, 11], ['shin.L', 11, 12], ['thigh.R', 13, 14], ['shin.R', 14, 15],
];

const v = (a, b) => new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
// rotation that takes basis (dir, side) to world, with dir as +Y
function basis(d, s) {
  const x = s.clone().addScaledVector(d, -s.dot(d)).normalize();
  const z = new THREE.Vector3().crossVectors(x, d);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, d, z));
}
let rest = null;

// joint positions of the current pose (world space); remembers the pose for driving bones later
export function beginRagdoll(x, y, z) {
  const { bones, group } = character;
  group.position.set(x, y, z);   // the model may lag a frame behind the controller
  group.updateMatrixWorld(true);
  const pts = POINTS.map(([b, len]) => bones[b].localToWorld(new THREE.Vector3(0, len, 0)).toArray());
  rest = DRIVE.map(([b, h, t, side]) => {
    const q = bones[b].getWorldQuaternion(new THREE.Quaternion());
    const d = v(pts[h], pts[t]);
    return { q, d, frame: side && basis(d, v(pts[side[0]], pts[side[1]])) };
  });
  return pts;
}

// pose the skeleton from particle positions
export function applyRagdollPose(p) {
  const { bones } = character;
  const hips = bones.hips;
  hips.position.copy(hips.parent.worldToLocal(new THREE.Vector3(...p[0])));
  const pq = new THREE.Quaternion(), q = new THREE.Quaternion();
  DRIVE.forEach(([b, h, t, side], i) => {
    const r = rest[i], d = v(p[h], p[t]);
    if (side) q.copy(basis(d, v(p[side[0]], p[side[1]]))).multiply(r.frame.clone().invert());
    else q.setFromUnitVectors(r.d, d);
    q.multiply(r.q);   // world rotation = change since the start * world rotation at the start
    const bone = bones[b];
    bone.parent.getWorldQuaternion(pq);
    bone.quaternion.copy(pq.invert().multiply(q));
    bone.updateMatrixWorld(true);
  });
}
