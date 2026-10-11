// Town policy and authored clearing plans. Pure data; also runs in the worker.
import { N, LH } from '../core/constants.js';
import { mulberry32, hash32 } from '../core/util.js';
import { parse, step } from './coords.js';

export const TOWN_KEY = '0,0,0';
export const TOWN_LEVEL = 4;
export const isTown = k => k === TOWN_KEY;
// The surface road's direction is seed % 4 (see layout.js). Reserve its first cube.
export const merchantCampKey = seed => step(TOWN_KEY, seed % 4);
export const isMerchantCamp = (k, seed) => k === merchantCampKey(seed);
export const isClearing = (k, seed) => isTown(k) || isMerchantCamp(k, seed);
export const enemyFreeAt = k => { const [x, y, z] = parse(k); return y === 0 && Math.max(Math.abs(x), Math.abs(z)) <= 1; };
export const townExitPosition = d => d === 0 || d === 3 ? 8 : 7;
const exitYaw = [-Math.PI / 2, Math.PI / 2, Math.PI, 0];

export function rotateTownPoint(x, z, yaw) {
  const dx = x - N / 2, dz = z - N / 2, c = Math.cos(yaw), s = Math.sin(yaw);
  return [N / 2 + dx * c + dz * s, N / 2 - dx * s + dz * c];
}

// Full exported footprint bounds in glTF X/Z, INCLUDING attached porches/props.
// Tests compare these to blender/town/*.glb. The asymmetric plan faces the clearing,
// not a street grid; individual yaws are deliberately not quarter turns.
export const BUILDINGS = [
  { name: 'town_inn_a', x: 3.5, z: 3.3, yaw: -.18, bounds: [-2.310, -1.764, 2.074, 2.459], height: 4.790 },
  { name: 'town_stable_a', x: 12.3, z: 3.9, yaw: .25, bounds: [-2.440, -1.564, 2.224, 2.142], height: 3.293 },
  { name: 'town_blacksmith_a', x: 3.1, z: 10.9, yaw: 1.32, bounds: [-2.446, -1.564, 2.578, 1.731], height: 3.376 },
  { name: 'town_pet_shop_a', x: 11.5, z: 12.6, yaw: -2.65, bounds: [-1.771, -1.489, 2.494, 2.122], height: 3.333 },
];
export const MERCHANTS = [
  { name: 'town_merchant_a', x: 4.0, z: 11.2, yaw: 1.35, bounds: [-1.551, -1.276, 1.786, 1.628], height: 2.630 },
  { name: 'town_merchant_b', x: 12.0, z: 8.0, yaw: -1.75, bounds: [-1.701, -1.276, 1.612, 1.644], height: 2.697 },
  { name: 'town_merchant_c', x: 4.6, z: 3.8, yaw: .85, bounds: [-1.671, -1.276, 1.801, 1.637], height: 2.757 },
];
const TREES = [
  { name: 'town_tree_oak_a', height: 6.8, radius: 1.30, trunk: .334, canopy: 4.01 },
  { name: 'town_tree_elm_a', height: 7.1, radius: 1.05, trunk: .276, canopy: 4.19 },
  { name: 'town_tree_birch_a', height: 6.1, radius: .85, trunk: .218, canopy: 3.59 },
];
// Deliberate gap at the north gate; the whole plan rotates with the single exit.
const GROVE = [[.65, 1.0], [.65, 5.7], [.65, 11.3], [1.0, 15.15],
  [15.25, 1.0], [15.25, 5.9], [15.25, 11.25], [15.1, 15.2],
  [3.8, .65], [6.5, .65], [10.7, .65], [13.4, .65],
  [3.8, 15.3], [6.2, 15.3], [10.25, 15.3], [13.2, 15.3]];

