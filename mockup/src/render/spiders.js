// Spider visuals: places the models, runs walk / attack, and the squash-and-fade death.
import * as THREE from 'three';
import { scene } from './scene.js';
import { spiderModel, cloneSpider } from './spidermodel.js';

const angleTo = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;

function makeView(s) {
  const group = new THREE.Group(), model = cloneSpider();
  group.add(model);
  scene.add(group);
  const mixer = new THREE.AnimationMixer(model);
  const walk = mixer.clipAction(spiderModel.walk), attack = mixer.clipAction(spiderModel.attack);
  walk.play(); walk.time = s.phase * walk.getClip().duration; walk.timeScale = 0;
  attack.setLoop(THREE.LoopOnce, 1); attack.clampWhenFinished = true;
  return { group, model, mixer, walk, attack, attacks: s.attacks, yaw: s.yaw };
}

// dust puff when a spider gets squashed
const puffGeo = new THREE.IcosahedronGeometry(0.045, 1);
function puff(view) {
  view.puff = [];
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color: 0x8a8278, transparent: true, opacity: 0.8 }));
    const a = i / 9 * Math.PI * 2;
    m.userData.v = new THREE.Vector3(Math.cos(a) * 1.4, 0.5 + (i % 3) * 0.3, Math.sin(a) * 1.4);
    m.position.set(0, 0.08, 0);
    view.group.add(m);
    view.puff.push(m);
  }
}

function dying(v, s, dt) {
  const t = s.deadT;
  if (!v.mats) {   // own materials so this spider can fade alone
    v.mats = [];
    v.model.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; v.mats.push(o.material); } });
    puff(v);
    v.mixer.stopAllAction();
  }
  const sq = Math.min(1, t / 0.12);
  v.group.scale.set(1 + 0.3 * sq, 1 - 0.75 * sq, 1 + 0.3 * sq);
  const fade = Math.max(0, 1 - Math.max(0, t - 0.5) / 0.6);
  for (const m of v.mats) m.opacity = fade;
  for (const p of v.puff) {
    p.position.addScaledVector(p.userData.v, dt / v.group.scale.y);
    p.userData.v.multiplyScalar(1 - dt * 4);
    p.scale.setScalar(1 + t * 2);
    p.material.opacity = Math.max(0, 0.8 - t * 1.3);
  }
  v.group.visible = fade > 0;
}

// off: where the cube is drawn (it slides during portal travel)
export function animateSpiders(list, dt, off = { x: 0, y: 0, z: 0 }) {
  if (!spiderModel.ready) return;
  for (const s of list) {
    const v = s.view || (s.view = makeView(s));
    v.yaw = angleTo(v.yaw, s.yaw, Math.min(1, dt * 14));
    v.group.position.set(s.x + off.x, s.y + off.y, s.z + off.z);
    v.group.rotation.y = v.yaw;
    if (s.mode === 'dead') { dying(v, s, dt); continue; }
    // the walk cycle plays at the pace of the actual ground speed
    v.walk.timeScale += (s.speed / spiderModel.walkSpeed - v.walk.timeScale) * Math.min(1, dt * 10);
    if (s.attacks !== v.attacks) {
      v.attacks = s.attacks;
      v.attack.reset().setEffectiveWeight(1).fadeIn(0.08).play();
      v.walk.fadeOut(0.08);
    }
    if (v.attack.isRunning() === false && v.attack.getEffectiveWeight() > 0 && !v.back) {
      v.back = true;
      v.attack.fadeOut(0.2); v.walk.reset().fadeIn(0.2).play();
    }
    if (v.attack.isRunning()) v.back = false;
    v.mixer.update(dt);
  }
}

export function removeSpiderViews(list) {
  for (const s of list) if (s.view) {
    scene.remove(s.view.group);
    s.view.mats?.forEach(m => m.dispose());
    s.view.puff?.forEach(p => p.material.dispose());
  }
}
