// Register buildings and large grove trees in the shared instanced-prop catalog.
// Startup waits for these AND ordinary vegetation: never spawn in an empty town.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { registerProps, propsReady } from './props.js';

const loader = new GLTFLoader();
export const townAssetsReady = Promise.all([
  propsReady,
  loader.loadAsync('../blender/town.glb').then(registerProps),
  loader.loadAsync('../blender/town_trees.glb').then(registerProps),
]);
townAssetsReady.catch(e => console.error('town assets failed to load', e));
