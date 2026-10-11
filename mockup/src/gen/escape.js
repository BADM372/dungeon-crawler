// Ways out for fall landings: where the character can fall in from the cube above, the spot
// it lands on must lead to the exit. Landings that do not get a route of their own (stairs,
// ladders, bridges) to the exit; any left over are moved by the fall itself (game/fall.js).
import { N } from '../core/constants.js';
import { reachTo } from './reach.js';
import { search, take } from './route.js';

const MAX = 6;   // escape routes per cube

export function addEscapes(ctx) {
  const { spec, hub, cols, jitter, have } = ctx;
  if (!hub || !spec.fallIn) return;
  let safe = reachTo(ctx, hub, false), n = 0;
  for (let c = 0; c < N * N && n < MAX; c++) {
    const f = spec.fallIn[c] && cols[c][cols[c].length - 1];
    if (!f || f.fluid || f.prot || safe.has(f.id)) continue;
    n++;
    if (take(ctx, search(ctx, f, hub, jitter, have))) { safe = reachTo(ctx, hub, false); ctx.stats.escapes = (ctx.stats.escapes || 0) + 1; }
  }
}
