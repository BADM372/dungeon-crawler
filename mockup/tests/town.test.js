import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { N, LH, CHAR_R, EDGE_CORNERS } from '../src/core/constants.js';
import { containsXZ, viewBlockedAt } from '../src/core/blockers.js';
import { World } from '../src/world/world.js';
import { step, faceKey } from '../src/world/coords.js';
import { BUILDINGS, MERCHANTS, TOWN_LEVEL, enemyFreeAt, merchantCampKey, rotateTownPoint } from '../src/world/town.js';
import { state } from './fixtures.js';
import { SPIDER, STUNDER } from '../src/core/enemies.js';
import { enemySpots } from '../src/game/enemyspawn.js';
import { blockedAt, insideSolid, ceilingAt } from '../src/physics/collide.js';
import { canMove } from '../src/physics/canmove.js';
import { mapInfo } from '../src/game/cutinfo.js';
import { player } from '../src/game/state.js';
import { buildCubeGeometry } from '../src/render/cubegeo.js';
import { propMetadata } from '../src/core/propcatalog.js';

const overlaps = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
const signature = m => ({ clearing: m.town || m.merchantCamp, portals: m.portals.map(p => [p.kind, p.dir, p.x, p.z]),
  ground: m.floors.map(f => [f.top, f.fluid, f.cs]), routes: m.routes });

function checkCurvedPaths(m) {
  const plan = m.town || m.merchantCamp;
  for (const path of plan.paths) for (const [i, b] of path.points.slice(1).entries()) {
    const a = path.points[i];
    for (let t = 0; t <= 1; t += .1) {
      const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      assert.ok(!m.occluders.filter(b => b.shape !== 'ellipsoid').some(b => containsXZ(b, x, z, CHAR_R + .03)), 'curved path must clear bodies, not just look connected');
      assert.ok(!new Set(m.staticBlockers.flat()).values().some(b => containsXZ(b, x, z, CHAR_R + .03)), 'curved path must clear clutter');
      const c = Math.min(N - 1, Math.max(0, Math.floor(z))) * N + Math.min(N - 1, Math.max(0, Math.floor(x)));
      assert.equal(m.cols[c][0].fluid, 0);
    }
  }
}

function checkWalkingRoutes(m) {
  state.map = m;
  Object.assign(player, { y: TOWN_LEVEL * LH, visY: TOWN_LEVEL * LH, h: .85, r: CHAR_R, grounded: true, swimming: false });
  for (const route of m.routes) for (const [i, b] of route.slice(1).entries()) {
    const a = route[i];
    player.x = a.x; player.z = a.z; player.support = m.cols[Math.floor(a.z) * N + Math.floor(a.x)][0];
    for (let t = .1; t <= 1.001; t += .1) {
      const nx = a.x + (b.x - a.x) * t, nz = a.z + (b.z - a.z) * t;
      assert.equal(canMove(nx, nz, a.x === b.x ? 'z' : 'x', Math.sign(b.x - a.x || b.z - a.z)), true);
      player.x = nx; player.z = nz;
    }
  }
}

