// The shape of the world: which cubes exist at each depth and how they are connected. It only
// depends on the world seed. The way down spirals inwards around the axis under the town:
//   depth 0: the town (0,0,0) and a short road out to the first well
//   depth 1-19: an arc of a ring (two cubes wide) around the axis. You come up through a ring
//     at one end and the well down is at the other, 150-240 degrees around; the next depth's
//     arc starts right below that well. The ring gets smaller the deeper you go.
//   depth 20: the core, around the axis
// A spine of portals always leads from the ring up to the well down; every other cube of the
// arc hangs off it (branches), and a few extra portals make loops.
import { mulberry32, hash32 } from '../core/util.js';
import { key, faceKey } from './coords.js';
import { MAX_DEPTH } from '../themes/depth.js';
import { planSites } from './sites.js';

const RADIUS = d => d === 0 || d >= MAX_DEPTH ? 0 : d <= 5 ? 3 : d <= 12 ? 2 : 1;
const AXES = [[1, 0], [-1, 0], [0, 1], [0, -1]];   // same order as the face directions
const cheb = (x, z) => Math.max(Math.abs(x), Math.abs(z));
const TAU = Math.PI * 2, ccw = a => ((a % TAU) + TAU) % TAU;
const nb = ([x, z]) => AXES.map(([dx, dz]) => [x + dx, z + dz]);
const id = ([x, z]) => x + ',' + z;

// cheapest path from a to b through the cells (random cell costs), as a list of cells
function path(cells, a, b, R) {
  const cost = new Map(cells.map(c => [id(c), 1 + R() * 1.5])), dist = new Map([[id(a), 0]]), prev = new Map();
  const open = [a];
  while (open.length) {
    open.sort((p, q) => dist.get(id(p)) - dist.get(id(q)));
    const c = open.shift();
    if (id(c) === id(b)) break;
    for (const n of nb(c)) {
      if (!cost.has(id(n))) continue;
      const g = dist.get(id(c)) + cost.get(id(n));
      if (g < (dist.get(id(n)) ?? Infinity)) { dist.set(id(n), g); prev.set(id(n), c); open.push(n); }
    }
  }
  const out = [b];
  while (id(out[0]) !== id(a)) out.unshift(prev.get(id(out[0])));
  return out;
}

function build(seed, d, above) {
  const R = mulberry32(hash32(seed ^ (d * 0x9e3779b1))), Y = -d;
  let cells, start, end;
  if (d === 0) {
    const a = AXES[seed % 4], r = RADIUS(1);
    cells = Array.from({ length: r + 1 }, (_, i) => [a[0] * i, a[1] * i]);
    start = cells[0]; end = cells[r];
  } else {
    const r = RADIUS(d);
    start = above.end;
    const band = [];
    for (let z = -r - 1; z <= r + 1; z++) for (let x = -r - 1; x <= r + 1; x++) if (cheb(x, z) === r || cheb(x, z) === r + 1) band.push([x, z]);
    if (d === MAX_DEPTH) { cells = band; end = [0, 0]; } else {
      const a0 = Math.atan2(start[1], start[0]), span = (150 + R() * 90) * Math.PI / 180;
      cells = band.filter(([x, z]) => ccw(Math.atan2(z, x) - a0 + 0.3) <= span + 0.6);
      // the well down: on the inner ring (which also belongs to the next depth's ring)
      const inner = cells.filter(([x, z]) => cheb(x, z) === r);
      const target = a0 + span, off = c => Math.abs(ccw(Math.atan2(c[1], c[0]) - target + Math.PI) - Math.PI);
      end = inner.reduce((b, c) => off(c) < off(b) ? c : b);
    }
  }
  const spine = d === 0 ? cells : path(cells, start, end, R);
  const portals = new Set(), K = ([x, z]) => key(x, Y, z);
  const link = (a, b) => { const dir = AXES.findIndex(([dx, dz]) => a[0] + dx === b[0] && a[1] + dz === b[1]); portals.add(faceKey(K(a), dir)); };
  for (let i = 1; i < spine.length; i++) link(spine[i - 1], spine[i]);
  // every other cell hangs off a neighbour that is closer to the spine; a few extra loops
  const dist = new Map(spine.map(c => [id(c), 0])), inArc = new Set(cells.map(id));
  for (let front = spine; front.length;) {
    const next = [];
    for (const c of front) for (const n of nb(c)) if (inArc.has(id(n)) && !dist.has(id(n))) { dist.set(id(n), dist.get(id(c)) + 1); link(c, n); next.push(n); }
    front = next;
  }
  for (const c of cells) for (const n of nb(c)) if (inArc.has(id(n)) && R() < 0.12) link(c, n);
  // each cube's exit: the portal one step closer to the well down (the core: to its centre)
  const exit = new Map(), goal = d < MAX_DEPTH ? end : [0, 0], seen = new Set([id(goal)]);
  if (d < MAX_DEPTH) exit.set(K(goal), 4);
  for (let front = [goal]; front.length;) {
    const next = [];
    for (const c of front) nb(c).forEach((n, dir) => {
      if (!inArc.has(id(n)) || seen.has(id(n)) || !portals.has(faceKey(K(c), dir))) return;
      seen.add(id(n)); exit.set(K(n), dir ^ 1); next.push(n);
    });
    front = next;
  }
  const layout = { depth: d, cells, start, end, spine: spine.length, exists: new Set(cells.map(K)), portals, exit,
    up: d ? K(start) : null, down: d < MAX_DEPTH ? K(end) : null };
  const sites = planSites(seed, layout, new Map([...dist].map(([c, n]) => [K(c.split(',').map(Number)), n])));
  layout.sitePlans = sites.plans; layout.roles = sites.roles;
  return layout;
}

// layouts for one world (each depth builds on the one above)
export function makeLayouts(seed) {
  const cache = [];
  const get = d => cache[d] || (cache[d] = build(seed, d, d ? get(d - 1) : null));
  return get;
}
