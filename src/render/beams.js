// Beams in the air (game/beams.js): the Spicy's laser. Two thin beams, one from each of its
// floating eyes (the model's eye bones; the muzzle while it has no view), meet where the beam
// ends. Each is a bright core in a soft glow; both swell and flicker harder as the burst comes
// near. Where it ends a light flickers and sparks sizzle off.
import * as THREE from 'three';
import { scene } from './scene.js';
import { glow, emit, rand } from './particles.js';
import { trackLight, untrackLight } from './lightpool.js';

const tube = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true).translate(0, 0.5, 0);   // +Y, 0 to 1
const ball = new THREE.IcosahedronGeometry(1, 1);
const EYES = ['eye.L', 'eye.R'].map(n => THREE.PropertyBinding.sanitizeNodeName(n));
const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), start = new THREE.Vector3(), end = new THREE.Vector3();

function makeView(b) {
  const color = new THREE.Color(b.profile?.beamColor ?? b.spec.color ?? '#7dff3a');
  const additive = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
  const core = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').lerp(color, 0.3), ...additive });
  const halo = new THREE.MeshBasicMaterial({ color, opacity: 0.4, ...additive });
  const group = new THREE.Group(), rays = [];
  for (let i = 0; i < 2; i++) {
    const c = new THREE.Mesh(tube, core), h = new THREE.Mesh(tube, halo);
    c.frustumCulled = h.frustumCulled = false;
    group.add(c, h); rays.push({ core: c, halo: h });
  }
  const spot = new THREE.Mesh(ball, halo);
  const light = new THREE.PointLight(color, 2.5, 3, 2);
  group.add(spot); scene.add(group); trackLight(light, spot);   // a pool light source, not in the scene
  return { group, rays, spot, light, owned: [core, halo], colors: ['#ffffff', '#' + color.getHexString(), '#d8ff7a'] };
}
function eyeAt(b, i, off, out) {
  const bone = b.enemy?.view?.model.getObjectByName(EYES[i]);
  if (bone) return bone.getWorldPosition(out);
  return out.set(b.x + off.x, b.y + off.y, b.z + off.z);
}
export function drawBeams(list, dt, off = { x: 0, y: 0, z: 0 }) {
  for (const b of list) {
    const v = b.view || (b.view = makeView(b));
    const k = Math.min(1, b.t / b.spec.time), t = b.t;
    const flick = 0.75 + 0.25 * Math.sin(t * 61) * Math.sin(t * 23) + 0.3 * k * Math.sin(t * 97);
    end.set(b.ex + off.x, b.ey + off.y, b.ez + off.z);
    v.rays.forEach((r, i) => {
      eyeAt(b, i, off, start);
      dir.subVectors(end, start);
      const length = dir.length();
      for (const m of [r.core, r.halo]) { m.position.copy(start); m.quaternion.setFromUnitVectors(up, dir.normalize()); }
      r.core.scale.set((0.012 + 0.014 * k) * flick, length, (0.012 + 0.014 * k) * flick);
      r.halo.scale.set((0.035 + 0.05 * k) * flick, length, (0.035 + 0.05 * k) * flick);
    });
    v.owned[1].opacity = 0.3 + 0.25 * k;
    v.spot.position.copy(end); v.spot.scale.setScalar((0.07 + 0.08 * k) * flick);
    v.light.intensity = (1.5 + 2.5 * k) * flick;
    for (let i = Math.floor((40 + 60 * k) * dt + Math.random()); i > 0; i--)   // sizzling where it ends
      emit(glow, end.x, end.y, end.z, { v: [rand(-1.2, 1.2), rand(0.4, 2), rand(-1.2, 1.2)], spread: 0.05, life: rand(0.15, 0.3),
        size: rand(0.05, 0.1), color: v.colors[i % 3], gravity: 5, drag: 2 });
  }
}
export function removeBeamViews(list) {
  for (const b of list) if (b.view) {
    scene.remove(b.view.group); untrackLight(b.view.light);
    b.view.owned.forEach(m => m.dispose()); b.view = null;
  }
}
