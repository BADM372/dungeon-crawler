// A* from the first portal to every other one over walk / drop / stair / bridge moves. Moves
// already on the route are cheap, so later routes share the earlier ones where they can.
import { Heap } from '../core/heap.js';

const moveKey = m => m.kind + ':' + Math.min(m.from.id, m.to.id) + ':' + Math.max(m.from.id, m.to.id);

function search(ctx, from, goal, jitter, have) {
  const { SZ, movesFrom } = ctx;
  const gs = new Float64Array(SZ).fill(Infinity), prev = new Array(SZ).fill(null), closed = new Uint8Array(SZ);
  const hfn = f => Math.abs(f.x - goal.x) + Math.abs(f.z - goal.z);
  const open = new Heap();
  gs[from.id] = 0; open.push(hfn(from), from);
  while (open.size) {
    const cur = open.pop();
    if (cur === goal) break;
    if (closed[cur.id]) continue;
    closed[cur.id] = 1;
    for (const mv of movesFrom(cur)) {
      const ng = gs[cur.id] + (have.has(moveKey(mv)) ? 0.2 : mv.cost + jitter[mv.to.id]);
      if (ng < gs[mv.to.id]) { gs[mv.to.id] = ng; prev[mv.to.id] = mv; open.push(ng + hfn(mv.to), mv.to); }
    }
  }
  if (!isFinite(gs[goal.id])) return null;
  const moves = [];
  for (let f = goal; f !== from; f = prev[f.id].from) moves.unshift(prev[f.id]);
  return moves;
}

export function findRoute(ctx) {
  const { R, SZ, portalFloors } = ctx;
  if (!portalFloors.length) { Object.assign(ctx, { moves: [], segments: [], pathFloors: [] }); return true; }   // not part of the world
  const jitter = new Float32Array(SZ).map(() => R() * 0.6);   // varies the route per seed
  const [first, ...rest] = portalFloors, have = new Set(), moves = [], segments = [];
  for (const goal of rest) {
    const seg = search(ctx, first, goal, jitter, have);
    if (!seg) return false;
    segments.push(seg);
    for (const m of seg) if (!have.has(moveKey(m))) { have.add(moveKey(m)); moves.push(m); }
  }
  const pathFloors = [...new Set([first, ...moves.flatMap(m => [m.from, m.to])])].filter(n => !n.landing);
  // landings belong to the layer the climb started from (so they stay visible from below)
  for (const m of moves) if (m.to.landing) m.to.layer = m.from.layer;
  ctx.moves = moves; ctx.segments = segments; ctx.pathFloors = pathFloors;
  return true;
}
