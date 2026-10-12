// Which base types drop, from what item level and how often. A base is an item in
// core/items.js; `tags` decide which affixes may roll on it (core/gear/affixes.js).
// To add a dropping weapon: define the item (with its model and icon), then list it here.
// The Old Sword is never dropped: it is what a run starts with.
const base = (itemId, minLevel, weight = 1, tags = ['sword', 'melee']) =>
  Object.freeze({ itemId, minLevel, weight, tags: Object.freeze(tags) });

export const BASES = Object.freeze([
  base('weapon_sword_short', 1),
  base('weapon_sword_medium', 1),
  base('weapon_sword_long', 2),
  base('weapon_sword_broad', 4),
  base('weapon_sword_greatsword', 6, 1, ['sword', 'melee', 'two-handed']),
]);
export const BASE = Object.freeze(Object.fromEntries(BASES.map(b => [b.itemId, b])));
// tags for any weapon, including those that never drop
export const baseTags = itemId => BASE[itemId]?.tags ?? ['sword', 'melee'];

export function rollBase(rng, ilvl) {
  const open = BASES.filter(b => ilvl >= b.minLevel);
  let w = rng() * open.reduce((n, b) => n + b.weight, 0);
  for (const b of open) if ((w -= b.weight) < 0) return b;
  return open.at(-1);
}
