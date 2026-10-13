// Item definitions are data, not renderer objects. Equipment uses rig units in the hand sockets.
// These are the base types; a weapon in the bag or on the floor is an instance of one, with its
// own rolled rarity, affixes and name in `gen` (core/gear/). Its stats: core/gear/stats.js.
const icon = name => `assets/items/${name}.png`;
const model = name => `assets/items/${name}.glb`;
// Base weapon stats at item level 1 (core/gear/stats.js grows the damage with item level):
//   kind: sword, bow, crossbow or staff (how it attacks: core/combat.js KINDS); damage per hit;
//   interval: seconds from one attack to the next (the attack speed; every attack time scales
//   with it, see core/combat.js); range: reach in cells (how far a shot flies for the ranged
//   kinds); arc: × the basic swing arc (swords); pierce: how many enemies a bolt goes through
//   before it stops; burst: the radius (cells) a spell bursts over where it hits, hurting
//   everything else there for BURST_SHARE of its damage (core/shots.js); color: the spell's.
// Swords: the light ones are quick and nimble, the heavy ones hit harder, wider and further but
// plant you for longer; damage per second rises a little with weight, and the heavier bases only
// drop deeper down (core/gear/bases.js). Shooting from afar is safer, so the ranged kinds deal
// less per second than swords of the same weight: bows are quick and reach far, crossbows hit
// hard and slowly and pierce, staffs are slow and burst.
const weapon = (id, name, kind, damage, interval, range, more = {}) => Object.freeze({
  id, name, category: 'weapon', stackLimit: 1,
  icon: icon(more.old ? 'weapon_sword_medium' : id), model: more.old ? 'assets/sword.glb' : model(id),
  weapon: Object.freeze({ kind, damage, interval, range, arc: more.arc ?? 1, pierce: more.pierce ?? 0,
    burst: more.burst ?? 0, ...(more.color && { color: more.color }) }),
});
const sword = (id, name, damage, interval, range, arc = 1, old = false) => weapon(id, name, 'sword', damage, interval, range, { arc, old });
// learn: combat.html#chain (see learn/README.md)
export const WEAPONS = Object.freeze([
  sword('weapon_sword_old', 'Old Sword', 30, .42, .85, 1, true),   //  71 damage per second
  sword('weapon_sword_short', 'Short Sword', 23, .32, .72),         //  72, the fastest
  sword('weapon_sword_medium', 'Medium Sword', 34, .42, .85),       //  81
  sword('weapon_sword_long', 'Long Sword', 39, .48, 1.05),          //  81, long reach
  sword('weapon_sword_broad', 'Broadsword', 46, .54, .88, 1.25),    //  85, a wide sweep
  sword('weapon_sword_greatsword', 'Greatsword', 60, .66, 1.15, 1.3), // 91, wide and long
  weapon('weapon_bow_short', 'Short Bow', 'bow', 22, .44, 5),             // 50, the quickest
  weapon('weapon_bow_hunting', 'Hunting Bow', 'bow', 30, .56, 6),         // 54
  weapon('weapon_bow_recurve', 'Recurve Bow', 'bow', 35, .62, 6.5),       // 56
  weapon('weapon_bow_long', 'Longbow', 'bow', 44, .74, 8),                // 59, the furthest
  weapon('weapon_bow_war', 'War Bow', 'bow', 54, .84, 7),                 // 64
  weapon('weapon_crossbow_hand', 'Hand Crossbow', 'crossbow', 34, .66, 4.5),                // 52
  weapon('weapon_crossbow_light', 'Light Crossbow', 'crossbow', 46, .84, 5.5, { pierce: 1 }), // 55
  weapon('weapon_crossbow_repeating', 'Repeating Crossbow', 'crossbow', 27, .45, 5),       // 60, rapid
  weapon('weapon_crossbow_heavy', 'Heavy Crossbow', 'crossbow', 64, 1.04, 6, { pierce: 1 }), // 62
  weapon('weapon_crossbow_arbalest', 'Arbalest', 'crossbow', 86, 1.28, 7, { pierce: 2 }),  // 67
  weapon('weapon_staff_gnarled', 'Gnarled Staff', 'staff', 27, .58, 4.5, { burst: .5, color: '#8fe07a' }),   // 47
  weapon('weapon_staff_oak', 'Oak Staff', 'staff', 33, .62, 5, { burst: .6, color: '#7fb4ff' }),            // 53
  weapon('weapon_staff_ember', 'Ember Staff', 'staff', 41, .70, 5, { burst: .85, color: '#ff8a3a' }),       // 59
  weapon('weapon_staff_crystal', 'Crystal Staff', 'staff', 47, .74, 5.5, { burst: .7, color: '#bdf3ff' }),  // 64
  weapon('weapon_staff_arcane', 'Arcane Staff', 'staff', 58, .84, 6, { burst: 1, color: '#c48cff' }),       // 69
]);
// the kinds of weapon, in the order the UI lists them
export const WEAPON_KINDS = Object.freeze(['sword', 'bow', 'crossbow', 'staff']);
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
// Things a character wears or carries (render/figure.js puts them on): `slot` is where they go,
// one thing per slot (OUTFIT_SLOTS): on the head, or in the right or the left hand. Their models
// say which bone they sit on, how, and how the arm holds them (blender/items.py WEARS).
// `glow`: the colour the gem-like part shines in. No stats or uses yet; for now only the
// villagers wear them (world/town.js VILLAGERS), but they are items like any other.
const wearable = (id, name, slot, description, more = {}) => Object.freeze({
  id, name, category: slot === 'head' ? 'wearable' : 'held', slot, stackLimit: 1, icon: icon(id), model: model(id),
  description, ...more });
export const OUTFIT_SLOTS = Object.freeze(['head', 'right', 'left']);
export const WEARABLES = Object.freeze([
  wearable('wear_headscarf', 'Headscarf', 'head', 'A plum kerchief with golden dots, knotted at the nape.'),
  wearable('wear_welding_mask', 'Welding mask', 'head', 'A smith\'s mask with a dark glass window.'),
  wearable('wear_wizard_hat', 'Wizard hat', 'head', 'Tall, pointed and covered in stars.'),
  wearable('held_towel', 'Towel', 'left', 'A striped towel, carried over the forearm.'),
  wearable('held_crystal_ball', 'Crystal ball', 'right', 'It floats over the palm and glows softly.', { glow: '#7fb4ff' }),
  wearable('held_rope', 'Rope', 'right', 'A coil of hemp rope.'),
  wearable('held_hammer', 'Hammer', 'right', 'A smith\'s hammer.'),
  wearable('held_pliers', 'Pliers', 'left', 'A smith\'s pliers, holding a glowing billet.', { glow: '#ff7a2a' }),
  wearable('held_feed_bag', 'Feed bag', 'left', 'Grain for the animals, and a carrot.'),
]);
// what a list of worn and held item ids puts in each slot: { head, right, left } (missing: empty)
export function outfitOf(ids) {
  const out = {};
  for (const id of ids) {
    const slot = ITEMS[id]?.slot;
    if (!slot) throw new TypeError(`Not a wearable item: ${id}`);
    if (out[slot]) throw new Error(`Two things for the ${slot} slot: ${out[slot]} and ${id}`);
    out[slot] = id;
  }
  return out;
}
// Mana and stamina potions and the materials have inventory definitions only; no use, crafting
// or shops yet.
export const ITEMS = Object.freeze(Object.fromEntries([...WEAPONS, ...COINS, HEALTH_POTION, ...stackables, TOWN_PORTAL, ...WEARABLES].map(i => [i.id, i])));
export const OLD_SWORD = WEAPONS[0];
