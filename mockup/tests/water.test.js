import { test } from 'node:test';
import assert from 'node:assert/strict';
import { N, LH, WATER, LAVA, ACID } from '../src/core/constants.js';
import { flatMap, state } from './fixtures.js';
import { player } from '../src/game/state.js';
import { canMove } from '../src/physics/canmove.js';
import { movePlayer } from '../src/physics/move.js';
import { groundAt } from '../src/physics/collide.js';
import { inWater } from '../src/physics/water.js';

function bank(dx = 1, dz = 0) {
  const m = flatMap(), f = m.floors[5 * N + 5], water = m.floors[(5 + dz) * N + 5 + dx];
  Object.assign(water, { fluid: WATER, surf: -1, top: -3, bottom: -5, cs: [-1.5, -1.5, -1.5, -1.5] });
  Object.assign(player, { x: 5.5 + dx * 0.24, z: 5.5 + dz * 0.24, y: 0,
    vx: 0, vy: 0, vz: 0, grounded: true, swimming: false, fluid: 0,
    support: f, stun: 0, coyote: 0, jumpBuf: 0 });
  return water;
}

test('walking and running stop before water-facing ledges in every direction', () => {
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    for (const run of [false, true]) {
      bank(dx, dz);
      for (let i = 0; i < 120; i++) movePlayer(1 / 60, dx, dz, run, false);
      assert.equal(Math.floor(player.x), 5);
      assert.equal(Math.floor(player.z), 5);
      assert.equal(player.y, 0);
      assert.equal(player.grounded, true);
      assert.equal(dx ? player.vx : player.vz, 0);
    }
  }
});

test('water guard includes corner probes and still permits sliding along the bank', () => {
  bank(); player.z = 5.99;
  assert.equal(canMove(5.8, 5.99, 'x', 1), false);
  assert.equal(canMove(5.74, 5.9, 'z', -1), true);
});

test('jumping and airborne movement can cross the guarded edge', () => {
  bank();
  movePlayer(1 / 60, 1, 0, false, true);
  assert.equal(player.grounded, false);
  assert.ok(player.vy > 0);
  assert.equal(canMove(5.85, 5.5, 'x', 1), true);
  for (let i = 0; i < 20; i++) movePlayer(1 / 60, 1, 0, false, false);
  assert.ok(player.x > 6);
});

test('dry drops and voids remain unguarded; lava and acid behavior is unchanged', () => {
  for (const fluid of [0, LAVA, ACID]) {
    const water = bank(); water.fluid = fluid;
    assert.equal(canMove(5.85, 5.5, 'x', 1), true);
  }
  const water = bank(); state.map.cols[water.c] = [];
  assert.equal(canMove(5.85, 5.5, 'x', 1), true);
});

test('bridges and stacked dry floors above water stay walkable', () => {
  const water = bank();
  state.map.pieces[water.c].push({ c: water.c, kind: 'bridge', dx: 1, dz: 0, j: 0,
    run: { kind: 'landing', y0: 0 } });
  assert.equal(canMove(5.85, 5.5, 'x', 1), true);
  assert.equal(inWater(groundAt(6.5, 5.5, 0, 0), -0.1), false);
  state.map.pieces[water.c] = [];
  state.map.cols[water.c].push({ ...water, fluid: 0, bottom: -0.4, cs: [0, 0, 0, 0] });
  assert.equal(canMove(5.85, 5.5, 'x', 1), true);
  assert.equal(inWater(groundAt(6.5, 5.5, 0, 0), -0.1), false);
});

test('water contact begins below the surface, not while jumping above it', () => {
  const water = bank(), gr = groundAt(6.5, 5.5, 10, 0), surface = water.surf * LH;
  assert.equal(inWater(gr, surface + 1), false);
  assert.equal(inWater(gr, surface), false);
  assert.equal(inWater(gr, surface - 0.01), true);
  assert.equal(inWater({ s: null }, -10), false);
  for (const fluid of [0, LAVA, ACID]) {
    water.fluid = fluid;
    assert.equal(inWater(gr, surface - 0.01), false);
  }
});
