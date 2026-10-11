// The glass box every cube sits in (the active one and the low-detail neighbours alike), so the
// box moves and fades along with its cube.
import * as THREE from 'three';
import { N, CUBE_H, BASE } from '../core/constants.js';

const box = new THREE.BoxGeometry(N, CUBE_H, N), outline = new THREE.EdgesGeometry(box);

export function makeGlass(strength = 1) {
  const g = new THREE.Group();
  const edges = new THREE.LineSegments(outline, new THREE.LineBasicMaterial({ color: 0x8fb3d9, transparent: true, opacity: 0.35 * strength }));
  const glass = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: 0x6d8db5, transparent: true, opacity: 0.05 * strength, side: THREE.BackSide, depthWrite: false }));
  edges.userData.sharedGeo = glass.userData.sharedGeo = true;   // not disposed with the cube
  g.add(edges, glass);
  g.position.set(N / 2, CUBE_H / 2 - BASE, N / 2);
  return g;
}
