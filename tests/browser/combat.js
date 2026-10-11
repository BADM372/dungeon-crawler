// Browser integration checks: run from index.html's devtools (see docs/combat.md).
// Uses the real controller, input handlers, enemy AI, GLTFLoader, skeletons and
// animation mixers on a controlled floor grid. Restores the live level afterward.
import * as THREE from 'three';
import { N, DIRS } from '../../src/core/constants.js';
import { player, state } from '../../src/game/state.js';
import { SWORD, cancelSwing, startSwing, damageEnemy } from '../../src/core/combat.js';
import { createPlayerStats, createRun } from '../../src/core/progression.js';
import { resetEnemies, allEnemies, updateEnemies, drawEnemies } from '../../src/game/enemies.js';
import { spiders } from '../../src/game/spiders.js';
import { stunders } from '../../src/game/stunders.js';
import { snakes } from '../../src/game/snakes.js';
import { octonauts } from '../../src/game/octonauts.js';
import { fireFaces } from '../../src/game/firefaces.js';
import { triangles } from '../../src/game/triangles.js';
import { fireCats } from '../../src/game/firecats.js';
import { projectiles, clearProjectiles } from '../../src/game/projectiles.js';
import { SNAKE, OCTONAUT, FIREFACE, TRIANGLE, FIRECAT, makeEnemy } from '../../src/core/enemies.js';
import { updatePlayer } from '../../src/game/update.js';
import { climb } from '../../src/physics/climb.js';
import { W, resetMode } from '../../src/render/blendtree.js';
import { character, equipSword, loadSword } from '../../src/render/character.js';
import { animateCharacter } from '../../src/render/animator.js';
import { scene } from '../../src/render/scene.js';
import { stunderModel } from '../../src/render/stundermodel.js';
import { spiderModel } from '../../src/render/spidermodel.js';
import { snakeModel } from '../../src/render/snakemodel.js';
import { octonautModel } from '../../src/render/octonautmodel.js';
import { fireFaceModel } from '../../src/render/firefacemodel.js';
import { triangleModel } from '../../src/render/trianglemodel.js';
import { fireCatModel } from '../../src/render/firecatmodel.js';
import { tickBurning, burningLit } from '../../src/render/burning.js';
import { startTravel, travelling, updateTravel, drawTravelEnemies } from '../../src/game/travel.js';
import { camera } from '../../src/render/scene.js';
import { updatePointer, hoveredEnemy } from '../../src/game/pointer.js';

