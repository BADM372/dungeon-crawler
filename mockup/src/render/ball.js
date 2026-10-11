// The player: a low-poly ball, a silhouette visible through walls and a small light.
import * as THREE from 'three';
import { scene } from './scene.js';
import { playerU } from './materials.js';

const R = 0.3;
const group = new THREE.Group();
const geo = new THREE.IcosahedronGeometry(R, 1);
const ball = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xf2efe6, emissive: 0x3a2f1a, flatShading: true, roughness: 0.5 }));
ball.castShadow = true;
const ghost = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.45, depthFunc: THREE.GreaterDepth, depthWrite: false }));
ghost.renderOrder = 999;
const light = new THREE.PointLight(0xffd9a0, 1.2, 3.5, 2);
light.position.y = 0.5;
group.add(ball, ghost, light);
scene.add(group);

const axis = new THREE.Vector3();

// place the ball and roll it by the distance travelled since the last frame
export function updateBall(x, y, z, dx, dz) {
  const dist = Math.hypot(dx, dz);
  if (dist > 1e-5) {
    axis.set(dz, 0, -dx).normalize();
    ball.rotateOnWorldAxis(axis, dist / R);
    ghost.quaternion.copy(ball.quaternion);
  }
  group.position.set(x, y + R, z);
  playerU.value.set(x, y, z);
}
