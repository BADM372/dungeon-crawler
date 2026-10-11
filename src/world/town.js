// Town policy and authored clearing plans. Pure data; also runs in the worker.
import { N, LH, CHAR_R } from '../core/constants.js';
import { mulberry32, hash32 } from '../core/util.js';
import { propMetadata } from '../core/propcatalog.js';
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
// Tests compare these to assets/town/*.glb. The asymmetric plan faces the clearing,
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

// Small catalog props dressing the clearings. Each has a kind deciding how it keeps
// clear of routes: `solid` ones collide, `prop` ones are knee-high or taller but
// walk-through, `cover` lies flat on the grass and may hug the path edges.
const clutterKind = m => m.blocking ? 'solid' : m.cover || m.height < .2 ? 'cover' : 'prop';
const variant = (R, base) => base + (R() < .5 ? '_a' : '_b');
const segmentDistance = (x, z, [ax, az], [bx, bz]) => {
  const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - ax - t * dx, z - az - t * dz);
};

function clearingPlan(exit, seed, buildings, gates) {
  const yaw = exitYaw[exit];
  if (yaw === undefined) throw new Error('Clearing needs a side exit');
  const y = TOWN_LEVEL * LH, R = mulberry32(hash32(seed ^ 0x70a11));
  const placements = [], colliders = [], occluders = [], frontages = [], paths = [];
  const footprints = [], clutter = [];
  const add = (name, x, z, localYaw = 0, s = 1) => {
    const [rx, rz] = rotateTownPoint(x, z, yaw);
    const p = { name, x: rx, y, z: rz, yaw: localYaw + yaw, s, tint: null };
    placements.push(p); return p;
  };
  for (const b of buildings) {
    const p = add(b.name, b.x, b.z, b.yaw), [x0, z0, x1, z1] = b.bounds;
    const c = Math.cos(p.yaw), s = Math.sin(p.yaw);
    footprints.push({ x: p.x, z: p.z, c, s, bounds: b.bounds });
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
  const plan = { placements, colliders, occluders, frontages, paths, pond: [], yaw,
    spawn: [Math.floor(sx), Math.floor(sz)] };
  // Solid clutter keeps away from gates, the spawn plaza and doorsteps, so every
  // generated route, gate cell and frontage stays walkable.
  const keepOut = () => [
    ...gates.map(([x, z]) => { const [gx, gz] = rotateTownPoint(x, z, yaw); return { x: gx, z: gz, r: 2.1 }; }),
    { x: sx, z: sz, r: 2.25 }, ...frontages.map(f => ({ x: f.x, z: f.z, r: 1.25 })),
  ];
  const wet = (x, z, r) => plan.pond.some(c => {
    const cx = c % N, cz = Math.floor(c / N);
    return Math.hypot(x - Math.max(cx, Math.min(cx + 1, x)), z - Math.max(cz, Math.min(cz + 1, z))) < r;
  });
  const fits = (x, z, r, kind, { water = false, shore = false } = {}) => {
    if (x - r < .05 || z - r < .05 || x + r > N - .05 || z + r > N - .05) return false;
    if (water ? !plan.pond.includes(Math.floor(z) * N + Math.floor(x)) : wet(x, z, shore ? .05 : kind === 'cover' ? r * .5 : r)) return false;
    for (const f of footprints) {
      const dx = x - f.x, dz = z - f.z, lx = dx * f.c - dz * f.s, lz = dx * f.s + dz * f.c, m = kind === 'cover' ? r * .5 : r;
      if (lx > f.bounds[0] - m && lx < f.bounds[2] + m && lz > f.bounds[1] - m && lz < f.bounds[3] + m) return false;
    }
    for (const b of colliders) if (b.shape !== 'box' && Math.hypot(x - b.x, z - b.z) < b.r + r * (kind === 'cover' ? .4 : 1) + (kind === 'solid' ? .15 : 0)) return false;
    const clearance = { solid: r + CHAR_R + .2, prop: r * .7 + .05, cover: r * .35 }[kind];
    for (const p of paths) for (let i = 1; i < p.points.length; i++)
      if (segmentDistance(x, z, p.points[i - 1], p.points[i]) < p.width / 2 + clearance) return false;
    if (Math.hypot(x - sx, z - sz) < 1.35 + r) return false;
    if (kind === 'solid' && keepOut().some(q => Math.hypot(x - q.x, z - q.z) < q.r + r)) return false;
    return !clutter.some(c => Math.hypot(x - c.x, z - c.z) < (r + c.r) * (kind === 'cover' && c.kind === 'cover' ? .55
      : kind === 'cover' || c.kind === 'cover' ? .7 : 1));
  };
  // Places at the first candidate (town-local coordinates) that fits, or nowhere.
  const put = (name, candidates, { yaw: localYaw, s = .9 + R() * .2, water = false, world = false, unlit = false } = {}) => {
    const m = propMetadata.get(name);
    if (!m) throw new Error('Unknown clutter prop ' + name);
    const kind = clutterKind(m), r = m.radius * s, py = water ? (TOWN_LEVEL - 1) * LH : y + (kind === 'cover' ? .008 : -.02);
    const turn = localYaw ?? R() * Math.PI * 2;
    for (const [lx, lz] of candidates) {
      const [x, z] = world ? [lx, lz] : rotateTownPoint(lx, lz, yaw);
      if (!fits(x, z, r, kind, { water, shore: !!m.shore })) continue;
      const p = { name, x, y: py, z, yaw: turn + yaw, s, tint: null, ...(unlit ? { unlit } : {}) };
      placements.push(p); clutter.push({ x, z, r, kind });
      if (kind === 'solid') colliders.push({ name, x, z, r: m.radius * s * .8, bottom: y, top: py + m.height * s });
      return p;
    }
    return null;
  };
  // A loose group: each item lands somewhere within `spread` of the anchor.
  const group = (anchors, items, spread = .9) => {
    for (const name of items) {
      const tries = anchors.flatMap(([ax, az]) => Array.from({ length: 6 }, () => {
        const a = R() * Math.PI * 2, d = Math.sqrt(R()) * spread;
        return [ax + Math.cos(a) * d, az + Math.sin(a) * d];
      }));
      put(name, tries);
    }
  };
  // Random fill, thinned out towards the open centre of the clearing.
  const scatter = (count, pick, open = 0, size = [.9, 1.1]) => {
    for (let placed = 0, tries = 0; placed < count && tries < count * 25; tries++) {
      const x = .2 + R() * (N - .4), z = .2 + R() * (N - .4);
      if (R() > open + Math.hypot(x - N / 2, z - N / 2) / 6) continue;
      if (put(pick(x, z), [[x, z]], { world: true, s: size[0] + R() * (size[1] - size[0]) })) placed++;
    }
  };
  const shore = () => {
    const out = [];
    for (const c of plan.pond) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = c % N + dx, z = Math.floor(c / N) + dz;
      if (!plan.pond.includes(z * N + x)) out.push([c % N + .5 + dx * .78, Math.floor(c / N) + .5 + dz * .78]);
    }
    return out.sort(() => R() - .5);
  };
  return { plan, add, path, tree, put, group, scatter, shore, R };
}

