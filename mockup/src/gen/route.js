// A* from the entry floor to the exit floor over walk / drop / stair / bridge moves.
import { Heap } from '../core/heap.js';

export function findRoute(ctx) {
  const { R, SZ, entryF, exitF, movesFrom, mode, le } = ctx;
  const jitter = new Float32Array(SZ).map(() => R() * 0.6);   // varies the route per seed
  const gs = new Float64Array(SZ).fill(Infinity);
  const prev = new Array(SZ).fill(null);
  const closed = new Uint8Array(SZ);
  const hfn = f => Math.abs(f.x - exitF.x) + Math.abs(f.z - exitF.z);
  const open = new Heap();
  gs[entryF.id] = 0; open.push(hfn(entryF), entryF);
  while (open.size) {
    const cur = open.pop();
    if (cur === exitF) break;
    if (closed[cur.id]) continue;
    closed[cur.id] = 1;
    for (const mv of movesFrom(cur)) {
      const ng = gs[cur.id] + mv.cost + jitter[mv.to.id];
      if (ng < gs[mv.to.id]) { gs[mv.to.id] = ng; prev[mv.to.id] = mv; open.push(ng + hfn(mv.to), mv.to); }
    }
  }
  if (!isFinite(gs[exitF.id])) return false;

  const moves = [];
  for (let f = exitF; f !== entryF; f = prev[f.id].from) moves.unshift(prev[f.id]);
  const pathFloors = [entryF, ...moves.map(m => m.to).filter(n => !n.landing)];
  // a split layer only counts if the route really leaves it
  if (mode === 'split' && !pathFloors.some(f => f.layer !== le)) return false;
  // landings belong to the layer the climb started from (so they stay visible from below)
  for (const m of moves) if (m.to.landing) m.to.layer = m.from.layer;
  ctx.moves = moves; ctx.pathFloors = pathFloors;
  return true;
}
