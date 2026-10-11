// Decoration props from blender/props.glb: a catalog by theme and attachment (from the glTF
// extras), and instanced meshes per cube. Materials are cloned per cube (cubes fade and get cut
// on their own); props with `sway` move in the wind; glowing props add light sources.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { cutMaterial } from './section.js';

const URL = '../blender/props.glb';
export const props = { ready: false, byName: new Map(), sets: new Map() };
const wind = { value: 0 };
const onReady = [];
export const whenPropsReady = fn => props.ready ? fn() : onReady.push(fn);
export const tickProps = t => { wind.value = t; };

export function registerProps(gltf) {
  for (const o of gltf.scene.children) {
    // a prop is one mesh, or a group of meshes when it has a glowing material as well
    const parts = (o.isMesh ? [o] : o.children.filter(c => c.isMesh)).map(c => ({ geometry: c.geometry, material: c.material }));
    if (!parts.length) continue;
    const name = o.name, ex = o.userData || {};
    const [set, ...rest] = name.split('_');
    const base = rest.slice(0, -1).join('_');
    const box = new THREE.Box3();
    for (const q of parts) { q.geometry.computeBoundingBox(); box.union(q.geometry.boundingBox); }
    const p = { name, set, base, attach: ex.attach || 'ground', radius: ex.radius ?? 0.3, blocking: !!ex.blocking,
      light: ex.light, intensity: ex.intensity ?? 1, sway: ex.sway ?? 0, priority: ex.priority ?? 1, parts, height: box.max.y };
    props.byName.set(name, p);
    const key = set + '/' + p.attach;
    if (!props.sets.has(key)) props.sets.set(key, []);
    props.sets.get(key).push(p);
  }
}

// sway: bend with the wind, more the further from the attachment point; per-instance phase
function swayMaterial(mat, sway) {
  const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey();
  mat.onBeforeCompile = (sh, r) => {
    prev.call(mat, sh, r);
    sh.uniforms.uWind = wind; sh.uniforms.uSway = { value: sway };
    sh.vertexShader = 'uniform float uWind, uSway;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float ph = 0.0;
      #ifdef USE_INSTANCING
        ph = instanceMatrix[3].x * 0.9 + instanceMatrix[3].z * 1.7;
      #endif
      float bend = abs(position.y) * uSway * 0.07;
      transformed.x += sin(uWind * 1.9 + ph) * bend;
      transformed.z += cos(uWind * 1.4 + ph * 1.3) * bend * 0.7;`);
  };
  mat.customProgramCacheKey = () => key + '|sway';
  return mat;
}

// placed: [{ name, x, y, z, yaw, s, tint }] -> instanced meshes (and light sources) in group
export function buildProps(placed, group) {
  const byName = new Map();
  for (const q of placed) { if (!byName.has(q.name)) byName.set(q.name, []); byName.get(q.name).push(q); }
  const m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  let lights = 0;
  for (const [name, list] of byName) {
    const p = props.byName.get(name);
    for (const part of p.parts) {
      const c = cutMaterial(part.material.clone(), false, true);
      const mesh = new THREE.InstancedMesh(part.geometry, p.sway ? swayMaterial(c, p.sway) : c, list.length);
      mesh.userData.sharedGeo = true;   // the catalog owns the geometry
      list.forEach((q, i) => {
        qt.setFromAxisAngle(up, q.yaw);
        m4.compose(new THREE.Vector3(q.x, q.y, q.z), qt, new THREE.Vector3(q.s, q.s, q.s));
        mesh.setMatrixAt(i, m4);
        mesh.setColorAt(i, col.set(q.tint || '#ffffff'));
      });
      mesh.castShadow = p.blocking || p.height > 0.8;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    // a few glowing props light their surroundings (the light pool picks the nearest)
    if (p.light) for (const q of list) {
      if (lights >= 6) break;
      const l = new THREE.PointLight(p.light, p.intensity * 2, 4, 2);
      l.position.set(q.x, q.y + (p.attach === 'ceiling' ? -0.4 : 0.5), q.z);
      group.add(l); lights++;
    }
  }
}

export const propsReady = new GLTFLoader().loadAsync(URL).then(gltf => {
  registerProps(gltf);
  props.ready = true;
  onReady.splice(0).forEach(fn => fn());
});
propsReady.catch(e => console.error('props failed to load', e));
