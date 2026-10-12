// Keyboard, mouse and wheel. Modal input never enters the game queue.
// Mouse: click the floor to walk there, click an enemy to attack it (hold for more),
// Shift+click to swing towards the cursor in place. F swings towards the cursor too.
import { stepZoom } from '../core/zoom.js';
import { player, state, view, setStatus } from './state.js';
import { spawnEntry, nextCube, updateNeighbors } from './flow.js';
import { knockDown } from './ragdoll.js';
import { toggleInventory, setInventoryOpen } from './inventory.js';
import { controls, clearInput } from './inputstate.js';
import { helpOpen, setHelpOpen, toggleHelp } from './help.js';
import { requestCollect } from './loot.js';
import { pointer, pickFloor, aimPoint, hoveredEnemy } from './pointer.js';
import { orderMove, orderAttack, clearOrder } from './orders.js';
import { queueAttack } from './sword.js';
import { toggleMute } from '../audio/sfx.js';
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
  if (e.code === 'KeyF' && !state.transitioning) { clearOrder(); queueAttack(attackTarget()); e.preventDefault(); }
  if (e.code === 'KeyM') setStatus(toggleMute() ? 'Sound off' : 'Sound on');
  if (e.code === 'KeyQ') view.yawTarget -= Math.PI / 2;
  if (e.code === 'KeyE') view.yawTarget += Math.PI / 2;
  if (e.code === 'KeyC') requestCollect();
  if (e.code === 'KeyR') { spawnEntry(); setStatus('Respawned where you came in'); }
  if (e.code === 'KeyN') nextCube();
  if (e.code === 'KeyV') { state.showNeighbors = !state.showNeighbors; updateNeighbors(); }
  if (e.code === 'KeyK' || e.code === 'KeyL') { view.zoomTarget = stepZoom(view.zoomTarget, e.code === 'KeyK' ? -1 : 1); e.preventDefault(); }
  if (e.code === 'KeyB' && !player.ragdoll) knockDown({ push: 3, hop: 2.5, reason: 'Whoops!' });
  if (e.code === 'KeyP') { state.showPath = !state.showPath; if (state.world) state.world.pathLine.visible = state.showPath; }
  if (e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', e => {
  keys.delete(e.code);
  if (!MOVE.some(k => keys.has(k))) controls.running = false;
});
addEventListener('blur', clearInput);
// what a swing aims at: the enemy under the cursor, else the cursor's spot
const attackTarget = () => hoveredEnemy() || aimPoint();
addEventListener('pointerdown', e => {
  if (e.button !== 0 || e.target.tagName !== 'CANVAS' || state.transitioning || state.inventoryOpen) return;
  e.preventDefault();
  pointer.down = true;
  const enemy = hoveredEnemy();
  if (e.shiftKey) { pointer.mode = 'force'; clearOrder(); queueAttack(attackTarget()); return; }
  if (enemy) { pointer.mode = 'attack'; orderAttack(enemy); return; }
  pointer.mode = 'move';
  const hit = pickFloor();
  if (hit) orderMove(hit);
  else {   // off the map: head that way
    const a = aimPoint();
    if (a) orderMove({ x: a.x, z: a.z, s: null });
  }
});
addEventListener('wheel', e => {
  if (!state.inventoryOpen) view.zoomTarget = stepZoom(view.zoomTarget, Math.sign(e.deltaY));
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
