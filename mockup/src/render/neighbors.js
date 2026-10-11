// Low-detail copies of the neighbouring cubes around the active one: terrain, structures and
// fluids only, dimmed, no shadows, no lights, each in its glass box. Every proxy is its own
// fadable group, so portal travel can cross-fade a proxy with the full version of its cube.
import * as THREE from 'three';
import { N, FLUIDS } from '../core/constants.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { scene } from './scene.js';
import { toGeometry } from './builder.js';
import { makeFadable, setFade } from './fade.js';
import { makeGlass } from './glass.js';

let current = [];   // [{ key, group, base }]

function proxy(geo) {
  const g = new THREE.Group(), solids = [], fluids = [];
  const solid = new THREE.MeshLambertMaterial({ vertexColors: true, color: 0x5f6672 });
  const fluid = new THREE.MeshLambertMaterial({ color: 0x2e6aa8, transparent: true, opacity: 0.6, depthWrite: false });
  for (const L of geo) {
    for (const a of [L.terrain, L.wood]) if (a) solids.push(toGeometry(a));
    for (const t of FLUIDS) if (L.fluids[t]) { const f = toGeometry(L.fluids[t]); f.deleteAttribute('color'); fluids.push(f); }
  }
  if (solids.length) g.add(new THREE.Mesh(mergeGeometries(solids), solid));
  if (fluids.length) g.add(new THREE.Mesh(mergeGeometries(fluids), fluid));
  solids.forEach(s => s.dispose()); fluids.forEach(f => f.dispose());
  g.add(makeGlass(0.6));
  return g;
}

// list: [{ key, geo, dx, dz }] -> proxies, faded out (fade them in with setFade / tickNeighbors)
export function buildNeighbors(list) {
  return list.map(({ key, geo, dx, dz }) => {
    const group = proxy(geo), base = new THREE.Vector3(dx * N, 0, dz * N);
    group.position.copy(base);
    makeFadable(group, 0);
    scene.add(group);
    return { key, group, base };
  });
}

export function disposeNeighbors(list) {
  for (const { group } of list) {
    scene.remove(group);
    group.traverse(o => {
      if (!o.userData.sharedGeo) o.geometry?.dispose();
      if (o.material) o.material.dispose();
    });
  }
}

export function clearNeighbors() { disposeNeighbors(current); current = []; }
export function showNeighbors(list) { clearNeighbors(); current = buildNeighbors(list); }
// portal travel takes the current proxies along with the old cube, and hands in the new ones
export function detachNeighbors() { const c = current; current = []; return c; }
export function adoptNeighbors(list) { clearNeighbors(); current = list; }

export function tickNeighbors(dt) {
  for (const { group } of current) if (group.userData.fade < 1) setFade(group, Math.min(1, group.userData.fade + dt * 2.5));
}
