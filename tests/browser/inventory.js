// Browser integration checks. Resets to a fresh seed-3 run before and after testing.
import { player, state, view } from '../../src/game/state.js';
import { newWorld, enterCube, spawnEntry, hurt } from '../../src/game/flow.js';
import { updatePlayer } from '../../src/game/update.js';
import { allEnemies, resetEnemies, updateEnemies, ENTRY_GRACE } from '../../src/game/enemies.js';
import { setInventoryOpen, updateInventory } from '../../src/game/inventory.js';
import { clearInput, inputDir } from '../../src/game/input.js';
import { equipOwnedWeapon, devSwapWeapon } from '../../src/game/equipment.js';
import { WEAPONS, ITEMS } from '../../src/core/items.js';
import { lootHere, updateLoot, requestCollect } from '../../src/game/loot.js';
import { addItem, addCopper, copperTotal, equippedItem } from '../../src/core/inventory.js';
import { awardXP } from '../../src/core/progression.js';
import { startSwing, cancelSwing, damageEnemy } from '../../src/core/combat.js';
import { character } from '../../src/render/character.js';
import { paused } from './combat.js';

const check = (condition, message) => { if (!condition) throw Error(message); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const press = code => {
  dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
  dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
};
const $ = id => document.getElementById(id);
async function settleEquipment() {
  for (let i = 0; i < 200 && state.equipping; i++) await delay(20);
  check(!state.equipping, 'Weapon load timed out');
  updateInventory();
}
function correctModel(w) {
  return equippedItem(player.inventory)?.itemId === w.id
    && character.sword.parent === character.bones['hand.R']
    && !!character.sword.getObjectByName(w.id === 'weapon_sword_basic' ? 'Sword' : w.id);
}

export async function runInventoryChecks() {
  const results = [];
  await newWorld(3); clearInput();
  try {
    check(correctModel(WEAPONS[0]) && player.level === 1, 'Run must start with basic sword / level 1');
    press('KeyI');
    check(state.inventoryOpen && !$('inventory-overlay').hidden, 'I must open inventory');
    check(document.querySelectorAll('.inventory-slot').length === 24, 'Inventory must have 24 bag slots');
    check(document.querySelectorAll('.coin-slot').length === 3, 'Currency needs three reserved slots');
    check($('inventory-dev').hidden === !state.dev, 'Developer controls must be gated by ?dev=1');
    const before = [state.time, player.x, player.y, player.z, player.hp, view.yawTarget, view.zoomTarget];
    for (const code of ['KeyW','Space','KeyF','KeyQ','KeyR','KeyN']) press(code);
    document.querySelector('canvas').dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
    dispatchEvent(new WheelEvent('wheel', { deltaY: 100 }));
    updatePlayer(1); updateEnemies(1);
    await delay(200);
    check(JSON.stringify(before) === JSON.stringify([state.time,player.x,player.y,player.z,player.hp,view.yawTarget,view.zoomTarget]), 'Inventory must freeze simulation and suppress gameplay input');
    check(!player.sword.requested && !player.sword.active, 'UI input must not queue a slash');
    results.push('I opens / 24 slots / currency / simulation pause / input isolation');

    for (const w of WEAPONS) {
      if (state.dev) {
        $('dev-weapon').value = w.id; $('dev-equip').click();
      } else {
        check(!await devSwapWeapon(w.id), 'Non-dev runs must reject dev grants');
        if (!player.inventory.slots.some(s => s?.itemId === w.id)) addItem(player.inventory, w.id);
        await equipOwnedWeapon(player.inventory.slots.find(s => s?.itemId === w.id).instanceId);
      }
      await settleEquipment(); check(correctModel(w), 'Equipment stats / model mismatch for ' + w.id);
      check(!player.sword.active && !player.sword.requested, 'Equipping must not attack');
    }
    const basicIndex = player.inventory.slots.findIndex(s => s?.itemId === WEAPONS[0].id);
    document.querySelector(`[data-slot="${basicIndex}"]`).click(); $('inventory-equip').click();
    await settleEquipment(); check(correctModel(WEAPONS[0]), 'Owned slot Equip action must work');
    results.push('all six swords load at hand.R / dev grants / ordinary slot equipment');

    addItem(player.inventory, 'item_potion_health', 150); addCopper(player.inventory, 1237); updateInventory();
    check(JSON.stringify(player.inventory.currency.map(s=>s.count)) === '[1,23,7]', 'Coin denominations must roll up');
    const potionCounts = player.inventory.slots.filter(s=>s?.itemId === 'item_potion_health').map(s=>s.count);
    check(JSON.stringify(potionCounts) === '[99,51]', 'Items must stack across slots');
    check([...document.querySelectorAll('.inventory-slot .count')].some(el=>el.textContent === '99'), 'Stack count must be visible');
    await delay(150);
    check([...document.querySelectorAll('#inventory-grid img, #inventory-currency img')].every(img=>img.complete && img.naturalWidth), 'Inventory previews failed to load');
    press('Escape'); check(!state.inventoryOpen && $('inventory-overlay').hidden, 'Escape must close inventory');
    check(inputDir().every(n=>n === 0) && !player.sword.requested, 'Closing must not replay input');
    results.push('visible counts / 1g 23s 7c conversion / Escape / no buffered input');

    await paused(async () => {
      startSwing(player); setInventoryOpen(true);
      check($('inventory-equip').disabled && $('dev-equip').disabled, 'Mid-swing weapon switches must be disabled');
      check(!await equipOwnedWeapon(player.inventory.slots.find(s=>s?.itemId === WEAPONS[1].id).instanceId), 'Equipment API must guard active swings');
      setInventoryOpen(false); cancelSwing(player, true);
      const hostile = await state.cubes.get('0,0,-2'), town = await state.cubes.get('0,0,0');
      enterCube(hostile, 2);
      const e = allEnemies()[0]; check(e && e.level === 1, 'Need a level-1 surface enemy');
      const xp = player.xp, coins = copperTotal(player.inventory), expectedCoins = e.coinDrop, id = e.id;
      damageEnemy(e, e.hp); updateEnemies(1/60);
      const loot = () => lootHere().reduce((n, p) => n + ITEMS[p.itemId].value * p.count, 0);
      check(player.xp === xp + e.profile.xp && copperTotal(player.inventory) === coins && loot() === expectedCoins, 'Death must grant XP and drop the seeded coins');
      // C from a cell away pulls them all in; they count once they arrive
      Object.assign(player, { x: e.x + 1, z: e.z, y: e.y, visY: e.y });
      for (let i = 0; i < 40; i++) updateLoot(1/60, i / 60);   // let them land
      requestCollect();
      for (let i = 0; i < 120 && lootHere().length; i++) updateLoot(1/60, 1 + i / 60);
      check(!lootHere().length && copperTotal(player.inventory) === coins + expectedCoins, 'C must collect the dropped coins');
      const earnedXP = player.xp, earnedCoins = copperTotal(player.inventory);
      updateEnemies(1/60); resetEnemies(); updateEnemies(1/60);
      check(!allEnemies().some(e=>e.id === id), 'Defeated enemies must not respawn');
      check(player.xp === earnedXP && copperTotal(player.inventory) === earnedCoins, 'Rewards must not duplicate');
      enterCube(town, 3); enterCube(hostile, 2);
      check(!allEnemies().some(e=>e.id === id) && player.xp === earnedXP, 'Cube revisits must keep defeated IDs and progression');
      awardXP(player, 100); const level = player.level, equipped = player.inventory.equipped;
      player.hp = 1; spawnEntry();
      check(player.hp === player.maxHp && player.level === level && player.inventory.equipped === equipped
        && copperTotal(player.inventory) === earnedCoins, 'Death/respawn must preserve progression, equipment and currency');
      // a death puts the cube back as it was when you came in: enemies return, their coins go
      const again = allEnemies()[0], againId = again.id;
      damageEnemy(again, again.hp); updateEnemies(1/60);
      check(again.mode === 'dead' && state.run.defeated.has(againId), 'Need a second kill');
      hurt(player.hp, 'Test death');
      check(!state.run.defeated.has(againId) && allEnemies().some(e=>e.id === againId) && !lootHere().length
        && !allEnemies().some(e=>e.id === id), 'Death must restore the cube as entered (and only that)');
      check(state.enemyGrace === ENTRY_GRACE, 'Enemies must hold their attacks after a respawn');
      results.push('real cube death reward / no duplicate rewards / revisits / max-HP respawn / death resets the visit');

      const pending = equipOwnedWeapon(player.inventory.slots.find(s=>s?.itemId === WEAPONS[4].id).instanceId);
      await newWorld(3);
      check(!await pending && correctModel(WEAPONS[0]), 'Old asynchronous equipment must not cross a new-run reset');
      check(player.xp === 0 && player.level === 1 && player.maxHp === 100 && copperTotal(player.inventory) === 0
        && player.inventory.slots.filter(Boolean).length === 1 && state.run.defeated.size === 0, 'New world must reset the entire run');
      results.push('new-run reset / stale asynchronous weapon requests');
    });
    const resumedAt = state.time;
    for (let i = 0; i < 100 && state.time === resumedAt; i++) await delay(20);
    check(state.time > resumedAt, 'Browser checks must resume the main frame loop');
    return results;
  } finally { setInventoryOpen(false); clearInput(); await newWorld(3); }
}
