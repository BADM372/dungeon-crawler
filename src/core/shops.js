// What the villagers sell (world/town.js VILLAGERS, by name). Clicking a villager with a shop
// walks up to them and opens the bag with their wares beside it (game/inventory.js); an item is
// bought for its `price` in copper (core/items.js), change given. Pure.
import { ITEMS, POTIONS } from './items.js';
import { addItem, spendCopper, copperTotal } from './inventory.js';

export const SHOPS = Object.freeze({
  // the potion seller in the wizard hat: every potion and flask there is
  alchemist: Object.freeze({ title: 'Alchemist', trade: 'Potions', wares: Object.freeze(POTIONS.map(p => p.id)) }),
});
// how close (cells) the player has to be to a villager to trade
export const TRADE_REACH = 1.4;
export const shopOf = villager => SHOPS[villager?.name] ?? null;
export const priceOf = itemId => ITEMS[itemId]?.price ?? null;
// Buy `count` of `itemId`, all or nothing: 'ok', or why not: 'poor' (not enough coins),
// 'full' (no room in the bag), 'unknown' (it has no price)
export function buy(inv, itemId, count = 1) {
  const price = priceOf(itemId);
  if (!Number.isSafeInteger(price) || price <= 0 || !Number.isSafeInteger(count) || count < 1) return 'unknown';
  if (copperTotal(inv) < price * count) return 'poor';
  if (!addItem(inv, itemId, count)) return 'full';
  spendCopper(inv, price * count);
  return 'ok';
}
