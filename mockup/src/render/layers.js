// Per-layer geometry builders and the meshes made from them. Everything is clipped by the
// section plane; solid meshes also feed the stencil that draws the section caps.
import * as THREE from 'three';
import { FLUIDS, LAVA } from '../core/constants.js';
import { GeoBuilder } from './builder.js';
import { fluidMaterial } from './materials.js';
import { clipping, stencilMeshes } from './section.js';

export function makeLayers(K) {
  return Array.from({ length: K }, () => ({
    terrain: new GeoBuilder(), wood: new GeoBuilder(),
    fluids: Object.fromEntries(FLUIDS.map(t => [t, new GeoBuilder()])),
  }));
}

// returns the fluid meshes (animated every frame)
export function layerMeshes(layers, group) {
  const fluidMeshes = [];
  layers.forEach(L => {
    for (const b of [L.terrain, L.wood]) {
      if (!b.pos.length) continue;
      const geo = b.build();
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, clippingPlanes: clipping }));
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);
      stencilMeshes(geo, group);
    }
    for (const t of FLUIDS) {
      if (!L.fluids[t].pos.length) continue;
      const mat = fluidMaterial(t);
      mat.clippingPlanes = clipping;
      const mesh = new THREE.Mesh(L.fluids[t].build(), mat);
      mesh.receiveShadow = t !== LAVA;
      mesh.renderOrder = 2;
      mesh.userData.fluid = t;
      group.add(mesh);
      fluidMeshes.push(mesh);
    }
  });
  return fluidMeshes;
}