test('town is flat, has water, four permanent buildings, varied tall trees, and one dry way out across seeds', () => {
  const directions = new Set();
  for (let seed = 0; seed < 80; seed++) {
    const w = new World(seed, { arche: 'chasm' }); // debug archetypes cannot destroy town
    const m = state.map = w.cube(w.start).map;
    const exit = m.portals.find(p => p.kind === 'side'), spawn = m.portals.find(p => p.kind === 'spawn');
    directions.add(exit.dir);
    assert.equal(m.K, 1); assert.equal(m.attempts, 1); assert.equal(m.enemyFree, true);
    assert.equal(m.portals.length, 2); assert.equal(m.portals.filter(p => p.kind !== 'spawn').length, 1);
    assert.equal(exit.dir, m.exit);
    assert.equal(m.floors.length, N * N); assert.ok(m.cols.every(c => c.length === 1));
    assert.equal(m.falls.length, 0); assert.equal(m.runs.length, 0);
    assert.equal(m.floors.filter(f => f.fluid).length, 5);
    for (const f of m.floors) {
      if (!f.fluid) assert.deepEqual(f.cs, Array(4).fill(TOWN_LEVEL * LH));
      else { assert.ok(f.top < f.surf && f.surf < TOWN_LEVEL); assert.ok(f.x > 0 && f.x < N - 1 && f.z > 0 && f.z < N - 1); }
    }
    const boxes = m.occluders.filter(b => b.shape === 'box');
    assert.deepEqual(boxes.map(b => b.name).sort(), BUILDINGS.map(b => b.name).sort());
    assert.equal(m.authoredProps, m.town.placements);
    assert.equal(m.authoredProps.some(p => p.name.startsWith('town_merchant_')), false);
    for (const b of BUILDINGS) {
      const p = m.authoredProps.find(p => p.name === b.name);
      assert.ok(Math.abs(Math.sin(p.yaw * 2)) > .2, 'houses must not align with a street grid');
    }
    checkWalkingRoutes(m); checkCurvedPaths(m);
    assert.equal(m.town.placements.filter(p => p.name.startsWith('town_tree_')).length, 16);
    assert.equal(new Set(m.town.placements.filter(p => p.name.startsWith('town_tree_')).map(p => p.name)).size, 3);
    assert.ok(m.occluders.filter(b => b.shape === 'ellipsoid').every(b => b.top > TOWN_LEVEL * LH + 4.8));
    for (const box of boxes) {
      assert.ok(box.x0 > 0 && box.z0 > 0 && box.x1 < N && box.z1 < N);
      for (const other of boxes) if (box !== other) assert.equal(overlaps(box, other), false, `${box.name}/${other.name}`);
      for (const c of m.town.pond) assert.equal(containsXZ(box, c % N + .5, Math.floor(c / N) + .5), false);
    }
    assert.equal(m.safe[spawn.floor.id], 1); assert.equal(m.safe[exit.floor.id], 1);
    for (const p of m.town.frontages) assert.equal(m.safe[Math.floor(p.z) * N + Math.floor(p.x)], 1, p.name);
    for (const route of m.routes) for (const p of route) {
      assert.equal(m.cols[Math.floor(p.z) * N + Math.floor(p.x)][0].fluid, 0);
      assert.ok(!m.occluders.filter(b => b.shape !== 'ellipsoid').some(b => containsXZ(b, p.x, p.z, CHAR_R + .02)));
    }
    assert.deepEqual(enemySpots(m, SPIDER), []); assert.deepEqual(enemySpots(m, STUNDER), []);
    assert.deepEqual(signature(m), signature(new World(seed).cube(w.start).map));
  }
  assert.deepEqual([...directions].sort(), [0, 1, 2, 3]);
});

test('town boundary is shared and exactly flat even if the neighbour is generated first', () => {
  for (let seed = 0; seed < 24; seed++) for (const first of [true, false]) {
    const w = new World(seed), dir = w.layout(0).exit.get(w.start), roadKey = step(w.start, dir);
    const road = first ? w.cube(roadKey).map : null;
    const town = w.cube(w.start).map, neighbour = road || w.cube(roadKey).map;
    assert.deepEqual(signature(town), signature(new World(seed).cube(w.start).map));
    const face = w.faces.get(faceKey(w.start, dir));
    assert.ok([...face.profile].every(h => h === TOWN_LEVEL));
    assert.equal(face.river, null); assert.equal(face.spout, null);
    const nd = dir ^ 1;
    for (const f of neighbour.floors) if (f.layer === 0 && [f.x === N - 1, f.x === 0, f.z === N - 1, f.z === 0][nd])
      for (const c of EDGE_CORNERS[nd]) assert.equal(f.cs[c], TOWN_LEVEL * LH);
    const portal = neighbour.portals.find(p => p.dir === nd);
    assert.equal(portal.layer, 0); assert.equal(portal.y, town.portals[0].y);
  }
});