const check = (condition, message) => { if (!condition) throw Error(message); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function paused(fn) {
  const raf = window.requestAnimationFrame, cancel = window.cancelAnimationFrame;
  const pending = new Map(); let id = 0;
  window.requestAnimationFrame = callback => { pending.set(--id, callback); return id; };
  window.cancelAnimationFrame = token => { if (token < 0) pending.delete(token); else cancel.call(window, token); };
  try { await delay(150); return await fn(); }
  finally {
    window.requestAnimationFrame = raf; window.cancelAnimationFrame = cancel;
    // Fade/flash callbacks must not overwrite the queued main frame and stop the game.
    for (const callback of pending.values()) raf.call(window, callback);
  }
}
function arena() {
  const floors = Array.from({ length: N * N }, (_, c) => ({ c, id: c, x: c % N, z: Math.floor(c / N),
    top: 0, bottom: -2, layer: 0, cs: [0, 0, 0, 0], split: 0, link: [] }));
  for (const f of floors) f.link = DIRS.map(([dx, dz]) => {
    const x = f.x + dx, z = f.z + dz;
    return x >= 0 && z >= 0 && x < N && z < N ? floors[z * N + x] : null;
  });
  return { seed: 123, K: 1, B: [0], floors, cols: floors.map(f => [f]), pieces: floors.map(() => []),
    blockers: floors.map(() => []), fences: new Map(), portals: [], ladders: [], falls: [] };
}
const at = (x, z) => state.map.floors[Math.floor(z) * N + Math.floor(x)];
function place(e, x, z) {
  Object.assign(e, { x, y: 0, z, yaw: Math.PI, f: at(x, z), home: at(x, z), path: null,
    mode: 'idle', t: 1e6, think: 1e6, cool: 0, stun: 0, speed: 0 });
}
function hero() {
  cancelSwing(player, true);
  Object.assign(player, { x: 6.5, y: 0, visY: 0, z: 6.5, yaw: 0, vx: 0, vy: 0, vz: 0,
    ...createPlayerStats(), grounded: true, swimming: false, climb: null, ragdoll: null, stun: 0, burning: null,
    support: at(6.5, 6.5), safe: { x: 6.5, y: 0, z: 6.5 }, coyote: 0, jumpBuf: 0 });
}
function press(code) {
  dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
  dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
}
function tick(n, freeze = true) {
  let maxY = player.y;
  for (let i = 0; i < n; i++) {
    if (freeze) for (const e of allEnemies()) if (e.mode !== 'dead') {
      e.mode = 'idle'; e.think = e.t = 1e6;
    }
    updatePlayer(1 / 60); updateEnemies(1 / 60);
    player.visY = player.y;
    animateCharacter(1 / 60, i / 60); drawEnemies(1 / 60);
    maxY = Math.max(maxY, player.y);
  }
  scene.updateMatrixWorld(true);
  return maxY;
}
// hover the cursor over enemy e and click it once (a real pointer event sequence)
function clickOn(e) {
  const canvas = document.querySelector('canvas');
  scene.updateMatrixWorld(true); camera.updateMatrixWorld();
  const v = new THREE.Vector3(e.x, e.y + e.profile.bodyHeight / 2, e.z).project(camera);
  const at = { clientX: (v.x + 1) / 2 * innerWidth, clientY: (1 - v.y) / 2 * innerHeight, button: 0, bubbles: true };
  canvas.dispatchEvent(new PointerEvent('pointermove', at)); updatePointer();
  check(hoveredEnemy() === e, 'The cursor must hover the enemy');
  canvas.dispatchEvent(new PointerEvent('pointerdown', at));
  dispatchEvent(new PointerEvent('pointerup', at));
  canvas.dispatchEvent(new PointerEvent('pointerleave', at)); updatePointer();
}
function bones(e) {
  const out = [];
  e.view.model.traverse(o => { if (o.isBone) out.push(...o.position.toArray(), ...o.quaternion.toArray()); });
  return out;
}
function minimumY(model) {
  scene.updateMatrixWorld(true);
  const v = new THREE.Vector3(); let min = Infinity;
  model.traverse(o => {
    if (!o.isMesh) return;
    for (let i = 0; i < o.geometry.attributes.position.count; i++) {
      o.getVertexPosition(i, v).applyMatrix4(o.matrixWorld); min = Math.min(min, v.y);
    }
  });
  return min;
}

export async function runCombatChecks() {
  check(character.ready && character.sword && spiderModel.ready && stunderModel.ready, 'Wait for all character / weapon assets to load');
  check(!state.transitioning && !state.inventoryOpen, 'Close inventory and wait for portal travel to finish');
  return paused(async () => {
    const originalMap = state.map, saved = { ...player }, savedRun = state.run, savedWeapon = character.sword, results = [];
    try {
      state.run = createRun();
      state.map = arena(); resetEnemies(); hero(); await loadSword();
      for (const [i, e] of allEnemies().entries()) place(e, 2.5 + i * 0.03, 2.5);
      check(spiders.length > 0 && stunders.length === 2, 'Fixture must provide both species');
      const spider = spiders[0], stunder = stunders[0];
      resetMode(); tick(180); // settle any prior landing/sit/get-up blend on the test floor
      const swordBottom = minimumY(character.sword);
      check(character.sword.parent === character.bones['hand.R'] && swordBottom >= -0.002, 'Separate sword must be mounted on hand.R and off the floor: ' + swordBottom);
      check(stunders[0].view.model.getObjectByName('head') !== stunders[1].view.model.getObjectByName('head'), 'Instances must own independent bones');
      results.push('loaded sword / independent enemy skeletons');

      place(spider, 6.5, 6.5); press('Space');
      const maxY = tick(120);
      check(maxY > 0.5 && spider.hp === 30 && spider.mode !== 'dead', 'A real jump / landing must not stomp-kill');
      results.push('Space jump does not damage enemies');

      hero(); place(spider, 6.5, 7.25); press('KeyF'); tick(75);
      check(spider.hp === 0 && spider.mode === 'dead', 'F must slash-kill a spider');
      check(spider.view.actions.death.getEffectiveWeight() === 1, 'SpiderDeath must play instead of squash / hide');
      for (const time of [0.3, 0.7, 1.2, 1.9]) {
        spider.deadT = time; drawEnemies(1 / 60);
        check(minimumY(spider.view.model) >= -0.003, 'Spider death penetrates the floor at ' + time);
      }
      const held = bones(spider);
      spider.deadT = 2.4; drawEnemies(1 / 60);
      check(bones(spider).every((v, i) => Math.abs(v - held[i]) < 1e-5), 'Spider corpse must hold its final pose');
      results.push('F slash / SpiderDeath floor contact and held corpse');

      hero(); place(stunder, 6.5, 7.4);
      for (let i = 0; i < 4; i++) {
        if (i === 0) clickOn(stunder);
        else press('KeyF');
        tick(75);
        check(stunder.hp === 90 - i * 30, 'Stunder should take exactly one hit per swing');
      }
      check(stunder.mode === 'dead' && stunder.view.actions.death.getEffectiveWeight() === 1, 'Stunder must play its real death clip');
      results.push('click on enemy attacks it / Stunder survives 3 hits, dies on 4');

      tick(260);
      check(!allEnemies().includes(spider) && !allEnemies().includes(stunder), 'Finished corpses must leave the population');
      check(!spider.view && !stunder.view, 'Corpse mixers / materials / skeletons must be disposed');
      results.push('corpse view and population cleanup');

      state.run = createRun(); resetEnemies(); hero();
      for (const [i, e] of allEnemies().entries()) place(e, 2.5 + i * 0.03, 2.5);
      const heavy = stunders[0]; place(heavy, 6.5, 7.5);
      Object.assign(heavy, { mode: 'attack', t: 0, bit: false, attacks: 1, think: 1e6 });
      for (let i = 0; i < 33; i++) { updateEnemies(1 / 60); drawEnemies(1 / 60); }
      check(player.hp === 70 && player.ragdoll, 'Level-1 Stunder ram must deal 30 damage and knock down');
      const sourceHead = stunderModel.source.getObjectByName('head'), head = heavy.view.model.getObjectByName('head');
      scene.updateMatrixWorld(true);
      const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(sourceHead.getWorldQuaternion(new THREE.Quaternion()).invert())
        .applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion()));
      check(forward.y < -0.85, 'Stunder ram must strike head-down');
      results.push('30-damage knockdown synced with head-down animation');

      hero(); place(heavy, 6.5, 7.4);
      Object.assign(heavy, { mode: 'attack', t: 0.5, bit: false, attacks: 2, think: 1e6 });
      startSwing(player); player.sword.t = SWORD.activeStart;
      updateEnemies(1 / 60);
      check(player.hp === 100 && heavy.hp === 90 && heavy.mode !== 'attack', 'Connecting sword must interrupt the wind-up');
      results.push('sword interrupts enemy attack');
      return results;
    } finally {
      state.map = originalMap; state.run = savedRun;
      Object.assign(player, saved); cancelSwing(player, true); equipSword(savedWeapon);
      resetEnemies();
    }
  });
}

