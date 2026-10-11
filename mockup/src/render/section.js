// Cutaway: a slowly turning nine-cornered shape on screen around the character (cutshader.js).
// Inside it, everything above the cut height that is closer to the camera than the character
// is discarded; nothing behind the character is touched. Cut solids show their insides: back
// faces are drawn as a dark hatched cap, and the cut-away part as faint glass (ghosts.js).
// Cut fluids get flat caps.
import * as THREE from 'three';
import { N, LH, CUBE_H, LAVA, ACID } from '../core/constants.js';
import { GeoBuilder } from './builder.js';
import { C } from './palette.js';
import { scene, camera, renderer } from './scene.js';
import { U, inject, turnShape } from './cutshader.js';

const RADIUS = 2.8;   // world units around the character

// a material that gets cut away; with caps, its back faces show as the dark hatched cap;
// ghost: the cut-away part is drawn again as glass (ghosts.js)
export function cutMaterial(mat, caps = false, ghost = caps) {
  if (caps) { mat.side = THREE.DoubleSide; mat.shadowSide = THREE.BackSide; }
  mat.userData.ghost = ghost;
  return inject(mat, fs => {
    fs = fs.replace('#include <clipping_planes_fragment>', 'if (cutRegion(true) > 0.5 || frontWall()) discard;\n#include <clipping_planes_fragment>');
    if (caps) fs = fs.replace('#include <dithering_fragment>', `#include <dithering_fragment>
      if (!gl_FrontFacing) {
        float h = step(0.6, fract((vCutW.x + vCutW.z) * 2.5));
        gl_FragColor = vec4(mix(vec3(0.17, 0.145, 0.13), vec3(0.22, 0.19, 0.17), h), 1.0);
      }`);
    return fs;
  }, caps ? 'cut-caps' : 'cut');
}

// fluid caps: a flat quad at the cut height for every fluid cell it passes through, drawn
// only inside the cutaway
const fluidCaps = new THREE.Mesh(new THREE.BufferGeometry(), inject(new THREE.MeshBasicMaterial({ vertexColors: true }),
  fs => fs.replace('#include <clipping_planes_fragment>', 'if (cutRegion(false) < 0.5) discard;\n#include <clipping_planes_fragment>'), 'cut-fluid-cap'));
scene.add(fluidCaps);
const capColor = t => C(t === LAVA ? '#c2410a' : t === ACID ? '#4f9a24' : '#1f5d99');

const tmp = new THREE.Vector3(), right = new THREE.Vector3();
let key = '';
// y = height of the cut (Infinity for none), (px, py, pz) = the point to keep visible
export function setCut(y, map, px, py, pz) {
  const on = y < CUBE_H;
  turnShape(performance.now() / 1000);
  U.uCutY.value = on ? y : 1e3;
  // cave walls on the camera's side come down to a little over the character
  const cx = camera.position.x - N / 2, cz = camera.position.z - N / 2, cave = !!map?.cave;
  U.uFront.value.set(cave && cx > 6 ? 1 : 0, cave && cx < -6 ? 1 : 0, cave && cz > 6 ? 1 : 0, cave && cz < -6 ? 1 : 0);
  U.uWallY.value = py + 1;
  camera.updateMatrixWorld();
  renderer.getDrawingBufferSize(U.uRes.value);
  U.uAspect.value = camera.aspect;
  tmp.set(px, py, pz).applyMatrix4(camera.matrixWorldInverse);
  U.uDepth.value = -tmp.z;
  tmp.set(px, py, pz).project(camera);
  U.uCenter.value.set(tmp.x, tmp.y);
  // radius: project a point RADIUS to the side of the character
  right.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(RADIUS).add(new THREE.Vector3(px, py, pz)).project(camera);
  U.uRadius.value = Math.hypot((right.x - tmp.x) * camera.aspect, right.y - tmp.y);

  const k = on ? y.toFixed(3) : 'off';
  if (k === key && map === fluidCaps.userData.map) return;
  key = k; fluidCaps.userData.map = map;
  const b = new GeoBuilder();
  if (on && map) for (const f of map.floors) {
    if (!f.fluid || f.top * LH >= y || f.surf * LH - 0.06 <= y) continue;
    b.quad([f.x, y, f.z], [f.x + 1, y, f.z], [f.x + 1, y, f.z + 1], [f.x, y, f.z + 1], [0, 1, 0], capColor(f.fluid));
  }
  fluidCaps.geometry.dispose();
  fluidCaps.geometry = b.build();
}
