// Cutaway: a slowly turning nine-cornered shape on screen around the character (cutshader.js).
// Inside it, everything above the cut height that is closer to the camera than the character
// is discarded; nothing behind the character is touched. Cut solids show their insides: back
// faces are drawn as a flat cap, and the cut-away part as faint glass (ghosts.js). The cap
// has one colour per kind of solid (rock strata at the cut height, structure stone, wood), so
// the inner faces seen through the cut read as a single flat lid.
// Cut fluids get flat caps.
import * as THREE from 'three';
import { N, LH, CUBE_H, LAVA, ACID } from '../core/constants.js';
import { GeoBuilder } from './builder.js';
import { C, gradient } from './palette.js';
import { themeAt } from '../world/depth.js';
import { buildOf } from '../world/builds.js';
import { scene, camera, renderer } from './scene.js';
import { U, inject, turnShape } from './cutshader.js';

const RADIUS = 2.8;   // world units around the character

// how much darker a cap is than an unshadowed floor of the same colour
const CAP_SHADE = 0.68;

const CAP_UNIFORM = { rock: 'uCapRock', stone: 'uCapStone', wood: 'uCapWood' };

// a material that gets cut away; caps ('rock' | 'stone' | 'wood'): its back faces show as
// the flat cap in that kind's colour, lit like an upward-facing floor (sky + sun, no
// shadows), a little darker; ghost: the cut-away part is drawn again as glass (ghosts.js)
export function cutMaterial(mat, caps = false, ghost = !!caps) {
  if (caps) { mat.side = THREE.DoubleSide; mat.shadowSide = THREE.BackSide; }
  mat.userData.ghost = ghost;
  return inject(mat, fs => {
    fs = fs.replace('#include <clipping_planes_fragment>', 'if (cutRegion(true) > 0.5 || frontWall()) discard;\n#include <clipping_planes_fragment>');
    if (caps) fs = fs.replace('#include <opaque_fragment>', `if (!gl_FrontFacing) {
        vec3 capUp = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz), capIrr = vec3(0.0);
        #if NUM_HEMI_LIGHTS > 0
          for (int i = 0; i < NUM_HEMI_LIGHTS; i++) capIrr += getHemisphereLightIrradiance(hemisphereLights[i], capUp);
        #endif
        #if NUM_DIR_LIGHTS > 0
          for (int i = 0; i < NUM_DIR_LIGHTS; i++) capIrr += directionalLights[i].color * max(dot(capUp, directionalLights[i].direction), 0.0);
        #endif
        outgoingLight = BRDF_Lambert(${CAP_UNIFORM[caps]}) * capIrr * ${CAP_SHADE.toFixed(3)};
      }
      #include <opaque_fragment>`);
    return fs;
  }, caps ? 'cut-caps-' + caps : 'cut');
}

// fluid caps: a flat quad at the cut height for every fluid cell it passes through, drawn
// only inside the cutaway
const fluidCaps = new THREE.Mesh(new THREE.BufferGeometry(), inject(new THREE.MeshBasicMaterial({ vertexColors: true }),
  fs => fs.replace('#include <clipping_planes_fragment>', 'if (cutRegion(false) < 0.5) discard;\n#include <clipping_planes_fragment>'), 'cut-fluid-cap'));
scene.add(fluidCaps);
const capColor = t => C(t === LAVA ? '#c2410a' : t === ACID ? '#4f9a24' : '#1f5d99');

const tmp = new THREE.Vector3(), right = new THREE.Vector3();
let key = '', capKey = '';

// cap colours for the theme of `map`: rock is the cliff strata band at height y (as on the
// cliff walls, see walls.js), stone and wood are the theme's structure materials
function capColors(map, y) {
  const depth = map?.depth ?? 0, band = Math.max(0, Math.floor(y)), k = depth + ':' + band;
  if (k === capKey) return;
  capKey = k;
  const theme = themeAt(depth), build = buildOf(theme);
  U.uCapRock.value.copy(gradient(theme.side, band / LH)).multiplyScalar(0.94);
  U.uCapStone.value.set(build.stone);
  U.uCapWood.value.set(build.wood);
}
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
  capColors(map, on ? y : py + 1);

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
