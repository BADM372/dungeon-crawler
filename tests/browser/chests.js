// In devtools: await (await import('./tests/browser/chests.js')).runChestChecks()
// Real worker cube with a reward site: hover and click its chest, the lid's Open clip, the spilled
// loot, deaths and rebuilds; then drinking a health potion from the quick bar.
import * as THREE from 'three';
import { paused } from './combat.js';
import { state, player } from '../../src/game/state.js';
import { createRun, createPlayerStats } from '../../src/core/progression.js';
import { chestLoot } from '../../src/core/chests.js';
import { HEALTH_POTION } from '../../src/core/items.js';
import { barEntry, copperTotal } from '../../src/core/inventory.js';
import { enterCube, spawnAt, hurt } from '../../src/game/flow.js';
import { lootHere, updateLoot } from '../../src/game/loot.js';
import { updateLootLabels, hoveredChest } from '../../src/game/lootlabels.js';
import { updatePointer } from '../../src/game/pointer.js';
import { order } from '../../src/game/orders.js';
import { propsReady } from '../../src/render/props.js';
import { chestAt, tickChests } from '../../src/render/chests.js';
import { camera, scene } from '../../src/render/scene.js';

const check = (value, message) => { if (!value) throw Error(message); };
// the angle of a site's chest lid about its hinge (degrees; 0 closed, about -108 open)
const lidAngle = id => {
  const lid = chestAt(state.world, id)?.getObjectByName('treasure_chest_lid');
  return lid ? THREE.MathUtils.radToDeg(new THREE.Euler().setFromQuaternion(lid.quaternion).x) : NaN;
};
const closed = id => Math.abs(lidAngle(id)) < 0.5, open = id => Math.abs(lidAngle(id) + 108) < 0.5;

export async function runChestChecks() {
  await propsReady;
  return paused(async () => {
    const saved = Object.fromEntries(['run', 'arrival', 'visit', 'portalLock', 'portalCharge', 'boundaryLock', 'transitioning', 'inventoryOpen',
      'fallFrom', 'enemyGrace', 'devPassive'].map(k => [k, state[k]]));
    const hero = { ...player }, oldCube = state.cubes.cubes.get(state.cubeKey), opened = new Set(state.openedFaces), results = [];
    let key = null;
    for (let d = 1; d <= 6 && !key; d++) for (const k of state.cubes.layout(d).sitePlans.keys()) {
      const c = await state.cubes.get(k);
      if (c.map.rewardSites.length) { key = k; break; }
    }
    check(key, 'a cube with a reward site');
    const c = await state.cubes.get(key), entry = c.map.portals.find(p => p.kind !== 'spawn'), visits = c.visits;
    try {
      state.run = createRun(); state.transitioning = state.inventoryOpen = false; state.fallFrom = null; state.devPassive = true;
      Object.assign(player, createPlayerStats());
      enterCube(c, entry.dir);
      const site = state.map.rewardSites[0], a = site.anchor;
      check(closed(site.id), 'the chest stands closed');

      // hover it and click it from in front of it
      spawnAt(site.approach.x, site.approach.y, site.approach.z);
      scene.updateMatrixWorld(true); camera.updateMatrixWorld();
      const off = state.world.group.position, v = new THREE.Vector3(a.x + off.x, a.y + off.y + 0.75, a.z + off.z).project(camera);
      const at = { clientX: (v.x + 1) / 2 * innerWidth, clientY: (1 - v.y) / 2 * innerHeight, button: 0, bubbles: true };
      const canvas = document.querySelector('canvas');
      canvas.dispatchEvent(new PointerEvent('pointermove', at)); updatePointer(); updateLootLabels();
      check(hoveredChest() === site, 'the cursor hovers the chest');
      check([...document.querySelectorAll('.loot-label.hovered')].some(l => l.textContent === 'Treasure chest'), 'a hovered chest has a label');
      canvas.dispatchEvent(new PointerEvent('pointerdown', at)); dispatchEvent(new PointerEvent('pointerup', at));
      canvas.dispatchEvent(new PointerEvent('pointerleave', at)); updatePointer();
      check(state.run.chests.has(site.id) && !order.kind, 'clicking a chest in reach opens it');
      const copper = copperTotal(player.inventory);
      check(closed(site.id), 'the lid starts from closed');
      const angles = [];
      for (let i = 0; i < 30; i++) { tickChests(1 / 30); angles.push(lidAngle(site.id)); }
      check(Math.min(...angles) < -110 && open(site.id), 'the lid swings past its stop and settles open');
      updateLootLabels();
      check(hoveredChest() === null, 'an open chest is no longer hovered');
      results.push('hover / label / click opens / Open clip');

      for (let i = 0; i < 90; i++) updateLoot(1 / 60, i / 60);
      const want = chestLoot(site, state.map.depth, state.map.seed), here = lootHere().filter(p => p.kept);
      const names = list => list.filter(i => i.gen).map(i => i.gen.name).sort().join();
      check(names(here) === names(want.items) && here.every(p => p.toss === 1), 'the chest spills its seeded weapons');
      check(copperTotal(player.inventory) === copper + want.copper, 'and coins (the magnet takes them in front of the chest)');
      hurt(player.hp, 'Test death');
      check(state.run.chests.has(site.id) && names(lootHere().filter(p => p.kept)) === names(want.items), 'a death neither closes the chest nor takes its loot');
      enterCube(c, entry.dir);
      check(open(site.id), 'a rebuilt cube shows the chest open');
      results.push('seeded loot / kept through death / open after a rebuild');

      // a potion from the quick bar
      const potions = () => barEntry(player.inventory, 1)?.count ?? 0, n = potions();
      check(barEntry(player.inventory, 1)?.itemId === HEALTH_POTION.id && n > 0, 'potions on quick bar slot 2');
      player.hp = 50; player.drankAt = -Infinity;
      dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2', bubbles: true })); dispatchEvent(new KeyboardEvent('keyup', { code: 'Digit2', bubbles: true }));
      check(player.hp === Math.min(player.maxHp, 50 + HEALTH_POTION.heal * player.maxHp) && potions() === n - 1, 'key 2 drinks a potion');
      dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2', bubbles: true })); dispatchEvent(new KeyboardEvent('keyup', { code: 'Digit2', bubbles: true }));
      check(potions() === n - 1, 'one drink at a time');
      results.push('quick bar potion / cooldown');
      return results;
    } finally {
      state.run = saved.run; state.openedFaces = opened; c.visits = visits;
      enterCube(oldCube, null, { arrival: saved.arrival, visit: saved.visit, portalLock: saved.portalLock, boundaryLock: saved.boundaryLock });
      Object.assign(state, saved); Object.assign(player, hero);
    }
  });
}
