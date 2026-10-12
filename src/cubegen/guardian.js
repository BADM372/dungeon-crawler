// A deliberate descent arena: shared boundary terrain, one ground entrance, a dry
// open interior and a framed well at the far end. No terrain retries or optional clutter
// may move the guardian or break the defenders' floor graph.
import { N, LH, DIRS } from '../core/constants.js';
import { idx, edgeKey } from '../core/util.js';
import { createContext } from './context.js';
import { groundHeights } from './ground.js';
import { placePortals } from './portals.js';

export function generateGuardian(spec) {
  const entry = spec.portals.find(p => p.dir < 4);
  if (!entry || spec.portals.length !== 2 || !spec.portals.some(p => p.dir === 4) || entry.layer)
    throw new Error('Guardian arena needs one ground entrance and one descent');
  const ctx = createContext(spec.seed);
  ctx.spec = spec; ctx.K = 1; ctx.B = [0];
  groundHeights(ctx);
  const [dx, dz] = DIRS[entry.dir], level = entry.level;
  // Gate towards the wall opposite the entrance, with room to circle the guardian.
  const gx = dx ? dx > 0 ? 4 : N - 5 : N / 2;
  const gz = dz ? dz > 0 ? 4 : N - 5 : N / 2;
  ctx.spec = { ...spec, portals: [entry, { dir: 4, x: gx, z: gz }] };
  for (let z = 1; z < N - 1; z++) for (let x = 1; x < N - 1; x++) {
    ctx.lvl0[idx(x, z)] = level; ctx.void0[idx(x, z)] = 0;
  }
  placePortals(ctx);
  // Ordinary wells clamp their height; an arena's well shares the entrance level.
  ctx.portals[1].level = level;
  for (const c of ctx.portals[1].cells) ctx.lvl0[c] = level;
  const floors = [];
  for (let c = 0; c < N * N; c++) {
    const f = ctx.mk(c, ctx.lvl0[c], 0, 0);
    f.id = c; f.prot = ctx.prot0[c]; f.cs = Array(4).fill(f.top * LH); f.split = c % 2;
    f.encounter = f.x > 0 && f.z > 0 && f.x < N - 1 && f.z < N - 1;
    ctx.cols[c].push(f); floors.push(f);
  }
  for (const f of floors) f.link = DIRS.map(([x, z]) => {
    const nx = f.x + x, nz = f.z + z;
    if (nx < 0 || nz < 0 || nx >= N || nz >= N) return null;
    const g = floors[idx(nx, nz)]; return g.top === f.top ? g : null;
  });
  const portals = ctx.portals.map(p => ({ id: p.id, kind: p.kind, dir: p.dir, layer: 0, cells: p.cells,
    x: p.c % N, z: Math.floor(p.c / N), y: level * LH, floor: floors[p.c] }));
  const guardFloor = floors[idx(gx + dx * 2, gz + dz * 2)], entrance = portals[0];
  const guardian = { floor: guardFloor, x: guardFloor.x + .5, z: guardFloor.z + .5,
    y: level * LH, yaw: Math.atan2(dx, dz), approach: [dx, dz], portalId: portals[1].id };
  const prev = new Map([[entrance.floor, null]]), queue = [entrance.floor];
  for (let i = 0; i < queue.length; i++) for (const g of queue[i].link)
    if (g && !prev.has(g)) { prev.set(g, queue[i]); queue.push(g); }
  if (!prev.has(guardFloor) || !prev.has(portals[1].floor)) throw new Error('Disconnected guardian arena');
  const path = [];
  for (let f = portals[1].floor; f; f = prev.get(f)) path.unshift(f);
  const moves = path.slice(1).map((to, i) => ({ kind: 'walk', from: path[i], to, cells: [], cost: 1,
    d: DIRS.findIndex(([x, z]) => path[i].x + x === to.x && path[i].z + z === to.z) }));
  // Shared edges can be lower than the arena. Rails prevent accidental drops into
  // those perimeter pockets without altering the neighbouring cube's terrain.
  const fences = new Map(), fenceList = [];
  for (const f of floors) if (f.encounter) for (const [dx, dz] of DIRS) {
    const other = floors[idx(f.x + dx, f.z + dz)];
    if (other.encounter || other.top >= level - 1) continue;
    const x = f.x + (dx > 0 ? 1 : dx < 0 ? 0 : .5), z = f.z + (dz > 0 ? 1 : dz < 0 ? 0 : .5), y = level * LH;
    const pts = [-.43, 0, .43].map(t => [x - dz * t, y, z + dx * t]);
    const rail = { pts, ymin: y, ymax: y, layer: 0, show: true };
    fenceList.push(rail); fences.set(edgeKey(f.x, f.z, other.x, other.z), [rail]);
  }
  ctx.stats.layers = 1; ctx.stats.mode = 'guardian arena'; ctx.stats.fences = fenceList.length;
  return { seed: spec.seed, attempts: 1, K: 1, B: [0], cols: ctx.cols, floors,
    pieces: Array.from({ length: N * N }, () => []), runs: [], falls: [], ladders: [],
    fences, fenceList, stats: ctx.stats, moves, portals, exit: 4, guardian,
    safe: Uint8Array.from(floors, f => prev.has(f) ? 1 : 0),
    kind: spec.kind, archetype: 'arena', roomRole: 'guardian', biome: spec.biome,
    key: spec.key, depth: spec.depth, cave: !!spec.cave, enemyFree: false,
    rewardSites: [], siteFailures: [], sitePlacements: [], siteReservations: [],
    routes: [path, [...path].reverse()].map(p => p.map(f => ({ x: f.x + .5, y: level * LH + .12, z: f.z + .5 }))),
  };
}
