// Builds (and animates) all meshes for one generated map.
import * as THREE from 'three';
import { N, BASE, WATER, LAVA, ACID, FLUIDS } from '../core/constants.js';
import { BEDROCK } from './palette.js';
import { scene } from './scene.js';
import { fallTex } from './materials.js';
import { makeLayers, layerMeshes } from './layers.js';
import { buildFloors } from './floors.js';
import { buildStructures } from './structures.js';
import { buildFalls, lavaLights } from './falls.js';
import { buildMarkers } from './markers.js';

export function disposeWorld(world) {
  if (!world) return;
  scene.remove(world.group);
  world.group.traverse(o => { o.geometry?.dispose(); if (o.material) [].concat(o.material).forEach(m => m.dispose()); });
}

export function buildWorld(m, showPath) {
  const group = new THREE.Group();
  const layers = makeLayers(m.K);
  layers[0].terrain.box(0, -BASE, 0, N, 0, N, BEDROCK[0], BEDROCK[1]);
  buildFloors(m, layers);
  buildStructures(m, layers);
  const fluidMeshes = layerMeshes(layers, group);
  const { splashes, lights } = buildFalls(m, layers, group);
  lavaLights(m, group, lights);
  const markers = buildMarkers(m, group, showPath);
  scene.add(group);
  return { group, layers, fluidMeshes, splashes, lights, ...markers };
}

// per-frame animation; layers above `playerLayer` fade out
export function animateWorld(world, dt, time, playerLayer) {
  world.layers.forEach((L, k) => {
    const target = k > playerLayer ? 1 : 0;
    L.fadeU.value += (target - L.fadeU.value) * Math.min(1, dt * 5);
  });
  for (const m of world.fluidMeshes) {
    const t = m.userData.fluid;
    if (t === WATER) m.position.y = Math.sin(time * 1.6) * 0.025;
    else if (t === ACID) m.position.y = Math.sin(time * 2.3 + 1) * 0.02;
    else m.material.emissiveIntensity = 1.1 + Math.sin(time * 3) * 0.3;
  }
  for (const t of FLUIDS) fallTex[t].offset.y += dt * (t === LAVA ? 0.5 : 1.5);
  world.splashes.forEach((s, i) => { const k = 1 + Math.sin(time * 9 + i) * 0.08; s.scale.set(k, 1, k); });
  for (const l of world.lights) l.intensity = 5 + Math.sin(time * 4 + l.position.x) * 1.5;
  world.ring.rotation.x = time * 1.5;
  world.disc.material.opacity = 0.35 + Math.sin(time * 4) * 0.15;
  world.beam.material.opacity = 0.09 + Math.sin(time * 2) * 0.04;
  world.entryGlow.material.opacity = 0.25 + Math.sin(time * 2.5) * 0.1;
}