function clearingPlan(exit, seed, buildings) {
  const yaw = exitYaw[exit];
  if (yaw === undefined) throw new Error('Clearing needs a side exit');
  const y = TOWN_LEVEL * LH, R = mulberry32(hash32(seed ^ 0x70a11));
  const placements = [], colliders = [], occluders = [], frontages = [], paths = [];
  const add = (name, x, z, localYaw = 0, s = 1) => {
    const [rx, rz] = rotateTownPoint(x, z, yaw);
    const p = { name, x: rx, y, z: rz, yaw: localYaw + yaw, s, tint: null };
    placements.push(p); return p;
  };
  for (const b of buildings) {
    const p = add(b.name, b.x, b.z, b.yaw), [x0, z0, x1, z1] = b.bounds;
    const c = Math.cos(p.yaw), s = Math.sin(p.yaw);
    const points = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].map(([x, z]) => [p.x + x * c + z * s, p.z - x * s + z * c]);
    const box = { shape: 'box', name: b.name, x0: Math.min(...points.map(p => p[0])), x1: Math.max(...points.map(p => p[0])),
      z0: Math.min(...points.map(p => p[1])), z1: Math.max(...points.map(p => p[1])), bottom: y, top: y + b.height };
    colliders.push(box); occluders.push(box);
    // Frontage must clear the conservative axis-aligned envelope as well as the mesh.
    const dx = Math.sin(p.yaw), dz = Math.cos(p.yaw);
    const tx = Math.abs(dx) < 1e-6 ? Infinity : ((dx > 0 ? box.x1 : box.x0) - p.x) / dx;
    const tz = Math.abs(dz) < 1e-6 ? Infinity : ((dz > 0 ? box.z1 : box.z0) - p.z) / dz;
    const distance = Math.min(tx, tz) + 1.1;
    frontages.push({ name: b.name, x: p.x + dx * distance, z: p.z + dz * distance });
  }
  // Quadratic curves sampled in world coordinates, independent of the floor grid.
  const path = (from, via, to, width = .75) => {
    const points = Array.from({ length: 25 }, (_, i) => {
      const t = i / 24, u = 1 - t;
      return rotateTownPoint(u * u * from[0] + 2 * u * t * via[0] + t * t * to[0],
        u * u * from[1] + 2 * u * t * via[1] + t * t * to[1], yaw);
    });
    paths.push({ points, width });
  };
  const tree = (i, x, z) => {
    const t = TREES[i % TREES.length], scale = .94 + R() * .08;
    const p = add(t.name, x, z, R() * Math.PI * 2, scale);
    const trunk = { name: p.name, x: p.x, z: p.z, r: t.trunk * scale, bottom: y, top: y + t.canopy * scale };
    colliders.push(trunk); occluders.push(trunk);
    occluders.push({ shape: 'ellipsoid', x: p.x, z: p.z, y: y + t.height * .79 * scale,
      rx: t.radius * scale, rz: t.radius * scale, ry: t.height * .21 * scale,
      top: y + t.height * scale, bottom: y + t.canopy * scale });
  };
  const [sx, sz] = rotateTownPoint(8.5, 8.5, yaw);
  return { plan: { placements, colliders, occluders, frontages, paths, pond: [], yaw,
    spawn: [Math.floor(sx), Math.floor(sz)] }, add, path, tree, R };
}

function frontagePaths(plan, path, via) {
  plan.frontages.forEach((p, i) => {
    const to = rotateTownPoint(p.x, p.z, -plan.yaw);
    path([8.5, 8.5], via[i], to, .65);
  });
}

export function townPlan(exit, seed) {
  const { plan, add, path, tree, R } = clearingPlan(exit, seed, BUILDINGS);
  GROVE.forEach(([x, z], i) => tree(i, x, z));
  // Planting stays in reserved pockets, away from the walking routes.
  for (const [x, z] of [[.75, 3.3], [.8, 8.4], [.8, 13.5], [15.2, 3.5], [15.2, 8.6],
    [15.2, 13.4], [2.2, .6], [5.2, .6], [12, .6], [2.1, 15.4], [8.4, 15.4], [11.8, 15.4]]) {
    add('meadow_bush_' + (R() < .5 ? 'a' : 'b'), x, z, R() * Math.PI * 2, 1.05 + R() * .25);
  }
  for (const [x, z] of [[5.9, 6.6], [7.0, 11.8], [10.5, 7.4], [5.0, 14.0]])
    add('meadow_flowers_a', x, z, R() * Math.PI * 2, .9);
  plan.pond = [[6, 3], [7, 3], [6, 4], [7, 4], [7, 5]].map(([x, z]) => {
    const [rx, rz] = rotateTownPoint(x + .5, z + .5, plan.yaw); return Math.floor(rz) * N + Math.floor(rx);
  });
  path([8.5, 8.5], [9.3, 5.8], [8.8, 2.6]);
  path([8.8, 2.6], [8.7, 1.2], [8.5, 0]);
  frontagePaths(plan, path, [[5.6, 7.2], [10.7, 8.2], [7.0, 9.6], [9.8, 8.2]]);
  return plan;
}

export function merchantCampPlan(exit, seed) {
  const { plan, add, path, tree, R } = clearingPlan(exit, seed, MERCHANTS);
  // Open at both ends of the road; tents flank it instead of forming another row.
  [[1.0, 1.4], [14.7, 2.2], [1.0, 7.0], [14.9, 11.6], [2.0, 14.9], [12.9, 14.9]]
    .forEach(([x, z], i) => tree(i, x, z));
  for (const [x, z] of [[2.0, 5.0], [13.9, 4.7], [1.5, 12.5], [11.4, 14.5]])
    add('meadow_bush_a', x, z, R() * Math.PI * 2, 1.1);
  path([8.5, 16], [10.0, 12.0], [8.5, 8.5], .85);
  path([8.5, 8.5], [7.8, 4.1], [8.5, 0], .85);
  frontagePaths(plan, path, [[7.9, 10.5], [9.0, 8.0], [7.6, 6.5]]);
  return plan;
}
