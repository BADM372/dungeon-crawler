// Keyboard, sword clicks and mouse wheel. Modal input never enters the game queue.
import { clamp } from '../core/util.js';
import { player, state, view, setStatus } from './state.js';
import { spawnEntry, nextCube, updateNeighbors } from './flow.js';
import { knockDown } from './ragdoll.js';
import { toggleInventory, setInventoryOpen } from './inventory.js';
import { controls, clearInput } from './inputstate.js';
import { helpOpen, setHelpOpen, toggleHelp } from './help.js';
import { requestCollect } from './loot.js';
export { clearInput };

const { keys, lastTap } = controls;
// double-tapping a direction starts running while any direction is held
const MOVE = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'];
const DOUBLE_TAP = 0.3;

addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.code === 'KeyI') { if (!e.repeat) { setHelpOpen(false); toggleInventory(); } e.preventDefault(); return; }
  if (e.code === 'Escape' && state.inventoryOpen) { setInventoryOpen(false); e.preventDefault(); return; }
  if (state.inventoryOpen) return;
  // by key, not code: ? and / sit on different keys across layouts
  if (e.key === '?' || e.key === '/') { if (!e.repeat) toggleHelp(); e.preventDefault(); return; }
  if (e.code === 'Escape' && helpOpen()) { setHelpOpen(false); e.preventDefault(); return; }
  keys.add(e.code);
  if (e.repeat) return;
  if (MOVE.includes(e.code)) {
    const now = performance.now() / 1000;
    if (now - (lastTap[e.code] ?? -1) < DOUBLE_TAP) controls.running = true;
    lastTap[e.code] = now;
  }
  if (e.code === 'Space') { controls.jumpPressed = true; e.preventDefault(); }
  if (e.code === 'KeyF' && !state.transitioning) { player.sword.requested = true; e.preventDefault(); }
  if (e.code === 'KeyQ') view.yawTarget -= Math.PI / 2;
  if (e.code === 'KeyE') view.yawTarget += Math.PI / 2;
  if (e.code === 'KeyC') requestCollect();
  if (e.code === 'KeyR') { spawnEntry(); setStatus('Respawned where you came in'); }
  if (e.code === 'KeyN') nextCube();
  if (e.code === 'KeyV') { state.showNeighbors = !state.showNeighbors; updateNeighbors(); }
  if (e.code === 'KeyK' && !player.ragdoll) knockDown({ push: 3, hop: 2.5, reason: 'Whoops!' });
  if (e.code === 'KeyP') { state.showPath = !state.showPath; if (state.world) state.world.pathLine.visible = state.showPath; }
  if (e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', e => {
  keys.delete(e.code);
  if (!MOVE.some(k => keys.has(k))) controls.running = false;
});
addEventListener('blur', clearInput);
addEventListener('pointerdown', e => {
  if (e.button === 0 && e.target.tagName === 'CANVAS' && !state.transitioning && !state.inventoryOpen) {
    player.sword.requested = true; e.preventDefault();
  }
});
addEventListener('wheel', e => {
  if (!state.inventoryOpen) view.zoomTarget = clamp(view.zoomTarget * (e.deltaY > 0 ? 1.1 : 0.9), 0.15, 1.4);
}, { passive: true });

// desired direction in world space (WASD relative to the camera)
export function inputDir() {
  if (state.inventoryOpen) return [0, 0];
  if (player.autoDir) return player.autoDir;
  let ix = 0, iy = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) iy += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) iy -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
  const y = view.yaw;
  return [Math.cos(y) * ix - Math.sin(y) * iy, -Math.sin(y) * ix - Math.cos(y) * iy];
}
export const wantsRun = () => player.autoRun || controls.running || keys.has('ShiftLeft') || keys.has('ShiftRight');
export function takeJump() { const j = controls.jumpPressed; controls.jumpPressed = false; return j; }
export function takeAttack() { const a = player.sword.requested; player.sword.requested = false; return a; }
