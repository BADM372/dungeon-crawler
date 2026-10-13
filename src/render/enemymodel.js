// Load prefab clips once; each instance owns its skeleton, not the source's bones.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { cloneSkinned } from './skinned.js';

// names.attack is one clip name, or { [attack.clip]: clip name } for several attacks.
// names.props: standalone nodes (projectiles) taken out of the model into model.props.
export function loadEnemyModel(url, scale, names) {
  const model = { ready: false, scale };
  const attackNames = typeof names.attack === 'string' ? { attack: names.attack } : names.attack;
  new GLTFLoader().load(url, gltf => {
    const clips = Object.fromEntries(gltf.animations.map(c => [c.name, c]));
    if ([names.walk, names.fast, names.death, ...Object.values(attackNames)].some(n => n && !clips[n])) {
      model.error = 'Missing enemy animation in ' + url; console.error(model.error); return;
    }
    const extras = n => gltf.parser.json.animations.find(a => a.name === n)?.extras || {};
    const props = Object.fromEntries((names.props || []).map(n => [n, gltf.scene.getObjectByName(n)]));
    if (Object.values(props).some(o => !o)) { model.error = 'Missing enemy prop in ' + url; console.error(model.error); return; }
    for (const o of Object.values(props)) o.removeFromParent();
    gltf.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    Object.assign(model, {
      ready: true, source: gltf.scene, props, walk: clips[names.walk], fast: names.fast ? clips[names.fast] : null,
      attacks: Object.fromEntries(Object.entries(attackNames).map(([k, n]) => [k, clips[n]])), death: clips[names.death],
      walkSpeed: (extras(names.walk).speed || 1) * scale,
      fastSpeed: names.fast ? extras(names.fast).speed * scale : 0,
    });
  }, undefined, error => { model.error = String(error); console.error('Enemy failed to load:', url, error); });
  return model;
}
export function cloneEnemy(model) {
  const copy = cloneSkinned(model.source);
  copy.scale.setScalar(model.scale);
  return copy;
}