function frontagePaths(plan, path, via) {
  plan.frontages.forEach((p, i) => {
    const to = rotateTownPoint(p.x, p.z, -plan.yaw);
    path([8.5, 8.5], via[i], to, .65);
  });
}

// Meadow ground cover shared by both clearings, after the authored set pieces.
function groundCover(R, scatter, scale = 1) {
  const n = k => Math.round(k * scale), odd = ['any_rock_a', 'any_rock_b', 'any_rock_c',
    'meadow_mushroom_small_a', 'meadow_mushroom_small_b'];
  // Leafy things first so they get the spots along walls and under the grove.
  scatter(n(9), () => variant(R, R() < .4 ? 'meadow_fern' : R() < .6 ? 'meadow_berry_bush' : 'meadow_bush'), -.4, [.8, 1.15]);
  scatter(n(6), () => odd[Math.floor(R() * odd.length)], -.2);
  scatter(n(10), () => variant(R, 'meadow_flowers'), 0, [.8, 1.1]);
  scatter(n(14), () => variant(R, R() < .5 ? 'meadow_clover_patch' : 'meadow_daisies'), .1, [.9, 1.3]);
  scatter(n(7), () => variant(R, R() < .6 ? 'any_pebbles' : 'any_stone_chips'));
  scatter(n(70), () => variant(R, 'meadow_grass_tuft'), .3, [1, 1.45]);
}

