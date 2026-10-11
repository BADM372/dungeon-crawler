// Projectiles in flight: the fireball / Triangle punch meshes exported beside their thrower
// (enemymodel.js props), turned along the flight, each with a light and a particle trail.
import * as THREE from 'three';
import { scene } from './scene.js';
import { glow, emit, rand } from './particles.js';
import { trackLight, untrackLight } from './lightpool.js';
import { fireFaceModel } from './firefacemodel.js';
import { triangleModel } from './trianglemodel.js';

const LOOKS = {
  fireball: { prop: () => fireFaceModel.props?.FireFaceBall, light: [0xff7424, 3.5, 3.5], trail: ['#ffd25a', '#ff8a2a', '#ff4a17'], rate: 90 },
  punch: { prop: () => triangleModel.props?.TrianglePunch, light: [0xa45cff, 2.5, 3], trail: ['#e2b8ff', '#9a55ff'], rate: 45 },
};
const ahead = new THREE.Vector3();

function makeView(pr) {
  const look = LOOKS[pr.kind], group = new THREE.Group(), src = look.prop();
  if (src) group.add(src.clone());
  const light = new THREE.PointLight(...look.light, 2);
  group.add(light); scene.add(group); trackLight(light, group);
  return { group, light, look, base: look.light[1] };
}
export function drawProjectiles(list, dt, off = { x: 0, y: 0, z: 0 }) {
  for (const pr of list) {
    const v = pr.view || (pr.view = makeView(pr)), g = v.group;
    g.position.set(pr.x + off.x, pr.y + off.y, pr.z + off.z);
    g.lookAt(ahead.set(pr.vx, pr.vy, pr.vz).add(g.position));   // +Z along the flight
    if (pr.spec.spin) g.rotateZ(pr.t * pr.spec.spin);
    if (pr.kind === 'fireball') g.scale.setScalar(1 + 0.08 * Math.sin(pr.t * 40));
    v.light.intensity = v.base * (0.8 + 0.2 * Math.sin(pr.t * 31) * Math.sin(pr.t * 13));
    const colors = v.look.trail, n = Math.floor(v.look.rate * dt + Math.random());
    for (let i = 0; i < n; i++) {
      const r = pr.spec.radius * 0.6;
      emit(glow, g.position.x + rand(-r, r), g.position.y + rand(-r, r), g.position.z + rand(-r, r), {
        v: [-pr.vx * 0.12 + rand(-0.3, 0.3), rand(0.2, 0.9), -pr.vz * 0.12 + rand(-0.3, 0.3)], life: rand(0.2, 0.4),
        size: rand(0.08, 0.15), color: colors[i % colors.length], drag: 2, gravity: -1 });
    }
  }
}
export function removeProjectileViews(list) {
  for (const pr of list) if (pr.view) { scene.remove(pr.view.group); untrackLight(pr.view.light); pr.view = null; }
}
