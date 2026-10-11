// Vertical cliff walls clipped between sloped lines, coloured in rock strata.
import { LH } from '../core/constants.js';
import { gradient, SIDE_STOPS, LIP } from './palette.js';

// emit the vertical wall area along edge P0->P1 lying above every `lows` line and below every `ups` line.
// lines are [y at P0, y at P1]; we split at all crossings so each piece is an exact trapezoid.
export function wallRegion(b, P0, P1, lows, ups, nrm, col) {
  const lines = lows.concat(ups), ts = [0, 1];
  for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
    const d0 = lines[i][0] - lines[j][0], d1 = lines[i][1] - lines[j][1];
    if (d0 * d1 < 0) ts.push(d0 / (d0 - d1));
  }
  ts.sort((a, b) => a - b);
  const ev = (L, t) => L[0] + (L[1] - L[0]) * t;
  const lo = t => Math.max(...lows.map(L => ev(L, t))), hi = t => Math.min(...ups.map(L => ev(L, t)));
  for (let s = 0; s + 1 < ts.length; s++) {
    const t0 = ts[s], t1 = ts[s + 1];
    if (t1 - t0 < 1e-5) continue;
    const tm = (t0 + t1) / 2;
    if (hi(tm) - lo(tm) <= 1e-5) continue;
    const A = [P0[0] + (P1[0] - P0[0]) * t0, P0[1] + (P1[1] - P0[1]) * t0];
    const Bp = [P0[0] + (P1[0] - P0[0]) * t1, P0[1] + (P1[1] - P0[1]) * t1];
    const l0 = lo(t0), l1 = lo(t1), h0 = Math.max(l0, hi(t0)), h1 = Math.max(l1, hi(t1));
    b.quad([A[0], l0, A[1]], [Bp[0], l1, Bp[1]], [Bp[0], h1, Bp[1]], [A[0], h0, A[1]], nrm, col);
  }
}

// cliff wall clipped to the region above all `lows` and below all `ups`, in 1 unit strata bands,
// with a strip of grass along the top edge when `lip` is set
export function cliffWall(b, P0, P1, lows, ups, topLine, nrm, lip) {
  const lipLine = [topLine[0] - 0.12, topLine[1] - 0.12];
  const ymin = Math.max(...lows.map(l => Math.min(l[0], l[1])));
  const ymax = Math.min(Math.max(...topLine), ...ups.map(l => Math.max(l[0], l[1])));
  if (ymax <= ymin) return;
  for (let j = Math.floor(ymin); j < ymax; j++) {
    const col = gradient(SIDE_STOPS, j / LH).multiplyScalar(j & 1 ? 1 : 0.88);
    wallRegion(b, P0, P1, lows.concat([[j, j]]), ups.concat(lip ? [[j + 1, j + 1], lipLine] : [[j + 1, j + 1]]), nrm, col);
  }
  if (lip) wallRegion(b, P0, P1, lows.concat([lipLine]), ups, nrm, LIP);
}
