// Layer count / heights and the rolling ground of layer 0.
import { N, MAX_L } from '../core/constants.js';
import { idx, clamp } from '../core/util.js';

// 1-4 layers; B[k] is the base level of upper layer k
export function chooseLayers(ctx) {
  const { R, ri } = ctx;
  const r0 = R();
  const K = r0 < 0.12 ? 1 : r0 < 0.42 ? 2 : r0 < 0.75 ? 3 : 4;
  const B = [0];
  if (K === 2) B.push(ri(10, 12));
  if (K === 3) { B.push(ri(10, 11)); B.push(B[1] + ri(6, 7)); }
  if (K === 4) { B.push(ri(9, 10)); B.push(B[1] + 6); B.push(B[2] + 6); }
  ctx.K = K; ctx.B = B; ctx.stats.layers = K;
}

// terraced noise + conical hills; plateaus only when there are no upper layers
export function groundHeights(ctx) {
  const { R, ri, noise, K } = ctx;
  const lvl0 = new Int16Array(N * N);
  const flat = K > 1;
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    let n = noise(x * 0.21 + 0.5, z * 0.21 + 0.5);
    n = clamp((n - 0.25) / 0.5, 0, 1);
    lvl0[idx(x, z)] = 2 + Math.floor(n * (flat ? 3.99 : 6.99));
  }
  for (let h = ri(1, 2); h > 0; h--) {
    const cx = 2 + R() * (N - 4), cz = 2 + R() * (N - 4), rad = 2.2 + R() * 2.5, amp = flat ? ri(1, 3) : ri(2, 4);
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
      lvl0[idx(x, z)] += Math.round(amp * Math.max(0, 1 - d / rad));
    }
  }
  if (!flat) for (let p = ri(1, 2); p > 0; p--) {
    const cx = ri(3, N - 4) + 0.5, cz = ri(3, N - 4) + 0.5;
    const hx = 1.5 + R() * 2.5, hz = 1.5 + R() * 2.5, raise = ri(4, 7);
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const dx = Math.abs(x + 0.5 - cx) / hx, dz = Math.abs(z + 0.5 - cz) / hz;
      if (dx ** 4 + dz ** 4 + (noise(x * 0.8 + 40, z * 0.8 + 40) - 0.5) * 0.8 < 1) lvl0[idx(x, z)] += raise;
    }
  }
  for (let i = 0; i < N * N; i++) lvl0[i] = clamp(lvl0[i], 1, MAX_L);
  ctx.lvl0 = lvl0; ctx.flat = flat;
}
