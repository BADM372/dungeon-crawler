// Where props go in a cube (deterministic from the cube's seed):
//   ground : on dry floors without structures; blocking ones (trees, boulders) never on the
//            route or near portals, and only on gentle ground. Neutral "any" rocks get tinted.
//   ceiling: hanging under floating slabs with room below
//   wall   : on cliff faces, sticking out over the lower side
// Returns the placements plus colliders per cell for the blocking ones.
import { N, LH, DIRS, EDGE_CORNERS } from '../core/constants.js';
import { mulberry32, hash32, idx, inb } from '../core/util.js';
import { floorY } from '../core/surfaces.js';
import { props } from './props.js';

// pick a prop for an attachment: theme props (priority 1 more often) and, on the ground,
// tinted neutral rocks; `blockOK` = blocking props are allowed here
function picker(theme, R) {
  // neutral props: rocks everywhere; stalagmites and stalactites only in caves
  const any = a => (props.sets.get('any/' + a) || []).filter(p => theme.cave || !p.base.startsWith('stala'));
  const lists = a => [...(props.sets.get(theme.props + '/' + a) || []), ...any(a)];
  const weight = p => (p.priority === 1 ? 3 : 1) * (p.blocking ? 0.6 : 1) * (p.set === 'any' ? 0.5 : 1);
  return (attach, blockOK) => {
    const c = lists(attach).filter(p => blockOK || !p.blocking);
    let r = R() * c.reduce((s, p) => s + weight(p), 0);
    for (const p of c) if ((r -= weight(p)) < 0) return p;
    return null;
  };
}

export function placeProps(m, theme) {
  const out = [], blockers = Array.from({ length: N * N }, () => []);
  if (m.authoredProps) return { out: m.authoredProps, blockers };
  if (!props.ready || !theme.props) return { out, blockers };
  const R = mulberry32(hash32(m.seed ^ 0x9a0b5)), pick = picker(theme, R);
  // where people walk: the route, every stair / bridge / landing and the floors at their ends.
  // Blocking props stay out of those columns and the ones next to them.
  const walkCols = new Set(m.moves.flatMap(mv => [mv.from.c, mv.to.c, ...mv.cells]));
  for (const r of m.runs) for (const c of [...r.cells, r.from.c, r.to.c]) walkCols.add(c);
  const nearRoute = f => [[0, 0], ...DIRS].some(([dx, dz]) => inb(f.x + dx, f.z + dz) && walkCols.has(idx(f.x + dx, f.z + dz)));
  // straight pieces (rails, timber frames) only turn in quarter steps
  const yawFor = p => /rail|frame/.test(p.base) ? Math.floor(R() * 4) * Math.PI / 2 : R() * Math.PI * 2;
  const nearPortal = f => m.portals.some(p => Math.abs(p.x - f.x) <= 2 && Math.abs(p.z - f.z) <= 2);
  const rock = theme.side[1][1];
  const add = (p, x, y, z, yaw, s) => out.push({ name: p.name, x, y, z, yaw, s, tint: p.set === 'any' ? rock : null });

  for (const f of m.floors) {
    const col = m.cols[f.c];
    // ground
    if (!f.fluid && !f.prot && !f.covered && !m.pieces[f.c].length && R() < (theme.propDensity ?? 0.32)) {
      const slope = Math.max(...f.cs) - Math.min(...f.cs);
      const p = pick('ground', !nearRoute(f) && !nearPortal(f) && slope < 0.6);
      const above = col[col.indexOf(f) + 1], s = 0.85 + R() * 0.3;
      // it has to fit under whatever is above this floor
      if (p && (!above || above.bottom * LH - Math.max(...f.cs) > p.height * s + 0.2)) {
        const room = Math.max(0, 0.9 - 2 * p.radius), fx = 0.5 + (R() - 0.5) * room, fz = 0.5 + (R() - 0.5) * room;
        const y = floorY(f, fx, fz) - 0.03;
        add(p, f.x + fx, y, f.z + fz, yawFor(p), s);
        if (p.blocking) blockers[f.c].push({ x: f.x + fx, z: f.z + fz, r: p.radius * s * 0.8, bottom: y, top: y + p.height * s });
      }
    }
    // ceiling: under a floating slab with at least two levels of air below
    const below = col[col.indexOf(f) - 1];
    if (f.layer > 0 && !f.merged && (!below || below.top < f.bottom - 2) && !m.pieces[f.c].length && R() < 0.3) {
      const p = pick('ceiling', false);
      if (p) add(p, f.x + 0.3 + R() * 0.4, f.bottom * LH, f.z + 0.3 + R() * 0.4, R() * Math.PI * 2, 0.8 + R() * 0.4);
    }
    // walls: cliff faces at least 1.5 high towards a lower neighbour (or the open void)
    if (f.fluid) continue;
    for (let d = 0; d < 4; d++) {
      const nx = f.x + DIRS[d][0], nz = f.z + DIRS[d][1];
      if (!inb(nx, nz) || f.link[d] || R() > 0.12) continue;
      const [a, b] = EDGE_CORNERS[d], top = Math.min(f.cs[a], f.cs[b]);
      let low = f.bottom * LH;
      for (const g of m.cols[idx(nx, nz)]) if (g.top * LH < top - 0.1) low = Math.max(low, g.fluid ? g.surf * LH : g.top * LH);
      if (top - low < 1.5) continue;
      const p = pick('wall', false);
      if (!p) continue;
      const t = 0.25 + R() * 0.5, [ex, ez] = [[1, t], [0, t], [t, 1], [t, 0]][d];
      // the prop sticks out along its -Z: turn that towards the lower side
      add(p, f.x + ex, low + (top - low) * (0.35 + R() * 0.4), f.z + ez, Math.atan2(-DIRS[d][0], -DIRS[d][1]), 0.8 + R() * 0.3);
    }
  }
  return { out, blockers };
}
