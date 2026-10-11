// Ground floors for every column, then the upper layers: slabs made of blobs that
// merge into whatever pokes up from below (hills become overhangs / pillars).
import { N, HEAD } from '../core/constants.js';
import { idx } from '../core/util.js';

export function buildSlabs(ctx) {
  const { R, ri, noise, topNoise, K, B, mode, le, lx, ez, xz, cols, mk, topFloor, removeFloor } = ctx;
  for (let c = 0; c < N * N; c++) {
    const f = mk(c, ctx.lvl0[c], 0, 0);
    f.fluid = ctx.fluid0[c]; f.surf = ctx.surf0[c]; f.prot = ctx.prot0[c];
    cols[c].push(f);
  }

  for (let k = 1; k < K; k++) {
    const mask = new Uint8Array(N * N);
    const blob = (cx, cz, hx, hz) => {
      for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
        const dx = Math.abs(x + 0.5 - cx) / hx, dz = Math.abs(z + 0.5 - cz) / hz;
        if (dx ** 4 + dz ** 4 + (noise(x * 0.7 + k * 13, z * 0.7 + k * 7) - 0.5) * 0.9 < 1) mask[idx(x, z)] = 1;
      }
    };
    if (mode === 'split' && k === le) {
      // two halves with a gap in the middle: no way across on this layer
      blob(ri(2, 4) + 0.5, ri(3, N - 4) + 0.5, 2 + R() * 1.5, 2.5 + R() * 3);
      blob(ri(11, 13) + 0.5, ri(3, N - 4) + 0.5, 2 + R() * 1.5, 2.5 + R() * 3);
      for (let z = 0; z < N; z++) for (let x = 6; x <= 9; x++) mask[idx(x, z)] = 0;
    } else {
      for (let b = ri(1, 3); b > 0; b--) blob(ri(2, N - 3) + 0.5, ri(2, N - 3) + 0.5, 1.8 + R() * 3, 1.8 + R() * 3);
    }

    // entry / exit pads on this layer, connected towards the middle
    const padOf = new Map();
    const pad = (cells, p, x0, x1, z0, z1) => {
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) mask[idx(x, z)] = 1;
      for (const c of cells) padOf.set(c, p);
    };
    if (le === k) pad(ctx.entryCells, 1, 0, 3, ez - 1, ez + 1);
    if (lx === k) pad(ctx.exitCells, 2, N - 4, N - 1, xz - 1, xz + 1);

    for (let c = 0; c < N * N; c++) {
      if (!mask[c]) continue;
      const x = c % N, z = (c / N) | 0;
      const top = padOf.has(c) ? B[k] : B[k] + (topNoise(x * 0.35 + k * 5, z * 0.35) > 0.6 ? 1 : 0);
      const u = mk(c, top, top - 2, k);
      u.prot = padOf.get(c) || 0;
      const below = topFloor(c);
      if (below.top + HEAD > u.bottom) {
        if ((below.fluid || below.prot) && !u.prot) continue;   // leave a hole above rivers / pads
        u.bottom = below.bottom; u.merged = true; removeFloor(below);
      }
      cols[c].push(u);
    }
  }
}
