// How dark it is: sky, hemisphere light, sun, fog and the character's own light follow the
// (fractional) depth, blended between theme starts. Below the ground (depth > 4) the
// character's light grows, since local lights are all there is.
import * as THREE from 'three';
import { scene, setSky, hemi, sun } from './scene.js';
import { character } from './character.js';
import { lightAt } from '../world/depth.js';

const ca = new THREE.Color(), cb = new THREE.Color();
const mix = (a, b, t) => ca.set(a).lerp(cb.set(b), t);
const lerp = (a, b, t) => a + (b - a) * t;
let skyKey = '';

// camDist: distance from the camera to what it looks at (fog is placed around that)
export function applyLook(depth, camDist) {
  const { a, b, t } = lightAt(depth);
  hemi.color.copy(mix(a.hemi[0], b.hemi[0], t));
  hemi.groundColor.copy(mix(a.hemi[1], b.hemi[1], t));
  hemi.intensity = lerp(a.hemi[2], b.hemi[2], t);
  sun.color.copy(mix(a.sun[0], b.sun[0], t));
  sun.intensity = lerp(a.sun[1], b.sun[1], t);
  const top = '#' + mix(a.sky[0], b.sky[0], t).getHexString(), bottom = '#' + mix(a.sky[1], b.sky[1], t).getHexString();
  if (top + bottom !== skyKey) { skyKey = top + bottom; setSky(top, bottom); }
  // fog: nothing at 0, at 1 the far half of the cube disappears into the dark
  const f = lerp(a.fog, b.fog, t);
  scene.fog.color.set(bottom);
  scene.fog.near = f > 0.01 ? camDist - 6 : 1e4;
  scene.fog.far = f > 0.01 ? camDist + 6 + 70 * (1 - f) : 2e4;
  if (character.ready) {
    const cave = Math.min(1, Math.max(0, depth - 4));
    character.light.intensity = lerp(1.2, 3, cave);
    character.light.distance = lerp(3.5, 8, cave);
  }
}
