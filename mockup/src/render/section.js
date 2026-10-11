// Cutaway: a circle on screen centred on the character. Inside it, everything above the cut
// height that is closer to the camera than the character is discarded (soft dithered edge);
// nothing behind the character is touched. Cut solids show their insides: back faces are
// drawn as a dark hatched cap. Cut fluids get flat caps.
import * as THREE from 'three';
import { LH, CUBE_H, LAVA, ACID } from '../core/constants.js';
import { GeoBuilder } from './builder.js';
import { C } from './palette.js';
import { scene, camera, renderer } from './scene.js';

const RADIUS = 2.8;   // world units around the character

const U = {
  uCutY: { value: 1e3 }, uCenter: { value: new THREE.Vector2() }, uRadius: { value: 1 },
  uAspect: { value: 1 }, uDepth: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
};
// 1 inside the cutaway (with a dithered rim), 0 outside; y-test optional
const REGION = `
  float cutRegion(bool testY) {
    if (testY && vCutW.y <= uCutY) return 0.0;
    if (vCutZ > uDepth - 0.15) return 0.0;
    vec2 ndc = gl_FragCoord.xy / uRes * 2.0 - 1.0;
    float d = length((ndc - uCenter) * vec2(uAspect, 1.0)) / uRadius;
    float rim = smoothstep(0.85, 1.0, d);
    float n = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453);
    return n >= rim ? 1.0 : 0.0;
  }`;

function inject(mat, fragCode, key) {
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'varying vec3 vCutW;\nvarying float vCutZ;\n' + sh.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\n#ifdef USE_INSTANCING\n  vCutW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n#else\n  vCutW = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#endif\n  vCutZ = -mvPosition.z;');
    sh.fragmentShader = 'varying vec3 vCutW;\nvarying float vCutZ;\nuniform float uCutY, uRadius, uAspect, uDepth;\nuniform vec2 uCenter, uRes;\n'
      + REGION + '\n' + fragCode(sh.fragmentShader);
  };
  mat.customProgramCacheKey = () => key;
  return mat;
}

// a material that gets cut away; with caps, its back faces show as the dark hatched cap
export function cutMaterial(mat, caps = false) {
  if (caps) { mat.side = THREE.DoubleSide; mat.shadowSide = THREE.BackSide; }
  return inject(mat, fs => {
    fs = fs.replace('#include <clipping_planes_fragment>', 'if (cutRegion(true) > 0.5) discard;\n#include <clipping_planes_fragment>');
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
  U.uCutY.value = on ? y : 1e3;
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
