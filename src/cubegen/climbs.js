// Route moves that need no stairs or bridges: ladders up (or down) a cliff face, and jumps over
// a gap of one or two cells. Ladders are kept in their own list (not structure pieces): the
// lower floor's cell holds the ladder against the wall of the higher column.
import { LH, DIRS, OPP } from '../core/constants.js';
import { idx, inb } from '../core/util.js';

// ladder from f to the floor g in the neighbouring column n (3-14 levels apart, either way)
export function ladderMoves(ctx, f, d, n, out) {
  if (f.landing || f.fluid) return;
  for (const g of ctx.cols[n]) {
    if (g.fluid || g.siteBlocked) continue;
    const lo = g.top > f.top ? f : g, hi = lo === f ? g : f, rise = hi.top - lo.top;
    if (rise < 3 || rise > 14 || hi.bottom > lo.top + 1) continue;   // the wall reaches the lower floor
    const above = ctx.nextAbove(lo);
    if (above && above.bottom < hi.top + 3) continue;   // room to climb all the way up
    if (!ctx.headOK(hi, hi.top)) continue;
    out.push({ kind: 'ladder', from: f, to: g, d, cells: [], lo, hi, cost: 1.6 + 0.2 * rise });
  }
}

// jump from f over 1-2 cells of open drop (or void) to a floor at most 1 level higher and at most
// 2 lower (a soft landing, so jumps can follow each other; over two cells exactly 2 lower, for the
// time to get across), with room overhead for the arc
export function jumpMoves(ctx, f, d, out) {
  if (f.landing || f.fluid || !ctx.headOK(f, f.top + 2)) return;
  const [dx, dz] = DIRS[d], bx = f.x - dx, bz = f.z - dz;
  // a run-up: level ground right behind the take-off (not a ledge you only drop onto)
  if (!inb(bx, bz) || !ctx.cols[idx(bx, bz)].some(b => !b.fluid && !b.siteBlocked && Math.abs(b.top - f.top) <= 1)) return;
  for (let gap = 1; gap <= 2; gap++) {
    const gx = f.x + dx * gap, gz = f.z + dz * gap, ex = gx + dx, ez = gz + dz;
    if (!inb(ex, ez)) return;
    // the gap cell has to be clearly lower, with nothing to bump into overhead
    if (ctx.cols[idx(gx, gz)].some(h => h.top > f.top - 4 && h.bottom < f.top + 6)) return;
    for (const g of ctx.cols[idx(ex, ez)]) {
      const dh = g.top - f.top;
      if (g.fluid || g.siteBlocked || dh > (gap === 1 ? 1 : -2) || dh < -2 || !ctx.headOK(g, f.top + 2)) continue;   // soft landings only
      out.push({ kind: 'jump', from: f, to: g, d, gap, cells: [], cost: 1.6 + 0.6 * gap });
    }
  }
}

// placement: a ladder claims the space in front of its wall, a jump the air over its gap
// (nothing else may cross there), and the edges they use never get fences
const overlaps = (list, cl) => list.some(o => !(o.hi + 2 <= cl.lo || cl.hi + 2 <= o.lo));
export function placeClimb(m, claims, pathEdges, ladders) {
  if (m.kind === 'jump') {
    const air = [];
    for (let j = 1; j <= m.gap; j++) air.push({ c: idx(m.from.x + DIRS[m.d][0] * j, m.from.z + DIRS[m.d][1] * j), lo: m.from.top - 4, hi: m.from.top + 4 });
    if (air.some(cl => overlaps(claims[cl.c], cl))) return false;
    for (const cl of air) claims[cl.c].push(cl);
    pathEdges.add(m.from.id + ':' + m.d); pathEdges.add(m.to.id + ':' + OPP[m.d]);
    return true;
  }
  const { lo, hi } = m, wall = lo === m.from ? m.d : OPP[m.d];
  const cl = { c: lo.c, lo: lo.top, hi: hi.top + 1 };
  if (overlaps(claims[lo.c], cl)) return false;
  claims[lo.c].push(cl);
  pathEdges.add(lo.id + ':' + wall); pathEdges.add(hi.id + ':' + OPP[wall]);
  if (!ladders.some(l => l.lo === lo && l.hi === hi)) ladders.push({ lo, hi, d: wall });
  return true;
}

// what the game needs to know about a ladder (plain data)
export const ladderInfo = l => ({
  c: l.lo.c, x: l.lo.x, z: l.lo.z, d: l.d, y0: l.lo.top * LH, y1: l.hi.top * LH, layer: l.lo.layer, lo: l.lo.id, hi: l.hi.id,
});
