// Keyboard, mouse and wheel. Modal input never enters the game queue.
// The player always runs; holding Ctrl walks. Holding Shift auto-attacks enemies the blade
// can reach (and does nothing without one). Space jumps.
// Mouse: click the floor to walk there, click an enemy to attack it (hold for more), click an
// item on the floor to pick it up. V: the floor panel (game/inventory.js); X: item labels.
// 1-6: the quick bar (game/quickbar.js).
import { stepZoom } from '../core/zoom.js';
import { player, state, view, setStatus } from './state.js';
import { spawnEntry, nextCube } from './flow.js';
import { knockDown } from './ragdoll.js';
import { toggleInventory, toggleFloor, setInventoryOpen } from './inventory.js';
import { controls, clearInput } from './inputstate.js';
import { helpOpen, setHelpOpen, toggleHelp } from './help.js';
import { requestCollect } from './loot.js';
import { pointer, pickFloor, aimPoint, hoveredEnemy } from './pointer.js';
import { orderMove, orderAttack, orderPickup } from './orders.js';
import { hoveredPickup, toggleLabels } from './lootlabels.js';
import { queueAttack } from './sword.js';
import { softTarget } from '../core/combat.js';
import { clearLine } from '../physics/enemynav.js';
import { allEnemies } from './enemies.js';
import { toggleMute } from '../audio/sfx.js';
import { barKey } from './quickbar.js';
export { clearInput };

const { keys } = controls;
const MOVE = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'];
const WALK = ['ControlLeft', 'ControlRight'], ATTACK = ['ShiftLeft', 'ShiftRight'];

addEventListener('keydown', e => {
  if (e.metaKey || e.altKey) return;
  // Ctrl is the walk modifier: track it and the movement keys (and keep Ctrl+S / Ctrl+D /
  // Ctrl+A from saving, bookmarking or selecting), leave every other Ctrl shortcut alone
  if (e.ctrlKey) {
    if (!state.inventoryOpen && (WALK.includes(e.code) || MOVE.includes(e.code))) { keys.add(e.code); e.preventDefault(); }
    return;
  }
  if (e.code === 'KeyI') { if (!e.repeat) { setHelpOpen(false); toggleInventory(); } e.preventDefault(); return; }
  if (e.code === 'KeyV') { if (!e.repeat) { setHelpOpen(false); toggleFloor(); } e.preventDefault(); return; }
  if (e.code === 'Escape' && state.inventoryOpen) { setInventoryOpen(false); e.preventDefault(); return; }
  // 1-6: the quick bar (with the inventory open: put the selected item there); not while typing
  const bar = /^Digit([1-6])$/.exec(e.code);
  if (bar && !['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target?.tagName)) { if (!e.repeat) barKey(bar[1] - 1); e.preventDefault(); return; }
  if (state.inventoryOpen) return;
  // by key, not code: ? and / sit on different keys across layouts
  if (e.key === '?' || e.key === '/') { if (!e.repeat) toggleHelp(); e.preventDefault(); return; }
  if (e.code === 'Escape' && helpOpen()) { setHelpOpen(false); e.preventDefault(); return; }
  keys.add(e.code);
  if (e.repeat) return;
  if (e.code === 'Space') { controls.jumpPressed = true; e.preventDefault(); }
  // a tap between two frames still swings (holding is handled every frame in update.js)
  if (ATTACK.includes(e.code) && !state.transitioning) autoAttack();
  if (e.code === 'KeyM') setStatus(toggleMute() ? 'Sound off' : 'Sound on');
  if (e.code === 'KeyQ') view.yawTarget -= Math.PI / 2;
  if (e.code === 'KeyE') view.yawTarget += Math.PI / 2;
  if (e.code === 'KeyC') requestCollect();
  if (e.code === 'KeyR') { spawnEntry(); setStatus('Respawned where you came in'); }
  if (e.code === 'KeyN') nextCube();
  if (e.code === 'KeyX') toggleLabels();
  if (e.code === 'KeyK' || e.code === 'KeyL') { view.zoomTarget = stepZoom(view.zoomTarget, e.code === 'KeyK' ? -1 : 1); e.preventDefault(); }
  if (e.code === 'KeyB' && !player.ragdoll) knockDown({ push: 3, hop: 2.5, reason: 'Whoops!' });
  if (e.code === 'KeyP') { state.showPath = !state.showPath; if (state.world) state.world.pathLine.visible = state.showPath; }
  if (e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', clearInput);
// Ctrl+click is a right click on macOS: no context menu over the game
addEventListener('contextmenu', e => { if (e.target.tagName === 'CANVAS') e.preventDefault(); });
// Auto-attack (Shift): swing at the best enemy the blade can reach, the hovered one first,
// else the closest, preferring those ahead of the movement keys or the facing. Never at the
// air and never walking up: without an enemy that close it does nothing. AUTO_REACH: the
// wind-up's step-in still connects a little beyond blade reach. Mouse orders carry on.
const AUTO_REACH = 0.15;
const visible = e => clearLine(player.x, player.y + 0.4, player.z, e.x,
  Math.max(e.y + 0.1, Math.min(player.y + 0.4, e.y + e.profile.bodyHeight - 0.05)), e.z);
export function autoAttack() {
  const hovered = hoveredEnemy(), [dx, dz] = inputDir();
  const yaw = dx || dz ? Math.atan2(dx, dz) : player.yaw;
  const target = (hovered && softTarget(player, [hovered], yaw, visible, AUTO_REACH))
    || softTarget(player, allEnemies(), yaw, visible, AUTO_REACH);
  if (target) queueAttack(target);
  return target;
}
export const autoAttackHeld = () => !state.inventoryOpen && !state.transitioning && ATTACK.some(k => keys.has(k));
export const wantsWalk = () => WALK.some(k => keys.has(k));
addEventListener('pointerdown', e => {
  if (e.button !== 0 || e.target.tagName !== 'CANVAS' || state.transitioning || state.inventoryOpen) return;
  e.preventDefault();
  pointer.down = true;
  const enemy = hoveredEnemy();
  if (enemy) { pointer.mode = 'attack'; orderAttack(enemy); return; }
  const item = hoveredPickup();
  if (item) { pointer.mode = null; orderPickup(item); return; }
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
export function takeJump() { const j = controls.jumpPressed; controls.jumpPressed = false; return j; }
