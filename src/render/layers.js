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
    for (const [a, cap] of [[L.terrain, 'rock'], [L.stone, 'stone'], [L.wood, 'wood']]) {
      if (!a) continue;
      const mesh = new THREE.Mesh(toGeometry(a), cutMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), cap));
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
