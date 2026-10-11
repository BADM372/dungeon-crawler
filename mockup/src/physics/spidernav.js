// Spider navigation on the floor graph: spiders walk on plain floors (no fluids, nothing solid
// at body height) and only cross cell edges where two floors are linked into a slope.
import { DIRS } from '../core/constants.js';
import { floorY, runY } from '../core/surfaces.js';
import { state } from '../game/state.js';
import { cellAt, insideSolid } from './collide.js';

const CLEAR = 0.9;   // free height a spider needs above a floor
const free = new WeakMap();

export function walkable(f) {
  if (!f || f.kind || f.landing || f.fluid || f.covered || state.map.blockers?.[f.c]?.length) return false;
  let ok = free.get(f);
  if (ok === undefined) {
    const lo = floorY(f, 0.5, 0.5), hi = lo + CLEAR;
    ok = state.map.pieces[f.c].every(p => {
      if (p.kind === 'pillar') return p.bottom >= hi || p.top <= lo;
      const t = runY(p, 0.5, 0.5);
      return (p.kind === 'bridge' ? t - 0.2 : p.base) >= hi || t <= lo;
    });
    free.set(f, ok);
  }
  return ok;
}

const dirOf = (dx, dz) => DIRS.findIndex(([x, z]) => x === dx && z === dz);
const via = (f, d) => { const g = f.link[d]; return walkable(g) ? g : null; };
export const neighbors = f => [0, 1, 2, 3].map(d => via(f, d)).filter(Boolean);

// the floor a spider on floor f ends up on at (x, z), or null if it cannot go there
export function floorAt(f, x, z) {
  const c = cellAt(x, z);
  if (c < 0) return null;
  if (c === f.c) return f;
  const dx = Math.floor(x) - f.x, dz = Math.floor(z) - f.z;
  if (Math.abs(dx) > 1 || Math.abs(dz) > 1) return null;
  if (!dx || !dz) return via(f, dirOf(dx, dz));
  const a = via(f, dirOf(dx, 0)), b = via(f, dirOf(0, dz));
  const g1 = a && via(a, dirOf(0, dz)), g2 = b && via(b, dirOf(dx, 0));
  return g1 && g2 === g1 ? g1 : null;   // diagonal: both ways round must be open
}

export const groundY = (f, x, z) => floorY(f, x - f.x, z - f.z);

// move by (mx, mz), sliding along blocked edges; keeps r clearance to edges that block
export function stepSpider(s, mx, mz, r) {
  const go = (x, z) => {
    const g = floorAt(s.f, x, z);
    if (!g) return false;
    for (const [ox, oz] of [[r, 0], [-r, 0], [0, r], [0, -r]]) if (!floorAt(g, x + ox, z + oz)) return false;
    s.x = x; s.z = z; s.f = g; s.y = groundY(g, x, z);
    return true;
  };
  return go(s.x + mx, s.z + mz) || go(s.x + mx, s.z) || go(s.x, s.z + mz);
}

// shortest floor path from a to b (both included), at most maxLen steps, or null
export function findPath(a, b, maxLen) {
  if (!a || !b) return null;
  const prev = new Map([[a, null]]);
  let front = [a];
  for (let d = 0; d < maxLen && front.length && !prev.has(b); d++) {
    const next = [];
    for (const f of front) for (const g of neighbors(f)) if (!prev.has(g)) { prev.set(g, f); next.push(g); }
    front = next;
  }
  if (!prev.has(b)) return null;
  const path = [];
  for (let f = b; f; f = prev.get(f)) path.unshift(f);
  return path;
}

// floors reachable from f within n steps
export function around(f, n) {
  const seen = new Set([f]);
  let front = [f];
  for (let d = 0; d < n; d++) front = front.flatMap(g => neighbors(g).filter(h => !seen.has(h) && seen.add(h)));
  return [...seen];
}

// nothing solid between two points
export function clearLine(ax, ay, az, bx, by, bz) {
  const n = Math.ceil(Math.hypot(bx - ax, by - ay, bz - az) / 0.2);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (insideSolid(ax + (bx - ax) * t, az + (bz - az) * t, ay + (by - ay) * t)) return false;
  }
  return true;
}
