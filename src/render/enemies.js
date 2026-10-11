// Physics owns attack/death timers. Animation is sampled from those same timers,
// so loading late, interrupting a swing or sliding a cube cannot desynchronise hits.
import * as THREE from 'three';
import { scene, camera } from './scene.js';
import { spiderModel } from './spidermodel.js';
import { stunderModel } from './stundermodel.js';
import { snakeModel } from './snakemodel.js';
import { octonautModel } from './octonautmodel.js';
import { cloneEnemy } from './enemymodel.js';
import { attackOf } from '../core/enemies.js';
import { player } from '../game/state.js';
import { makeBar, makeLevelLabel } from './bars.js';

const prefabs = { spider: spiderModel, stunder: stunderModel, snake: snakeModel, octonaut: octonautModel };
const white = new THREE.Color(0xffffff), hover = new THREE.Color(0xffd9a0), inverseYaw = new THREE.Quaternion();
const up = new THREE.Vector3(0, 1, 0);
const angleTo = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;

function makeView(e, prefab) {
  const group = new THREE.Group(), model = cloneEnemy(prefab);
  group.add(model); scene.add(group);
  const materials = [];
  model.traverse(o => {
    if (!o.isMesh) return;
    const own = m => { const c = m.clone(); c.transparent = true; materials.push({ material: c, color: c.color.clone() }); return c; };
    o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material);
  });
  // actions: walk, fast?, death and one per attack clip (keyed like attack.clip, else 'attack')
  const mixer = new THREE.AnimationMixer(model), actions = {}, weights = {};
  const clips = { walk: prefab.walk, fast: prefab.fast, death: prefab.death, ...prefab.attacks };
  for (const [name, clip] of Object.entries(clips)) if (clip) {
    const a = mixer.clipAction(clip);
    if (name !== 'walk' && name !== 'fast') { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
    a.play(); a.timeScale = 0; a.setEffectiveWeight(name === 'walk' ? 1 : 0); actions[name] = a;
    weights[name] = name === 'walk' ? 1 : 0;
  }
  const hpBar = makeBar(), bar = hpBar.group;
  bar.position.y = e.profile.height + 0.12; group.add(bar);
  const label = makeLevelLabel(e.level); label.position.y = e.profile.height + .3; group.add(label);
  return { group, model, mixer, actions, prefab, materials, bar, hpBar, label, yaw: e.yaw, phase: e.phase,
    attacks: -1, dead: false, weights };
}
function dying(v, e) {
  if (!v.dead) {
    v.dead = true;
    for (const a of Object.values(v.actions)) a.setEffectiveWeight(0);
    v.actions.death.reset().play().setEffectiveWeight(1);
    v.actions.death.timeScale = 0;
  }
  v.actions.death.time = Math.min(e.deadT, v.actions.death.getClip().duration);
  const fade = Math.max(0, 1 - Math.max(0, e.deadT - e.profile.deathTime - 0.5) / 0.8);
  for (const { material } of v.materials) material.opacity = fade;
  v.bar.visible = false; v.label.visible = false;
  v.group.visible = fade > 0;
  v.mixer.update(0);
}
export function animateEnemies(list, dt, off = { x: 0, y: 0, z: 0 }) {
  for (const e of list) {
    const prefab = prefabs[e.type];
    if (!prefab?.ready) continue;
    const v = e.view || (e.view = makeView(e, prefab)), A = v.actions;
    // A ram commits to its direction before contact; visuals must match the hit cone.
    v.yaw = e.mode === 'attack' ? e.yaw : angleTo(v.yaw, e.yaw, Math.min(1, dt * 14));
    v.group.position.set(e.x + off.x, e.y + off.y, e.z + off.z);
    v.group.rotation.y = v.yaw;
    if (e.mode === 'dead') { dying(v, e); continue; }
    const attack = e.mode === 'attack', strike = A[attackOf(e).clip ?? 'attack'];
    if (attack && v.attacks !== e.attacks) {
      v.attacks = e.attacks; strike.reset().play(); strike.timeScale = 0;
    }
    const fast = A.fast ? THREE.MathUtils.clamp((e.speed - prefab.walkSpeed) / (prefab.fastSpeed - prefab.walkSpeed), 0, 1) : 0;
    const stride = prefab.walkSpeed * A.walk.getClip().duration * (1 - fast)
      + (A.fast ? prefab.fastSpeed * A.fast.getClip().duration * fast : 0);
    if (!attack && e.speed > 0.01) v.phase = (v.phase + dt * e.speed / stride) % 1;
    else if (!attack) v.phase = 0; // idle on both planted feet, not frozen mid-step
    A.walk.time = v.phase * A.walk.getClip().duration;
    if (A.fast) A.fast.time = v.phase * A.fast.getClip().duration;
    if (attack) strike.time = Math.min(e.t, strike.getClip().duration);
    for (const name in A) {
      const target = name === 'walk' ? (attack ? 0 : 1 - fast) : name === 'fast' ? (attack ? 0 : fast) : +(attack && A[name] === strike);
      v.weights[name] += (target - v.weights[name]) * Math.min(1, dt * 18);
      A[name].setEffectiveWeight(v.weights[name]);
    }
    const flash = Math.min(0.6, e.hurtT / 0.22 * 0.6);
    for (const { material, color } of v.materials) material.color.copy(color).lerp(flash > 0.1 || !e.hovered ? white : hover, Math.max(flash, e.hovered ? 0.22 : 0));
    v.bar.visible = e.hp < e.profile.hp || !!e.hovered;
    v.label.visible = v.bar.visible || Math.hypot(e.x - player.x, e.z - player.z) < e.profile.aggro + 1;
    inverseYaw.setFromAxisAngle(up, -v.yaw);
    v.bar.quaternion.copy(inverseYaw).multiply(camera.quaternion);
    v.hpBar.set(e.hp / e.profile.hp);
    v.mixer.update(0);
  }
}
export function removeEnemyViews(list) {
  for (const e of list) if (e.view) {
    const v = e.view;
    scene.remove(v.group);
    v.mixer.stopAllAction(); v.mixer.uncacheRoot(v.model);
    v.materials.forEach(({ material }) => material.dispose());
    v.label.material.map.dispose(); v.label.material.dispose();
    const skeletons = new Set();
    v.model.traverse(o => { if (o.isSkinnedMesh) skeletons.add(o.skeleton); });
    skeletons.forEach(s => s.dispose());
    e.view = null;
  }
}
