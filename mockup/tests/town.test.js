import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { N, LH, CHAR_R, EDGE_CORNERS } from '../src/core/constants.js';
import { containsXZ, viewBlockedAt } from '../src/core/blockers.js';
import { World } from '../src/world/world.js';
import { step, faceKey } from '../src/world/coords.js';
import { BUILDINGS, TOWN_LEVEL, enemyFreeAt } from '../src/world/town.js';
import { state } from './fixtures.js';
import { SPIDER, STUNDER } from '../src/core/enemies.js';
import { enemySpots } from '../src/game/enemyspawn.js';
import { blockedAt, insideSolid, ceilingAt } from '../src/physics/collide.js';
import { canMove } from '../src/physics/canmove.js';
import { mapInfo } from '../src/game/cutinfo.js';
import { player } from '../src/game/state.js';

const overlaps = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
const signature = m => ({ placements: m.town.placements, pond: m.town.pond, portals: m.portals.map(p => [p.kind, p.dir, p.x, p.z]),
  ground: m.floors.map(f => [f.top, f.fluid, f.cs]), routes: m.routes });

test('town is flat, has water, all seven buildings, varied tall trees, and one dry way out across seeds', () => {
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
  // Actual radius probes can walk every segment of the authored spawn-to-exit route.
  for (const [a, b] of m.routes[0].slice(1).map((b, i) => [m.routes[0][i], b])) {
    player.x = a.x; player.z = a.z; player.support = m.cols[Math.floor(a.z) * N + Math.floor(a.x)][0];
    for (let t = .1; t <= 1.001; t += .1) {
      const nx = a.x + (b.x - a.x) * t, nz = a.z + (b.z - a.z) * t;
      assert.equal(canMove(nx, nz, a.x === b.x ? 'z' : 'x', Math.sign(b.x - a.x || b.z - a.z)), true);
      player.x = nx; player.z = nz;
    }
  }
  const crown = m.occluders.find(b => b.shape === 'ellipsoid' && b.z > 5 && b.z < 6);
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
  for (const b of BUILDINGS) {
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
