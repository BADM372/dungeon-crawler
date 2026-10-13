// Item rarities, from worst to best. Each tier rolls more affixes and a stronger base, and
// glows more on the floor (render/loot.js reads `glow`). Colours are OKLCH, so the steps
// read as evenly bright; `css` is the same colour as a hex string for the DOM.
import { fromOklch, toHex } from '../oklch.js';

const tier = (id, name, rank, oklch, spec) => {
  const rgb = fromOklch(oklch);
  return Object.freeze({ id, name, rank, rgb: Object.freeze(rgb), css: toHex(rgb), ...spec });
};

// weight: base odds; minLevel: the least item level that may roll it (rarer tiers only drop
// deeper down); affixes: how many;
// tierBonus: affix tiers above what the item level allows; damage: base damage factor;
// glow: what the floor shows (none, ring, halo, beam height, sparks, runes, light, shimmer)
// learn: loot.html#rarities, random.html#weighted (see learn/README.md)
export const RARITIES = Object.freeze([
  tier('junk', 'Junk', 0, { l: 0.62, c: 0.012, h: 250 },
    { weight: 24, minLevel: 1, affixes: 0, tierBonus: 0, damage: 0.8, glow: null }),
  tier('common', 'Common', 1, { l: 0.95, c: 0, h: 0 },
    { weight: 40, minLevel: 1, affixes: 0, tierBonus: 0, damage: 1, glow: null }),
  tier('uncommon', 'Uncommon', 2, { l: 0.8, c: 0.19, h: 145 },
    { weight: 22, minLevel: 1, affixes: 1, tierBonus: 0, damage: 1.05,
      glow: { ring: 0.55, halo: 0, beam: 0, sparks: 0, runes: false, light: 0 } }),
  tier('rare', 'Rare', 3, { l: 0.72, c: 0.16, h: 250 },
    { weight: 8, minLevel: 1, affixes: 2, tierBonus: 0, damage: 1.1,
      glow: { ring: 0.7, halo: 0.55, beam: 0, sparks: 0, runes: false, light: 0 } }),
  tier('epic', 'Epic', 4, { l: 0.66, c: 0.22, h: 305 },
    { weight: 2.5, minLevel: 4, affixes: 3, tierBonus: 0, damage: 1.16,
      glow: { ring: 0.85, halo: 0.75, beam: 1, sparks: 0, runes: false, light: 0 } }),
  tier('legendary', 'Legendary', 5, { l: 0.78, c: 0.17, h: 68 },
    { weight: 0.5, minLevel: 8, affixes: 4, tierBonus: 0, damage: 1.24,
      glow: { ring: 0.95, halo: 0.9, beam: 3, sparks: 4, runes: false, light: 0 } }),
  tier('mythic', 'Mythic', 6, { l: 0.62, c: 0.23, h: 22 },
    { weight: 0.08, minLevel: 13, affixes: 4, tierBonus: 1, damage: 1.32,
      glow: { ring: 1, halo: 1, beam: 3.5, sparks: 6, runes: true, light: 2 } }),
  tier('ancient', 'Ancient', 7, { l: 0.92, c: 0.09, h: 95 },
    { weight: 0.015, minLevel: 17, affixes: 5, tierBonus: 2, damage: 1.4, guardianOnly: true,
      glow: { ring: 1, halo: 1.2, beam: 5, sparks: 10, runes: true, light: 3, shimmer: true } }),
]);
export const RARITY = Object.freeze(Object.fromEntries(RARITIES.map(r => [r.id, r])));
export const rarityOf = item => RARITY[item?.gen?.rarity] || RARITY.common;

// how much each step up the tiers gains per item level, on top of its base weight: deeper
// drops are better, but a Legendary stays a find (about 1 weapon in 40 at item level 20)
// learn: loot.html#rarities (see learn/README.md)
export const LEVEL_SHIFT = 0.025;

// the odds of every rarity at item level `ilvl`. luck shifts weight upwards (guardians, chests);
// floor: the least rank that may roll (lowered to the best this item level allows); ancient:
// whether Ancient may roll at all
// learn: loot.html#odds (see learn/README.md)
export function rarityOdds(ilvl, { luck = 0, floor = 0, ancient = false } = {}) {
  floor = Math.min(floor, Math.max(...RARITIES.filter(r => ilvl >= r.minLevel && (!r.guardianOnly || ancient)).map(r => r.rank)));
  const w = RARITIES.map(r => r.rank < floor || ilvl < r.minLevel || (r.guardianOnly && !ancient) ? 0
    : r.weight * Math.exp((LEVEL_SHIFT * (ilvl - 1) + luck) * r.rank));
  const total = w.reduce((a, b) => a + b, 0);
  return w.map(x => x / total);
}
export function rollRarity(rng, ilvl, opts) {
  const odds = rarityOdds(ilvl, opts);
  let u = rng();
  for (let i = 0; i < odds.length; i++) if ((u -= odds[i]) < 0 && odds[i] > 0) return RARITIES[i];
  return RARITIES[odds.findLastIndex(p => p > 0)];
}
