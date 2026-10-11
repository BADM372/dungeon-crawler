// Item definitions are data, not renderer objects. Equipment uses rig units on hand.R.
const icon = name => `assets/items/${name}.png`;
const model = name => `assets/items/${name}.glb`;
const weapon = (id, name, damage, cooldown, range, basic = false) => Object.freeze({
  id, name, category: 'weapon', stackLimit: 1,
  icon: icon(basic ? 'weapon_sword_medium' : id), model: basic ? 'assets/sword.glb' : model(id),
  weapon: Object.freeze({ damage, cooldown, range }),
});
export const WEAPONS = Object.freeze([
  weapon('weapon_sword_basic', 'Basic sword', 30, 1.12, .85, true),
  weapon('weapon_sword_short', 'Short sword', 24, .85, .70),
  weapon('weapon_sword_medium', 'Medium sword', 36, 1.12, .85),
  weapon('weapon_sword_long', 'Long sword', 40, 1.22, 1.05),
  weapon('weapon_sword_broad', 'Broad sword', 48, 1.35, .85),
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
// Potions/materials have inventory definitions only; no consumption, crafting or shops yet.
export const ITEMS = Object.freeze(Object.fromEntries([...WEAPONS, ...COINS, ...stackables].map(i => [i.id, i])));
export const BASIC_SWORD = WEAPONS[0];
