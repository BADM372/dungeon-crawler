import { test } from 'node:test';
import assert from 'node:assert/strict';
import { N, CHAR_R, DIRS } from '../src/core/constants.js';
import { faceKey, step, OPP6 } from '../src/world/coords.js';
import { isFaceOpen, openedSides, faceDistance, approachingFace, boundaryArrival, discoveredFaces } from '../src/core/boundaries.js';
import { flatMap, state } from './fixtures.js';
import { player } from '../src/game/state.js';
import { canMove } from '../src/physics/canmove.js';
import { stepEnemy } from '../src/physics/enemynav.js';

const atFace = (dir, distance, along = 9.3, y = 7.2) => ({
  x: dir === 0 ? N - distance : dir === 1 ? distance : along,
  z: dir === 2 ? N - distance : dir === 3 ? distance : along,
  y, r: CHAR_R, vx: DIRS[dir][0], vz: DIRS[dir][1],
});

test('opening a face is shared in both directions, not with any other side or vertical face', () => {
  const key = '2,-3,4';
  for (let dir = 0; dir < 4; dir++) {
    const opened = new Set([faceKey(key, dir)]), neighbor = step(key, dir);
    assert.equal(faceKey(key, dir), faceKey(neighbor, OPP6[dir]));
    assert.equal(isFaceOpen(opened, neighbor, OPP6[dir]), true);
    assert.deepEqual(openedSides(opened, key), DIRS.map((_, d) => d === dir));
    for (const d of [4, 5]) {
      opened.add(faceKey(key, d));
      assert.equal(isFaceOpen(opened, key, d), false);
    }
    opened.clear();
    assert.deepEqual(openedSides(opened, key), [false, false, false, false]);
  }
});

test('gateless faces open once both cubes are discovered; gated faces wait for a crossing', () => {
  const key = '2,-3,4', side = d => ({ kind: 'side', dir: d });
  const c = { key, visits: 1, map: { portals: [side(0)] } };
  const cubes = new Map([[key, c]]);
  for (let d = 0; d < 4; d++) cubes.set(step(key, d), { key: step(key, d), visits: d === 3 ? 0 : 1, map: { portals: [] } });
  // E has a gate, N is undiscovered: only W and S open
  assert.deepEqual(discoveredFaces(cubes, c), [faceKey(key, 1), faceKey(key, 2)]);
  // the neighbour discovering later opens the same shared face
  const n = cubes.get(step(key, 3));
  n.visits = 1;
  assert.deepEqual(discoveredFaces(cubes, n).filter(f => f === faceKey(key, 3)), [faceKey(key, 3)]);
  assert.deepEqual(discoveredFaces(cubes, { ...c, visits: 0 }), []);
});

test('open-face approach respects the body radius and outward intent, not height or portal position', () => {
  for (let dir = 0; dir < 4; dir++) for (const y of [0, 2, 12]) for (const along of [0.5, 8, 15.5]) {
    const p = atFace(dir, CHAR_R + 0.1, along, y);
    assert.ok(Math.abs(faceDistance(p, dir) - CHAR_R - 0.1) < 1e-9);
    assert.equal(approachingFace(p, dir), true);
    p.vx = p.vz = 0;
    assert.equal(approachingFace(p, dir), false);
    assert.equal(approachingFace(p, dir, ...DIRS[dir]), true);
    const [nx, nz] = DIRS[dir];
    assert.equal(approachingFace(p, dir, -nz, nx), false);
    assert.equal(approachingFace(p, dir, -nx, -nz), false);
    assert.equal(approachingFace(atFace(dir, 0.5), dir), false);
  }
});

test('boundary arrival preserves height and position along the face with room for the whole body', () => {
  for (let dir = 0; dir < 4; dir++) {
    const p = atFace(dir, 0.3), arrival = boundaryArrival(p, dir), opposite = OPP6[dir];
    assert.equal(arrival.y, p.y);
    assert.equal(dir < 2 ? arrival.z : arrival.x, dir < 2 ? p.z : p.x);
    assert.ok(Math.abs(faceDistance(arrival, opposite) - 0.6) < 1e-9);
    assert.equal(approachingFace({ ...p, ...arrival }, opposite), false);
    assert.ok(arrival.x > CHAR_R && arrival.x < N - CHAR_R);
    assert.ok(arrival.z > CHAR_R && arrival.z < N - CHAR_R);
  }
});

test('opening faces does not change cube-local player collision or enemy containment', () => {
  flatMap();
  state.openedFaces.add(faceKey('0,0,0', 0));
  try {
    const f = state.map.cols[8 * N + N - 1][0];
    Object.assign(player, { x: N - 0.3, z: 8.5, y: 0, grounded: true, swimming: false, support: f });
    assert.equal(canMove(N - 0.1, player.z, 'x', 1), false);
    const e = { x: N - 0.3, z: 8.5, y: 0, f };
    stepEnemy(e, 1, 0, CHAR_R, 0.9);
    assert.equal(e.x, N - 0.3);
    assert.equal(e.f, f);
  } finally { state.openedFaces.clear(); }
});
