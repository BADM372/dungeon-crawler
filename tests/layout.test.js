import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeLayouts, MIN_ROUTE_ROOMS, MAX_ROUTE_ROOMS } from '../src/world/layout.js';
import { key, faceKey, step } from '../src/world/coords.js';
import { discoveredFaces } from '../src/core/boundaries.js';
import { portalLocked } from '../src/core/guardians.js';
import { createRun } from '../src/core/progression.js';

// Model all rooms as already discovered, including rooms reached accidentally by falls.
// This exercises the extra full-face paths, not merely the authored portal graph.
function rooms(L) {
  return new Map([...L.exists].map(k => [k, { key: k, visits: 1, map: {
    key: k, exit: L.exit.get(k), guardian: L.guardians.get(k), routeIndex: L.routeIndex.get(k),
    gateKeys: [0, 1, 2, 3].map(d => L.gateFaces.get(faceKey(k, d))),
    portals: [0, 1, 2, 3].filter(d => L.portals.has(faceKey(k, d))).map(dir => ({ dir, kind: 'side' })),
  } }]));
}

function distances(L, cubes, run, from) {
  const dist = new Map([[from, 1]]), queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const c = cubes.get(queue[i]), open = new Set(discoveredFaces(cubes, c, run));
    for (let dir = 0; dir < 4; dir++) {
      const n = step(c.key, dir);
      if (!cubes.has(n) || dist.has(n) || portalLocked(c.map, run, { dir })) continue;
      if (!L.portals.has(faceKey(c.key, dir)) && !open.has(faceKey(c.key, dir))) continue;
      dist.set(n, dist.get(c.key) + 1); queue.push(n);
    }
  }
  return dist;
}

test('all depths have 7–14-room routes and bounded discovery, even with all neighbouring faces discovered', () => {
  for (let seed = 0; seed < 1000; seed++) {
    const get = makeLayouts(seed);
    for (let d = 0; d <= 20; d++) {
      const L = get(d), run = createRun(), cubes = rooms(L);
      assert.ok(L.spine >= MIN_ROUTE_ROOMS && L.spine <= MAX_ROUTE_ROOMS);
      assert.ok(L.cells.length <= MAX_ROUTE_ROOMS);
      assert.equal(L.route.length, L.spine);
      const entry = key(L.start[0], -d, L.start[1]), goal = L.route.at(-1);
      if (d) {
        assert.equal(L.up, entry);
        assert.deepEqual(L.start, get(d - 1).end);
      }
      if (d < 20) assert.equal(goal, L.down);
      for (const k of L.guardians.keys()) run.unlockedGates.add(k);
      const forward = distances(L, cubes, run, entry), back = distances(L, cubes, run, goal);
      assert.equal(forward.get(goal), L.spine, `seed ${seed}, depth ${d}: no shortcut`);
      assert.equal(back.get(entry), L.spine, 'up is just as far away as down');
      assert.equal(forward.size, L.exists.size); assert.equal(back.size, L.exists.size);
      // Every side guardian cuts all paths to the descent, even after discovery elsewhere.
      for (const [k, g] of L.guardians) if (g.role === 'side') {
        run.unlockedGates.delete(k);
        assert.equal(distances(L, cubes, run, entry).has(goal), false);
        const c = cubes.get(k);
        assert.equal(discoveredFaces(cubes, c, run).includes(faceKey(k, g.exit)), false);
        run.unlockedGates.add(k);
      }
      if (L.down) {
        run.unlockedGates.delete(L.down);
        assert.equal(portalLocked(cubes.get(L.down).map, run, { kind: 'down', dir: 4 }), true);
      }
    }
  }
});
