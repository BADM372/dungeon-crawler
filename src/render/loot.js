// Pickups on the ground: they arc out of the body, hover, spin and bob, and when collected
// they swoop into the player and shrink away. Views hang in the cube's group, so they slide
// along with it during travel and go away with it; their geometry and materials are shared
// between all copies, so disposing a cube leaves them alone.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ITEMS } from '../core/items.js';
import { player } from '../game/state.js';

const loader = new GLTFLoader(), protos = new Map();   // itemId -> prototype (null while loading)
const views = new Map();                               // pickup id -> Object3D
let viewsWorld = null;
const HOVER = 0.08, TOSS_HEIGHT = 0.75, SCALE = 1.35;

function proto(itemId) {
  if (protos.has(itemId)) return protos.get(itemId);
  protos.set(itemId, null);
  loader.loadAsync(ITEMS[itemId].model).then(g => {
    const root = g.scene, def = ITEMS[itemId];
    root.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.userData.sharedGeo = true;
      // a faint glow of their own colour, so pickups stand out from the ground clutter
      o.material = [].concat(o.material).map(m => {
        m = m.clone(); m.userData.keep = true;
        if (m.emissive) { m.emissive.copy(m.color); m.emissiveIntensity = 0.2; }
        return m;
      });
      if (o.material.length === 1) o.material = o.material[0];
    });
    if (def.category === 'currency') root.rotation.x = Math.PI / 2;   // coins stand on their rim
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root), centre = box.getCenter(new THREE.Vector3());
    root.position.sub(centre);
    const wrap = new THREE.Group();
    wrap.add(root); wrap.scale.setScalar(SCALE);
    wrap.userData.half = (box.max.y - box.min.y) / 2 * SCALE;
    protos.set(itemId, wrap);
  }).catch(e => console.error('item model failed to load', itemId, e));
  return null;
}

const ease = t => t * t * (3 - 2 * t);
const v = new THREE.Vector3(), target = new THREE.Vector3();

// where p is when nobody pulls it: on its arc out of the body, then hovering in place
function rest(p, half, time, out) {
  const y = p.y + half + HOVER + Math.sin(time * 2.6 + p.phase) * 0.035;
  if (p.toss >= 1) return out.set(p.x, y, p.z);
  const u = Math.max(0, p.toss), e = ease(u);
  return out.set(p.from.x + (p.x - p.from.x) * u, p.from.y + (y - p.from.y) * e + TOSS_HEIGHT * 4 * u * (1 - u), p.from.z + (p.z - p.from.z) * u);
}

export function drawLoot(list, world, time) {
  if (world !== viewsWorld) { views.clear(); viewsWorld = world; }   // old views leave with their cube
  if (!world) return;
  const seen = new Set();
  for (const p of list) {
    seen.add(p.id);
    let o = views.get(p.id);
    if (!o) {
      const pr = proto(p.itemId);
      if (!pr) continue;
      o = pr.clone(); world.group.add(o); views.set(p.id, o);
    }
    const half = o.userData.half;
    o.visible = p.toss >= 0;
    rest(p, half, time, v);
    let spin = 1.8, scale = SCALE;
    if (p.toss < 1) spin = 9;   // tumbling out
    if (p.fly) {
      const u = Math.min(1, Math.max(0, p.fly.t / p.fly.dur)), e = u * u;   // accelerate into the player
      target.set(player.x - world.group.position.x, player.visY + 0.55 - world.group.position.y, player.z - world.group.position.z);
      const lift = p.fly.t < 0 ? 0.12 * Math.min(1, (p.fly.t + 0.15) / 0.15) : 0;   // a little hop before it goes
      v.lerp(target, e).y += Math.sin(u * Math.PI) * 0.35 + Math.max(0, lift);
      spin = 4 + 14 * e; scale = SCALE * (1 - 0.65 * e);
    }
    o.position.copy(v);
    o.rotation.y = time * spin + p.phase;
    o.scale.setScalar(scale);
  }
  for (const [id, o] of views) if (!seen.has(id)) { o.removeFromParent(); views.delete(id); }
}
