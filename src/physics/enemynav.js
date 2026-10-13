// Floor-graph navigation for enemies. Clearance is species-specific: a Stunder
// cannot fit through the low ceilings that a spider can. Neither climbs / jumps.
import { DIRS } from '../core/constants.js';
import { floorY } from '../core/surfaces.js';
import { floorWalkable, floorNeighbor } from './floornav.js';
import { state } from '../game/state.js';
import { cellAt, insideSolid } from './collide.js';
import { containsXZ } from '../core/blockers.js';

export const walkable = (f, height = .9, player = false) => floorWalkable(state.map, f, height, player);
const dirOf = (dx, dz) => DIRS.findIndex(([x, z]) => x === dx && z === dz);
// ok: which floors may be entered (default: walkable for this height)
const via = (f, d, height, ok) => floorNeighbor(state.map, f, d, height, ok);
export const neighbors = (f, height = 0.9, ok) => [0, 1, 2, 3].map(d => via(f, d, height, ok)).filter(Boolean);
export function floorAt(f, x, z, height = 0.9) {
  const c = cellAt(x, z);
  if (c < 0) return null;
  if (c === f.c) return walkable(f, height) ? f : null;
  const dx = Math.floor(x) - f.x, dz = Math.floor(z) - f.z;
  if (Math.abs(dx) > 1 || Math.abs(dz) > 1) return null;
  if (!dx || !dz) return via(f, dirOf(dx, dz), height);
  const a = via(f, dirOf(dx, 0), height), b = via(f, dirOf(0, dz), height);
  const g1 = a && via(a, dirOf(0, dz), height), g2 = b && via(b, dirOf(dx, 0), height);
  return g1 && g2 === g1 ? g1 : null;
}
export const groundY = (f, x, z) => floorY(f, x - f.x, z - f.z);

export function stepEnemy(s, mx, mz, radius = s.profile.radius, height = s.profile.height) {
  const go = (x, z) => {
    const g = floorAt(s.f, x, z, height);
    if (!g) return false;
    for (const [ox, oz] of [[radius, 0], [-radius, 0], [0, radius], [0, -radius]])
      if (!floorAt(g, x + ox, z + oz, height)) return false;
    s.x = x; s.z = z; s.f = g; s.y = groundY(g, x, z);
    return true;
  };
  return go(s.x + mx, s.z + mz) || go(s.x + mx, s.z) || go(s.x, s.z + mz);
}
// learn: paths.html#bfs-code (see learn/README.md)
export function findPath(a, b, maxLen, height = 0.9) {
  if (!a || !b || !walkable(a, height) || !walkable(b, height)) return null;
  const prev = new Map([[a, null]]);
  let front = [a];
  for (let d = 0; d < maxLen && front.length && !prev.has(b); d++) {
    const next = [];
    for (const f of front) for (const g of neighbors(f, height))
      if (!prev.has(g)) { prev.set(g, f); next.push(g); }
    front = next;
  }
  if (!prev.has(b)) return null;
  const path = [];
  for (let f = b; f; f = prev.get(f)) path.unshift(f);
  return path;
}
export function around(f, n, height = 0.9) {
  const seen = new Set([f]);
  let front = [f];
  for (let d = 0; d < n; d++)
    front = front.flatMap(g => neighbors(g, height).filter(h => !seen.has(h) && seen.add(h)));
  return [...seen];
}
// learn: paths.html#sight (see learn/README.md)
export function clearLine(ax, ay, az, bx, by, bz) {
  const n = Math.ceil(Math.hypot(bx - ax, by - ay, bz - az) / 0.15);
  for (let i = 1; i < n; i++) {
    const t = i / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t, z = az + (bz - az) * t;
    if (insideSolid(x, z, y)) return false;
    const c = cellAt(x, z);
    if ((state.map.blockers?.[c] || []).some(b => y > b.bottom && y < b.top && containsXZ(b, x, z))) return false;
  }
  return true;
}
