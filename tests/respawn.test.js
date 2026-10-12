import { test } from 'node:test';
import assert from 'node:assert/strict';
import { N, WATER } from '../src/core/constants.js';
import { flatMap, state } from './fixtures.js';
import { player } from '../src/game/state.js';
import { groundAt, blockedAt } from '../src/physics/collide.js';
import { respawnPoint } from '../src/physics/respawn.js';
import { World } from '../src/world/world.js';

const cell = (x, z) => z * N + x;
function supported(p) {
  assert.ok(Number.isFinite(p.y));
  const g = groundAt(p.x, p.z, p.y, 0);
  assert.equal(g.h, p.y);
  assert.ok(g.s && !g.s.fluid);
  assert.equal(blockedAt(p.x, p.z, p.y, 0.3), false);
}

test('valid entries stay put and airborne entries snap onto the floor below', () => {
  flatMap();
  const point = { x: 3.4, y: 0, z: 4.6 };
  assert.deepEqual(respawnPoint(point), point);
  assert.deepEqual(respawnPoint({ ...point, y: 12 }), point);
});

test('void and non-finite entries relocate to nearby solid ground', () => {
  flatMap();
  state.map.cols[cell(6, 6)] = [];
  for (const y of [0, 8, -Infinity, NaN]) {
    const p = respawnPoint({ x: 6.5, y, z: 6.5 });
    supported(p);
    assert.notEqual(cell(Math.floor(p.x), Math.floor(p.z)), cell(6, 6));
    assert.ok(Math.hypot(p.x - 6.5, p.z - 6.5) <= 1);
  }
});

test('fluid, vertical portals and solid blockers are not respawn points', () => {
  for (const hazard of ['fluid', 'portal', 'blocker', 'ceiling']) {
    flatMap();
    const i = cell(6, 6), point = { x: 6.5, y: 0, z: 6.5 };
    if (hazard === 'fluid') state.map.cols[i][0].fluid = WATER;
    if (hazard === 'portal') state.map.portals = [{ kind: 'down', x: 6, y: 0, z: 6 }];
    if (hazard === 'blocker') state.map.blockers[i].push({ x: 6.5, z: 6.5, r: 0.4, bottom: 0, top: 2 });
    if (hazard === 'ceiling') state.map.cols[i].push({ ...state.map.cols[i][0], bottom: 1, cs: [2, 2, 2, 2] });
    const p = respawnPoint(point);
    supported(p);
    assert.notDeepEqual(p, point, hazard);
  }
});

test('the whole body needs support, not just the centre', () => {
  flatMap();
  state.map.cols[cell(7, 6)] = [];
  const p = respawnPoint({ x: 6.95, y: 0, z: 6.5 });
  supported(p);
  assert.ok(p.x + player.r < 7);
});

test('respawns respect stacked floors and bridges over void', () => {
  flatMap();
  const i = cell(6, 6), lower = state.map.cols[i][0];
  state.map.cols[i].push({ ...lower, id: N * N, bottom: 6, cs: [5, 5, 5, 5] });
  assert.deepEqual(respawnPoint({ x: 6.5, y: 5, z: 6.5 }), { x: 6.5, y: 5, z: 6.5 });
  assert.deepEqual(respawnPoint({ x: 6.5, y: 0, z: 6.5 }), { x: 6.5, y: 0, z: 6.5 });
  state.map.cols[i] = [];
  state.map.pieces[i].push({ c: i, kind: 'bridge', dx: 1, dz: 0, j: 0,
    run: { kind: 'bridge', k: 1, y0: 2, y1: 2, sag: 0 } });
  assert.deepEqual(respawnPoint({ x: 6.5, y: 8, z: 6.5 }), { x: 6.5, y: 2, z: 6.5 });
});

test('invalid entries cannot silently produce another falling respawn', () => {
  flatMap();
  for (const col of state.map.cols) col[0].fluid = WATER;
  assert.throws(() => respawnPoint({ x: 6.5, y: -Infinity, z: 6.5 }), /No dry, supported respawn point/);
});

test('generated cubes across themes provide supported respawns for invalid and airborne entries', () => {
  for (const seed of [0, 3, 7]) {
    const world = new World(seed);
    for (const depth of [0, 1, 4, 7, 9, 13, 17, 20]) {
      const key = world.layout(depth).exists.values().next().value;
      state.map = world.cube(key).map;
      state.map.blockers = state.map.staticBlockers;
      for (const point of [{ x: 0.6, y: 12, z: 8.5 }, { x: -1, y: -Infinity, z: -1 }]) {
        supported(respawnPoint(point));
      }
    }
  }
});
