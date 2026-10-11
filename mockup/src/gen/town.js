// An authored clearing, not a lucky outcome of terrain retries. All dry ground
// is exactly level. Static colliders exist before rendering or asset downloads.
import { N, LH, WATER, DIRS, CHAR_R } from '../core/constants.js';
import { containsXZ, indexBlockers } from '../core/blockers.js';
import { createContext } from './context.js';
import { edgeCell } from './portals.js';
import { TOWN_LEVEL, townPlan, rotateTownPoint } from '../world/town.js';

export function generateTown(spec) {
  const side = spec.portals.filter(p => p.dir < 4);
  if (side.length !== 1 || spec.portals.length !== 1) throw new Error('Town must have exactly one side exit');
  const plan = townPlan(spec.exit, spec.seed), ctx = createContext(spec.seed);
  const wet = new Set(plan.pond), floors = [];
  for (let c = 0; c < N * N; c++) {
    const f = ctx.mk(c, wet.has(c) ? TOWN_LEVEL - 3 : TOWN_LEVEL, 0, 0);
    f.id = c; f.cs = Array(4).fill(f.top * LH); f.split = c % 2;
    if (wet.has(c)) { f.fluid = WATER; f.surf = TOWN_LEVEL - 1; }
    const [x, z] = rotateTownPoint(f.x + .5, f.z + .5, -plan.yaw);
    f.townPath = !f.fluid && !plan.colliders.some(b => containsXZ(b, f.x + .5, f.z + .5))
      && ((x >= 6 && x <= 10.8 && z >= 6 && z <= 10.8)
        || (x >= 8 && x <= 9.5 && z <= 11.5)
        || (x >= 2 && x <= 14 && ((z >= 5 && z < 6) || (z >= 11 && z < 12)))
        || (((x >= 5 && x < 6) || (x >= 10 && x < 11)) && z >= 5 && z < 12));
    ctx.cols[c].push(f); floors.push(f);
  }
  for (const f of floors) f.link = DIRS.map(([dx, dz]) => {
    const x = f.x + dx, z = f.z + dz;
    if (x < 0 || z < 0 || x >= N || z >= N) return null;
    const g = floors[z * N + x]; return g.fluid === f.fluid ? g : null;
  });
  const sp = side[0], cells = [];
  for (let t = sp.pos - 1; t <= sp.pos + 1; t++) for (let j = 0; j < 2; j++) cells.push(edgeCell(sp.dir, t, j));
  const [sx, sz] = plan.spawn, sc = sz * N + sx;
  const portals = [
    { id: 1, kind: 'side', dir: sp.dir, layer: 0, x: edgeCell(sp.dir, sp.pos, 0) % N,
      z: Math.floor(edgeCell(sp.dir, sp.pos, 0) / N), y: TOWN_LEVEL * LH, cells },
    { id: 2, kind: 'spawn', dir: -1, layer: 0, x: sx, z: sz, y: TOWN_LEVEL * LH,
      cells: Array.from({ length: 9 }, (_, i) => (sz + Math.floor(i / 3) - 1) * N + sx + i % 3 - 1) },
  ];
  for (const p of portals) {
    p.floor = floors[p.z * N + p.x];
    for (const c of p.cells) floors[c].prot = p.id;
  }
  const staticBlockers = indexBlockers(plan.colliders);
  const clear = f => !f.fluid && !plan.colliders.some(b => containsXZ(b, f.x + .5, f.z + .5, CHAR_R + .03));
  // Flood-fill after buildings AND trunks. Guarantees a dry walking route to the gate.
  const prev = new Map([[sc, null]]), queue = [sc];
  for (let i = 0; i < queue.length; i++) for (const g of floors[queue[i]].link)
    if (g && clear(g) && !prev.has(g.c)) { prev.set(g.c, queue[i]); queue.push(g.c); }
  const goal = portals[0].floor.c;
  if (!clear(floors[sc]) || !prev.has(goal)) throw new Error('Town layout blocks spawn or exit');
  if (plan.frontages.some(p => !prev.has(Math.floor(p.z) * N + Math.floor(p.x))))
    throw new Error('Town layout blocks a building frontage');
  const path = [];
  for (let c = goal; c !== null; c = prev.get(c)) path.unshift(floors[c]);
  const moves = path.slice(1).map((to, i) => ({ kind: 'walk', from: path[i], to,
    d: DIRS.findIndex(([dx, dz]) => path[i].x + dx === to.x && path[i].z + dz === to.z), cells: [], cost: 1 }));
  ctx.stats.layers = 1; ctx.stats.mode = 'town'; ctx.stats.fluids = ['town pond'];
  return { seed: spec.seed, attempts: 1, K: 1, B: [0], cols: ctx.cols, floors,
    pieces: Array.from({ length: N * N }, () => []), runs: [], falls: [], ladders: [],
    fences: new Map(), fenceList: [], stats: ctx.stats, moves, portals, exit: spec.exit,
    safe: Uint8Array.from(floors, f => prev.has(f.c) ? 1 : 0),
    kind: 'meadow', archetype: 'plain', key: spec.key, depth: 0, cave: false, enemyFree: true,
    staticBlockers, blockers: staticBlockers, occluders: plan.occluders,
    town: { placements: plan.placements, frontages: plan.frontages, pond: plan.pond, yaw: plan.yaw },
    routes: [path.map(f => ({ x: f.x + .5, y: TOWN_LEVEL * LH + .12, z: f.z + .5 }))],
  };
}
