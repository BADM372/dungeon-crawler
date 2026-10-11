// Run-local coordinates for stairs and bridges, and a block primitive in that space.
import { N } from '../core/constants.js';

// s runs along the structure (0..k cells), w across it (-0.5..0.5)
export function runFrame(r) {
  const first = r.cells[0];
  const ox = first % N + 0.5 - r.dx * 0.5, oz = ((first / N) | 0) + 0.5 - r.dz * 0.5;
  const lx = -r.dz, lz = r.dx;
  return {
    P: (s, w, y) => [ox + r.dx * s + lx * w, y, oz + r.dz * s + lz * w],
    Y: s => { const T = s / r.k; return r.y0 + (r.y1 - r.y0) * T - r.sag * Math.sin(Math.PI * T); },
    D: [r.dx, 0, r.dz], Lt: [lx, 0, lz],
  };
}

// six-sided block between s0..s1 and w0..w1, bottom/top heights given at both ends
export function slab(b, F, s0, s1, w0, w1, b0, t0, b1, t1, top, side) {
  if (t0 - b0 < 0.005 && t1 - b1 < 0.005) return;
  const P = F.P;
  const v = [P(s0, w0, b0), P(s1, w0, b1), P(s1, w1, b1), P(s0, w1, b0), P(s0, w0, t0), P(s1, w0, t1), P(s1, w1, t1), P(s0, w1, t0)];
  const neg = a => a.map(x => -x), sd = side.clone().multiplyScalar(0.85);
  b.quad(v[4], v[5], v[6], v[7], [0, 1, 0], top);
  b.quad(v[0], v[1], v[2], v[3], [0, -1, 0], sd);
  b.quad(v[0], v[1], v[5], v[4], neg(F.Lt), side);
  b.quad(v[3], v[2], v[6], v[7], F.Lt, side);
  b.quad(v[0], v[3], v[7], v[4], neg(F.D), sd);
  b.quad(v[1], v[2], v[6], v[5], F.D, sd);
}
