// Keyboard and mouse wheel.
import { clamp } from '../core/util.js';
import { player, state, view, setStatus } from './state.js';
import { spawnEntry, nextCube, updateNeighbors } from './flow.js';
import { knockDown } from './ragdoll.js';

const keys = new Set();
let jumpPressed = false;

// double-tapping a direction key starts running; it lasts while any direction key is held
const MOVE = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'];
const DOUBLE_TAP = 0.3;   // seconds
const lastTap = {};
let running = false;

addEventListener('keydown', e => {
  keys.add(e.code);
  if (e.repeat) return;
  if (MOVE.includes(e.code)) {
    const now = performance.now() / 1000;
    if (now - (lastTap[e.code] ?? -1) < DOUBLE_TAP) running = true;
    lastTap[e.code] = now;
  }
  if (e.code === 'Space') { jumpPressed = true; e.preventDefault(); }
  if (e.code === 'KeyQ') view.yawTarget -= Math.PI / 2;
  if (e.code === 'KeyE') view.yawTarget += Math.PI / 2;
  if (e.code === 'KeyR') { spawnEntry(); setStatus('Respawned where you came in'); }
  if (e.code === 'KeyN') nextCube();
  if (e.code === 'KeyV') { state.showNeighbors = !state.showNeighbors; updateNeighbors(); }
  if (e.code === 'KeyK' && !player.ragdoll) knockDown({ push: 3, hop: 2.5, reason: 'Whoops!' });
  if (e.code === 'KeyP') { state.showPath = !state.showPath; if (state.world) state.world.pathLine.visible = state.showPath; }
  if (e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', e => {
  keys.delete(e.code);
  if (!MOVE.some(k => keys.has(k))) running = false;
});
addEventListener('blur', () => { keys.clear(); running = false; });
addEventListener('wheel', e => { view.zoomTarget = clamp(view.zoomTarget * (e.deltaY > 0 ? 1.1 : 0.9), 0.15, 1.4); }, { passive: true });

// desired move direction in world space (WASD relative to the camera), length <= 1
export function inputDir() {
  if (player.autoDir) return player.autoDir;
  let ix = 0, iy = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) iy += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) iy -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
  const y = view.yaw;
  return [Math.cos(y) * ix - Math.sin(y) * iy, -Math.sin(y) * ix - Math.cos(y) * iy];
}

export const wantsRun = () => player.autoRun || running;

// true once per key press
export function takeJump() { const j = jumpPressed; jumpPressed = false; return j; }
