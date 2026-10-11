// Keyboard and mouse wheel.
import { clamp } from '../core/util.js';
import { player, state, view, setStatus } from './state.js';
import { spawnEntry, nextCube } from './flow.js';

const keys = new Set();

addEventListener('keydown', e => {
  keys.add(e.code);
  if (e.code === 'KeyQ') view.yawTarget -= Math.PI / 2;
  if (e.code === 'KeyE') view.yawTarget += Math.PI / 2;
  if (e.code === 'KeyR') { spawnEntry(); setStatus('Respawned at entry'); }
  if (e.code === 'KeyN') nextCube(true);
  if (e.code === 'KeyP') { state.showPath = !state.showPath; if (state.world) state.world.pathLine.visible = state.showPath; }
  if (e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
addEventListener('wheel', e => { view.zoomTarget = clamp(view.zoomTarget * (e.deltaY > 0 ? 1.1 : 0.9), 0.35, 1.4); }, { passive: true });

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
