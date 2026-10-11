// The static geometry of a cube (terrain, structures, fluid volumes) as plain typed arrays per
// layer. Runs in the world worker; the main thread only wraps the arrays into meshes, for the
// active cube as well as for the low-detail neighbours.
import { N, BASE, FLUIDS } from '../core/constants.js';
import { GeoBuilder } from './builder.js';
import { BEDROCK, usePalette } from './palette.js';
import { themeAt } from '../world/depth.js';
import { buildFloors } from './floors.js';
import { buildStructures } from './structures.js';

export function buildCubeGeometry(m) {
  usePalette(themeAt(m.depth ?? 0));
  const layers = Array.from({ length: m.K }, () => ({
    terrain: new GeoBuilder(), wood: new GeoBuilder(),
    fluids: Object.fromEntries(FLUIDS.map(t => [t, new GeoBuilder()])),
  }));
  layers[0].terrain.box(0, -BASE, 0, N, 0, N, BEDROCK[0], BEDROCK[1]);
  buildFloors(m, layers);
  buildStructures(m, layers);
  const arr = b => b.pos.length ? b.arrays() : null;
  return layers.map(L => ({
    terrain: arr(L.terrain), wood: arr(L.wood),
    fluids: Object.fromEntries(FLUIDS.map(t => [t, arr(L.fluids[t])])),
  }));
}

// the buffers to transfer (instead of copy) when posting the geometry
export function buffers(geo) {
  const out = [];
  for (const L of geo) for (const a of [L.terrain, L.wood, ...Object.values(L.fluids)]) if (a) out.push(a.pos.buffer, a.nor.buffer, a.col.buffer);
  return out;
}
