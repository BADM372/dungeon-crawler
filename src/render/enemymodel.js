// Load prefab clips once; each instance owns its skeleton, not the source's bones.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function loadEnemyModel(url, scale, names) {
  const model = { ready: false, scale };
  new GLTFLoader().load(url, gltf => {
    const clips = Object.fromEntries(gltf.animations.map(c => [c.name, c]));
    if (Object.values(names).some(n => !clips[n])) {
      model.error = 'Missing enemy animation in ' + url; console.error(model.error); return;
    }
    const extras = n => gltf.parser.json.animations.find(a => a.name === n)?.extras || {};
    gltf.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    Object.assign(model, {
      ready: true, source: gltf.scene, walk: clips[names.walk], fast: names.fast ? clips[names.fast] : null,
      attack: clips[names.attack], death: clips[names.death],
      walkSpeed: (extras(names.walk).speed || 1) * scale,
      fastSpeed: names.fast ? extras(names.fast).speed * scale : 0,
    });
  }, undefined, error => { model.error = String(error); console.error('Enemy failed to load:', url, error); });
  return model;
}
export function cloneEnemy(model) {
  const source = model.source, copy = source.clone(true), bones = {};
  copy.traverse(o => { if (o.isBone) bones[o.name] = o; });
  const meshes = [];
  source.traverse(o => { if (o.isSkinnedMesh) meshes.push(o); });
  let i = 0;
  copy.traverse(o => {
    if (!o.isSkinnedMesh) return;
    const original = meshes[i++].skeleton;
    o.bind(new THREE.Skeleton(original.bones.map(b => bones[b.name]), original.boneInverses), o.bindMatrix);
  });
  copy.scale.setScalar(model.scale);
  return copy;
}