test('the three tents form a safe roadside camp exactly one cube in front of town', () => {
  for (let seed = 0; seed < 80; seed++) {
    const w = new World(seed, { arche: 'chasm' }), town = w.cube(w.start).map;
    const k = step(w.start, town.exit), m = state.map = w.cube(k).map;
    assert.equal(k, merchantCampKey(seed));
    assert.equal(m.town, undefined); assert.ok(m.merchantCamp);
    assert.equal(m.K, 1); assert.equal(m.attempts, 1); assert.equal(m.enemyFree, true);
    assert.equal(m.authoredProps, m.merchantCamp.placements);
    assert.equal(m.portals.length, 2);
    assert.deepEqual(m.portals.map(p => p.dir).sort(), [town.exit, town.exit ^ 1].sort());
    assert.ok(m.portals.every(p => p.kind === 'side' && p.layer === 0 && p.y === TOWN_LEVEL * LH));
    assert.equal(m.exit, town.exit);
    assert.equal(m.floors.length, N * N);
    assert.ok(m.floors.every(f => !f.fluid && f.cs.every(y => y === TOWN_LEVEL * LH)));
    assert.equal(m.falls.length, 0); assert.equal(m.runs.length, 0);
    const boxes = m.occluders.filter(b => b.shape === 'box');
    assert.deepEqual(boxes.map(b => b.name).sort(), MERCHANTS.map(b => b.name).sort());
    assert.equal(m.authoredProps.some(p => BUILDINGS.some(b => b.name === p.name)), false);
    for (const box of boxes) {
      assert.ok(box.x0 > 0 && box.z0 > 0 && box.x1 < N && box.z1 < N);
      for (const other of boxes) if (box !== other) assert.equal(overlaps(box, other), false);
      for (let z = Math.floor(box.z0); z <= Math.floor(box.z1); z++)
        for (let x = Math.floor(box.x0); x <= Math.floor(box.x1); x++) assert.ok(m.staticBlockers[z * N + x].includes(box));
      assert.equal(blockedAt((box.x0 + box.x1) / 2, (box.z0 + box.z1) / 2, TOWN_LEVEL * LH, .3), true);
    }
    for (const p of m.portals) for (const c of p.cells) assert.equal(m.safe[c], 1);
    for (const p of m.merchantCamp.frontages) assert.equal(m.safe[Math.floor(p.z) * N + Math.floor(p.x)], 1, p.name);
    const route = m.routes[0], entry = m.portals.find(p => p.dir !== m.exit), exit = m.portals.find(p => p.dir === m.exit);
    assert.deepEqual([route[0].x, route[0].z], [entry.x + .5, entry.z + .5]);
    assert.deepEqual([route.at(-1).x, route.at(-1).z], [exit.x + .5, exit.z + .5]);
    checkWalkingRoutes(m); checkCurvedPaths(m);
    assert.deepEqual(enemySpots(m, SPIDER), []); assert.deepEqual(enemySpots(m, STUNDER), []);
    assert.deepEqual(signature(m), signature(new World(seed).cube(k).map));
    assert.deepEqual(signature(m), signature(structuredClone(m)), 'worker clone preserves authored placements');
  }
});

test('camp-to-countryside edges stay flat even when countryside is generated first', () => {
  for (let seed = 0; seed < 24; seed++) for (const first of [true, false]) {
    const w = new World(seed), dir = w.layout(0).exit.get(w.start);
    const campKey = step(w.start, dir), outsideKey = step(campKey, dir);
    const early = first ? w.cube(outsideKey).map : null;
    const camp = w.cube(campKey).map, outside = early || w.cube(outsideKey).map;
    assert.deepEqual(signature(camp), signature(new World(seed).cube(campKey).map));
    assert.deepEqual(signature(w.cube(w.start).map), signature(new World(seed).cube(w.start).map));
    const face = w.faces.get(faceKey(campKey, dir)), nd = dir ^ 1;
    assert.ok([...face.profile].every(h => h === TOWN_LEVEL));
    assert.equal(face.river, null); assert.equal(face.spout, null);
    for (const f of outside.floors) if (f.layer === 0 && [f.x === N - 1, f.x === 0, f.z === N - 1, f.z === 0][nd])
      for (const c of EDGE_CORNERS[nd]) assert.equal(f.cs[c], TOWN_LEVEL * LH);
    const p = outside.portals.find(p => p.dir === nd);
    assert.equal(p.layer, 0); assert.equal(p.y, TOWN_LEVEL * LH);
    assert.equal(outside.merchantCamp, undefined);
  }
});

