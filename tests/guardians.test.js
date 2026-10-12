import { test } from 'node:test';
import assert from 'node:assert/strict';
import { state } from './fixtures.js';
import { DIRS } from '../src/core/constants.js';
import { edgeKey } from '../src/core/util.js';
import { World } from '../src/world/world.js';
import { makeLayouts, guardianDepth } from '../src/world/layout.js';
import { faceKey, step } from '../src/world/coords.js';
import { voidAllowed } from '../src/world/voids.js';
import { generate } from '../src/cubegen/index.js';
import { ENEMY_PROFILES, ENEMY_KINDS, GUARDIAN_KINDS, enemyProfile, makeEnemy } from '../src/core/enemies.js';
import { guardianId, gateLocked, portalLocked, restoreDefeated } from '../src/core/guardians.js';
import { createRun, createPlayerStats, awardKill } from '../src/core/progression.js';
import { population } from '../src/core/spawns.js';
import { damageEnemy } from '../src/core/combat.js';
import { enemySpots, guardianSpots } from '../src/game/enemyspawn.js';
import { coordinateDefence } from '../src/game/defence.js';
import { walkable, findPath } from '../src/physics/enemynav.js';
import { buildCubeGeometry } from '../src/render/cubegeo.js';

const signature = spots => spots.map(s => [s.id, s.kind.type, s.level, s.f.id, s.x, s.y, s.z, s.yaw]);
const arena = (seed = 123, depth = 2) => {
  const world = new World(seed), key = world.layout(depth).down;
  world.prepare(key);
  return { world, map: state.map = generate({ ...world.spec(key), guardian: true }) };
};

test('guardian placement is seeded, starts at depth 2, and leaves no disconnected or useless gates', () => {
  for (let seed = 0; seed < 100; seed++) {
    const get = makeLayouts(seed), same = makeLayouts(seed);
    for (let d = 0; d <= 20; d++) {
      const L = get(d);
      assert.equal(L.guardian, guardianDepth(seed, d));
      assert.deepEqual(L, same(d));
      assert.equal(L.exit.size, L.exists.size - (d === 20 ? 1 : 0));
      if (L.guardian) {
        assert.ok(d >= 2 && d < 20);
        assert.equal([0, 1, 2, 3].filter(dir => L.portals.has(faceKey(L.down, dir))).length, 1);
        assert.equal(L.exit.get(L.down), 4);
      }
    }
    assert.equal(get(2).guardian, true);
    for (let d = 3; d < 19; d += 2) assert.notEqual(get(d).guardian, get(d + 1).guardian);
  }
});

test('each species has a distinct pink guardian kind with unchanged movement and attacks', () => {
  assert.equal(Object.keys(GUARDIAN_KINDS).length, ENEMY_PROFILES.length);
  for (const base of ENEMY_PROFILES) {
    const kind = GUARDIAN_KINDS[base.species];
    assert.equal(ENEMY_KINDS[kind.type], kind);
    assert.ok(kind.guardian && kind.label.startsWith('Guardian'));
    assert.notEqual(kind.type, base.type);
    for (const role of Object.keys(base.parts)) assert.ok(kind.colors[role]);
    for (const key of ['chase', 'radius', 'height', 'attackTime', 'hitAt', 'cooldown']) assert.equal(kind[key], base[key]);
    const normal = enemyProfile(base, 2), guardian = enemyProfile(kind, 8);
    assert.ok(guardian.hp > normal.hp * 2 && guardian.damage > normal.damage * 1.5, base.type);
  }
});

test('guardian arenas have dry, connected floors, shared ground entrances and no fall-through bypass', () => {
  for (const seed of [0, 1, 2, 7, 42, 123]) {
    const w = new World(seed);
    for (let d = 2; d < 20; d++) {
      const L = w.layout(d);
      if (!L.guardian) continue;
      const m = state.map = w.cube(L.down).map, clone = structuredClone(m);
      assert.equal(m.portals.length, 2);
      assert.deepEqual(m.portals.map(p => p.kind), ['side', 'down']);
      assert.equal(m.K, 1); assert.equal(m.exit, 4); assert.equal(m.roomRole, 'guardian');
      assert.equal(voidAllowed(w, m.key), false);
      assert.equal(m.floors.length, 256);
      assert.ok(m.floors.every(f => !f.fluid && !f.covered));
      for (const f of m.floors) if (f.encounter) for (const [dx, dz] of DIRS) {
        const other = m.floors[(f.z + dz) * 16 + f.x + dx];
        if (!other.encounter && other.top < f.top - 1) assert.ok(m.fences.has(edgeKey(f.x, f.z, other.x, other.z)));
      }
      const entry = m.portals[0], down = m.portals[1];
      assert.equal(entry.layer, 0); assert.equal(entry.y, down.y);
      for (const cfg of ENEMY_PROFILES) {
        assert.ok(walkable(m.guardian.floor, cfg.height));
        assert.ok(findPath(entry.floor, m.guardian.floor, 40, cfg.height));
        assert.ok(findPath(m.guardian.floor, down.floor, 40, cfg.height));
      }
      assert.equal(Math.hypot(m.guardian.x - down.x - .5, m.guardian.z - down.z - .5), 2);
      assert.equal(clone.guardian.floor, clone.floors[m.guardian.floor.id]);
      assert.equal(buildCubeGeometry(m).length, 1);
      const neighbor = w.cube(step(m.key, entry.dir)).map;
      const other = neighbor.portals.find(p => p.dir === (entry.dir ^ 1));
      assert.equal(other.layer, 0); assert.equal(other.y, entry.y);
    }
  }
});

