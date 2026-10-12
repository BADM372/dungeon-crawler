// Item definitions are data, not renderer objects. Equipment uses rig units on hand.R.
// These are the base types; a weapon in the bag or on the floor is an instance of one, with its
// own rolled rarity, affixes and name in `gen` (core/gear/). Its stats: core/gear/stats.js.
const icon = name => `assets/items/${name}.png`;
const model = name => `assets/items/${name}.glb`;
const weapon = (id, name, damage, cooldown, range, old = false) => Object.freeze({
  id, name, category: 'weapon', stackLimit: 1,
  icon: icon(old ? 'weapon_sword_medium' : id), model: old ? 'assets/sword.glb' : model(id),
  weapon: Object.freeze({ damage, cooldown, range }),
});
export const WEAPONS = Object.freeze([
  weapon('weapon_sword_old', 'Old Sword', 30, 1.12, .85, true),
  weapon('weapon_sword_short', 'Short Sword', 24, .85, .70),
  weapon('weapon_sword_medium', 'Medium Sword', 36, 1.12, .85),
  weapon('weapon_sword_long', 'Long Sword', 40, 1.22, 1.05),
  weapon('weapon_sword_broad', 'Broadsword', 48, 1.35, .85),
  weapon('weapon_sword_greatsword', 'Greatsword', 60, 1.65, 1.15),
]);
export const COINS = Object.freeze([
  { id: 'item_coin_gold', name: 'Gold', value: 1000, suffix: 'g' },
  { id: 'item_coin_silver', name: 'Silver', value: 10, suffix: 's' },
  { id: 'item_coin_copper', name: 'Copper', value: 1, suffix: 'c' },
].map(c => Object.freeze({ ...c, category: 'currency', stackLimit: Infinity, icon: icon(c.id), model: model(c.id) })));
const stackables = [
  ['item_potion_health', 'Health potion'], ['item_potion_mana', 'Mana potion'], ['item_potion_stamina', 'Stamina potion'],
  ['item_stick_short', 'Short stick'], ['item_stick_long', 'Long stick'], ['item_stick_forked', 'Forked stick'],
  ...['ruby', 'diamond', 'emerald', 'sapphire', 'amethyst'].map(s => [`item_crystal_${s}`, s[0].toUpperCase() + s.slice(1)]),
].map(([id, name]) => Object.freeze({ id, name, category: 'item', stackLimit: 99, icon: icon(id), model: model(id) }));
// Tools are used, not consumed. `bound`: never leaves the bag (no Drop); `use`: what using it
// does (game/quickbar.js useItem). They never lie on the floor, so they have no model.
// Placeholder icon until the scroll has artwork in blender/items.py.
const svg = s => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${s}</svg>`)}`;
export const TOWN_PORTAL = Object.freeze({
  id: 'item_town_portal', name: 'Town Portal Scroll', category: 'tool', stackLimit: 1, bound: true, use: 'townPortal',
  description: 'Opens a portal to town after 5 seconds of standing still. Step back through it in town to return here. Never used up.',
  icon: svg('<rect x="14" y="11" width="36" height="42" rx="2" fill="#ead9b2" stroke="#7b5a32" stroke-width="2"/>'
    + '<rect x="9" y="6" width="46" height="9" rx="4.5" fill="#c9a46a" stroke="#7b5a32" stroke-width="2"/>'
    + '<rect x="9" y="49" width="46" height="9" rx="4.5" fill="#c9a46a" stroke="#7b5a32" stroke-width="2"/>'
    + '<circle cx="32" cy="32" r="12" fill="#2a1050"/>'
    + '<path d="M32 22a10 10 0 1 1-9.6 7.2M32 27a5 5 0 1 0 4.6 3" fill="none" stroke="#c79bff" stroke-width="2.6" stroke-linecap="round"/>'
    + '<circle cx="32" cy="32" r="2.2" fill="#f3e6ff"/>'),
});
// Potions/materials have inventory definitions only; no consumption, crafting or shops yet.
export const ITEMS = Object.freeze(Object.fromEntries([...WEAPONS, ...COINS, ...stackables, TOWN_PORTAL].map(i => [i.id, i])));
export const OLD_SWORD = WEAPONS[0];
