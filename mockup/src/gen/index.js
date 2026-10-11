// World generator: runs the stages in order and retries with a new seed on failure.
import { N, LH, DIRS } from '../core/constants.js';
import { hash32 } from '../core/util.js';
import { floorY, runY } from '../core/surfaces.js';
import { createContext } from './context.js';
import { chooseLayers, groundHeights } from './ground.js';
import { placePortals } from './portals.js';
import { shapeCube } from './archetypes.js';
import { ladderInfo } from './climbs.js';
import { carveRiver } from './river.js';
import { buildSlabs } from './slabs.js';
import { addRamps, addSupports } from './supports.js';
import { addPools } from './pools.js';
import { addStreams } from './streams.js';
import { makeMoves } from './moves.js';
import { findRoute, finishRoute } from './route.js';
import { addEscapes } from './escape.js';
import { reachTo, isCramped } from './reach.js';
import { placeStructures } from './place.js';
import { smooth } from './smooth.js';
import { shapeStructures } from './shape.js';
import { addFences } from './fences.js';

function indexFloors(ctx) {
  const floors = ctx.floors = [];
  for (const col of ctx.cols) {
    col.sort((a, b) => a.top - b.top);
    for (const f of col) { f.id = floors.length; floors.push(f); }
  }
  for (const p of ctx.portals) p.floor = ctx.cols[p.c].find(f => f.prot === p.id);
  ctx.portalFloors = ctx.portals.map(p => p.floor);
}

// polyline along route moves (debug overlay, test bots)
function pathPoints(ctx, moves) {
  const center = (c, y) => ({ x: c % N + 0.5, y: y + 0.12, z: ((c / N) | 0) + 0.5 });
  const nodeY = n => n.landing ? n.top * LH : floorY(n, 0.5, 0.5);
  if (!ctx.portalFloors.length) return [];
  const start = moves.length ? moves[0].from : ctx.portalFloors[0];
  const pts = [center(start.c, nodeY(start))];
  for (const m of moves) {
    if (m.cells.length) {
      const run = ctx.runs.find(r => r.from === m.from && r.to === m.to), back = ctx.runs.find(r => r.from === m.to && r.to === m.from);
      const pieces = run ? run.pieces : [...back.pieces].reverse();   // a structure used the other way round
      for (const p of pieces) pts.push(center(p.c, runY(p, 0.5, 0.5)));
    }
    // jumps: a waypoint at the take-off edge (bots jump there)
    if (m.kind === 'jump') { const c = center(m.from.c, nodeY(m.from)); pts.push({ x: c.x + DIRS[m.d][0] * 0.42, y: c.y, z: c.z + DIRS[m.d][1] * 0.42, takeoff: true }); }
    pts.push(center(m.to.c, nodeY(m.to)));
  }
  return pts;
}

function tryGenerate(seed, spec) {
  const ctx = createContext(seed);
  ctx.spec = spec;
  chooseLayers(ctx);
  groundHeights(ctx);
  shapeCube(ctx);
  placePortals(ctx);
  carveRiver(ctx);
  buildSlabs(ctx);
  addRamps(ctx);
  addSupports(ctx);
  addPools(ctx);
  addStreams(ctx);
  indexFloors(ctx);
  if (ctx.portalFloors.some(f => !f)) return null;
  makeMoves(ctx);
  if (!findRoute(ctx)) return null;
  addEscapes(ctx);
  finishRoute(ctx);
  if (!placeStructures(ctx)) return null;
  smooth(ctx);
  shapeStructures(ctx);
  addFences(ctx);
  // every portal must lead to the exit with the final slopes and fences
  const safe = reachTo(ctx, ctx.hub, true);
  if (safe && ctx.portalFloors.some(f => !safe.has(f.id))) return null;
  if (ctx.moves.some(m => isCramped(ctx, m.from) || isCramped(ctx, m.to))) return null;   // a route squeezes under a slab
  const { K, B, cols, floors, pieces, runs, falls, fences, fenceList, stats, moves } = ctx;
  const portals = ctx.portals.map(p => ({ id: p.id, kind: p.kind, dir: p.dir, layer: p.layer, cells: p.cells,
    x: p.c % N, z: (p.c / N) | 0, y: p.level * LH, floor: p.floor }));
  return {
    seed, K, B, cols, floors, pieces, runs, falls, fences, fenceList, stats, moves, portals,
    ladders: ctx.ladders.map(ladderInfo), exit: spec.exit,
    safe: Uint8Array.from(floors, f => !safe || safe.has(f.id) ? 1 : 0),   // floors that lead to the exit
    kind: spec.kind, archetype: spec.archetype, key: spec.key, depth: spec.depth, cave: !!spec.cave,
    routes: ctx.segments.map(s => pathPoints(ctx, s)),   // each portal -> the exit, then the way back
  };
}

// spec: what the world fixes for this cube (faces, portals, layers; see world/world.js)
export function generate(spec) {
  for (let a = 0; a < 200; a++) {
    const m = tryGenerate(hash32(spec.seed + a * 7919), spec);
    if (m) { m.seed = spec.seed; m.attempts = a + 1; return m; }
  }
  throw new Error('generator failed for cube ' + spec.key);
}
