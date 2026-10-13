// Worker-safe floor clearance and links, shared by generation and live enemy navigation.
import { LH } from '../core/constants.js';
import { edgeKey } from '../core/util.js';
import { floorY, runY } from '../core/surfaces.js';

const free = new WeakMap();
// enemies keep off stair landings and any cell with a prop in it; for the player (click to
// move, game/orders.js) only the floor and its headroom count, props are checked there
export function floorWalkable(map, f, height = 0.9, player = false) {
  if (!f || f.kind || f.fluid || f.covered || (!player && (f.landing || map.blockers?.[f.c]?.length))) return false;
  let byHeight = free.get(f);
  if (!byHeight) { byHeight = new Map(); free.set(f, byHeight); }
  if (!byHeight.has(height)) {
    const lo = floorY(f, 0.5, 0.5), hi = lo + height;
    const floors = (map.cols[f.c] || []).every(g => g === f
      || floorY(g, 0.5, 0.5) <= lo + 0.001 || g.bottom * LH >= hi);
    const pieces = (map.pieces[f.c] || []).every(p => {
      if (p.kind === 'pillar') return p.bottom >= hi || p.top <= lo;
      const t = runY(p, 0.5, 0.5);
      return (p.kind === 'bridge' ? t - 0.2 : p.base) >= hi || t <= lo;
    });
    byHeight.set(height, floors && pieces);
  }
  return byHeight.get(height);
}

export function floorNeighbor(map, f, d, height = 0.9, ok) {
  const g = f.link[d];
  if (!(ok ? ok(g) : floorWalkable(map, g, height))) return null;
  const lo = Math.min(floorY(f, .5, .5), floorY(g, .5, .5));
  const fence = map.fences?.get(edgeKey(f.x, f.z, g.x, g.z));
  if (fence?.some(e => e.ymax > lo && e.ymin < lo + height)) return null;
  return g;
}
