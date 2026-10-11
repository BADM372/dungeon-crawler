// World generator: runs the stages in order and retries with a new seed on failure.
import * as THREE from 'three';
import { N, LH } from '../core/constants.js';
import { idx, hash32 } from '../core/util.js';
import { floorY, runY } from '../core/surfaces.js';
import { createContext } from './context.js';
import { chooseLayers, groundHeights } from './ground.js';
import { placePortals } from './portals.js';
import { carveRiver } from './river.js';
import { buildSlabs } from './slabs.js';
import { addRamps, addSupports } from './supports.js';
import { addPools } from './pools.js';
import { addStreams } from './streams.js';
import { makeMoves } from './moves.js';
import { findRoute } from './route.js';
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
  ctx.entryF = ctx.cols[idx(0, ctx.ez)].find(f => f.prot === 1);
  ctx.exitF = ctx.cols[idx(N - 1, ctx.xz)].find(f => f.prot === 2);
}

// polyline along the planned route (debug overlay)
function pathPoints(ctx) {
  const center = (c, y) => new THREE.Vector3(c % N + 0.5, y + 0.12, ((c / N) | 0) + 0.5);
  const nodeY = n => n.landing ? n.top * LH : floorY(n, 0.5, 0.5);
  const pts = [center(ctx.entryF.c, nodeY(ctx.entryF))];
  for (const m of ctx.moves) {
    if (m.cells.length) {
      const run = ctx.runs.find(r => r.from === m.from && r.to === m.to);
      for (const p of run.pieces) pts.push(center(p.c, runY(p, 0.5, 0.5)));
    }
    pts.push(center(m.to.c, nodeY(m.to)));
  }
  return pts;
}

function tryGenerate(seed) {
  const ctx = createContext(seed);
  chooseLayers(ctx);
  groundHeights(ctx);
  placePortals(ctx);
  carveRiver(ctx);
  buildSlabs(ctx);
  addRamps(ctx);
  addSupports(ctx);
  addPools(ctx);
  addStreams(ctx);
  indexFloors(ctx);
  if (!ctx.entryF || !ctx.exitF) return null;
  makeMoves(ctx);
  if (!findRoute(ctx) || !placeStructures(ctx)) return null;
  smooth(ctx);
  shapeStructures(ctx);
  addFences(ctx);
  const { K, B, mode, cols, floors, pieces, runs, falls, fences, fenceList, stats, moves } = ctx;
  return {
    seed, K, B, mode, cols, floors, pieces, runs, falls, fences, fenceList, stats, moves,
    pathPts: pathPoints(ctx),
    entry: { x: 0, z: ctx.ez, y: ctx.entryL * LH, floor: ctx.entryF, layer: ctx.le },
    exit: { x: N - 1, z: ctx.xz, y: ctx.exitL * LH, floor: ctx.exitF, layer: ctx.lx },
  };
}

export function generate(seed) {
  for (let a = 0; a < 120; a++) {
    const m = tryGenerate(hash32(seed + a * 7919));
    if (m) { m.seed = seed; m.attempts = a + 1; return m; }
  }
  throw new Error('generator failed for seed ' + seed);
}
