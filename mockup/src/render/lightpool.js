// A fixed set of point lights shared by all cubes. three.js recompiles every lit shader when
// the number of lights changes, which made entering a cube stutter. Cubes still create their
// point lights (portals, lava), but those are only light sources: every frame the pool lights
// copy the ones nearest to the focus point. Unused pool lights are switched off.
import * as THREE from 'three';
import { scene } from './scene.js';

const POOL = 8;
const pool = Array.from({ length: POOL }, () => { const l = new THREE.PointLight(0xffffff, 0, 1, 2); scene.add(l); return l; });
let sources = [];
const tmp = new THREE.Vector3();

// take the point lights out of a freshly built cube (group) and use them as sources
export function adoptLights(group) {
  const found = [];
  group.traverse(o => { if (o.isPointLight) found.push(o); });
  for (const l of found) { const parent = l.parent; parent.remove(l); sources.push({ l, parent, group, pos: new THREE.Vector3() }); }
}

export function releaseLights(group) { sources = sources.filter(s => s.group !== group); }

export function updateLightPool(focus) {
  for (const s of sources) {
    s.parent.updateWorldMatrix(true, false);
    s.pos.copy(s.l.position).applyMatrix4(s.parent.matrixWorld);
    s.d = s.pos.distanceToSquared(focus);
  }
  const best = sources.filter(s => s.group.visible && s.parent.visible).sort((a, b) => a.d - b.d).slice(0, POOL);
  pool.forEach((l, i) => {
    const s = best[i];
    if (!s) { l.intensity = 0; return; }
    l.position.copy(s.pos);
    l.color.copy(s.l.color);
    l.intensity = s.l.intensity * (s.group.userData.fade ?? 1);
    l.distance = s.l.distance; l.decay = s.l.decay;
  });
}

export const focusPoint = (x, y, z) => tmp.set(x, y, z);
