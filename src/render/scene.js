// Renderer, scene, lights and camera.
import * as THREE from 'three';
import { N } from '../core/constants.js';

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.localClippingEnabled = true;
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

export const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x000000, 1e4, 2e4);   // always present (adding fog later recompiles shaders)

// the backdrop (sky gradient, clouds, stars) is in sky.js

export const camera = new THREE.PerspectiveCamera(28, innerWidth / innerHeight, 0.1, 500);

export const hemi = new THREE.HemisphereLight(0xdfeaff, 0x3a3020, 1.1);
scene.add(hemi);
export const sun = new THREE.DirectionalLight(0xfff1dd, 2.4);
sun.position.set(N / 2 - 12, 34, N / 2 + 8);
sun.target.position.set(N / 2, 0, N / 2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 90 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});
