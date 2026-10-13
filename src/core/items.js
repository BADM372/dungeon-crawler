// Item definitions are data, not renderer objects. Equipment uses rig units on hand.R.
// These are the base types; a weapon in the bag or on the floor is an instance of one, with its
// own rolled rarity, affixes and name in `gen` (core/gear/). Its stats: core/gear/stats.js.
const icon = name => `assets/items/${name}.png`;
const model = name => `assets/items/${name}.glb`;
// Base weapon stats at item level 1 (core/gear/stats.js grows the damage with item level):
//   damage per hit; interval: seconds from one swing to the next (the attack speed; every swing
//   time scales with it, see core/combat.js); range: reach in cells; arc: × the basic swing arc.
// The light ones are quick and nimble, the heavy ones hit harder, wider and further but plant
// you for longer; damage per second rises a little with weight, and the heavier bases only
// drop deeper down (core/gear/bases.js).
const weapon = (id, name, damage, interval, range, arc = 1, old = false) => Object.freeze({
  id, name, category: 'weapon', stackLimit: 1,
  icon: icon(old ? 'weapon_sword_medium' : id), model: old ? 'assets/sword.glb' : model(id),
  weapon: Object.freeze({ damage, interval, range, arc }),
});
// learn: combat.html#chain (see learn/README.md)
export const WEAPONS = Object.freeze([
  weapon('weapon_sword_old', 'Old Sword', 30, .42, .85, 1, true),   //  71 damage per second
  weapon('weapon_sword_short', 'Short Sword', 23, .32, .72),         //  72, the fastest
  weapon('weapon_sword_medium', 'Medium Sword', 34, .42, .85),       //  81
  weapon('weapon_sword_long', 'Long Sword', 39, .48, 1.05),          //  81, long reach
  weapon('weapon_sword_broad', 'Broadsword', 46, .54, .88, 1.25),    //  85, a wide sweep
  weapon('weapon_sword_greatsword', 'Greatsword', 60, .66, 1.15, 1.3), // 91, wide and long
]);
// learn: code.html#lists (see learn/README.md)
export const COINS = Object.freeze([
  { id: 'item_coin_gold', name: 'Gold', value: 1000, suffix: 'g' },
  { id: 'item_coin_silver', name: 'Silver', value: 10, suffix: 's' },
  { id: 'item_coin_copper', name: 'Copper', value: 1, suffix: 'c' },
].map(c => Object.freeze({ ...c, category: 'currency', stackLimit: Infinity, icon: icon(c.id), model: model(c.id) })));
// Health potions are drunk (game/quickbar.js useItem): `use` names the action, `heal` the share
// of the maximum health they restore. They drop from enemies and lie in chests (core/gear/drops.js,
// core/chests.js); a new run starts with a few on the quick bar.
export const HEALTH_POTION = Object.freeze({ id: 'item_potion_health', name: 'Health potion', category: 'item', stackLimit: 99,
  icon: icon('item_potion_health'), model: model('item_potion_health'), use: 'heal', heal: 0.4, cooldown: 1,
  description: 'Restores 40% of your health at once. One drink a second.' });
const stackables = [
  ['item_potion_mana', 'Mana potion'], ['item_potion_stamina', 'Stamina potion'],
  ['item_stick_short', 'Short stick'], ['item_stick_long', 'Long stick'], ['item_stick_forked', 'Forked stick'],
  ...['ruby', 'diamond', 'emerald', 'sapphire', 'amethyst'].map(s => [`item_crystal_${s}`, s[0].toUpperCase() + s.slice(1)]),
].map(([id, name]) => Object.freeze({ id, name, category: 'item', stackLimit: 99, icon: icon(id), model: model(id) }));
// Tools are used, not consumed. `bound`: never leaves the bag (no Drop); `use`: what using it
// does (game/quickbar.js useItem). They never lie on the floor, so they have no model (the
// scroll's model in assets/items/ only renders its icon).
export const TOWN_PORTAL = Object.freeze({
  id: 'item_town_portal', name: 'Town Portal Scroll', category: 'tool', stackLimit: 1, bound: true, use: 'townPortal',
  description: 'Opens a portal to town after 5 seconds of standing still. Step back through it in town to return here. Never used up.',
  icon: icon('item_town_portal'),
});
// Mana and stamina potions and the materials have inventory definitions only; no use, crafting
// or shops yet.
export const ITEMS = Object.freeze(Object.fromEntries([...WEAPONS, ...COINS, HEALTH_POTION, ...stackables, TOWN_PORTAL].map(i => [i.id, i])));
export const OLD_SWORD = WEAPONS[0];
