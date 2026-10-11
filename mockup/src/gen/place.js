// Turn route moves into structures (stair / bridge runs, landings) plus a few decorative
// extras. Claims keep structures apart from each other, from waterfalls and from the route.
import { N, SHEAD, OPP, DIRS } from '../core/constants.js';
import { inb, idx } from '../core/util.js';

export function placeStructures(ctx) {
  const { ri, cols, floors, falls, moves, pathFloors, movesFrom, stats } = ctx;
  const cellLists = () => Array.from({ length: N * N }, () => []);
  const pieces = cellLists(), claims = cellLists(), walkedIn = cellLists(), sweeps = cellLists(), runCells = cellLists();
  for (const f of falls) claims[f.c].push({ c: f.c, lo: f.bot, hi: f.top });
  for (const f of pathFloors) walkedIn[f.c].push(f);
  // vertical space the ball sweeps through when it walks or drops into a column
  for (const m of moves) if (!m.cells.length && !m.to.landing) sweeps[m.to.c].push([Math.min(m.from.top, m.to.top), Math.max(m.from.top, m.to.top) + 2]);
  const runs = [], landings = new Map();

  const runClaims = m => {
    const out = m.cells.map((c, j) => {
      const k = m.cells.length, h = m.from.top, rise = m.to.top - h;
      const a = h + rise * j / k, b = h + rise * (j + 1) / k;
      return { c, lo: Math.min(a, b) - 1, hi: Math.max(a, b) };
    });
    if (m.to.landing && !landings.has(m.to.id)) out.push({ c: m.to.c, lo: m.to.top - 1, hi: m.to.top });
    return out;
  };
  const apart = (a, b) => a.hi + SHEAD <= b.lo || b.hi + SHEAD <= a.lo;
  // a stair never runs right beside a bridge (or the other way round) at a similar height
  const besideOther = (m, cl) => {
    const x = cl.c % N, z = (cl.c / N) | 0;
    return DIRS.some(([dx, dz]) => inb(x + dx, z + dz) && runCells[idx(x + dx, z + dz)].some(o => o.kind !== m.kind && !apart(o, cl)));
  };
  const canPlace = m => runClaims(m).every((cl, j) =>
    claims[cl.c].every(o => apart(o, cl)) && !(j < m.cells.length && besideOther(m, cl)) &&
    walkedIn[cl.c].every(g => !(g.top > cl.lo - SHEAD && g.top <= cl.hi + 1)) &&   // room for the character's head
    sweeps[cl.c].every(([a, b]) => !(cl.lo <= b && cl.hi >= a)));
  // floors right under a stair / landing are covered by it: they must not be smoothed up through it
  const coverBelow = (c, lo) => { for (const g of cols[c]) if (g.top <= lo && lo - g.top < SHEAD) g.covered = true; };

  function placeLanding(n) {
    const run = { kind: 'landing', from: n, to: n, cells: [n.c], k: 1, sag: 0, layer: n.layer, conn: new Set() };
    run.pieces = [{ kind: 'landing', c: n.c, j: 0, dx: 1, dz: 0, run, y0: 0, y1: 0, base: 0 }];
    pieces[n.c].push(run.pieces[0]);
    coverBelow(n.c, n.top - 1);
    landings.set(n.id, run);
    runs.push(run);
  }
  function place(m) {
    runClaims(m).forEach((cl, j) => { claims[cl.c].push(cl); if (j < m.cells.length) runCells[cl.c].push({ kind: m.kind, lo: cl.lo, hi: cl.hi }); });
    if (m.to.landing && !landings.has(m.to.id)) placeLanding(m.to);
    if (m.kind === 'walkway') {
      landings.get(m.from.id).conn.add(m.d); landings.get(m.to.id).conn.add(OPP[m.d]);
      return;
    }
    const lo = m.from.top <= m.to.top ? m.from : m.to, hi = lo === m.from ? m.to : m.from;
    const run = { kind: m.kind, from: m.from, to: m.to, d: m.d, dx: m.dx, dz: m.dz, cells: m.cells, k: m.cells.length, sag: 0,
      layerLo: lo.layer, layerHi: hi.layer, layer: Math.min(lo.layer, hi.layer) };
    if (m.kind === 'stair') for (const cl of runClaims(m)) coverBelow(cl.c, cl.lo + 1);
    run.pieces = m.cells.map((c, j) => { const p = { kind: m.kind, c, j, dx: m.dx, dz: m.dz, run, y0: 0, y1: 0, base: 0 }; pieces[c].push(p); return p; });
    if (m.from.landing) landings.get(m.from.id).conn.add(m.d);
    if (m.to.landing) landings.get(m.to.id).conn.add(OPP[m.d]);
    runs.push(run);
    if (m.kind === 'stair') stats.stairs++; else stats.bridges++;
  }

  const pathEdges = new Set(), pathWalks = [];
  for (const m of moves) {
    if (m.cells.length || m.to.landing) { if (!canPlace(m)) return false; place(m); }
    else {
      pathEdges.add(m.from.id + ':' + m.d); pathEdges.add(m.to.id + ':' + OPP[m.d]);
      if (m.kind === 'walk') pathWalks.push(m);
    }
  }
  stats.landings = landings.size;

  // decorative extras off the route
  let ds = ri(1, 3), db = ri(0, 2), tries = 0;
  while ((ds > 0 || db > 0) && tries++ < 300) {
    const f = floors[ri(0, floors.length - 1)];
    if (f.fluid || f.prot) continue;
    const mvs = movesFrom(f, false).filter(m => (m.kind === 'stair' && ds > 0) || (m.kind === 'bridge' && db > 0));
    if (!mvs.length) continue;
    const m = mvs[ri(0, mvs.length - 1)];
    if (!canPlace(m)) continue;
    place(m);
    if (m.kind === 'stair') ds--; else db--;
  }
  Object.assign(ctx, { pieces, runs, pathEdges, pathWalks });
  return true;
}
