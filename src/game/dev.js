// Debug tools, only with ?dev in the URL:
//   click a portal: take it            G: go to the nearest way down on this depth
//   PageDown / PageUp: go down / up a depth right away (finding the well / ring first)
import * as THREE from 'three';
import { camera, renderer } from '../render/scene.js';
import { step } from '../world/coords.js';
import { state, player, setStatus } from './state.js';
import { whenReady } from './hud.js';
import { startTravel } from './travel.js';
import { enterCube, arrivalPoint, spawnAt } from './flow.js';
import { clearMouseInput } from './orders.js';
import { takeTownPortal } from './townportal.js';

const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
const D = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function takePortal(q) {
  if (state.transitioning || state.inventoryOpen || q.kind === 'spawn') return;
  if (q.kind === 'town') { takeTownPortal(); return; }
  clearMouseInput();
  const [x, z] = q.kind === 'side' ? [q.x + 0.5 + D[q.dir][0] * 0.3, q.z + 0.5 + D[q.dir][1] * 0.3] : [q.x + 0.5, q.z + 0.5];
  Object.assign(player, { x, z, y: q.y, visY: q.y, vx: 0, vy: 0, vz: 0, grounded: true, ragdoll: null });
  startTravel(q);
}

function portalAt(e) {
  if (state.inventoryOpen || !state.world || e.target !== renderer.domElement) return null;
  mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const hit = ray.intersectObjects(state.world.portalFx.map(f => f.obj), true)[0];
  for (let o = hit?.object; o; o = o.parent) if (o.userData.portal) return o.userData.portal;
  return null;
}

// breadth-first through the portals of this depth until a cube with a `kind` portal turns up
async function findCube(kind) {
  const seen = new Set([state.cubeKey]), queue = [state.cubeKey];
  while (queue.length && seen.size < 120) {
    const k = queue.shift(), c = await state.cubes.get(k);
    if (c.map.portals.some(p => p.kind === kind)) return c;
    c.info.faces.forEach((f, d) => {
      const n = step(k, d);
      if (d < 4 && f?.portal && !seen.has(n)) { seen.add(n); queue.push(n); }
    });
  }
  return null;
}

async function goTo(kind, take) {
  if (state.transitioning || state.inventoryOpen) return;
  clearMouseInput();
  state.transitioning = true;
  const c = await whenReady(findCube(kind)).catch(() => null);
  state.transitioning = false;
  if (!c) { setStatus(`No way ${kind} found on this depth`); return; }
  if (c.key !== state.cubeKey) enterCube(c, c.map.portals.find(p => p.kind !== 'spawn')?.dir ?? null);
  const q = state.map.portals.find(p => p.kind === kind);
  if (take) { takePortal(q); return; }
  const a = arrivalPoint(q);
  spawnAt(a.x, a.y, a.z);
  setStatus(`Next to the way ${kind}`);
}

if (state.dev) {
  addEventListener('click', e => { const q = portalAt(e); if (q) takePortal(q); });
  addEventListener('mousemove', e => { document.body.style.cursor = portalAt(e) ? 'pointer' : ''; });
  addEventListener('keydown', e => {
    if (e.repeat || state.inventoryOpen) return;
    if (e.code === 'KeyG') goTo('down', false);
    if (e.code === 'PageDown') { e.preventDefault(); goTo('down', true); }
    if (e.code === 'PageUp') { e.preventDefault(); goTo('up', true); }
  });
}
