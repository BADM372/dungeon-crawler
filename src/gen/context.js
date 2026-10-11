// Shared state threaded through all generator stages, plus floor/column helpers.
import { N, WATER, LAVA, ACID } from '../core/constants.js';
import { mulberry32, makeNoise } from '../core/util.js';

export function createContext(seed) {
  const R = mulberry32(seed);
  const cols = Array.from({ length: N * N }, () => []);   // floors per column, sorted by top
  const ctx = {
    seed, R, cols,
    ri: (a, b) => a + Math.floor(R() * (b - a + 1)),
    // fluid for pools and falls: the depth's mix (water / lava / acid weights)
    pickFluid: () => {
      const [w, l, a] = ctx.spec.fluidMix, r = R() * (w + l + a);
      return r < w ? WATER : r < w + l ? LAVA : ACID;
    },
    // the order of these matters: it fixes the random sequence for a seed
    noise: makeNoise(R),
    fenceNoise: makeNoise(R),
    slopeNoise: makeNoise(R),
    topNoise: makeNoise(R),
    stats: { layers: 0, mode: '', stairs: 0, bridges: 0, fences: 0, slopes: 0, cliffs: 0, pillars: 0, ramps: 0, landings: 0, fluids: [] },
  };

  // a floor: solid from `bottom` to `top` (in levels) in column c, belonging to `layer`
  ctx.mk = (c, top, bottom, layer) => ({
    id: -1, c, x: c % N, z: (c / N) | 0, top, bottom, layer,
    fluid: 0, surf: 0, prot: 0, merged: layer === 0, ramp: false, link: [null, null, null, null],
  });
  ctx.topFloor = c => cols[c][cols[c].length - 1];
  // the outer ring of cells is shared with the neighbouring cubes and must not change
  ctx.border = f => !f.x || !f.z || f.x === N - 1 || f.z === N - 1;
  ctx.layerFloor = (c, k) => cols[c].find(f => f.layer === k);
  ctx.removeFloor = f => { const col = cols[f.c]; col.splice(col.indexOf(f), 1); };
  ctx.nextAbove = f => { const col = cols[f.c]; return col[col.indexOf(f) + 1] || null; };
  ctx.nextBelow = f => { const col = cols[f.c]; return col[col.indexOf(f) - 1] || null; };
  return ctx;
}
