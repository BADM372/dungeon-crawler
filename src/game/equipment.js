// Prepare the model first, then commit visual + inventory equipment together.
import { player, state, setStatus } from './state.js';
import { ITEMS } from '../core/items.js';
import { ownedItem, equipItem, addItem } from '../core/inventory.js';
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
    setStatus(`Equipped ${def.name}`);
    return true;
  } catch (error) {
    console.error('weapon failed to load', error);
    setStatus('Could not load this weapon; your previous sword is still equipped');
    return false;
  } finally { if (token === request) state.equipping = false; }
}
export async function devSwapWeapon(itemId) {
  if (!state.dev || !ITEMS[itemId]?.weapon || !equipmentAllowed()) return false;
  let slot = player.inventory.slots.find(s => s?.itemId === itemId);
  if (!slot) {
    if (!addItem(player.inventory, itemId)) { setStatus('Inventory is full'); return false; }
    slot = player.inventory.slots.find(s => s?.itemId === itemId);
  }
  return equipOwnedWeapon(slot.instanceId);
}
