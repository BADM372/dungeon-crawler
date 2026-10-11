// Physics owns attack/death timers. Animation is sampled from those same timers,
// so loading late, interrupting a swing or sliding a cube cannot desynchronise hits.
import * as THREE from 'three';
import { scene, camera } from './scene.js';
import { spiderModel } from './spidermodel.js';
import { stunderModel } from './stundermodel.js';
import { cloneEnemy } from './enemymodel.js';
import { player } from '../game/state.js';

const prefabs = { spider: spiderModel, stunder: stunderModel };
const barGeo = new THREE.PlaneGeometry(1, 1);
const backMat = new THREE.MeshBasicMaterial({ color: 0x231f25, side: THREE.DoubleSide });
const fillMat = new THREE.MeshBasicMaterial({ color: 0xf2a449, side: THREE.DoubleSide });
const white = new THREE.Color(0xffffff), inverseYaw = new THREE.Quaternion();
const up = new THREE.Vector3(0, 1, 0);
const angleTo = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;

function levelLabel(level) {
  const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 24px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 5; ctx.strokeStyle = '#171c25'; ctx.strokeText(`Lv ${level}`, 64, 16);
  ctx.fillStyle = '#ffe4ae'; ctx.fillText(`Lv ${level}`, 64, 16);
  const texture = new THREE.CanvasTexture(canvas);
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false }));
  label.scale.set(.7, .175, 1);
  return label;
}
function makeView(e, prefab) {
  const group = new THREE.Group(), model = cloneEnemy(prefab);
  group.add(model); scene.add(group);
  const materials = [];
  model.traverse(o => {
    if (!o.isMesh) return;
    const own = m => { const c = m.clone(); c.transparent = true; materials.push({ material: c, color: c.color.clone() }); return c; };
    o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material);
  });
  const mixer = new THREE.AnimationMixer(model), actions = {};
  for (const name of ['walk', 'fast', 'attack', 'death']) if (prefab[name]) {
    const a = mixer.clipAction(prefab[name]);
    if (name === 'attack' || name === 'death') { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
    a.play(); a.timeScale = 0; a.setEffectiveWeight(name === 'walk' ? 1 : 0); actions[name] = a;
  }
  const bar = new THREE.Group(), back = new THREE.Mesh(barGeo, backMat), fill = new THREE.Mesh(barGeo, fillMat);
  back.scale.set(0.66, 0.07, 1); fill.scale.set(0.62, 0.045, 1); fill.position.z = 0.001;
  bar.add(back, fill); bar.position.y = e.profile.height + 0.12; group.add(bar);
  const label = levelLabel(e.level); label.position.y = e.profile.height + .3; group.add(label);
  return { group, model, mixer, actions, prefab, materials, bar, fill, label, yaw: e.yaw, phase: e.phase,
    attacks: -1, dead: false, weights: { walk: 1, fast: 0, attack: 0, death: 0 } };
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
    const attack = e.mode === 'attack';
    if (attack && v.attacks !== e.attacks) {
      v.attacks = e.attacks; A.attack.reset().play(); A.attack.timeScale = 0;
    }
    const fast = A.fast ? THREE.MathUtils.clamp((e.speed - prefab.walkSpeed) / (prefab.fastSpeed - prefab.walkSpeed), 0, 1) : 0;
    const stride = prefab.walkSpeed * A.walk.getClip().duration * (1 - fast)
      + (A.fast ? prefab.fastSpeed * A.fast.getClip().duration * fast : 0);
    if (!attack && e.speed > 0.01) v.phase = (v.phase + dt * e.speed / stride) % 1;
    else if (!attack) v.phase = 0; // idle on both planted feet, not frozen mid-step
    A.walk.time = v.phase * A.walk.getClip().duration;
    if (A.fast) A.fast.time = v.phase * A.fast.getClip().duration;
    if (attack) A.attack.time = Math.min(e.t, A.attack.getClip().duration);
    const target = { walk: attack ? 0 : 1 - fast, fast: attack ? 0 : fast, attack: attack ? 1 : 0, death: 0 };
    for (const name in A) {
      v.weights[name] += (target[name] - v.weights[name]) * Math.min(1, dt * 18);
      A[name].setEffectiveWeight(v.weights[name]);
    }
    const flash = Math.min(0.6, e.hurtT / 0.22 * 0.6);
    for (const { material, color } of v.materials) material.color.copy(color).lerp(white, flash);
    v.bar.visible = e.hp < e.profile.hp;
    v.label.visible = v.bar.visible || Math.hypot(e.x - player.x, e.z - player.z) < e.profile.aggro + 1;
    inverseYaw.setFromAxisAngle(up, -v.yaw);
    v.bar.quaternion.copy(inverseYaw).multiply(camera.quaternion);
    const hp = e.hp / e.profile.hp;
    v.fill.scale.x = 0.62 * hp; v.fill.position.x = -0.31 * (1 - hp);
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
