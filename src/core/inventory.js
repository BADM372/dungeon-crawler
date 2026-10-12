import { ITEMS, COINS } from './items.js';

// A slot holds { instanceId, itemId, count, gen? }. `gen` is a generated item's own data
// (core/gear/): a slot with it is one unique item and never stacks.

export const BAG_SIZE = 24;
export function whole(n) {
  if (!Number.isSafeInteger(n) || n < 0) throw new RangeError('Expected a non-negative safe integer');
  return n;
}
export function createInventory() {
  return { slots: Array(BAG_SIZE).fill(null), currency: COINS.map(c => ({ itemId: c.id, count: 0 })),
    equipped: null, nextInstance: 1, version: 0 };
}
export const copperTotal = inv => whole(inv.currency.reduce((n, s) => n + s.count * ITEMS[s.itemId].value, 0));
export function coinCounts(copper) {
  whole(copper);
  return [Math.floor(copper / 1000), Math.floor(copper % 1000 / 10), copper % 10];
}
export function formatCoins(copper) {
  return coinCounts(copper).map((n, i) => n ? `${n}${COINS[i].suffix}` : '').filter(Boolean).join(' ') || '0c';
}
function setCopper(inv, total) {
  coinCounts(total).forEach((count, i) => { inv.currency[i].count = count; });
  inv.version++;
}
export function addCopper(inv, amount) {
  whole(amount);
  const total = whole(copperTotal(inv) + amount);
  if (amount) setCopper(inv, total);
  return true;
}
export function spendCopper(inv, amount) {
  whole(amount);
  const total = copperTotal(inv);
  if (total < amount) return false;
  if (amount) setCopper(inv, total - amount);
  return true;
}
export const ownedItem = (inv, instanceId) => inv.slots.find(s => s?.instanceId === instanceId) || null;
export const equippedItem = inv => ownedItem(inv, inv.equipped);
export function equipItem(inv, instanceId) {
  const slot = ownedItem(inv, instanceId);
  if (!slot || !ITEMS[slot.itemId]?.weapon) return false;
  if (inv.equipped !== instanceId) { inv.equipped = instanceId; inv.version++; }
  return true;
}

// All-or-nothing: a full bag never consumes a reward or partially inserts an item.
export function addItem(inv, itemId, count = 1) {
  whole(count);
  const def = ITEMS[itemId];
  if (!def) throw new TypeError(`Unknown item: ${itemId}`);
  if (def.category === 'currency') return addCopper(inv, whole(count * def.value));
  const capacity = inv.slots.reduce((n, s) => n + (!s ? def.stackLimit : s.itemId === itemId ? def.stackLimit - s.count : 0), 0);
  if (capacity < count) return false;
  let left = count;
  for (const s of inv.slots) if (left && s?.itemId === itemId && s.count < def.stackLimit) {
    const take = Math.min(left, def.stackLimit - s.count); s.count += take; left -= take;
  }
  for (let i = 0; left && i < inv.slots.length; i++) if (!inv.slots[i]) {
    const take = Math.min(left, def.stackLimit);
    inv.slots[i] = { instanceId: `item-${inv.nextInstance++}`, itemId, count: take }; left -= take;
  }
  if (count) inv.version++;
  return true;
}
// a single item instance ({ itemId, gen }) into the first free slot; its instanceId, or null
// when the bag is full
export function addInstance(inv, item) {
  const def = ITEMS[item?.itemId];
  if (!def) throw new TypeError(`Unknown item: ${item?.itemId}`);
  if (def.category === 'currency') throw new TypeError('Coins are not instances');
  if (!item.gen) return addItem(inv, item.itemId, item.count ?? 1) ? inv.slots.findLast(s => s?.itemId === item.itemId).instanceId : null;
  const i = inv.slots.indexOf(null);
  if (i < 0) return null;
  const instanceId = `item-${inv.nextInstance++}`;
  inv.slots[i] = { instanceId, itemId: item.itemId, count: 1, gen: item.gen };
  inv.version++;
  return instanceId;
}
// the whole slot out of the bag (unequipping it): { itemId, count, gen? }, or null
export function takeItem(inv, instanceId) {
  const i = inv.slots.findIndex(s => s?.instanceId === instanceId);
  if (i < 0) return null;
  const { itemId, count, gen } = inv.slots[i];
  inv.slots[i] = null;
  if (inv.equipped === instanceId) inv.equipped = null;
  inv.version++;
  return gen ? { itemId, count, gen } : { itemId, count };
}
export const hasRoom = inv => inv.slots.includes(null);

export function removeItem(inv, instanceId, count = 1) {
  whole(count);
  const i = inv.slots.findIndex(s => s?.instanceId === instanceId);
  if (i < 0 || inv.slots[i].count < count) return false;
  if (!count) return true;
  inv.slots[i].count -= count;
  if (!inv.slots[i].count) {
    inv.slots[i] = null;
    if (inv.equipped === instanceId) inv.equipped = null;
  }
  inv.version++;
  return true;
}
