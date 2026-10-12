// Name labels over the items on the floor, Diablo style, in their rarity's colour. X shows
// them for everything in the cube but coins; otherwise only the item under the cursor gets
// one. A label (or the item itself) is clicked to walk there and pick it up (game/orders.js).
// Labels that would overlap are pushed upwards into a stack. Runs after the camera moved.
import * as THREE from 'three';
import { camera, renderer } from '../render/scene.js';
import { lootView } from '../render/loot.js';
import { rarityOf } from '../core/gear/rarities.js';
import { labelled } from '../core/loot.js';
import { displayName } from '../core/gear/stats.js';
import { state } from './state.js';
import { lootHere } from './loot.js';
import { pointer, hoveredEnemy } from './pointer.js';
import { orderPickup } from './orders.js';

const layer = document.getElementById('loot-labels'), canvas = renderer.domElement;
const labels = new Map();   // pickup id -> { el, p, w, h }
const PICK = 26;             // px: how close the cursor must be to an item to hover it
let hovered = null, overLabel = null, cursor = '';

export const hoveredPickup = () => hovered;
export function toggleLabels() { state.showLabels = !state.showLabels; }

function label(p) {
  let l = labels.get(p.id);
  if (l) return l;
  const el = document.createElement('button');
  el.className = 'loot-label'; el.tabIndex = -1;
  el.textContent = displayName(p) + (p.count > 1 ? ` (${p.count})` : '');
  el.style.color = p.gen ? rarityOf(p).css : '#d8d2c4';
  if (p.gen) el.dataset.rarity = rarityOf(p).id;
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0 || state.inventoryOpen || state.transitioning) return;
    e.preventDefault(); e.stopPropagation();
    orderPickup(p);
  });
  el.addEventListener('pointerenter', () => { overLabel = p; });
  el.addEventListener('pointerleave', () => { if (overLabel === p) overLabel = null; });
  layer.append(el);
  l = { el, p, w: 0, h: 0 };
  labels.set(p.id, l);
  return l;
}

const v = new THREE.Vector3();
// p on screen (px), over the item; null when behind the camera or off screen
function screen(p, off) {
  v.set(p.x + off.x, p.y + off.y + (p.gen ? 0.12 : 0.35), p.z + off.z).project(camera);
  if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) return null;
  return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight };
}

export function updateLootLabels() {
  const live = !state.inventoryOpen && !state.transitioning && !!state.world;
  const list = live ? lootHere().filter(p => labelled(p) && p.toss >= 1 && !p.fly && lootView(p)) : [];
  const off = state.world?.group.position ?? v.set(0, 0, 0), spots = new Map();
  for (const p of list) { const s = screen(p, off); if (s) spots.set(p, s); }
  // the item under the cursor: a label it points at, else the nearest item on screen
  hovered = null;
  if (live && overLabel && spots.has(overLabel)) hovered = overLabel;
  else if (live && pointer.inside && !hoveredEnemy()) {
    const px = (pointer.ndc.x + 1) / 2 * innerWidth, py = (1 - pointer.ndc.y) / 2 * innerHeight;
    let best = PICK;
    for (const [p, s] of spots) {
      const d = Math.hypot(s.x - px, s.y - py);
      if (d < best) { best = d; hovered = p; }
    }
  }
  const show = [...spots.keys()].filter(p => state.showLabels || p === hovered);
  // nearest to the camera first; each label goes up past any it would cover
  show.sort((a, b) => spots.get(b).y - spots.get(a).y);
  const placed = [], keep = new Set();
  for (const p of show) {
    const l = label(p), s = spots.get(p);
    keep.add(p.id);
    if (!l.w) { l.w = l.el.offsetWidth || 80; l.h = l.el.offsetHeight || 18; }
    let x = s.x - l.w / 2, y = s.y - l.h - 6;
    for (let moved = true, n = 0; moved && n < 30; n++) {
      moved = false;
      for (const r of placed) if (x < r.x + r.w && x + l.w > r.x && y < r.y + r.h && y + l.h > r.y) { y = r.y - l.h - 2; moved = true; }
    }
    placed.push({ x, y, w: l.w, h: l.h });
    l.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    l.el.classList.toggle('hovered', p === hovered);
  }
  for (const [id, l] of labels) if (!keep.has(id)) { l.el.remove(); labels.delete(id); if (overLabel === l.p) overLabel = null; }
  const want = hoveredEnemy() ? 'crosshair' : hovered ? 'pointer' : '';
  if (want !== cursor) canvas.style.cursor = cursor = want;
}
