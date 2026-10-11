// Layer count / heights and the rolling ground of layer 0. The four face profiles (shared with
// the neighbouring cubes) pin the edge cells; inwards the ground blends from them into local
// detail, hills and plateaus.
import { N, MAX_L } from '../core/constants.js';
import { idx, clamp } from '../core/util.js';

export function chooseLayers(ctx) {
  ctx.K = ctx.spec.K; ctx.B = ctx.spec.B; ctx.stats.layers = ctx.K;
}

// local relief added on top of the blended profiles (faded out towards the edges)
function relief(ctx) {
  const { R, ri, noise, spec } = ctx;
  const extra = new Float32Array(N * N);
  const hills = spec.kind === 'highland' ? 0 : ri(1, 2);
  for (let h = 0; h < hills; h++) {
    const cx = 3 + R() * (N - 6), cz = 3 + R() * (N - 6), rad = 2.2 + R() * 2.5, amp = ri(1, 3);
    for (let i = 0; i < N * N; i++) extra[i] += amp * Math.max(0, 1 - Math.hypot(i % N + 0.5 - cx, ((i / N) | 0) + 0.5 - cz) / rad);
  }
  const plateaus = spec.kind === 'highland' || spec.kind === 'meadow' && ctx.K === 1 ? ri(1, 2) : 0;
  for (let p = 0; p < plateaus; p++) {
    const cx = ri(4, N - 5) + 0.5, cz = ri(4, N - 5) + 0.5;
    const hx = 1.5 + R() * 2.5, hz = 1.5 + R() * 2.5, raise = ri(3, 6);
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const dx = Math.abs(x + 0.5 - cx) / hx, dz = Math.abs(z + 0.5 - cz) / hz;
      if (dx ** 4 + dz ** 4 + (noise(x * 0.8 + 40, z * 0.8 + 40) - 0.5) * 0.8 < 1) extra[idx(x, z)] += raise;
    }
  }
  return extra;
}

export function groundHeights(ctx) {
  const { noise, spec } = ctx;
  const P = spec.faces.map(f => f.profile), extra = relief(ctx);
  const lvl0 = new Int16Array(N * N);
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const d = [N - 1 - x, x, N - 1 - z, z], p = [P[0][z], P[1][z], P[2][x], P[3][x]];
    const near = d.indexOf(Math.min(...d));
    let s = 0, ws = 0;
    for (let i = 0; i < 4; i++) { const w = 1 / (d[i] + 0.6) ** 2; s += w * p[i]; ws += w; }
    const e = clamp(d[near] / 3, 0, 1);
    const v = d[near] === 0 ? p[near] : Math.round(s / ws + e * ((noise(x * 0.21 + 0.5, z * 0.21 + 0.5) - 0.5) * 3 + extra[idx(x, z)]));
    lvl0[idx(x, z)] = clamp(v, 2, MAX_L);
  }
  ctx.lvl0 = lvl0; ctx.flat = ctx.K > 1;
}
