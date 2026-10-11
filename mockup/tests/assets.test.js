import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { SWORD } from '../src/core/combat.js';
import { SPIDER, STUNDER } from '../src/core/enemies.js';

// Same shared-asset convention as serve.py; explicit override for CI.
const repo = resolve(import.meta.dirname, '../..');
const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: repo, encoding: 'utf8' }).trim();
const assets = resolve(process.env.CRAWLER_ASSETS_ROOT || resolve(common, '..'), 'blender');
function glb(name) {
  const b = readFileSync(resolve(assets, name + '.glb'));
  assert.equal(b.readUInt32LE(0), 0x46546c67);
  const size = b.readUInt32LE(12), json = JSON.parse(b.subarray(20, 20 + size));
  const bin = b.subarray(28 + size);
  const floats = index => {
    const a = json.accessors[index], v = json.bufferViews[a.bufferView], components = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type];
    assert.equal(a.componentType, 5126);
    return Array.from({ length: a.count * components }, (_, i) => bin.readFloatLE((v.byteOffset || 0) + (a.byteOffset || 0) + i * 4));
  };
  return { json, floats, duration: clip => Math.max(...clip.samplers.flatMap(s => floats(s.input))) };
}
test('player embeds sword on the hand socket and exports only its own clips', () => {
  const { json: j, duration } = glb('character');
  const sword = j.nodes.findIndex(n => n.name === 'Sword');
  assert.ok(sword >= 0);
  assert.equal(j.nodes.find(n => n.children?.includes(sword)).name, 'hand.R');
  assert.equal(j.nodes[sword].extras.weapon, 'sword');
  assert.equal(j.meshes.length, 2); assert.equal(j.skins.length, 1);
  assert.ok(!j.animations.some(a => /Spider|Stunder/.test(a.name)));
  const slash = j.animations.find(a => a.name === 'Slash');
  assert.ok(slash);
  assert.ok(Math.abs(duration(slash) - SWORD.duration) < 1e-5);
  assert.equal(slash.extras.weapon_socket, 'hand.R');
  assert.equal(slash.extras.active_start, SWORD.activeStart);
  assert.equal(slash.extras.active_end, SWORD.activeEnd);
  assert.equal(j.images?.length || 0, 0);
});
test('spider has exactly walk, bite and a held 2-second death animation', () => {
  const { json: j, duration } = glb('spider');
  assert.deepEqual(j.animations.map(a => a.name).sort(), ['SpiderAttack', 'SpiderDeath', 'SpiderWalk']);
  const death = j.animations.find(a => a.name === 'SpiderDeath');
  assert.equal(death.extras.hold_last_frame, true);
  assert.ok(Math.abs(duration(death) - SPIDER.deathTime) < 1e-5);
});
test('Stunder timings and speeds match the four existing clips', () => {
  const { json: j, duration } = glb('stunder');
  assert.deepEqual(j.animations.map(a => a.name).sort(), ['StunderAttack', 'StunderDeath', 'StunderWalk', 'StunderWalkFast']);
  const a = Object.fromEntries(j.animations.map(a => [a.name, a]));
  assert.equal(a.StunderWalk.extras.speed, STUNDER.wander);
  assert.equal(a.StunderWalkFast.extras.speed, STUNDER.chase);
  assert.equal(a.StunderAttack.extras.hit_frame / 30, STUNDER.hitAt);
  assert.equal(a.StunderAttack.extras.attack_style, 'head_down');
  assert.ok(Math.abs(duration(a.StunderDeath) - STUNDER.deathTime) < 1e-5);
  assert.equal(a.StunderDeath.extras.hold_last_frame, true);
});
test('standalone sword is a small untextured, unskinned prop', () => {
  const { json: j } = glb('sword');
  assert.equal(j.meshes.length, 1);
  assert.equal(j.skins?.length || 0, 0);
  assert.equal(j.images?.length || 0, 0);
  assert.equal(j.animations?.length || 0, 0);
  const triangles = j.meshes[0].primitives.reduce((n, p) => n + j.accessors[p.indices].count / 3, 0);
  assert.ok(triangles < 500);
});