export function townPlan(exit, seed) {
  const { plan, path, tree, put, group, scatter, shore, R } = clearingPlan(exit, seed, BUILDINGS, [[8.5, .9]]);
  GROVE.forEach(([x, z], i) => tree(i, x, z));
  // Planting stays in reserved pockets, away from the walking routes.
  for (const [x, z] of [[.75, 3.3], [.8, 8.4], [.8, 13.5], [15.2, 3.5], [15.2, 8.6],
    [15.2, 13.4], [2.2, .6], [5.2, .6], [12, .6], [2.1, 15.4], [8.4, 15.4], [11.8, 15.4]]) {
    put('meadow_bush_' + (R() < .5 ? 'a' : 'b'), [[x, z]], { s: 1.05 + R() * .25 });
  }
  for (const [x, z] of [[5.9, 6.6], [7.0, 11.8], [10.5, 7.4], [5.0, 14.0]])
    put('meadow_flowers_a', [[x, z]], { s: .9 });
  plan.pond = [[6, 3], [7, 3], [6, 4], [7, 4], [7, 5]].map(([x, z]) => {
    const [rx, rz] = rotateTownPoint(x + .5, z + .5, plan.yaw); return Math.floor(rz) * N + Math.floor(rx);
  });
  path([8.5, 8.5], [9.3, 5.8], [8.8, 2.6]);
  path([8.8, 2.6], [8.7, 1.2], [8.5, 0]);
  frontagePaths(plan, path, [[5.6, 7.2], [10.7, 8.2], [7.0, 9.6], [9.8, 8.2]]);

  // Set pieces: a waymark at the gate, lamps on the plaza, and each trade's leftovers.
  put('relics_signpost_a', [[7.3, 1.3], [7.4, 2.0], [9.9, 1.4]], { yaw: Math.PI / 2 + .3, s: 1 });
  put('mines_lantern_a', [[10.3, 9.9], [10.6, 10.3]], { s: 1, unlit: true });
  put('mines_lantern_b', [[6.6, 7.3], [6.4, 6.9]], { s: 1, unlit: true });
  put('mines_lantern_a', [[9.9, 4.2], [9.8, 5.0], [7.7, 6.4]], { s: 1, unlit: true });
  // Inn: deliveries by the side door, a cask by the porch.
  group([[6.2, 1.8]], ['mines_barrel_a', 'mines_barrel_b', 'mines_crate_a', 'mines_sacks_a'], .7);
  group([[1.2, 6.8]], ['mines_barrel_b', 'mines_crate_b'], .5);
  // Stable: feed sacks along the wall and a barrow by the paddock.
  group([[11.2, 6.6]], ['mines_sacks_a', 'mines_sacks_b', 'mines_crate_a'], .8);
  put('mines_wheelbarrow_a', [[14.6, 7.3], [14.4, 6.8], [15.0, 9.8]], { yaw: -.6 });
  // Blacksmith: timber and fuel for the forge, a coal spill, a finished cart wheel.
  group([[7.4, 14.1], [6.6, 13.4]], ['mines_plank_stack_a', 'mines_barrel_a', 'mines_crate_b', 'mines_sacks_b'], .8);
  put('mines_coal_scatter_a', [[5.6, 12.6], [6.0, 13.0], [5.5, 13.3]]);
  put('badlands_broken_wagon_wheel_a', [[1.0, 9.9], [0.7, 10.5], [7.9, 12.4]]);
  put('meadow_stump_a', [[0.6, 7.6], [1.6, 15.0], [9.2, 14.9]]);
  // Pet shop: feed sacks and a crate by the doorstep.
  group([[11.0, 9.6], [8.0, 11.5]], ['mines_sacks_a', 'mines_crate_a', 'mines_sacks_b'], .6);
  // Pond: reeds and stones on its banks, lily pads on the water.
  const banks = shore();
  for (const name of ['meadow_cattails_a', 'meadow_cattails_b', 'any_shore_stones_a', 'any_shore_stones_b', 'meadow_cattails_a'])
    put(name, banks.splice(0, 3), { world: true });
  for (const c of [...plan.pond].sort(() => R() - .5).slice(0, 2 + Math.floor(R() * 2)))
    put(variant(R, 'meadow_lily_pads'), [[c % N + .3 + R() * .4, Math.floor(c / N) + .3 + R() * .4]], { water: true, world: true });
  groundCover(R, scatter);
  return plan;
}

