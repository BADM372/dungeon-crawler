// Fixed ~45 degree perspective camera that frames the whole cube; zooming in follows the player.
import * as THREE from 'three';
import { N, CUBE_H, BASE } from '../core/constants.js';
import { clamp } from '../core/util.js';
import { camera } from '../render/scene.js';
import { player, view } from './state.js';
import { kick } from './juice.js';

// learn: drawing.html#camera (see learn/README.md)
const pitch = THREE.MathUtils.degToRad(44);
const cubeCenter = new THREE.Vector3(N / 2, CUBE_H / 2 - BASE - 1.5, N / 2);
const target = new THREE.Vector3(), focus = new THREE.Vector3();

export function updateCamera(dt) {
  view.yaw += (view.yawTarget - view.yaw) * Math.min(1, dt * 8);
  view.zoom += (view.zoomTarget - view.zoom) * Math.min(1, dt * 8);
  const follow = clamp((1 - view.zoom) / 0.6, 0, 1) * 0.9;
  target.copy(cubeCenter).lerp(focus.set(player.x, player.visY + 0.5, player.z), follow);
  // distance that fits the cube's bounding sphere into the narrower field of view
  const fovV = THREE.MathUtils.degToRad(camera.fov);
  const fovH = 2 * Math.atan(Math.tan(fovV / 2) * camera.aspect);
  const d = 12.5 / Math.sin(Math.min(fovV, fovH) / 2) * view.zoom;
  // hit kicks shove the whole view a little and spring back (scaled with the view distance)
  const decay = Math.exp(-dt * 16), s = d * 0.03;
  kick.x *= decay; kick.y *= decay; kick.z *= decay;
  target.x += kick.x * s; target.y += kick.y * s; target.z += kick.z * s;
  camera.position.set(
    target.x + Math.sin(view.yaw) * Math.cos(pitch) * d,
    target.y + Math.sin(pitch) * d,
    target.z + Math.cos(view.yaw) * Math.cos(pitch) * d);
  camera.lookAt(target);
}
