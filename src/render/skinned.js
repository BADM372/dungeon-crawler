// A copy of a skinned glTF scene that owns its skeleton: the copy's meshes are bound to the
// copy's bones, not the source's. Geometry and materials stay shared with the source.
import * as THREE from 'three';

export function cloneSkinned(source) {
  const copy = source.clone(true), bones = {};
  copy.traverse(o => { if (o.isBone) bones[o.name] = o; });
  const meshes = [];
  source.traverse(o => { if (o.isSkinnedMesh) meshes.push(o); });
  let i = 0;
  copy.traverse(o => {
    if (!o.isSkinnedMesh) return;
    const original = meshes[i++].skeleton;
    o.bind(new THREE.Skeleton(original.bones.map(b => bones[b.name]), original.boneInverses), o.bindMatrix);
  });
  return copy;
}
