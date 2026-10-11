// Layer 0 fluids: a river canyon across the cube plus a few pools.
import { N, DIRS, FLUID_NAME } from '../core/constants.js';
import { idx, inb, clamp } from '../core/util.js';

export function carveRiver(ctx) {
  const { R, ri, pickFluid, lvl0, prot0, stats } = ctx;
  const fluid0 = new Uint8Array(N * N), surf0 = new Int16Array(N * N);
  // surface one level below the lowest bank, bed two below the surface
  const fill = (cells, type, S) => { for (const i of cells) { fluid0[i] = type; surf0[i] = S; lvl0[i] = Math.max(0, S - 2); } };

  const hasRiver = R() < 0.7;
  if (hasRiver) {
    const type = pickFluid(0.6, 0.25);
    let x = ri(5, N - 6); const w = R() < 0.5 ? 1 : 2;
    const cells = new Set();
    for (let z = 0; z < N; z++) {
      for (let k = 0; k < w; k++) cells.add(idx(x + k, z));
      const r = R(), nx = clamp(x + (r < 0.3 ? -1 : r > 0.7 ? 1 : 0), 4, N - 6);
      if (nx !== x) { for (let k = 0; k < w; k++) cells.add(idx(nx + k, z)); x = nx; }
    }
    const list = [...cells].filter(i => !prot0[i]);
    let S = Infinity; for (const i of list) S = Math.min(S, lvl0[i]);
    fill(list, type, Math.max(2, S - 1));
    stats.fluids.push(FLUID_NAME[type] + ' river');
  }

  for (let p = hasRiver ? ri(0, 1) : ri(1, 2); p > 0; p--) {
    const type = pickFluid(0.5, 0.3);
    const cx = 3 + R() * (N - 6), cz = 3 + R() * (N - 6), rad = 1.1 + R() * 1.4;
    const cells = [];
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const i = idx(x, z);
      if (!prot0[i] && !fluid0[i] && Math.hypot(x + 0.5 - cx, z + 0.5 - cz) < rad) cells.push(i);
    }
    if (!cells.length) continue;
    const set = new Set(cells);
    let S = Infinity;
    for (const i of cells) {
      S = Math.min(S, lvl0[i]);
      const x = i % N, z = (i / N) | 0;
      for (const [dx, dz] of DIRS) {
        const nx = x + dx, nz = z + dz;
        if (inb(nx, nz) && !set.has(idx(nx, nz)) && !fluid0[idx(nx, nz)]) S = Math.min(S, lvl0[idx(nx, nz)]);
      }
    }
    fill(cells, type, Math.max(1, S - 1));
    stats.fluids.push(FLUID_NAME[type] + ' pool');
  }
  ctx.fluid0 = fluid0; ctx.surf0 = surf0;
}