test('double the full local roster with exactly one promoted guardian, without overlapping spawns', () => {
  for (let seed = 0; seed < 30; seed++) {
    const w = new World(seed);
    for (let d = 2; d < 20; d++) {
      const L = w.layout(d);
      if (!L.guardian) continue;
      const map = state.map = w.cube(L.down).map, spots = guardianSpots(map);
      const ordinary = population({ ...map, guardian: null }), pop = population(map);
      assert.deepEqual(signature(spots), signature(guardianSpots(map)));
      assert.deepEqual(signature(spots), signature(guardianSpots(structuredClone(map))));
      assert.equal(spots.filter(s => s.guardian).length, 1);
      const guard = spots.find(s => s.guardian);
      assert.equal(guard.id, guardianId(map.key)); assert.equal(guard.guardianGate, map.key);
      assert.equal(guard.kind, GUARDIAN_KINDS[guard.kind.species]);
      assert.ok(guard.level >= 7);
      for (const [type, p] of pop) {
        assert.equal(p.count, ordinary.get(type).count * 2);
        const cfg = ENEMY_PROFILES.find(p => p.species === type);
        assert.equal(enemySpots(map, cfg).length, p.count);
      }
      assert.equal(new Set(spots.map(s => s.f.id)).size, spots.length);
      for (const a of spots) {
        assert.ok(walkable(a.f, a.kind.height) && findPath(a.f, guard.f, 40, a.kind.height));
        for (const b of spots) if (a !== b)
          assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= a.kind.radius + b.kind.radius + .1);
      }
    }
  }
});

test('only guardian death unlocks the descent, surviving enemies do not matter, and death cannot restore it', () => {
  const { map } = arena(), run = createRun(), hero = createPlayerStats();
  const list = guardianSpots(map).map(s => makeEnemy(s, s.kind)), guard = list.find(e => e.guardian);
  const ordinary = list.find(e => !e.guardian), down = map.portals.find(p => p.kind === 'down');
  assert.equal(gateLocked(map, run), true);
  assert.equal(portalLocked(map, run, down), true);
  assert.equal(portalLocked(map, run, map.portals[0]), false);
  assert.equal(awardKill(hero, run, guard), null);
  damageEnemy(ordinary, ordinary.hp); awardKill(hero, run, ordinary);
  assert.equal(gateLocked(map, run), true);
  damageEnemy(guard, guard.hp); assert.ok(awardKill(hero, run, guard));
  assert.equal(portalLocked(map, run, down), false);
  assert.ok(list.some(e => e.mode !== 'dead'));
  const xp = hero.xp;
  assert.equal(awardKill(hero, run, guard), null); assert.equal(hero.xp, xp);
  restoreDefeated(run, new Set());
  assert.equal(run.defeated.has(guard.id), true);
  assert.equal(run.defeated.has(ordinary.id), false);
  const respawns = guardianSpots(map).filter(s => !run.defeated.has(s.id));
  assert.ok(respawns.some(s => s.id === ordinary.id));
  assert.ok(!respawns.some(s => s.guardian));
  assert.equal(gateLocked(map, run), false);
  assert.equal(gateLocked(map, createRun()), true);
});

test('defenders intercept advances, rally when the guardian is hurt, and cannot all be lured to the entrance', () => {
  const { map } = arena(), run = createRun(), list = guardianSpots(map).map(s => makeEnemy(s, s.kind));
  const guard = list.find(e => e.guardian), g = map.guardian, [dx, dz] = g.approach;
  const hero = { hp: 100, x: g.x + dx * 2, y: g.y, z: g.z + dz * 2 };
  guard.hp--;
  coordinateDefence(map, run, list, hero);
  const defenders = list.filter(e => !e.guardian);
  assert.ok(defenders.every(e => e.defence.engage));
  for (const e of list) assert.ok(findPath(e.f, e.defence.post, 40, e.profile.height));
  assert.ok(new Set(defenders.map(e => e.defence.post.id)).size > 1);
  const entry = map.portals[0];
  Object.assign(hero, { x: entry.x + .5 - dx, z: entry.z + .5 - dz });
  coordinateDefence(map, run, list, hero);
  assert.equal(guard.defence.engage, false);
  assert.ok(defenders.filter(e => e.defence.engage).length <= Math.ceil(defenders.length / 3));
  const committed = defenders[0]; committed.mode = 'attack';
  coordinateDefence(map, run, list, hero); assert.equal(committed.mode, 'attack');
  run.unlockedGates.add(map.key);
  committed.mode = 'defend';
  coordinateDefence(map, run, list, hero);
  assert.ok(list.every(e => !e.defence)); assert.equal(committed.mode, 'idle');
});
