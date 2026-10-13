// Weapon affixes. Each one changes one stat; an item has each affix at most once, and at
// most MAX_PREFIXES / MAX_SUFFIXES of each kind. A tier is a value range; the item level
// picks the tier (affixTier), rarer items reach above it (RARITIES tierBonus).
// Values are kept as shown: whole numbers for flat stats and percentages, cells for reach.
// To add an affix: an entry here (stat must be one core/gear/stats.js applies), and tests
// check every tier is valid. `tags`: the bases it may roll on (core/gear/bases.js).
export const MAX_PREFIXES = 3, MAX_SUFFIXES = 3;
// the item level each tier starts at; tiers 6 and 7 come only from tierBonus
export const TIER_LEVELS = Object.freeze([1, 4, 8, 13, 19]);
export const MAX_TIER = 7;
export const affixTier = ilvl => TIER_LEVELS.filter(l => ilvl >= l).length;

const affix = (id, kind, name, stat, op, tiers, text, decimals = 0) =>
  Object.freeze({ id, kind, name, stat, op, tiers: Object.freeze(tiers.map(t => Object.freeze(t))), text, decimals, tags: Object.freeze(['sword']) });

export const AFFIXES = Object.freeze([
  affix('sharp', 'prefix', 'Sharp', 'damage', 'add',
    [[2, 4], [4, 7], [7, 11], [11, 16], [16, 22], [22, 29], [29, 38]], v => `+${v} damage`),
  affix('brutal', 'prefix', 'Brutal', 'damage', 'pct',
    [[4, 8], [8, 13], [13, 18], [18, 24], [24, 30], [30, 37], [37, 45]], v => `+${v}% damage`),
  affix('swift', 'prefix', 'Swift', 'speed', 'pct',
    [[3, 6], [6, 9], [9, 12], [12, 15], [15, 18], [18, 21], [21, 25]], v => `${v}% faster attacks`),
  affix('sweeping', 'prefix', 'Sweeping', 'arc', 'pct',
    [[8, 15], [15, 22], [22, 30], [30, 38], [38, 46], [46, 55], [55, 65]], v => `+${v}% swing arc`),
  affix('vicious', 'prefix', 'Vicious', 'crit', 'add',
    [[3, 5], [5, 7], [7, 9], [9, 12], [12, 15], [15, 18], [18, 22]], v => `+${v}% critical chance`),
  affix('reach', 'suffix', 'of Reach', 'range', 'add',
    [[0.05, 0.08], [0.08, 0.12], [0.12, 0.16], [0.16, 0.2], [0.2, 0.25], [0.25, 0.3], [0.3, 0.36]],
    v => `+${v.toFixed(2)} reach`, 2),
  affix('leech', 'suffix', 'of the Leech', 'leech', 'add',
    [[1, 2], [2, 3], [3, 5], [5, 7], [7, 10], [10, 13], [13, 17]], v => `+${v} life on hit`),
  affix('force', 'suffix', 'of Force', 'knockback', 'pct',
    [[15, 30], [30, 45], [45, 60], [60, 80], [80, 100], [100, 125], [125, 150]], v => `+${v}% knockback`),
  affix('precision', 'suffix', 'of Precision', 'critDamage', 'add',
    [[10, 20], [20, 30], [30, 40], [40, 55], [55, 70], [70, 85], [85, 100]], v => `+${v}% critical damage`),
]);
export const AFFIX = Object.freeze(Object.fromEntries(AFFIXES.map(a => [a.id, a])));

export function rollAffixValue(a, tier, rng) {
  const [lo, hi] = a.tiers[tier - 1], k = 10 ** a.decimals;
  return Math.round((lo + (hi - lo) * rng()) * k) / k;
}

// `count` distinct affixes allowed on `tags`, tier from the item level plus the bonus
export function rollAffixes(rng, count, ilvl, tags, tierBonus = 0) {
  const tier = Math.min(MAX_TIER, affixTier(ilvl) + tierBonus);
  const pool = AFFIXES.filter(a => a.tags.some(t => tags.includes(t))), out = [];
  const kinds = { prefix: 0, suffix: 0 }, max = { prefix: MAX_PREFIXES, suffix: MAX_SUFFIXES };
  while (out.length < count) {
    const open = pool.filter(a => !out.some(o => o.id === a.id) && kinds[a.kind] < max[a.kind]);
    if (!open.length) break;
    const a = open[Math.floor(rng() * open.length)];
    kinds[a.kind]++;
    out.push({ id: a.id, tier, value: rollAffixValue(a, tier, rng) });
  }
  // prefixes first, then suffixes, each in table order: a stable reading order
  return out.sort((x, y) => AFFIXES.indexOf(AFFIX[x.id]) - AFFIXES.indexOf(AFFIX[y.id]));
}
export const describeAffix = a => AFFIX[a.id].text(a.value);
