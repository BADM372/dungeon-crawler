// Fluid materials and scrolling waterfall textures.
import * as THREE from 'three';
import { WATER, LAVA, ACID } from '../core/constants.js';
import { mulberry32 } from '../core/util.js';

export function fluidMaterial(t) {
  if (t === WATER) return new THREE.MeshStandardMaterial({ color: 0x2e86de, emissive: 0x0a2a4a, transparent: true, opacity: 0.72, roughness: 0.15, metalness: 0.1, depthWrite: false });
  if (t === LAVA) return new THREE.MeshStandardMaterial({ color: 0xff6a00, emissive: 0xff3a00, emissiveIntensity: 1.2, roughness: 0.6 });
  return new THREE.MeshStandardMaterial({ color: 0x7dff3a, emissive: 0x3a9a10, emissiveIntensity: 0.8, transparent: true, opacity: 0.82, roughness: 0.3, depthWrite: false });
}

// streaky textures for falling fluids (offset scrolled every frame)
function makeFallTex(base, streak) {
  const c = document.createElement('canvas'); c.width = 32; c.height = 64;
  const g = c.getContext('2d'), R = mulberry32(7);
  g.fillStyle = base; g.fillRect(0, 0, 32, 64);
  g.fillStyle = streak;
  for (let i = 0; i < 46; i++) {
    g.globalAlpha = 0.2 + R() * 0.55;
    const x = Math.floor(R() * 32), y = Math.floor(R() * 64), w = 1 + Math.floor(R() * 2), h = 6 + Math.floor(R() * 22);
    g.fillRect(x, y, w, h); g.fillRect(x, y - 64, w, h);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export const fallTex = {
  [WATER]: makeFallTex('#3f8fe0', '#eaf7ff'),
  [LAVA]: makeFallTex('#ff5a00', '#ffd27a'),
  [ACID]: makeFallTex('#66e030', '#eaffc8'),
};
