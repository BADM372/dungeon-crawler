// Section cut: everything above a horizontal plane is clipped away. Where the plane slices
// through solid matter a hatched cap is drawn (stencil capping: inside a cut solid the plane
// sees one more back face than front faces). Cut fluids get flat caps in their own colour.
import * as THREE from 'three';
import { N, LH, CUBE_H, LAVA, ACID } from '../core/constants.js';
import { GeoBuilder } from './builder.js';
import { C } from './palette.js';
import { scene } from './scene.js';

export const cutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e3);   // keeps y <= constant
export const clipping = [cutPlane];

// stencil counters for a solid mesh: +1 for back faces, -1 for front faces below the cut
const stencilBase = {
  depthWrite: false, depthTest: false, colorWrite: false, stencilWrite: true,
  stencilFunc: THREE.AlwaysStencilFunc, clippingPlanes: clipping,
};
const stencilBack = new THREE.MeshBasicMaterial({ ...stencilBase, side: THREE.BackSide,
  stencilFail: THREE.IncrementWrapStencilOp, stencilZFail: THREE.IncrementWrapStencilOp, stencilZPass: THREE.IncrementWrapStencilOp });
const stencilFront = new THREE.MeshBasicMaterial({ ...stencilBase, side: THREE.FrontSide,
  stencilFail: THREE.DecrementWrapStencilOp, stencilZFail: THREE.DecrementWrapStencilOp, stencilZPass: THREE.DecrementWrapStencilOp });

export function stencilMeshes(geo, group) {
  for (const mat of [stencilBack, stencilFront]) {
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = 1;
    group.add(m);
  }
}

// hatched cap material: dark rock with diagonal strokes, in world scale
function hatchTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#3a312b'; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#564a40'; g.lineWidth = 5;
  for (let i = -64; i < 128; i += 16) { g.beginPath(); g.moveTo(i, 64); g.lineTo(i + 64, 0); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(N * 1.5, N * 1.5);
  return t;
}
const cap = new THREE.Mesh(new THREE.PlaneGeometry(N, N), new THREE.MeshBasicMaterial({
  map: hatchTexture(), stencilWrite: true, stencilRef: 0, stencilFunc: THREE.NotEqualStencilFunc,
  stencilFail: THREE.ReplaceStencilOp, stencilZFail: THREE.ReplaceStencilOp, stencilZPass: THREE.ReplaceStencilOp,
}));
cap.rotation.x = -Math.PI / 2;
cap.renderOrder = 1.1;
cap.onAfterRender = renderer => renderer.clearStencil();

// fluid caps are simple: fluids are boxes from the bed to the surface in each cell
const fluidCapMat = new THREE.MeshBasicMaterial({ vertexColors: true });
const fluidCaps = new THREE.Mesh(new THREE.BufferGeometry(), fluidCapMat);
const capColor = t => C(t === LAVA ? '#c2410a' : t === ACID ? '#4f9a24' : '#1f5d99');

scene.add(cap, fluidCaps);
stencilBack.userData.keep = stencilFront.userData.keep = true;   // shared by every world

let current = Infinity, currentMap = null;
// y = height of the cut, Infinity for none; caps only once the cut has settled (a moving
// plane sweeping through a slab would flash a slab-sized cap)
export function setCut(y, map, settled = true) {
  cap.visible = fluidCaps.visible = y < CUBE_H && settled;
  if (y === current && map === currentMap) return;
  current = y; currentMap = map;
  const on = y < CUBE_H;
  cutPlane.constant = on ? y : 1e3;
  cap.position.set(N / 2, y, N / 2);
  const b = new GeoBuilder();
  if (on && map) for (const f of map.floors) {
    if (!f.fluid || f.top * LH >= y || f.surf * LH - 0.06 <= y) continue;
    b.quad([f.x, y, f.z], [f.x + 1, y, f.z], [f.x + 1, y, f.z + 1], [f.x, y, f.z + 1], [0, 1, 0], capColor(f.fluid));
  }
  fluidCaps.geometry.dispose();
  fluidCaps.geometry = b.build();
}
