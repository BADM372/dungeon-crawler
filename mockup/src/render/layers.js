// Meshes for a cube's geometry layers (see cubegeo.js). Everything is clipped by the cutaway
// around the player; solids draw their insides as section caps.
import * as THREE from 'three';
import { FLUIDS, LAVA } from '../core/constants.js';
import { toGeometry } from './builder.js';
import { fluidMaterial } from './materials.js';
import { cutMaterial } from './section.js';

// returns the fluid meshes (animated every frame)
export function layerMeshes(geo, group) {
  const fluidMeshes = [];
  for (const L of geo) {
    for (const a of [L.terrain, L.wood]) {
      if (!a) continue;
      const mesh = new THREE.Mesh(toGeometry(a), cutMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), true));
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);
    }
    for (const t of FLUIDS) {
      if (!L.fluids[t]) continue;
      const mesh = new THREE.Mesh(toGeometry(L.fluids[t]), cutMaterial(fluidMaterial(t)));
      mesh.receiveShadow = t !== LAVA;
      mesh.renderOrder = 2;
      mesh.userData.fluid = t;
      group.add(mesh);
      fluidMeshes.push(mesh);
    }
  }
  return fluidMeshes;
}