function checkClutter(m, min) {
  const plan = m.town || m.merchantCamp, y = TOWN_LEVEL * LH, pond = new Set(plan.pond);
  const clutter = plan.placements.filter(p => !p.name.startsWith('town_'));
  assert.ok(clutter.length >= min, `only ${clutter.length} clutter props`);
  assert.ok(new Set(clutter.map(p => p.name.replace(/_[ab]$/, ''))).size >= 15, 'clutter must be varied');
  // Oriented footprints: the axis-aligned collider envelopes have empty corners.
  const footprints = [...BUILDINGS, ...MERCHANTS].flatMap(b => plan.placements.filter(p => p.name === b.name)
    .map(p => ({ p, bounds: b.bounds })));
  const inside = (x, z) => footprints.some(({ p, bounds: [x0, z0, x1, z1] }) => {
    const dx = x - p.x, dz = z - p.z, c = Math.cos(p.yaw), s = Math.sin(p.yaw);
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    return lx > x0 && lx < x1 && lz > z0 && lz < z1;
  });
  for (const p of clutter) {
    const meta = propMetadata.get(p.name), c = Math.floor(p.z) * N + Math.floor(p.x);
    assert.ok(meta, p.name); assert.equal(meta.attach === 'water', pond.has(c), p.name);
    assert.ok(p.x > 0 && p.z > 0 && p.x < N && p.z < N);
    if (meta.attach === 'water') assert.equal(p.y, (TOWN_LEVEL - 1) * LH);
    else assert.ok(Math.abs(p.y - y) < .03, p.name);
    assert.ok(!inside(p.x, p.z), p.name + ' inside a building');
    if (meta.light) assert.equal(p.unlit, true, 'daytime lamps should not add point lights');
    if (meta.blocking) {
      assert.ok(m.staticBlockers[c].some(b => b.name === p.name && b.x === p.x && b.z === p.z), p.name + ' needs a collider');
    }
  }
}

test('both clearings are dressed with varied clutter that stays off paths, water and buildings', () => {
  for (let seed = 0; seed < 24; seed++) {
    const w = new World(seed), town = w.cube(w.start).map, camp = w.cube(step(w.start, town.exit)).map;
    checkClutter(town, 100); checkClutter(camp, 100);
    assert.ok(town.town.placements.some(p => p.name.startsWith('meadow_lily_pads_')));
    assert.ok(town.town.placements.some(p => p.name.startsWith('meadow_cattails_') || p.name.startsWith('any_shore_stones_')));
    assert.ok(camp.merchantCamp.placements.some(p => p.name.startsWith('relics_old_campfire_')));
  }
});

test('authored paths curve and connect each frontage instead of outlining rectangular streets', () => {
  for (let seed = 0; seed < 4; seed++) {
    const w = new World(seed), town = w.cube(w.start).map, camp = w.cube(step(w.start, town.exit)).map;
    for (const m of [town, camp]) {
      const plan = m.town || m.merchantCamp;
      for (const p of plan.frontages) assert.ok(plan.paths.some(path => {
        const end = path.points.at(-1); return Math.hypot(end[0] - p.x, end[1] - p.z) < 1e-6;
      }));
      assert.ok(plan.paths.every(p => p.points.length > 2));
      const road = plan.paths[0].points.map(([x, z]) => rotateTownPoint(x, z, -plan.yaw));
      assert.ok(new Set(road.map(([x]) => x.toFixed(2))).size > 5);
    }
  }
});

test('path ribbons have curved non-grid edges, stay inside the cube, and never pave over the pond', () => {
  for (let seed = 0; seed < 4; seed++) {
    const w = new World(seed), town = w.cube(w.start).map, camp = w.cube(step(w.start, town.exit)).map;
    for (const m of [town, camp]) {
      const { pos, nor } = buildCubeGeometry(m)[0].terrain;
      let pathVertices = 0, offGrid = 0;
      for (let i = 0; i < pos.length; i += 9) {
        if (Math.abs(pos[i + 1] - (TOWN_LEVEL * LH + .012)) > 1e-5) continue;
        pathVertices += 3;
        for (let j = i; j < i + 9; j += 3) {
          assert.ok(pos[j] >= 0 && pos[j] <= N && pos[j + 2] >= 0 && pos[j + 2] <= N);
          assert.ok(Number.isFinite(pos[j]) && Number.isFinite(pos[j + 2]));
          assert.equal(nor[j + 1], 1);
          if (Math.abs(pos[j] - Math.round(pos[j])) > .1) offGrid++;
        }
        const x = (pos[i] + pos[i + 3] + pos[i + 6]) / 3, z = (pos[i + 2] + pos[i + 5] + pos[i + 8]) / 3;
        assert.equal(m.cols[Math.min(N - 1, Math.floor(z)) * N + Math.min(N - 1, Math.floor(x))][0].fluid, 0);
      }
      assert.ok(pathVertices > 100); assert.ok(offGrid > pathVertices / 2);
    }
  }
});