// Snake bite, Octonaut slap and spin kick: real AI timers, damage, reach / arc and the
// matching GLB clip for each attack.
export async function runNewEnemyChecks() {
  check(snakeModel.ready && octonautModel.ready, 'Wait for the snake / Octonaut assets to load');
  return paused(async () => {
    const originalMap = state.map, saved = { ...player }, savedRun = state.run, results = [];
    const strike = (e, attack, steps, t = 0) => {
      Object.assign(e, { mode: 'attack', t, bit: false, attacks: e.attacks + 1, attack, think: 1e6 });
      for (let i = 0; i < steps; i++) { updateEnemies(1 / 60); drawEnemies(1 / 60); }
    };
    try {
      state.run = createRun(); state.map = arena(); resetEnemies();
      for (const e of allEnemies()) place(e, 2.5, 2.5);
      const snake = makeEnemy({ f: at(6.5, 7.4), x: 6.5, y: 0, z: 7.4, yaw: Math.PI }, SNAKE);
      const octo = makeEnemy({ f: at(6.5, 7.5), x: 6.5, y: 0, z: 7.5, yaw: Math.PI }, OCTONAUT);
      snakes.push(snake); octonauts.push(octo);
      place(octo, 12.5, 12.5); hero(); place(snake, 6.5, 7.4);
      strike(snake, 0, 30);
      check(player.hp === 100 - SNAKE.damage && !player.ragdoll, 'A snake bite is a 16-damage flinch: ' + player.hp);
      check(snake.view.actions.attack.getEffectiveWeight() > 0.99, 'SnakeAttack must play during the bite');
      place(snake, 12.5, 2.5);
      results.push('snake bite: damage, flinch, SnakeAttack');

      hero(); place(octo, 6.5, 7.5);
      strike(octo, 0, 30);
      check(player.hp === 100 - OCTONAUT.damage && !player.ragdoll, 'Slap must deal 20 without knocking down: ' + player.hp);
      check(octo.view.actions.slap.getEffectiveWeight() > 0.99 && octo.view.actions.spin.getEffectiveWeight() < 0.01, 'OctoSlap must play');
      hero(); place(octo, 6.5, 5.5); octo.yaw = Math.PI;   // player behind it, after the wind-up stopped tracking
      strike(octo, 0, 30, OCTONAUT.attacks[0].trackUntil);
      check(player.hp === 100, 'A slap must not reach behind the Octonaut');
      hero(); place(octo, 6.5, 5.4); octo.yaw = Math.PI;
      strike(octo, 1, 40, OCTONAUT.attacks[1].trackUntil);
      check(player.hp === 100 - Math.round(OCTONAUT.damage * 1.4) && player.ragdoll, 'Spin kick must hit all around and knock down: ' + player.hp);
      check(octo.view.actions.spin.getEffectiveWeight() > 0.99, 'OctoSpin must play');
      results.push('Octonaut slap (frontal) / spin kick (all around, knockdown) with matching clips');

      hero(); place(octo, 6.5, 7.5); place(snake, 8.5, 6.5);
      damageEnemy(octo, octo.hp); damageEnemy(snake, snake.hp); updateEnemies(1 / 60); drawEnemies(1 / 60);
      check(octo.view.actions.death.getEffectiveWeight() === 1 && snake.view.actions.death.getEffectiveWeight() === 1, 'Death clips must play');
      for (const time of [0.4, 1, 1.6, 2.1]) {
        octo.deadT = snake.deadT = time; drawEnemies(1 / 60);
        check(minimumY(octo.view.model) >= -0.003 && minimumY(snake.view.model) >= -0.003, 'Corpses must stay above the floor at ' + time);
      }
      results.push('death clips stay on the floor');
      return results;
    } finally {
      state.map = originalMap; state.run = savedRun;
      Object.assign(player, saved); cancelSwing(player, true);
      resetEnemies();
    }
  });
}

