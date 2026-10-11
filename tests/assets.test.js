import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assets } from './paths.js';
import { SLASH_CLIP } from '../src/core/combat.js';
import { SPIDER, STUNDER, SNAKE, OCTONAUT, FIREFACE, TRIANGLE, FIRECAT } from '../src/core/enemies.js';
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
  assert.ok(!j.animations.some(a => /Spider|Stunder|Snake|Octo|Fire|Tri|Cat/.test(a.name)));
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
test('snake slithers at its wander speed, bites on the profile hit frame and holds its corpse', () => {
  const { json: j, duration } = glb('snake');
  assert.deepEqual(j.animations.map(a => a.name).sort(), ['SnakeAttack', 'SnakeDeath', 'SnakeWalk']);
  const a = Object.fromEntries(j.animations.map(a => [a.name, a]));
  assert.equal(a.SnakeWalk.extras.speed, SNAKE.wander);
  // the body wave travels one wavelength per loop: it stays put on the floor as the snake moves
  assert.ok(Math.abs(a.SnakeWalk.extras.wavelength - SNAKE.wander * duration(a.SnakeWalk)) < 1e-5);
  assert.equal(a.SnakeAttack.extras.hit_frame / 30, SNAKE.hitAt);
  assert.ok(Math.abs(duration(a.SnakeAttack) - SNAKE.attackTime) < 1e-5);
  assert.ok(Math.abs(duration(a.SnakeDeath) - SNAKE.deathTime) < 1e-5);
  assert.equal(a.SnakeDeath.extras.hold_last_frame, true);
});
test('Octonaut has a slap and a spin kick whose clips match the attack timings', () => {
  const { json: j, duration } = glb('octonaut');
  assert.deepEqual(j.animations.map(a => a.name).sort(), ['OctoDeath', 'OctoSlap', 'OctoSpin', 'OctoWalk']);
  const a = Object.fromEntries(j.animations.map(a => [a.name, a]));
  assert.equal(a.OctoWalk.extras.speed, OCTONAUT.wander);
  const [slap, spin] = OCTONAUT.attacks;
  for (const [clip, attack, style] of [[a.OctoSlap, slap, 'slap'], [a.OctoSpin, spin, 'spin_kick']]) {
    assert.equal(clip.extras.attack_style, style);
    assert.equal(clip.extras.hit_frame / 30, attack.hitAt);
    assert.ok(Math.abs(duration(clip) - attack.attackTime) < 1e-5);
  }
  assert.ok(Math.abs(duration(a.OctoDeath) - OCTONAUT.deathTime) < 1e-5);
  assert.equal(a.OctoDeath.extras.hold_last_frame, true);
  const legs = new Set(j.nodes.map(n => n.name).filter(n => /^leg\d_upper$/.test(n)));
  assert.equal(legs.size, 6);
  assert.ok(j.nodes.some(n => n.name === 'hand.L') && j.nodes.some(n => n.name === 'hand.R'));
});
test('the new enemies have shining purple eyes', () => {
  for (const name of ['snake', 'octonaut']) {
    const { json: j } = glb(name), eyes = j.materials.find(m => /Eyes_glow/.test(m.name));
    const [r, g, b] = eyes.emissiveFactor;
    assert.ok(b === 1 && r > 2 * g && b > r, name);
    assert.ok(eyes.extensions.KHR_materials_emissive_strength.emissiveStrength > 1, name);
  }
});
// clips by name, and the clip contract every enemy shares: an idle / walk loop at its
// wander speed, an attack whose hit frame and length match the profile, a held death
function enemyClips(name, profile, { walk, attack, death, fast }) {
  const { json: j, duration } = glb(name), a = Object.fromEntries(j.animations.map(c => [c.name, c]));
  assert.deepEqual(Object.keys(a).sort(), [walk, attack, death, fast].filter(Boolean).sort());
  assert.equal(a[walk].extras.speed, profile.wander);
  assert.equal(a[walk].extras.loop, true);
  assert.equal(a[attack].extras.hit_frame / 30, profile.hitAt);
  assert.ok(Math.abs(duration(a[attack]) - profile.attackTime) < 1e-5);
  assert.ok(Math.abs(duration(a[death]) - profile.deathTime) < 1e-5);
  assert.equal(a[death].extras.hold_last_frame, true);
  return { j, a };
}
// a standalone, unskinned projectile mesh beside the rig
function projectileProp(j, name, kind) {
  const node = j.nodes.find(n => n.name === name);
  assert.ok(node && j.scenes[0].nodes.includes(j.nodes.indexOf(node)), name);
  assert.equal(node.skin, undefined); assert.ok(node.mesh !== undefined);
  assert.equal(node.extras.projectile, kind);
}
const glowing = j => j.materials.filter(m => /_glow/.test(m.name) && !/Eyes/.test(m.name)).map(m => [m.name, m.emissiveFactor]);
test('Fire-face hovers, spits its fireball from the profile muzzle and glows red and orange', () => {
  const { j, a } = enemyClips('fireface', FIREFACE, { walk: 'FireFloat', attack: 'FireAttack', death: 'FireDeath' });
  assert.equal(a.FireFloat.extras.hover, true); assert.equal(FIREFACE.hover, true);
  assert.deepEqual(a.FireAttack.extras.muzzle, [...FIREFACE.projectile.muzzle]);
  projectileProp(j, 'FireFaceBall', 'fireball');
  assert.ok(j.nodes.filter(n => /^flame\d_[ab]$/.test(n.name)).length >= 10, 'flickering flame tongues');
  const mats = glowing(j);
  assert.ok(mats.length >= 4);
  for (const [name, [r, g, b]] of mats) assert.ok(r === 1 && g < 0.4 && b < 0.05, name);   // red .. orange
});
test('Triangle hovers, punches with its inner triangles from the profile muzzle and glows purple', () => {
  const { j, a } = enemyClips('triangle', TRIANGLE, { walk: 'TriFloat', attack: 'TriPunch', death: 'TriDeath' });
  assert.equal(a.TriFloat.extras.hover, true); assert.equal(TRIANGLE.hover, true);
  assert.deepEqual(a.TriPunch.extras.muzzle, [...TRIANGLE.projectile.muzzle]);
  projectileProp(j, 'TrianglePunch', 'triangle_punch');
  for (const bone of ['body', 'ring', 'core']) assert.ok(j.nodes.some(n => n.name === bone), bone);
  const mats = glowing(j);
  assert.equal(mats.length, 3);
  for (const [name, [r, g, b]] of mats) assert.ok(b >= r && b > 3 * g, name);   // purple
});
test('Fire-cat prowls and gallops at its speeds, pounces over the profile window and is on fire', () => {
  const { j, a } = enemyClips('firecat', FIRECAT, { walk: 'CatWalk', fast: 'CatRun', attack: 'CatPounce', death: 'CatDeath' });
  assert.equal(a.CatRun.extras.speed, FIRECAT.chase);
  assert.equal(a.CatPounce.extras.lunge_from, FIRECAT.lunge.from);
  assert.equal(a.CatPounce.extras.lunge_to, FIRECAT.lunge.to);
  assert.ok(j.nodes.filter(n => /^flame_/.test(n.name)).length >= 9, 'flames on the tail, back and head');
  for (const bone of ['jaw', 'tail_5', 'upperarm.L', 'thigh.R']) assert.ok(j.nodes.some(n => n.name === bone), bone);
  const body = j.materials.find(m => m.name === 'FireCatBody').pbrMetallicRoughness.baseColorFactor;
  assert.ok(body[0] > 4 * body[1] && body[0] < 0.4, 'dark red');
  assert.ok(!j.materials.find(m => m.name === 'FireCatBody').emissiveFactor);
  for (const [name, [r, g, b]] of glowing(j).filter(([n]) => /Flame/.test(n))) assert.ok(r === 1 && g < 0.5 && b < 0.05, name);
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
