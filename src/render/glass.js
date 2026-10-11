// Cube-local glass boxes move and fade with the full cube and its proxies. Side panes can
// disappear independently; the outline still shows that these are separate simulation spaces.
import * as THREE from 'three';
import { N, CUBE_H, BASE } from '../core/constants.js';

const box = new THREE.BoxGeometry(N, CUBE_H, N), outline = new THREE.EdgesGeometry(box);
// BoxGeometry's faces are +x, -x, +y, -y, +z, -z. Keep one shared geometry per side.
const sides = [0, 1, 4, 5].map(face => {
  const geo = box.clone();
  geo.setIndex(Array.from(box.index.array.slice(face * 6, face * 6 + 6)));
  geo.clearGroups();
  return geo;
});

export function setGlassFaces(group, open = []) {
  group.userData.panes.forEach((pane, dir) => { pane.visible = !open[dir]; });
}

export function makeGlass(strength = 1, open = []) {
  const g = new THREE.Group();
  const edges = new THREE.LineSegments(outline, new THREE.LineBasicMaterial({ color: 0x8fb3d9, transparent: true, opacity: 0.35 * strength }));
  edges.userData.sharedGeo = true;
  const material = new THREE.MeshBasicMaterial({ color: 0x6d8db5, transparent: true, opacity: 0.05 * strength, side: THREE.BackSide, depthWrite: false });
  g.userData.panes = sides.map(geo => {
    const pane = new THREE.Mesh(geo, material);
    pane.userData.sharedGeo = true;
    return pane;
  });
  g.add(edges, ...g.userData.panes);
  g.position.set(N / 2, CUBE_H / 2 - BASE, N / 2);
  setGlassFaces(g, open);
  return g;
}