// Fire-face fireball (and burning), Triangle punch (knockdown, dodging, walls), Fire-cat
// chase and pounce: real AI timers, projectiles flying over the level, the matching clips,
// glow lights, and corpses.
export async function runFireChecks() {
  check(fireFaceModel.ready && triangleModel.ready && fireCatModel.ready, 'Wait for the Fire-face / Triangle / Fire-cat assets to load');
  return paused(async () => {
    const originalMap = state.map, saved = { ...player }, savedRun = state.run, results = [];
    const run = (n, each) => { for (let i = 0; i < n; i++) { updateEnemies(1 / 60); drawEnemies(1 / 60); tickBurning(1 / 60); if (each?.(i)) return i; } return n; };
    const attack = (e, t = 0) => Object.assign(e, { mode: 'attack', t, bit: false, attacks: e.attacks + 1, attack: 0, think: 1e6, leap: 0 });
    const muzzle = (e, [mx, my, mz]) => new THREE.Vector3(e.x + mx * Math.cos(e.yaw) + mz * Math.sin(e.yaw), e.y + my, e.z - mx * Math.sin(e.yaw) + mz * Math.cos(e.yaw));
    const wall = on => { for (let x = 4; x < 9; x++) state.map.blockers[8 * N + x] = on ? [{ shape: 'box', x0: 4, x1: 9, z0: 8.4, z1: 8.6, bottom: -1, top: 3 }] : []; };
    try {
      state.run = createRun(); state.map = arena(); resetEnemies();
      for (const e of allEnemies()) place(e, 2.5, 2.5);   // the arena's own population waits in a corner
      const ff = makeEnemy({ f: at(6.5, 10.5), x: 6.5, y: 0, z: 10.5, yaw: Math.PI }, FIREFACE);
      const tri = makeEnemy({ f: at(6.5, 10), x: 6.5, y: 0, z: 10, yaw: Math.PI }, TRIANGLE);
      const cat = makeEnemy({ f: at(6.5, 8.5), x: 6.5, y: 0, z: 8.5, yaw: Math.PI }, FIRECAT);
      fireFaces.push(ff); triangles.push(tri); fireCats.push(cat);
      place(tri, 13.5, 2.5); place(cat, 13.5, 13.5); place(ff, 6.5, 10.5); hero();
      drawEnemies(1 / 60);
      const walkTime = ff.view.actions.walk.time;
      drawEnemies(0.25);
      check(ff.view.actions.walk.time !== walkTime && ff.speed === 0, 'A hovering Fire-face keeps its loop running while idle');
      check(ff.view.light.intensity > 2 && tri.view.light.intensity > 1 && cat.view.light.intensity > 0.5, 'Fire and the Triangle must light their surroundings');
      check(ff.view.flames.length >= 12 && cat.view.flames.length >= 9, 'Flame bones must be found for the flicker');

      // the ball in the clip sits where the thrown fireball starts
      attack(ff, FIREFACE.hitAt - 1 / 30);
      for (let i = 0; i < 40; i++) drawEnemies(1 / 60);
      scene.updateMatrixWorld(true);
      const ball = ff.view.model.getObjectByName('charge').getWorldPosition(new THREE.Vector3());
      check(ball.distanceTo(muzzle(ff, FIREFACE.projectile.muzzle)) < 0.05, 'FireAttack ball must leave from the muzzle: ' + ball.distanceTo(muzzle(ff, FIREFACE.projectile.muzzle)));
      place(ff, 6.5, 10.5); attack(ff);
      run(Math.ceil(FIREFACE.hitAt * 60));
      check(ff.view.actions.attack.getEffectiveWeight() > 0.99, 'FireAttack must play');
      check(projectiles.length === 1 && projectiles[0].kind === 'fireball' && projectiles[0].view, 'The Fire-face must spit one fireball');
      const fired = run(90, () => player.hp < 100);
      check(player.hp === 100 - FIREFACE.damage && !player.ragdoll && player.burning && burningLit(), 'A fireball deals 22 and sets the player on fire: ' + player.hp);
      check(!projectiles.length, 'The fireball must burst on the player');
      const burnt = run(60, () => !player.burning);
      check(player.hp === 100 - FIREFACE.damage - FIREFACE.projectile.burn.damage && Math.abs(burnt / 60 - 0.5) < 0.05,
        'Burning lasts half a second and deals its damage: ' + player.hp + ' after ' + burnt / 60);
      results.push(`fireball: from the muzzle, hit after ${(fired / 60).toFixed(2)}s, 22 + 6 burn over 0.5s`);

      hero(); place(ff, 6.5, 10.5); wall(true);
      attack(ff); run(120);
      check(player.hp === 100 && !projectiles.length, 'A wall must stop a fireball');
      place(ff, 6.5, 10.5); Object.assign(ff, { mode: 'chase', path: [ff.f], cool: 0 });
      run(40);
      check(ff.mode === 'chase' && ff.attacks === 3, 'No clear shot, no throw');
      wall(false); place(ff, 6.5, 10.5); Object.assign(ff, { mode: 'chase', path: [ff.f], cool: 0 });
      run(40);
      check(ff.mode === 'attack', 'With a clear shot in reach it throws by itself');
      place(ff, 13.5, 6.5); clearProjectiles();
      results.push('walls stop fireballs and block the shot; a clear line starts one');

      hero(); place(tri, 6.5, 10); attack(tri);
      run(Math.ceil(TRIANGLE.hitAt * 60) + 1);
      check(tri.view.actions.attack.getEffectiveWeight() > 0.99 && projectiles.length === 1 && projectiles[0].kind === 'punch', 'TriPunch must throw its inner triangles');
      check(tri.view.model.getObjectByName('ring').scale.x < 0.1, 'The thrown triangles must leave the frame');
      run(60, () => player.ragdoll);
      check(player.hp === 100 - TRIANGLE.damage && player.ragdoll, 'A Triangle punch deals 28 and knocks down: ' + player.hp);
      hero(); place(tri, 6.5, 10); attack(tri);
      run(Math.ceil(TRIANGLE.trackUntil * 60) + 2);
      player.x = 8.2;   // step aside after it stopped aiming
      run(90);
      check(player.hp === 100 && !projectiles.length, 'Stepping aside after the wind-up dodges the punch');
      check(tri.view.model.getObjectByName('ring').scale.x > 0.9, 'New inner triangles grow back');
      place(tri, 13.5, 2.5);
      results.push('Triangle punch: knockdown, dodgeable after it stops aiming, triangles regrow');

      hero(); place(cat, 6.5, 8.5); attack(cat);
      run(Math.ceil(FIRECAT.hitAt * 60) + 2);
      check(Math.abs(cat.z - (6.5 + FIRECAT.lunge.stop)) < 0.06, 'The pounce must land lunge.stop short of the player: ' + cat.z);
      check(cat.view.actions.attack.getEffectiveWeight() > 0.99, 'CatPounce must play');
      check(player.hp === 100 - FIRECAT.damage && !player.ragdoll && !player.burning, 'A Fire-cat bite deals 26, no knockdown, no burn: ' + player.hp);
      hero(); place(cat, 6.5, 13.5); Object.assign(cat, { mode: 'chase', think: 0 });
      let fastest = 0, runWeight = 0;
      run(240, () => { fastest = Math.max(fastest, cat.speed); runWeight = Math.max(runWeight, cat.view.actions.fast.getEffectiveWeight()); return cat.mode === 'attack'; });
      check(cat.mode === 'attack' && fastest > FIRECAT.chase * 0.9 && runWeight > 0.9, `The cat must run in (CatRun) and pounce: ${fastest} ${runWeight}`);
      const from = cat.z;
      run(80, () => player.hp < 100);
      check(player.hp === 100 - FIRECAT.damage && from - cat.z > 0.9, 'The real chase ends in a leap and a bite: ' + (from - cat.z));
      results.push('Fire-cat: runs at chase speed with CatRun, pounces lunge.stop short and bites');

      hero(); place(ff, 6.5, 9.5); place(tri, 4.5, 9.5); place(cat, 8.5, 9.5);
      for (const e of [ff, tri, cat]) damageEnemy(e, e.hp);
      run(1);
      check([ff, tri, cat].every(e => e.view.actions.death.getEffectiveWeight() === 1), 'Death clips must play');
      for (const time of [0.5, 1.2, 1.9, 2.4]) {
        for (const e of [ff, tri, cat]) e.deadT = time;
        drawEnemies(1 / 60);
        for (const e of [ff, tri, cat]) check(minimumY(e.view.model) >= -0.003, e.type + ' corpse below the floor at ' + time);
      }
      check(ff.view.light.intensity === 0 && tri.view.light.intensity === 0, 'The glow must die with them');
      run(Math.ceil(FIRECAT.corpseTime * 60) + 60);
      check(![ff, tri, cat].some(e => allEnemies().includes(e) || e.view), 'Corpses must leave and release their views');
      results.push('death clips on the floor, the glow dies, views released');
      return results;
    } finally {
      state.map = originalMap; state.run = savedRun;
      Object.assign(player, saved); cancelSwing(player, true);
      resetEnemies(); tickBurning(1);
    }
  });
}

