// A local patch for a wild pack, not a room/arena generator. Everything outside the
// footprint keeps the normal archetype, layers, rivers, shafts and shared faces.
import { N, HEAD, MAX_L } from '../core/constants.js';
import { idx, hash32, mulberry32 } from '../core/util.js';
import { floorY } from '../core/surfaces.js';
import { ENEMY_KINDS } from '../core/enemies.js';
import { floorWalkable, floorNeighbor } from '../physics/floornav.js';
import { search, take } from './route.js';
import { reachTo } from './reach.js';

export function reserveHorde(ctx) {
  if (!ctx.spec.horde) return true;
  const R = mulberry32(hash32(ctx.seed ^ 0x40ad5)), candidates = [];
  const protectedCells = new Set(ctx.portals.flatMap(p => p.cells));
  for (const spout of ctx.spouts) for (const c of spout.cells) protectedCells.add(c);
  const preferred = ctx.portals.find(p => p.dir !== ctx.spec.exit)?.layer ?? 0;
  // Size to the pack (at most 5x5) plus one-cell manoeuvring margin. Rotate narrow
  // footprints to fit a riverbank/terrace rather than reshaping the river or whole cube.
  const width = Math.ceil(Math.sqrt(ctx.spec.horde.count)), height = Math.ceil(ctx.spec.horde.count / width);
  const shapes = width === height ? [[width, height]] : [[width, height], [height, width]];
  for (const [w, h] of shapes) for (let layer = 0; layer < ctx.K; layer++)
    for (let cz = 2; cz < N - 2; cz++) for (let cx = 2; cx < N - 2; cx++) {
      const cells = [], spawnCells = [], x0 = -Math.floor(w / 2), z0 = -Math.floor(h / 2);
      let fits = true;
      for (let dz = z0 - 1; dz <= z0 + h; dz++) for (let dx = x0 - 1; dx <= x0 + w; dx++) {
        const x = cx + dx, z = cz + dz;
        if (x < 1 || z < 1 || x >= N - 1 || z >= N - 1) { fits = false; continue; }
        const c = idx(x, z); cells.push(c);
        if (dx >= x0 && dx < x0 + w && dz >= z0 && dz < z0 + h) spawnCells.push(c);
      }
      const protectedCell = c => ctx.siteSpace.has(c) || protectedCells.has(c) || ctx.sky.has(c);
      if (!fits || spawnCells.some(protectedCell)) continue;
      if (spawnCells.some(c => ctx.portals.some(p => Math.hypot(c % N - p.c % N, Math.floor(c / N) - Math.floor(p.c / N)) < 4))) continue;
      if (!layer && spawnCells.some(c => ctx.fluid0[c])) continue;
      const level = layer ? ctx.B[layer] : Math.min(MAX_L - 2, Math.max(4, Math.round(spawnCells.reduce((n, c) => n + ctx.lvl0[c], 0) / spawnCells.length)));
      const available = c => !protectedCell(c) && (layer
        ? ctx.void0[c] || Math.max(ctx.lvl0[c], ctx.surf0[c]) + HEAD <= level - 2 : !ctx.fluid0[c]);
      if (spawnCells.some(c => !available(c))) continue;
      // The margin follows dry free space; it must not dam a river or erase a shaft.
      const footprint = cells.filter(available);
      const shaping = layer ? 0 : footprint.reduce((n, c) => n + Math.abs(ctx.lvl0[c] - level), 0) / footprint.length;
      const filled = footprint.filter(c => ctx.void0[c]).length / footprint.length;
      candidates.push({ cx, cz, layer, level, cells: footprint, spawnCells,
        score: R() * 2 - shaping - filled * 3 + (layer === preferred ? 3 : 0) });
    }
  candidates.sort((a, b) => b.score - a.score);
  const patch = ctx.hordePatch = candidates[0];
  if (!patch) return false;
  const site = { id: ctx.spec.horde.id, anchorCell: idx(patch.cx, patch.cz) }, spawns = new Set(patch.spawnCells);
  for (const c of patch.cells) {
    ctx.siteSpace.set(c, { site, layer: patch.layer, top: patch.level, horde: true, spawn: spawns.has(c) });
    if (!patch.layer) { ctx.lvl0[c] = patch.level; ctx.void0[c] = 0; }
  }
  return true;
}

// The player can approach, fight and leave, even if the surrounding route uses stairs.
// Individual members never need to jump/climb to reach one another inside the patch.
export function routeHorde(ctx) {
  if (!ctx.spec.horde) return true;
  const patch = ctx.hordePatch, floor = ctx.layerFloor(idx(patch.cx, patch.cz), patch.layer);
  if (!floor) return false;
  const entry = ctx.portalFloors.find(f => f !== ctx.hub) || ctx.portalFloors[0], exit = ctx.hub || entry;
  if (!entry || !exit) return false;
  const approach = search(ctx, entry, floor, ctx.jitter, ctx.have), onward = search(ctx, floor, exit, ctx.jitter, ctx.have);
  if (!approach || !onward) return false;
  take(ctx, approach); take(ctx, onward); ctx.reqMoves = ctx.moves.length;
  Object.assign(patch, { floor, entry, exit });
  return true;
}

// Validate with the same clearance and fence-aware floor links used by live enemies.
export function finishHorde(ctx, blockers) {
  if (!ctx.spec.horde) return undefined;
  const patch = ctx.hordePatch, { floor, entry, exit } = patch, kind = ENEMY_KINDS[ctx.spec.horde.kind];
  if (!reachTo(ctx, floor, true)?.has(entry.id) || !reachTo(ctx, exit, true)?.has(floor.id)) return null;
  const map = { ...ctx, blockers }, seen = new Set([floor]), queue = [floor];
  if (!floorWalkable(map, floor, kind.height)) return null;
  for (let i = 0; i < queue.length; i++) for (let d = 0; d < 4; d++) {
    const g = floorNeighbor(map, queue[i], d, kind.height);
    if (g && g.hordeReserved && !seen.has(g)) { seen.add(g); queue.push(g); }
  }
  const spawns = patch.spawnCells.map(c => ctx.layerFloor(c, patch.layer));
  if (spawns.some(f => !f || !seen.has(f) || !floorWalkable(map, f, kind.height))) return null;
  return { ...ctx.spec.horde, floor, layer: patch.layer, cells: patch.cells, spawnFloors: spawns,
    entryFloor: entry.id, exitFloor: exit.id,
    anchor: { x: floor.x + .5, y: floorY(floor, .5, .5), z: floor.z + .5 }, radius: 10, wild: true };
}
