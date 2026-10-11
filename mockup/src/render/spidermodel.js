// Loads the spider and hands out independent skinned copies of it.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const URL = '../blender/spider.glb';
export const SPIDER_SCALE = 0.4;   // the rig is ~2 m across -> ~0.8 units

export const spiderModel = { ready: false };

function setup(gltf) {
  const clips = Object.fromEntries(gltf.animations.map(c => [c.name, c]));
  const extras = name => gltf.parser.json.animations.find(a => a.name === name)?.extras || {};
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.frustumCulled = false;
    if (o.material.emissive && o.material.emissive.getHex()) o.material.emissiveIntensity = 3;
  });
  Object.assign(spiderModel, {
    ready: true, source: gltf.scene, walk: clips.SpiderWalk, attack: clips.SpiderAttack,
    walkSpeed: (extras('SpiderWalk').speed || 1) * SPIDER_SCALE,   // ground speed at timeScale 1
  });
}

// a deep copy with its own skeleton (Object3D.clone keeps the bones of the source)
export function cloneSpider() {
  const src = spiderModel.source, copy = src.clone(true);
  const bones = {};
  copy.traverse(o => { if (o.isBone) bones[o.name] = o; });
  const srcMeshes = [];
  src.traverse(o => { if (o.isSkinnedMesh) srcMeshes.push(o); });
  let i = 0;
  copy.traverse(o => {
    if (!o.isSkinnedMesh) return;
    const sk = srcMeshes[i++].skeleton;
    o.bind(new THREE.Skeleton(sk.bones.map(b => bones[b.name]), sk.boneInverses), o.bindMatrix);
  });
  copy.scale.setScalar(SPIDER_SCALE);
  return copy;
}

new GLTFLoader().load(URL, setup, undefined, e => console.error('spider failed to load', e));
