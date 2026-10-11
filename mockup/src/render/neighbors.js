// Low-detail copies of the neighbouring cubes around the active one: terrain, structures and
// fluids only, dimmed, no shadows, no lights. They show how the world continues past the faces.
import * as THREE from 'three';
import { N, BASE, FLUIDS } from '../core/constants.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BEDROCK } from './palette.js';
import { scene } from './scene.js';
import { makeLayers } from './layers.js';
import { buildFloors } from './floors.js';
import { buildStructures } from './structures.js';

const solid = new THREE.MeshLambertMaterial({ vertexColors: true, color: 0x5f6672 });
const fluid = new THREE.MeshLambertMaterial({ color: 0x2e6aa8, transparent: true, opacity: 0.6, depthWrite: false });
let group = null;

function cubeMesh(m) {
  const layers = makeLayers(m.K);
  layers[0].terrain.box(0, -BASE, 0, N, 0, N, BEDROCK[0], BEDROCK[1]);
  buildFloors(m, layers);
  buildStructures(m, layers);
  const g = new THREE.Group(), solids = [], fluids = [];
  for (const L of layers) {
    for (const b of [L.terrain, L.wood]) if (b.pos.length) solids.push(b.build());
    for (const t of FLUIDS) if (L.fluids[t].pos.length) fluids.push(L.fluids[t].build());
  }
  if (solids.length) g.add(new THREE.Mesh(mergeGeometries(solids), solid));
  if (fluids.length) g.add(new THREE.Mesh(mergeGeometries(fluids.map(f => { f.deleteAttribute('color'); return f; })), fluid));
  solids.forEach(s => s.dispose()); fluids.forEach(f => f.dispose());
  return g;
}

export function clearNeighbors() {
  if (!group) return;
  scene.remove(group);
  group.traverse(o => o.geometry?.dispose());
  group = null;
}

// list: [{ map, dx, dz }]
export function showNeighbors(list) {
  clearNeighbors();
  group = new THREE.Group();
  for (const { map, dx, dz } of list) {
    const g = cubeMesh(map);
    g.position.set(dx * N, 0, dz * N);
    group.add(g);
  }
  scene.add(group);
}
