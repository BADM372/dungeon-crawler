// Which enemies live at each depth and how many. docs/depths.md explains the plan.
// Each cube draws its population from its depth's row with its own seeded stream, so the
// terrain and the per-species placement streams (game/enemyspawn.js) are unaffected.
//   roster: [type, chance, lo, hi, pack]
//     chance: that the species is in a cube at all (1: always, unless `mix` cuts it)
//     lo..hi: how many when it is; pack: the largest group it spawns in (1: on its own)
//   mix: the most species one cube holds. If more roll present, the extra ones are dropped:
//     always-present species are kept first, the others in a random order weighted by chance.
//   The lead: one present species (picked by chance) dominates the cube. It draws its count
//     from the top half of its range, every other species from the bottom half.
// Ranged species (Fire-face, Triangle) stay at a few per cube; the melee ones, the spiders
// above all, come in larger and larger packs further down.
import { mulberry32, hash32 } from './util.js';

export const D = (mix, ...roster) => Object.freeze({ mix, roster: Object.freeze(roster.map(([type, chance, lo, hi, pack = 1]) =>
  Object.freeze({ type, chance, lo, hi, pack }))) });

export const DEPTH_SPAWNS = Object.freeze([
  /*  0 road out of town */ D(1, ['snake', 1, 1, 2]),
  /*  1 meadow islands */ D(2, ['snake', 1, 2, 4], ['stunder', .2, 1, 1]),
  /*  2 meadow islands */ D(3, ['snake', 1, 2, 5], ['spider', .6, 2, 4, 2], ['stunder', .25, 1, 1]),
  /*  3 snowy peaks */ D(3, ['spider', 1, 8, 14, 3], ['stunder', .5, 1, 2], ['triangle', .12, 1, 1]),
  /*  4 badlands */ D(3, ['snake', 1, 3, 6, 2], ['spider', .8, 4, 8, 3], ['stunder', .6, 1, 2]),
  /*  5 root caves */ D(3, ['spider', 1, 6, 10, 3], ['snake', .8, 3, 6, 2], ['stunder', .6, 1, 2]),
  /*  6 root caves */ D(3, ['spider', 1, 7, 12, 3], ['snake', .8, 4, 7, 2], ['stunder', .6, 1, 3], ['octonaut', .2, 1, 1]),
  /*  7 frozen caves */ D(3, ['octonaut', 1, 2, 4], ['spider', .8, 6, 10, 3], ['stunder', .5, 1, 2], ['snake', .3, 3, 5, 2]),
  /*  8 frozen caves */ D(3, ['octonaut', 1, 3, 5, 2], ['spider', .8, 7, 12, 4], ['stunder', .6, 1, 2], ['triangle', .15, 1, 1]),
  /*  9 fungal swamp */ D(3, ['snake', 1, 6, 10, 3], ['octonaut', .8, 2, 4, 2], ['spider', .6, 6, 10, 4], ['stunder', .25, 1, 2]),
  /* 10 fungal swamp */ D(3, ['snake', 1, 7, 12, 3], ['octonaut', .8, 3, 5, 2], ['spider', .6, 8, 12, 4], ['fireface', .1, 1, 1]),
  /* 11 spider nests */ D(3, ['spider', 1, 16, 24, 6], ['stunder', .5, 1, 2], ['octonaut', .3, 1, 2], ['snake', .3, 4, 6, 3]),
  /* 12 spider nests */ D(3, ['spider', 1, 20, 28, 7], ['stunder', .6, 1, 3], ['octonaut', .4, 1, 2], ['triangle', .15, 1, 1]),
  /* 13 crystal mines */ D(3, ['triangle', 1, 1, 2], ['stunder', .6, 1, 2], ['octonaut', .7, 2, 4, 2], ['spider', .6, 10, 14, 4]),
  /* 14 crystal mines */ D(3, ['triangle', 1, 2, 3], ['stunder', .7, 1, 3], ['octonaut', .7, 2, 5, 2], ['spider', .5, 10, 14, 4]),
  /* 15 buried ruins */ D(3, ['triangle', .8, 1, 2], ['octonaut', .8, 3, 5, 2], ['snake', .8, 8, 12, 4], ['firecat', .3, 1, 2]),
  /* 16 buried ruins */ D(4, ['triangle', .8, 1, 3], ['octonaut', .8, 3, 6, 2], ['snake', .6, 10, 14, 4], ['firecat', .5, 2, 3, 2], ['spider', .4, 10, 16, 5]),
  /* 17 volcanic depths */ D(3, ['fireface', 1, 1, 2], ['firecat', 1, 2, 4, 2], ['stunder', .6, 1, 2], ['snake', .5, 10, 14, 4]),
  /* 18 volcanic depths */ D(3, ['fireface', 1, 2, 3], ['firecat', 1, 3, 6, 3], ['stunder', .6, 2, 3], ['spider', .3, 14, 20, 6]),
  /* 19 obsidian abyss */ D(3, ['fireface', 1, 2, 3], ['firecat', 1, 4, 7, 3], ['triangle', .6, 1, 2], ['stunder', .4, 1, 2]),
  /* 20 the core */ D(4, ['firecat', 1, 5, 9, 3], ['fireface', 1, 2, 4], ['triangle', .8, 2, 3], ['stunder', .5, 2, 3], ['spider', .3, 18, 26, 8]),
]);
export const spawnsAt = depth => DEPTH_SPAWNS[Math.min(DEPTH_SPAWNS.length - 1, Math.max(0, depth | 0))];

const SALT = 0x3e1a5c7;
// the cube's population: type -> { count, pack, lead }; species not in it are absent.
// map.spawns (a row like the ones above) replaces the depth's row, for test arenas.
export function population(map) {
  if (map.enemyFree) return new Map();
  const R = mulberry32(hash32(map.seed ^ SALT)), row = map.spawns ?? spawnsAt(map.depth || 0);
  const rolled = [];
  for (const e of row.roster) if (R() < e.chance) rolled.push({ e, key: e.chance >= 1 ? 1 + R() : R() ** (1 / e.chance) });
  let present = rolled.sort((a, b) => b.key - a.key).slice(0, row.mix).map(r => r.e);
  if (!present.length) present = [row.roster[0]];
  let w = R() * present.reduce((n, e) => n + e.chance, 0), lead = present[present.length - 1];
  for (const e of present) if ((w -= e.chance) < 0) { lead = e; break; }
  return new Map(present.map(e => {
    const mid = (e.lo + e.hi) / 2, lo = e === lead ? Math.ceil(mid) : e.lo, hi = e === lead ? e.hi : Math.floor(mid);
    return [e.type, { count: lo + Math.floor(R() * (hi - lo + 1)), pack: e.pack, lead: e === lead }];
  }));
}
