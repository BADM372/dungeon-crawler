// The cloud bridge: walking through a side portal into a cube that is not drawn yet (no
// low-detail proxy), a light blue cloud spills out of the gate so the character never steps
// onto nothing. It appears when the travel starts (also covering a cube still generating) and
// dissolves while the new cube fades in (game/travel.js, game/travelfx.js). It lives in the
// scene, not a cube: the cubes' dither fade would chop the soft puffs.
import * as THREE from 'three';
import { N, DIRS } from '../core/constants.js';
import { renderer, scene, camera } from './scene.js';

const COUNT = 96, DEPTH = 2.7, WIDTH = 1.75;   // how far it reaches out, half its width at the gate
const APPEAR = 0.12, DISSOLVE = 0.45, ALPHA = 0.8;   // seconds to spill out / to dissolve; puff opacity
// The new cube fades in this much later on trips with a cloud (game/travelfx.js), so the
// cloud has a moment to itself.
export const CLOUD_DELAY = 0.4;
const vertexShader = `
attribute vec3 puff;   // size (world units), alpha, brightness
uniform float scale;
varying vec2 vPuff;
void main() {
  vPuff = puff.yz;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = puff.x * scale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
// lit from above: light on top, a deeper blue underneath
const fragmentShader = `
uniform vec3 top, bottom;
varying vec2 vPuff;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float r = length(q);
  if (r > 0.5) discard;
  vec3 c = mix(bottom, top, clamp(0.55 - q.y * 1.6, 0.0, 1.0)) * vPuff.y;
  gl_FragColor = vec4(c, vPuff.x * smoothstep(0.5, 0.08, r));
  #include <colorspace_fragment>
}`;

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3).setUsage(THREE.DynamicDrawUsage));
geometry.setAttribute('puff', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3).setUsage(THREE.DynamicDrawUsage));
const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, transparent: true, depthWrite: false,
  uniforms: { scale: { value: 1 }, top: { value: new THREE.Color('#4e6488') }, bottom: { value: new THREE.Color('#212f4a') } } });
const points = new THREE.Points(geometry, material);
points.frustumCulled = false; points.renderOrder = 950; points.visible = false;
const group = new THREE.Group();
group.add(points); scene.add(group);

const puffs = [];
const smooth = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
let active = false, appear = 0, fading = -1, reveal = 0, time = 0;   // fading: seconds dissolving
const at = { x: 0, y: 0, z: 0, ox: 0, oz: 0, ax: 0, az: 0 };   // gate centre, outwards, along

// a tongue of puffs, widest at the gate, with a thinner underside
function layout() {
  puffs.length = 0;
  for (let i = 0; i < COUNT; i++) {
    const u = -0.3 + Math.random() ** 0.85 * (DEPTH + 0.3);
    const w = WIDTH - Math.max(0, u - 1) * 0.4, v = (Math.random() * 2 - 1) * w;
    const edge = Math.max(Math.abs(v) / w, u / DEPTH), under = i % 4 === 0;
    puffs.push({ u, v, phase: Math.random() * 6.3, r: Math.random(),
      h: under ? -0.6 - Math.random() * 0.3 : -0.3 - Math.random() * 0.15 - edge * 0.12,
      size: (under ? 0.9 : 1.2) + Math.random() * 0.45 - edge * 0.3, light: 0.88 + Math.random() * 0.16 });
  }
}

// p: the side portal (in the current cube's coordinates); without a gate, where the player is
export function showPortalCloud(p, player) {
  const [dx, dz] = DIRS[p.dir], gate = Number.isFinite(p.x);
  at.ox = dx; at.oz = dz; at.ax = dz ? 1 : 0; at.az = dx ? 1 : 0;
  at.x = dx ? (dx > 0 ? N : 0) : gate ? p.x + 0.5 : player.x;
  at.z = dz ? (dz > 0 ? N : 0) : gate ? p.z + 0.5 : player.z;
  at.y = gate ? p.y : player.y;
  layout();
  active = true; appear = reveal = 0; fading = -1;
  group.position.set(0, 0, 0);
}

// offset: where the cube the cloud was opened in is drawn now; shown: how far the new cube
// has faded in (0..1). The cloud holds until a quarter of it is there, then dissolves over
// DISSOLVE seconds (on its own, also after the travel ended).
export function placePortalCloud(offset, shown) {
  group.position.copy(offset);
  reveal = shown;
}

export function hidePortalCloud() { active = false; points.visible = false; }

const buffer = new THREE.Vector2();
export function tickPortalCloud(dt) {
  if (!active) return;
  time += dt;
  appear = Math.min(1, appear + dt / APPEAR);
  if (fading < 0 && reveal >= 0.25) fading = 0;
  if (fading >= 0) fading += dt;
  const dissolve = Math.max(0, fading) / DISSOLVE;
  if (dissolve >= 1) { hidePortalCloud(); return; }
  renderer.getDrawingBufferSize(buffer);
  material.uniforms.scale.value = buffer.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  const pos = geometry.attributes.position, attr = geometry.attributes.puff;
  puffs.forEach((p, i) => {
    // spills out of the gate front first; dissolves in random order, swelling and lifting
    const a = smooth(appear * 1.6 - (p.u + 0.3) / (DEPTH + 0.3) * 0.6), d = smooth((dissolve - p.r * 0.45) / 0.55);
    const u = p.u * (0.6 + 0.4 * a), v = p.v * (1 + 0.25 * d);
    pos.setXYZ(i, at.x + at.ox * u + at.ax * v, at.y + p.h + Math.sin(time * 1.4 + p.phase) * 0.04 + d * 0.3,
      at.z + at.oz * u + at.az * v);
    attr.setXYZ(i, p.size * (0.5 + 0.5 * a) * (1 + 0.6 * d), ALPHA * a * (1 - d), p.light);
  });
  pos.needsUpdate = attr.needsUpdate = true;
  points.visible = true;
}
