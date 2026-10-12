// In devtools: await (await import('./tests/browser/guardians.js')).runGuardianChecks()
// Real worker, models, gate charging, defender AI, death rollback and portal travel.
import { paused } from './combat.js';
import { state, player } from '../../src/game/state.js';
import { makeLayouts } from '../../src/world/layout.js';
import { createRun } from '../../src/core/progression.js';
import { GUARDIAN_KINDS, makeEnemy } from '../../src/core/enemies.js';
import { damageEnemy } from '../../src/core/combat.js';
import { gateLocked } from '../../src/core/guardians.js';
import { allEnemies, updateEnemies, drawEnemies } from '../../src/game/enemies.js';
import { enterCube, spawnAt, die } from '../../src/game/flow.js';
import { checkPortals } from '../../src/game/portals.js';
import { startTravel, travelling, updateTravel } from '../../src/game/travel.js';
import { animateEnemies, removeEnemyViews } from '../../src/render/enemies.js';
import { animateWorld } from '../../src/render/world.js';
import { renderer, scene, camera } from '../../src/render/scene.js';
import { propsReady } from '../../src/render/props.js';

const check = (value, message) => { if (!value) throw Error(message); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function runGuardianChecks() {
  await propsReady;
  return paused(async () => {
    const oldCube = state.cubes.cubes.get(state.cubeKey), hero = { ...player };
    const saved = Object.fromEntries(['run', 'arrival', 'visit', 'portalLock', 'portalCharge', 'boundaryLock', 'transitioning', 'inventoryOpen', 'fallFrom', 'statusMsg', 'statusUntil'].map(k => [k, state[k]]));
    const opened = new Set(state.openedFaces), key = makeLayouts(state.cubes.seed)(2).down;
    const c = await state.cubes.get(key), visits = c.visits, samples = [];
    try {
      state.run = createRun(); state.transitioning = state.inventoryOpen = false; state.fallFrom = null;
      const entry = c.map.portals.find(p => p.kind === 'side');
      enterCube(c, entry.dir);
      const map = state.map, down = map.portals.find(p => p.kind === 'down');
      let list = allEnemies(), guard = list.find(e => e.guardian);
      check(guard && list.length > 1, 'one guardian and defenders load from worker');
      const population = list.length;
      drawEnemies(0);
      check(guard.view?.bar.visible && guard.view.label.visible, 'guardian label and health bar always visible');
      const fx = state.world.portalFx.find(f => f.obj.userData.portal.id === down.id);
      const swirl = fx.obj.children.find(o => o.geometry?.type === 'CircleGeometry');
      check(swirl.material.color.getHexString() === 'ff3547', 'locked well shines red');
      spawnAt(down.x + .5, down.y, down.z + .5);
      state.portalLock = 0; state.portalCharge = null;
      check(!checkPortals(0, 0, 2) && !state.portalCharge, 'locked well cannot charge');
      startTravel(down);
      check(!state.transitioning && !travelling(), 'direct travel cannot bypass the guardian');
      const before = allEnemies().map(e => [e, e.x, e.z]);
      player.hp = player.maxHp = 10000; state.enemyGrace = 60;
      damageEnemy(guard, 1); updateEnemies(.3);
      check(allEnemies().filter(e => !e.guardian).every(e => e.defence.engage), 'attacking guardian rallies every defender');
      for (let i = 0; i < 20; i++) updateEnemies(.05);
      check(before.some(([e, x, z]) => !e.guardian && Math.hypot(e.x - x, e.z - z) > .2), 'defenders actually navigate towards the fight');
      damageEnemy(guard, guard.hp); updateEnemies(.001);
      check(!gateLocked(map, state.run), 'guardian death alone unlocks the well');
      for (let i = 0; i < 40; i++) animateWorld(state.world, 1 / 60, i / 60);
      check(swirl.material.color.getHexString() !== 'ff3547', 'well visibly changes colour on unlock');
      die();
      check(!allEnemies().some(e => e.guardian), 'guardian never respawns after death rollback');
      check(allEnemies().length === population - 1, 'ordinary defenders return on death');
      enterCube(c, entry.dir);
      check(!allEnemies().some(e => e.guardian) && !gateLocked(map, state.run), 'revisit keeps gate unlocked');
      state.run = createRun(); enterCube(c, entry.dir);
      guard = allEnemies().find(e => e.guardian);
      check(guard && gateLocked(map, state.run), 'new run restores guardian and seal');
      // Exercise every guardian model/material, not just this seed's selected species.
      for (const kind of Object.values(GUARDIAN_KINDS)) {
        const e = makeEnemy({ f: map.guardian.floor, x: map.guardian.x, y: map.guardian.y, z: map.guardian.z,
          level: 8, guardian: true, yaw: 0 }, kind);
        samples.push(e);
      }
      animateEnemies(samples, 0);
      check(samples.every(e => e.view?.label.visible), 'all seven guardian kinds have loaded models and labels');
      renderer.compile(scene, camera);
      removeEnemyViews(samples); samples.length = 0;
      damageEnemy(guard, guard.hp); updateEnemies(.001);
      spawnAt(down.x + .5, down.y, down.z + .5); state.portalLock = 0;
      check(checkPortals(0, 0, 2), 'unlocked well charges and initiates real travel');
      for (let i = 0; i < 100 && !travelling(); i++) await delay(50);
      check(travelling(), 'destination builds and travel starts');
      for (let i = 0; i < 30 && travelling(); i++) updateTravel(.1);
      check(state.cubeKey !== map.key && !state.transitioning, 'unlocked well reaches the next depth');
      return { guardianKinds: 7, population, deathPersistence: true, defenders: true, travelled: true };
    } finally {
      removeEnemyViews(samples);
      state.run = saved.run; state.openedFaces = opened; c.visits = visits;
      enterCube(oldCube, null, { arrival: saved.arrival, visit: saved.visit,
        portalLock: saved.portalLock, boundaryLock: saved.boundaryLock });
      Object.assign(state, saved); Object.assign(player, hero);
    }
  });
}
