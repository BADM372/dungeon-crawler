import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assets } from './paths.js';
import { SLASH_CLIP } from '../src/core/combat.js';
import { SPIDER, STUNDER } from '../src/core/enemies.js';
import { CHAR_SCALE } from '../src/core/constants.js';

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
test('player is unarmed, retains both hand sockets and exports only its own clips', () => {
  const { json: j, duration } = glb('character');
  assert.ok(!j.nodes.some(n => n.name === 'Sword' || n.extras?.weapon));
  for (const name of ['hand.L', 'hand.R']) {
    const socket = j.nodes.find(n => n.name === name);
    assert.ok(socket);
    assert.equal(socket.children?.length || 0, 0, 'hand socket must be empty');
  }
  assert.equal(j.meshes.length, 1); assert.equal(j.skins.length, 1);
  assert.ok(!j.animations.some(a => /Spider|Stunder/.test(a.name)));
  const slash = j.animations.find(a => a.name === 'Slash');
  assert.ok(slash);
  assert.ok(Math.abs(duration(slash) - SLASH_CLIP.duration) < 1e-5);
  assert.equal(slash.extras.weapon_socket, 'hand.R');
  assert.equal(slash.extras.active_start, SLASH_CLIP.activeStart);
  assert.equal(slash.extras.active_end, SLASH_CLIP.activeEnd);
  assert.equal(j.images?.length || 0, 0);
});
test('player climbing is a seamless in-place loop covering two ladder rungs', () => {
  const { json: j, floats, duration } = glb('character');
  const clip = j.animations.find(a => a.name === 'Climb');
  assert.ok(clip);
  assert.ok(Math.abs(duration(clip) - 1.2) < 1e-5);
  assert.ok(Math.abs(clip.extras.distance * CHAR_SCALE - 0.56) < 1e-6);
  assert.ok(Math.abs(clip.extras.speed * duration(clip) - clip.extras.distance) < 1e-6);
  const moving = new Set();
  for (const channel of clip.channels) {
    const sampler = clip.samplers[channel.sampler], a = j.accessors[sampler.output];
    const values = floats(sampler.output), n = a.type === 'VEC4' ? 4 : 3;
    const name = j.nodes[channel.target.node].name;
    for (let k = 0; k < n; k++) {
      assert.ok(Math.abs(values[k] - values[values.length - n + k]) < 1e-5, name + ' loop seam');
      const component = values.filter((_, i) => i % n === k);
      const span = Math.max(...component) - Math.min(...component);
      if (channel.target.path === 'rotation' && span > 0.1) moving.add(name);
      if (channel.target.path === 'translation') assert.ok(span < 0.05, name + ' must stay in place');
    }
  }
  for (const name of ['upper_arm.L', 'upper_arm.R', 'thigh.L', 'thigh.R', 'shin.L', 'shin.R']) {
    assert.ok(moving.has(name), name + ' must reach / step');
  }
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
