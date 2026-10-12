// With ?dev=1: await (await import('/tests/browser/dev.js')).runDevPortalChecks()
// Resets to a fresh seed-3 run before and after testing.
import * as THREE from 'three';
import { player, state } from '../../src/game/state.js';
import { newWorld } from '../../src/game/flow.js';
import { startTravel, travelling, updateTravel } from '../../src/game/travel.js';
import { order, orderMove, orderAttack, clearMouseInput } from '../../src/game/orders.js';
import { pointer } from '../../src/game/pointer.js';
import { controls, clearInput } from '../../src/game/inputstate.js';
import { updatePlayer } from '../../src/game/update.js';
import { updateCamera } from '../../src/game/camera.js';
import { camera, renderer, scene } from '../../src/render/scene.js';
import { paused } from './combat.js';
import '../../src/game/dev.js';

const check = (condition, message) => { if (!condition) throw Error(message); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function finishTravel() {
  for (let i = 0; i < 200 && state.transitioning && !travelling(); i++) await delay(20);
  check(travelling(), 'Portal click must start travel');
  for (let i = 0; i < 180 && travelling(); i++) updateTravel(1 / 60);
  check(!state.transitioning, 'Travel must finish');
}
function inputCleared() {
  check(!order.kind && !order.path && !order.enemy && !pointer.down && pointer.mode === null,
    'Travel must discard old targets and held mouse input');
}
function remainsIdle() {
  const x = player.x, z = player.z;
  for (let i = 0; i < 120; i++) updatePlayer(1 / 60);
  inputCleared();
  check(Math.hypot(player.x - x, player.z - z) < 1e-8 && !player.sword.requested,
    'Arrival must not resume the old move/attack order');
}

export async function runDevPortalChecks() {
  check(state.dev, 'Open the game with ?dev=1');
  return paused(async () => {
    try {
      await newWorld(3); clearInput(); clearMouseInput();
      const portal = state.map.portals.find(p => p.kind === 'side');
      const fx = state.world.portalFx.find(f => f.obj.userData.portal === portal);
      updateCamera(1); camera.updateMatrixWorld(); scene.updateMatrixWorld(true);
      const point = new THREE.Vector3(0, .88, 0).applyMatrix4(fx.obj.matrixWorld).project(camera);
      const event = { clientX: (point.x + 1) / 2 * innerWidth, clientY: (1 - point.y) / 2 * innerHeight,
        button: 0, bubbles: true };
      const canvas = renderer.domElement;
      canvas.dispatchEvent(new PointerEvent('pointermove', event));
      canvas.dispatchEvent(new PointerEvent('pointerdown', event));
      check(order.kind === 'move' && pointer.down, 'Normal pointerdown must reproduce the queued movement');
      canvas.dispatchEvent(new MouseEvent('click', event));
      inputCleared();
      await finishTravel(); remainsIdle();
      canvas.dispatchEvent(new PointerEvent('pointerup', event));

      const back = state.map.portals.find(p => p.kind === 'side' && p.dir === (portal.dir ^ 1));
      orderAttack({ x: 8, y: 2, z: 8 }); pointer.down = true; pointer.mode = 'attack';
      controls.keys.add('KeyW');
      startTravel(back); inputCleared();
      check(controls.keys.has('KeyW'), 'Travel must preserve held keyboard movement');
      clearInput(); await finishTravel(); remainsIdle();

      orderMove({ x: 8, z: 8, s: null }); pointer.down = true; pointer.mode = 'move';
      dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyG' }));
      inputCleared();
      for (let i = 0; i < 200 && state.transitioning; i++) await delay(20);
      check(!state.transitioning, 'Dev relocation must finish');
      clearInput(); remainsIdle();
      return ['dev portal click cancels normal move input', 'held mouse / attack targets cleared while keyboard preserved', 'dev G relocation cancels old input'];
    } finally { clearInput(); clearMouseInput(); await newWorld(3); }
  });
}
