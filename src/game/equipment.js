// Prepare the model first, then commit visual + inventory equipment together.
import { player, state, setStatus } from './state.js';
import { ITEMS } from '../core/items.js';
import { ownedItem, equipItem, addInstance } from '../core/inventory.js';
import { rollWeapon } from '../core/gear/generate.js';
import { displayName } from '../core/gear/stats.js';
import { dropAtFeet } from './loot.js';
import { equippedWeapon, canChangeWeapon } from '../core/combat.js';
import { prepareSword, equipSword } from '../render/character.js';

let request = 0;
export const equipmentAllowed = () => !state.transitioning && !state.equipping && canChangeWeapon(player);
export async function syncEquippedWeapon() {
  const token = ++request, inventory = player.inventory, def = equippedWeapon(player);
  state.equipping = true;
  try {
    const model = def ? await prepareSword(def.model) : null;
    if (token === request && inventory === player.inventory) equipSword(model);
  } finally { if (token === request) state.equipping = false; }
}
export async function equipOwnedWeapon(instanceId) {
  if (!equipmentAllowed()) { setStatus('Finish your current action before changing weapons'); return false; }
  const inventory = player.inventory, slot = ownedItem(inventory, instanceId), def = ITEMS[slot?.itemId];
  if (!def?.weapon) return false;
  const token = ++request;
  state.equipping = true;
  try {
    const model = await prepareSword(def.model);
    if (token !== request || inventory !== player.inventory || !canChangeWeapon(player) || state.transitioning
        || ownedItem(inventory, instanceId) !== slot) return false;
    equipItem(inventory, instanceId); equipSword(model);
    setStatus(`Equipped ${displayName(slot)}`);
    return true;
  } catch (error) {
    console.error('weapon failed to load', error);
    setStatus('Could not load this weapon; your previous sword is still equipped');
    return false;
  } finally { if (token === request) state.equipping = false; }
}
// dev tools (?dev=1): roll a weapon of this base, rarity and item level into the bag and
// equip it, or drop one at your feet
const devRoll = (itemId, rarity, ilvl) => rollWeapon(Math.random, ilvl, { itemId, rarity });
export async function devSwapWeapon(itemId, rarity = 'common', ilvl = 1) {
  if (!state.dev || !ITEMS[itemId]?.weapon || !equipmentAllowed()) return false;
  const id = addInstance(player.inventory, devRoll(itemId, rarity, ilvl));
  if (!id) { setStatus('Inventory is full'); return false; }
  return equipOwnedWeapon(id);
}
export function devDropWeapon(itemId, rarity = 'rare', ilvl = 8) {
  if (!state.dev || !ITEMS[itemId]?.weapon) return null;
  return dropAtFeet(devRoll(itemId, rarity, ilvl));
}
