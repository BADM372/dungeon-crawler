// With ?dev=1: await (await import('/tests/browser/dev.js')).runDevPortalChecks()
//              await (await import('/tests/browser/dev.js')).runDevSpawnChecks()
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
import { spawnEnemies, killEnemies, clearEnemies } from '../../src/game/devspawn.js';
import { allEnemies, updateEnemies, drawEnemies, resetEnemies } from '../../src/game/enemies.js';
import { ENEMY_KINDS, enemyRoll } from '../../src/core/enemies.js';

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

// every kind spawns on a floor that fits it, at the depth's level or a chosen one; passive
// enemies stand still; kill all pays out (a guardian opens no gate); clear and resets remove them
export async function runDevSpawnChecks() {
  check(state.dev, 'Open the game with ?dev=1');
  return paused(async () => {
    const tick = n => { for (let i = 0; i < n; i++) { updatePlayer(1 / 60); updateEnemies(1 / 60); drawEnemies(1 / 60); } };
    try {
      await newWorld(3); clearInput(); clearMouseInput(); clearEnemies();
      const at = { x: player.x, y: player.y, z: player.z };
      for (const type of Object.keys(ENEMY_KINDS)) {
        const [e] = spawnEnemies(type, { at });
        check(e && e.type === type && e.level === enemyRoll(state.map, e.profile, e.f.id).level, 'Spawns at the depth level: ' + type);
        check(e.f && !e.f.fluid && e.id.startsWith('dev:') && !!e.guardian === !!ENEMY_KINDS[type].guardian && !e.guardianGate,
          'A dev spawn has a floor, its own id and no gate: ' + type);
        clearEnemies();
      }
      const pack = spawnEnemies('redback', { level: 9, n: 4, at });
      check(pack.length === 4 && pack.every(e => e.level === 9 && e.hp === e.profile.hp) && new Set(pack.map(e => e.id)).size === 4,
        'A chosen level and count');
      const guardian = spawnEnemies('guardianstunder', { at })[0];
      state.devPassive = true;
      tick(30);   // bodies spawned around the player push apart first
      const hp = player.hp, where = allEnemies().map(e => [e.x, e.z]);
      tick(120);
      const moved = Math.max(...allEnemies().map((e, i) => Math.hypot(e.x - where[i][0], e.z - where[i][1])));
      check(player.hp === hp && moved < 0.01 && allEnemies().every(e => e.mode === 'idle'),
        `Passive enemies stand still and never attack: moved ${moved}, hp ${hp} -> ${player.hp}, ${allEnemies().map(e => e.mode)}`);
      state.devPassive = false;
      const xp = player.xp, gates = state.run.unlockedGates.size;
      check(killEnemies() === 5, 'Kill all kills every living enemy');
      tick(1);
      check(player.xp > xp && state.run.unlockedGates.size === gates && guardian.mode === 'dead', 'Kill all pays XP; a dev guardian opens no gate');
      spawnEnemies('stunder', { n: 2, at }); tick(5);
      check(clearEnemies() === 7 && !allEnemies().length && !guardian.view, 'Clear removes enemies and corpses with their views');
      spawnEnemies('snake', { at }); resetEnemies();
      check(!allEnemies().some(e => e.id.startsWith('dev:')), 'A cube reset drops dev spawns');
      return ['all ' + Object.keys(ENEMY_KINDS).length + ' kinds spawn on fitting floors at the depth level', 'level / count overrides',
        'passive enemies hold still', 'kill all pays out without opening gates', 'clear and cube resets remove spawns'];
    } finally { state.devPassive = false; clearInput(); clearMouseInput(); await newWorld(3); }
  });
}
