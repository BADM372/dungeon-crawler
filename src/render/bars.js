// Health bars and level labels floating over the player and the enemies.
import * as THREE from 'three';

const INDICATOR_SCALE = 1.15;
const barGeo = new THREE.PlaneGeometry(1, 1);
const mats = new Map();
const mat = (color, onTop) => {
  const k = color + ':' + onTop;
  if (!mats.has(k)) mats.set(k, new THREE.MeshBasicMaterial(onTop
    ? { color, side: THREE.DoubleSide, transparent: true, depthTest: false }   // drawn over the world
    : { color, side: THREE.DoubleSide }));
  return mats.get(k);
};

// a bar (back plate + fill) of width w; set(f) fills it to f in 0..1
export function makeBar({ w = 0.66, h = 0.07, color = 0xf2a449, back = 0x231f25, onTop = false } = {}) {
  const group = new THREE.Group(), plate = new THREE.Mesh(barGeo, mat(back, onTop)), fill = new THREE.Mesh(barGeo, mat(color, onTop));
  const fw = w - 0.04, fh = h - 0.025;
  plate.scale.set(w, h, 1); fill.scale.set(fw, fh, 1); fill.position.z = 0.001;
  group.add(plate, fill);
  group.scale.setScalar(INDICATOR_SCALE);
  if (onTop) { plate.renderOrder = 1200; fill.renderOrder = 1201; }
  return { group, set(f) { f = Math.min(1, Math.max(0, f)); fill.scale.x = fw * f; fill.position.x = -fw / 2 * (1 - f); } };
}

// "Lv N" as a sprite; setLevel redraws it only when the level changes
export function makeLevelLabel(level, { color = '#ffe4ae', onTop = false } = {}) {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d'), texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false, depthTest: !onTop }));
  sprite.scale.set(.7 * INDICATOR_SCALE, .175 * INDICATOR_SCALE, 1);
  if (onTop) sprite.renderOrder = 1202;
  let shown = null;
  sprite.setLevel = n => {
    if (n === shown) return;
    shown = n;
    ctx.clearRect(0, 0, 256, 64);
    ctx.font = 'bold 48px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 10; ctx.strokeStyle = '#171c25'; ctx.strokeText(`Lv ${n}`, 128, 32);
    ctx.fillStyle = color; ctx.fillText(`Lv ${n}`, 128, 32);
    texture.needsUpdate = true;
  };
  sprite.setLevel(level);
  return sprite;
}