export function merchantCampPlan(exit, seed) {
  const { plan, path, tree, put, group, scatter, R } = clearingPlan(exit, seed, MERCHANTS, [[8.5, .9], [8.5, 15.1]]);
  // Open at both ends of the road; tents flank it instead of forming another row.
  [[1.0, 1.4], [14.7, 2.2], [1.0, 7.0], [14.9, 11.6], [2.0, 14.9], [12.9, 14.9]]
    .forEach(([x, z], i) => tree(i, x, z));
  for (const [x, z] of [[2.0, 5.0], [13.9, 4.7], [1.5, 12.5], [11.4, 14.5]])
    put('meadow_bush_a', [[x, z]], { s: 1.1 });
  path([8.5, 16], [10.0, 12.0], [8.5, 8.5], .85);
  path([8.5, 8.5], [7.8, 4.1], [8.5, 0], .85);
  frontagePaths(plan, path, [[7.9, 10.5], [9.0, 8.0], [7.6, 6.5]]);

  // Waymarks at both ends and lamps where the traders set up.
  put('relics_signpost_b', [[7.2, 1.2], [9.8, 1.4]], { yaw: Math.PI / 2 - .2, s: 1 });
  put('relics_signpost_a', [[9.9, 14.8], [7.1, 14.7]], { yaw: -Math.PI / 2 + .3, s: 1 });
  put('mines_lantern_a', [[7.0, 9.4], [6.8, 8.8]], { s: 1, unlit: true });
  put('mines_lantern_b', [[10.0, 6.0], [10.2, 5.2]], { s: 1, unlit: true });
  // Traders' camp: a fire ring with log seats, and stock stacked behind the stalls.
  const fire = put('relics_old_campfire_b', [[11.9, 3.4], [12.3, 4.0], [11.6, 2.6]], { s: 1 });
  if (fire) {
    const [fx, fz] = rotateTownPoint(fire.x, fire.z, -plan.yaw);
    // Seats lie tangentially; the log mesh is long along its X axis.
    [[-1.0, .25], [.75, -.75], [.55, .9]].forEach(([dx, dz]) =>
      put(variant(R, 'meadow_fallen_log'), [[fx + dx, fz + dz]], { yaw: Math.atan2(dx, dz), s: .9 }));
  }
  group([[1.6, 9.4], [2.0, 10.2]], ['mines_barrel_a', 'mines_barrel_b', 'mines_crate_a'], .7);
  group([[14.6, 6.2], [14.4, 9.6]], ['mines_crate_b', 'mines_crate_a', 'mines_barrel_a', 'mines_sacks_a'], .8);
  group([[2.6, 1.0], [7.0, 2.4]], ['mines_sacks_b', 'mines_crate_b', 'mines_barrel_b'], .7);
  put('mines_wheelbarrow_b', [[10.6, 13.0], [11.6, 12.6]], { yaw: .9 });
  put('mines_plank_stack_b', [[13.8, 13.0], [12.9, 12.0]], { yaw: .3 });
  put('relics_abandoned_pack_a', [[11.6, 4.2], [13.6, 4.0]]);
  put('meadow_stump_b', [[5.6, 14.6], [3.2, 7.4]]);
  for (const [x, z] of [[11.6, 7.4], [5.0, 8.4], [12.2, 10.6]]) put(variant(R, 'meadow_sapling'), [[x, z]]);
  groundCover(R, scatter, 1.15);
  return plan;
}
