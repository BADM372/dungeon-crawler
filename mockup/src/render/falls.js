// Waterfall sheets with splash rings, and point lights over lava.
import * as THREE from 'three';
import { N, LH, LAVA, ACID, DIRS } from '../core/constants.js';
import { fadeMaterial, fallTex } from './materials.js';

function fallMaterial(type) {
  return new THREE.MeshStandardMaterial({
    map: fallTex[type], transparent: true, opacity: type === LAVA ? 1 : 0.85, depthWrite: false, roughness: 0.3,
    emissive: type === LAVA ? 0xff4a00 : type === ACID ? 0x2a7a10 : 0x0a2a4a,
    emissiveMap: type === LAVA ? fallTex[LAVA] : null, emissiveIntensity: type === LAVA ? 1.3 : 1,
  });
}

// a sheet pouring over the slab edge, plus a splash ring where it lands
export function buildFalls(m, layers, group) {
  const splashes = [], lights = [];
  for (const f of m.falls) {
    const L = layers[f.layer], [dx, dz] = DIRS[f.d], bx = f.c % N, bz = (f.c / N) | 0;
    const yTop = f.top * LH - 0.04, yBot = f.bot * LH - 0.08, h = yTop - yBot;
    const ex = dx > 0 ? bx : dx < 0 ? bx + 1 : bx + 0.5, ez = dz > 0 ? bz : dz < 0 ? bz + 1 : bz + 0.5;
    const geo = new THREE.BoxGeometry(dx ? 0.22 : 0.84, h, dx ? 0.84 : 0.22);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * h * 0.7);
    const mat = fallMaterial(f.type);
    const sheet = new THREE.Mesh(geo, f.layer ? fadeMaterial(mat, L.fadeU) : mat);
    sheet.position.set(ex + dx * 0.12, yBot + h / 2, ez + dz * 0.12);
    sheet.renderOrder = 10 * f.layer + 3;
    group.add(sheet);

    const foam = f.type === LAVA ? 0xffc06a : f.type === ACID ? 0xd8ff9a : 0xeaf6ff;
    const splash = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 0.05, 14),
      new THREE.MeshBasicMaterial({ color: foam, transparent: true, opacity: 0.55, depthWrite: false }));
    splash.position.set(ex + dx * 0.3, yBot + 0.06, ez + dz * 0.3);
    splash.renderOrder = 10 * f.layer + 4;
    group.add(splash); splashes.push(splash);
    if (f.type === LAVA) {
      const l = new THREE.PointLight(0xff5a1a, 6, 6, 2);
      l.position.set(ex + dx * 0.6, yBot + h * 0.4, ez + dz * 0.6);
      lights.push(l); group.add(l);
    }
  }
  return { splashes, lights };
}

// a few glows over lava bodies (at most 4 lights in total)
export function lavaLights(m, group, lights) {
  for (const f of m.floors) {
    if (f.fluid !== LAVA) continue;
    const x = f.x + 0.5, z = f.z + 0.5, y = f.surf * LH + 0.7;
    if (lights.some(l => Math.hypot(l.position.x - x, l.position.z - z, l.position.y - y) < 4) || lights.length >= 4) continue;
    const l = new THREE.PointLight(0xff5a1a, 6, 6, 2);
    l.position.set(x, y, z);
    lights.push(l); group.add(l);
  }
}
