// Per-layer geometry builders and the meshes made from them. Layer 0 is opaque; upper
// layers use a depth pre-pass plus a blended colour pass so they can fade cleanly.
import * as THREE from 'three';
import { FLUIDS, LAVA } from '../core/constants.js';
import { GeoBuilder } from './builder.js';
import { fadeMaterial, fluidMaterial } from './materials.js';

export function makeLayers(K) {
  return Array.from({ length: K }, () => ({
    terrain: new GeoBuilder(), wood: new GeoBuilder(),
    fluids: Object.fromEntries(FLUIDS.map(t => [t, new GeoBuilder()])),
    fadeU: { value: 0 },   // 0 = solid, 1 = faded (player is below this layer)
  }));
}

// returns the fluid meshes (animated every frame)
export function layerMeshes(layers, group) {
  const fluidMeshes = [];
  layers.forEach((L, k) => {
    for (const b of [L.terrain, L.wood]) {
      if (!b.pos.length) continue;
      const geo = b.build();
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
      const mesh = new THREE.Mesh(geo, k ? fadeMaterial(mat, L.fadeU) : mat);
      mesh.castShadow = mesh.receiveShadow = true;
      if (k) {
        mesh.renderOrder = 10 * k + 1;
        const pre = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true }));
        pre.renderOrder = 10 * k;
        group.add(pre);
      }
      group.add(mesh);
    }
    for (const t of FLUIDS) {
      if (!L.fluids[t].pos.length) continue;
      const mat = fluidMaterial(t);
      const mesh = new THREE.Mesh(L.fluids[t].build(), k ? fadeMaterial(mat, L.fadeU) : mat);
      mesh.receiveShadow = t !== LAVA;
      mesh.renderOrder = 10 * k + 2;
      mesh.userData.fluid = t;
      group.add(mesh);
      fluidMeshes.push(mesh);
    }
  });
  return fluidMeshes;
}
