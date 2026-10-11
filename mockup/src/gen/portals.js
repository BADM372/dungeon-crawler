// Entry (x=0 face) and exit (x=N face): on different layers, or both on one upper
// layer that gets split in two so the route has to detour through another layer.
import { N, MAX_L } from '../core/constants.js';
import { idx, inb, clamp } from '../core/util.js';

export function placePortals(ctx) {
  const { R, ri, K, B, lvl0, flat, stats } = ctx;
  let mode, le, lx;
  if (K === 1) { mode = 'single'; le = lx = 0; }
  else if (R() < 0.7) { mode = 'cross'; le = ri(0, K - 1); do lx = ri(0, K - 1); while (lx === le); }
  else { mode = 'split'; le = lx = ri(1, K - 1); }
  stats.mode = mode;

  const ez = ri(2, N - 3), xz = ri(2, N - 3);
  const entryCells = [], exitCells = [];
  for (let x = 0; x <= 1; x++) for (let z = ez - 1; z <= ez + 1; z++) entryCells.push(idx(x, z));
  for (let x = N - 2; x < N; x++) for (let z = xz - 1; z <= xz + 1; z++) exitCells.push(idx(x, z));

  // pads on layer 0 are flattened into the ground and protected (prot 1 = entry, 2 = exit)
  const prot0 = new Uint8Array(N * N);
  let entryL = B[le], exitL = B[lx];
  if (le === 0) {
    entryL = clamp(lvl0[idx(1, ez)], 2, flat ? 5 : 16);
    for (const c of entryCells) { lvl0[c] = entryL; prot0[c] = 1; }
  }
  if (lx === 0) {
    let around = 0;
    for (let x = N - 4; x < N; x++) for (let z = xz - 2; z <= xz + 2; z++) if (inb(x, z)) around = Math.max(around, lvl0[idx(x, z)]);
    exitL = clamp(around + ri(0, 2), 3, flat ? 5 : MAX_L);
    for (const c of exitCells) { lvl0[c] = exitL; prot0[c] = 2; }
  }
  Object.assign(ctx, { mode, le, lx, ez, xz, entryCells, exitCells, prot0, entryL, exitL });
}
