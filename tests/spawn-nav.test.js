import { test } from 'node:test';
import assert from 'node:assert/strict';
import { N, LH } from '../src/core/constants.js';
import { edgeKey } from '../src/core/util.js';
import { flatMap, state } from './fixtures.js';
import { SPIDER, STUNDER, makeEnemy } from '../src/core/enemies.js';
import { enemySpots } from '../src/game/enemyspawn.js';
import { walkable, neighbors, findPath, stepEnemy, clearLine } from '../src/physics/enemynav.js';
import { World } from '../src/world/world.js';

const signature = spots => spots.map(s => [s.f.id, s.x, s.y, s.z, s.yaw]);

test('seeded Stunder population is repeatable, spans 0-2 and stays away from entrances', () => {
  const counts = new Set();
  for (let seed = 0; seed < 150; seed++) {
    const map = flatMap(seed), a = enemySpots(map, STUNDER);
    counts.add(a.length);
    assert.ok(a.length <= 2);
    assert.deepEqual(signature(a), signature(enemySpots(map, STUNDER)));
    for (const e of a) {
      assert.ok(walkable(e.f, STUNDER.height));
      assert.ok(Math.hypot(e.f.x, e.f.z) >= 4);
    }
    if (a.length === 2) assert.ok(Math.hypot(a[0].x - a[1].x, a[0].z - a[1].z) >= STUNDER.spacing);
    const spiders = signature(enemySpots(map, SPIDER));
    enemySpots(map, STUNDER);
    assert.deepEqual(signature(enemySpots(map, SPIDER)), spiders);
  }
  assert.deepEqual([...counts].sort(), [0, 1, 2]);
});
test('no dry safe floor means no Stunders, never an unsafe fallback spawn', () => {
  const map = flatMap(3);
  for (const f of map.floors) f.fluid = true;
  assert.deepEqual(enemySpots(map, STUNDER), []);
});
test('height-specific navigation cache does not grant spider clearance to Stunder', () => {
  const map = flatMap(), f = map.floors[5 * N + 5];
  const roof = { bottom: 1.5 / LH, top: 2 / LH, cs: [2, 2, 2, 2] };
  map.cols[f.c].push(roof);
  assert.ok(walkable(f, SPIDER.height));
  assert.equal(walkable(f, STUNDER.height), false);
  assert.ok(walkable(f, SPIDER.height));
  assert.equal(findPath(f, f.link[0], 2, STUNDER.height), null);
});
test('Stunder cannot move its body over a cliff or through a prop', () => {
  const map = flatMap(), f = map.floors[5 * N + 5];
  const e = makeEnemy({ f, x: f.x + 0.5, z: f.z + 0.5, y: 0 }, STUNDER);
  map.blockers[f.link[0].c].push({ x: f.x + 1.5, z: f.z + 0.5, r: 0.3, bottom: 0, top: 2 });
  assert.equal(stepEnemy(e, 1, 0), true); // axis fallback can stand still, but cannot enter it
  assert.equal(e.x, f.x + 0.5);
  f.link[0] = null;
  stepEnemy(e, 1, 0);
  assert.equal(e.x, f.x + 0.5);
});
test('navigation respects fences, melee line of sight respects props and slabs', () => {
  const map = flatMap(), f = map.floors[5 * N + 5], g = f.link[0];
  map.fences.set(edgeKey(f.x, f.z, g.x, g.z), [{ ymin: 0, ymax: 1 }]);
  assert.ok(!neighbors(f).includes(g));
  assert.equal(findPath(f, g, 1), null);
  assert.ok(clearLine(4.5, 0.4, 5.5, 7.5, 0.4, 5.5));
  map.blockers[5 * N + 6].push({ x: 6.5, z: 5.5, r: 0.3, bottom: 0, top: 2 });
  assert.equal(clearLine(4.5, 0.4, 5.5, 7.5, 0.4, 5.5), false);
});
test('real generated levels keep the population cap and species clearance', () => {
  for (const seed of [1, 2, 3, 8, 17, 42, 123, 456]) {
    const world = new World(seed);
    const map = state.map = world.cube(world.start).map;
    const spots = enemySpots(map, STUNDER);
    assert.ok(spots.length <= 2);
    assert.deepEqual(signature(spots), signature(enemySpots(map, STUNDER)));
    for (const e of spots) assert.ok(walkable(e.f, STUNDER.height));
  }
});