// Real ladder controller, exported Climb action and blend tree (no keyboard timing).
export async function runClimbChecks() {
  check(character.ready && character.sword, 'Wait for the player and separate weapon assets to load');
  return paused(async () => {
    const originalMap = state.map, saved = { ...player }, weapon = character.sword, results = [];
    let time = 0;
    const step = (dx = 0, dz = 0, jump = false) => {
      climb(1 / 60, dx, dz, jump); player.visY = player.y;
      animateCharacter(1 / 60, time += 1 / 60);
    };
    const pose = () => Object.values(character.bones).flatMap(b => [...b.position.toArray(), ...b.quaternion.toArray()]);
    const samePose = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-5);
    try {
      state.map = arena(); hero(); resetMode();
      const l = { x: 6, z: 6, d: 2, y0: 0, y1: 4, layer: 0 };
      state.map.ladders = [l];
      Object.assign(at(6.5, 7.5), { top: 8, cs: [4, 4, 4, 4] });   // top is in levels, corners in game units
      player.z = 6.74;
      for (let i = 0; i < 40; i++) step(0, 1);
      check(player.climb && W.climb > 0.99 && W.walk < 0.01, 'Ladder must use Climb, not Walk');
      check(!character.sword.visible, 'Climbing needs both hands free');
      results.push('ladder grab selects exported Climb and hides sword');

      for (let i = 0; i < 90; i++) step();
      const held = pose(), phase = character.actions.climb.time, y = player.y;
      for (let i = 0; i < 30; i++) step();
      check(player.y === y && character.actions.climb.time === phase && samePose(held, pose()), 'Idle on ladder must hold the same grip');
      results.push('stationary ladder grip freezes pose');

      step(0, 1); const forward = pose();
      step(0, -1);
      check(Math.abs(character.actions.climb.time - phase) < 1e-8 && samePose(held, pose()), 'Descent must reverse the same cycle');
      check(!samePose(held, forward), 'Ascent must animate hands and feet');
      results.push('ascent advances / descent reverses distance-driven phase');

      step(0, 0, true);
      check(!player.climb && !player.grounded && player.vy > 0 && character.sword.visible, 'Jump-off must release ladder and restore sword');
      for (let i = 0; i < 40; i++) animateCharacter(1 / 60, time += 1 / 60);
      check(W.fall > 0.99 && W.climb < 0.01, 'Jump-off must blend to airborne animation');
      results.push('jump-off blends to falling and restores sword');

      // Both exits must leave the climb mode (including after reverse phase wrap).
      Object.assign(player, { climb: { l, side: 0 }, y: l.y1 - 0.01, grounded: true, vy: 0 });
      step(0, 1);
      check(!player.climb && player.y === l.y1, 'Top exit must stand on the upper floor');
      for (let i = 0; i < 90; i++) animateCharacter(1 / 60, time += 1 / 60);
      check(W.idle > 0.99 && W.climb < 0.01, 'Top exit must return to locomotion');
      Object.assign(player, { climb: { l, side: 0 }, y: 0.01 });
      step(0, -1);
      check(!player.climb && player.y === 0, 'Bottom exit must return to ground');
      results.push('top and bottom exits return to grounded animation');

      for (let d = 0; d < DIRS.length; d++) {
        l.d = d; Object.assign(player, { climb: { l, side: 0 }, y: 2, climbV: 0 });
        for (let i = 0; i < 90; i++) step();
        const [dx, dz] = DIRS[d];
        check(Math.abs(Math.sin(player.yaw) - dx) < 1e-5 && Math.abs(Math.cos(player.yaw) - dz) < 1e-5, 'Climber must face wall in direction ' + d);
      }
      results.push('faces the wall in all four ladder orientations');
      equipSword(null); step();
      check(!character.sword && !weapon.parent && W.climb > 0.99, 'Unarmed character must climb without any weapon');
      equipSword(weapon); step();
      check(weapon.parent === character.bones['hand.R'] && !weapon.visible, 'Dynamically re-equipped sword must stay hidden while climbing');
      results.push('unarmed climbing / dynamic weapon attachment');
      return results;
    } finally {
      equipSword(weapon);
      state.map = originalMap; Object.assign(player, saved); resetMode();
      animateCharacter(1 / 60, time);
    }
  });
}

// Uses a real generated neighbour, not the fixture. Leaves you in that cube.
export async function runTravelCheck() {
  check(!state.transitioning, 'Wait for current travel to finish');
  return paused(async () => {
    drawEnemies(1 / 60);
    const old = allEnemies(), portal = state.map.portals.find(p => p.kind !== 'spawn');
    check(portal, 'Need an exit portal');
    if (old[0]) { damageEnemy(old[0], old[0].hp); updateEnemies(1 / 60); } // reward + cleanup include a dead enemy too
    player.sword.requested = true;
    startTravel(portal);
    for (let i = 0; i < 100 && !travelling(); i++) await delay(30);
    check(travelling(), 'Travel did not start');
    for (let i = 0; i < 180 && travelling(); i++) { updateTravel(1 / 60); drawTravelEnemies(1 / 60); }
    check(!state.transitioning && !travelling(), 'Travel did not finish');
    check(old.every(e => !e.view), 'Old live / dead enemy views leaked across portal');
    check(stunders.length <= 2, 'Next cube exceeded Stunder cap');
    check(!player.sword.active && !player.sword.requested, 'Queued sword input crossed the portal');
    return { cube: state.cubeKey, stunders: stunders.length, oldEnemiesDisposed: old.length };
  });
}
