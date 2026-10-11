// Loads the skinned player character and prepares its animation actions.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CHAR_SCALE } from '../core/constants.js';
import { scene } from './scene.js';

const URL = '../blender/character.glb';
const SWORD_URL = '../blender/sword.glb';
const FPS = 30;
const STAND_HIPS = 0.69;   // hips height of the standing pose (rig units)

export const character = { ready: false };

// Weapons are separate props. The character GLB contains only the body and hand sockets.
export function equipSword(weapon) {
  if (character.sword) character.sword.removeFromParent();
  character.sword = weapon;
  if (!weapon) return;
  character.bones['hand.R'].add(weapon);
  weapon.position.set(0, 0, 0);   // glTF bone origins are socket heads, not Blender tails
  weapon.rotation.set(Math.PI / 3, 0, 0);   // +Y blade axis -> 60 degrees from forearm
  weapon.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
}

export async function loadSword(url = SWORD_URL) {
  const gltf = await new GLTFLoader().loadAsync(url);
  equipSword(gltf.scene);
  return gltf.scene;
}

// a frame range of a clip; the hips never rise above standing height in it, because in the
// game the controller moves the body through the air, not the animation
function part(clip, name, from, to) {
  const c = THREE.AnimationUtils.subclip(clip, name, from, to, FPS);
  const t = c.tracks.find(t => t.name === 'hips.position');
  if (t) for (let i = 2; i < t.values.length; i += 3) t.values[i] = Math.min(t.values[i], STAND_HIPS);
  return c;
}

function setup(gltf) {
  const model = gltf.scene;
  model.scale.setScalar(CHAR_SCALE);
  const group = new THREE.Group();
  group.add(model);
  let mesh = null;
  model.traverse(o => { if (o.isSkinnedMesh) mesh = o; if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });

  // silhouette shown where the character is hidden behind terrain
  const ghost = new THREE.SkinnedMesh(mesh.geometry, new THREE.MeshBasicMaterial({
    color: 0xffe9a8, transparent: true, opacity: 0.4, depthFunc: THREE.GreaterDepth, depthWrite: false }));
  ghost.bind(mesh.skeleton, mesh.bindMatrix);
  ghost.renderOrder = 999; ghost.frustumCulled = false;
  mesh.parent.add(ghost);
  // drawn after the silhouette, so the silhouette only shows where terrain hides the body
  mesh.material.transparent = true;
  mesh.renderOrder = 1000;
  const light = new THREE.PointLight(0xffd9a0, 1.2, 3.5, 2);
  light.position.y = 0.9;
  group.add(light);

  // bones by their Blender names ("upper_arm.L", ...)
  const bones = {};
  model.traverse(o => { if (o.isBone) bones[o.userData.name || o.name] = o; });

  const clips = Object.fromEntries(gltf.animations.map(c => [c.name, c]));
  const extras = name => gltf.parser.json.animations.find(a => a.name === name)?.extras || {};
  const J = clips.Jump, S = clips.JumpLandSit;
  const defs = {
    idle: part(J, 'Idle', 0, 2),          // the neutral standing pose
    walk: clips.Walk, run: clips.Run,
    slash: clips.Slash,
    swim: clips.Swim, swimIdle: clips.SwimIdle,   // authored for floating chest deep
    climb: clips.Climb,   // in-place ladder grips and steps
    jump: part(J, 'JumpUp', 15, 27),      // push-off into the rising pose
    fall: part(J, 'Fall', 26, 31),        // tucked pose around the apex
    land: part(J, 'Land', 37, 58),        // compression + recovery
    sit: part(S, 'SitLand', 36, 78),      // lose balance, land on the bottom, stay sitting
  };
  // all actions run all the time; the animator drives their weights and times by hand
  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const [k, clip] of Object.entries(defs)) {
    const a = mixer.clipAction(clip);
    a.play(); a.timeScale = 0; a.setEffectiveWeight(k === 'idle' ? 1 : 0);
    actions[k] = a;
  }
  // ground covered per animation cycle, so foot speed can match the actual speed
  const stride = name => extras(name).speed * clips[name].duration * CHAR_SCALE;

  scene.add(group);
  // reference (standing) pose for exaggerating strides
  mixer.update(0);
  const standing = Object.fromEntries(Object.entries(bones).map(([n, b]) => [n, b.quaternion.clone()]));
  Object.assign(character, {
    ready: true, group, model, mesh, bones, mixer, actions, standing, light,
    sword: null, swordWeight: 0,
    walkStride: stride('Walk'), runStride: stride('Run'), swimStride: stride('Swim'),
    climbStride: extras('Climb').distance * CHAR_SCALE,
  });
  // The mockup starts equipped; future inventory changes can replace / clear this prop.
  loadSword().catch(e => console.error('sword failed to load', e));
}

new GLTFLoader().load(URL, setup, undefined, e => console.error('character failed to load', e));