test('safe surface buffer includes diagonals, ends after one cube, and does not immunise the dungeon', () => {
  for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) assert.equal(enemyFreeAt(`${x},0,${z}`), true);
  for (const k of ['2,0,0', '0,0,-2', '0,-1,0', '1,-1,1']) assert.equal(enemyFreeAt(k), false);
  let hostilePopulation = 0;
  for (let seed = 0; seed < 16; seed++) {
    const w = new World(seed), town = w.cube(w.start).map;
    const roadKey = step(w.start, town.exit), road = state.map = w.cube(roadKey).map;
    assert.equal(road.enemyFree, true);
    assert.deepEqual(enemySpots(road, SPIDER), []); assert.deepEqual(enemySpots(road, STUNDER), []);
    const outside = state.map = w.cube(step(roadKey, town.exit)).map;
    assert.equal(outside.enemyFree, false);
    hostilePopulation += enemySpots(outside, SPIDER).length;
    // Retrieving cached cubes retains policy, it isn't an initial-spawn exception.
    assert.equal(w.cube(roadKey).map.enemyFree, true);
    assert.equal(w.cube(w.start).map.enemyFree, true);
  }
  assert.ok(hostilePopulation > 0);
});

test('building boxes collide in every covered cell; canopy occlusion is separate from trunk collision', () => {
  const m = state.map = new World(3).cube('0,0,0').map;
  Object.assign(player, { y: 2, visY: 2, h: .85, r: CHAR_R, grounded: true, swimming: false });
  const box = m.occluders.find(b => b.name === 'town_inn_a');
  for (let x = box.x0 + .1; x < box.x1; x += .7) for (let z = box.z0 + .1; z < box.z1; z += .7) {
    assert.equal(blockedAt(x, z, 2, .3), true);
    assert.equal(insideSolid(x, z, 2.5), true);
    assert.equal(ceilingAt(x, z, 1.9), 2);
  }
  checkWalkingRoutes(m);
  // Pick a crown whose overhang is not also inside one of the new building envelopes.
  const crown = m.occluders.find(b => b.shape === 'ellipsoid' && b.x > 12 && b.z < 1);
  assert.equal(viewBlockedAt(m, crown.x, crown.y, crown.z), true);
  assert.equal(viewBlockedAt(m, crown.x + crown.rx + .2, crown.y, crown.z), false);
  assert.ok(mapInfo(m).top > Math.max(...m.occluders.map(b => b.top)));
  assert.equal(insideSolid(crown.x + crown.rx * .8, crown.z, 2.5), false);
});

const repo = resolve(import.meta.dirname, '../..');
const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: repo, encoding: 'utf8' }).trim();
const assets = resolve(process.env.CRAWLER_ASSETS_ROOT || resolve(common, '..'), 'blender');
function glb(file) { const b = readFileSync(resolve(assets, file)); return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12))); }

test('authored building footprint boxes contain the actual exported assets', () => {
  for (const b of [...BUILDINGS, ...MERCHANTS]) {
    const j = glb(`town/${b.name}.glb`), root = j.nodes[j.scenes[j.scene || 0].nodes[0]];
    assert.equal(root.name, b.name);
    const positions = j.meshes[root.mesh].primitives.map(p => j.accessors[p.attributes.POSITION]);
    assert.ok(Math.min(...positions.map(a => a.min[0])) >= b.bounds[0]);
    assert.ok(Math.min(...positions.map(a => a.min[2])) >= b.bounds[1]);
    assert.ok(Math.max(...positions.map(a => a.max[0])) <= b.bounds[2]);
    assert.ok(Math.max(...positions.map(a => a.max[2])) <= b.bounds[3]);
    assert.ok(Math.max(...positions.map(a => a.max[1])) <= b.height);
  }
});
test('grove assets have flat coloured geometry, ground pivots and explicit trunk metadata', () => {
  const j = glb('town_trees.glb');
  assert.equal(j.scenes[j.scene || 0].nodes.length, 3);
  assert.equal(j.images?.length || 0, 0); assert.equal(j.animations?.length || 0, 0);
  for (const i of j.scenes[j.scene || 0].nodes) {
    const n = j.nodes[i], e = n.extras;
    assert.ok(n.name.startsWith('town_tree_')); assert.equal(e.attach, 'ground');
    assert.ok(e.trunk_radius > .1 && e.trunk_radius < .4 && e.radius > e.trunk_radius);
    const primitives = j.meshes[n.mesh].primitives;
    for (const p of primitives) {
      assert.ok(p.attributes.COLOR_0 !== undefined && p.attributes.NORMAL !== undefined);
      const a = j.accessors[p.attributes.POSITION];
      assert.ok(Math.abs(a.min[1]) < 1e-6); assert.ok(a.max[1] > 6 && a.max[1] < 7.3);
      assert.ok(j.accessors[p.indices].count / 3 < 900);
    }
  }
});
