// Renderer, scene, lights, camera and the glass cube outline.
import * as THREE from 'three';
import { N, CUBE_H, BASE } from '../core/constants.js';

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

export const scene = new THREE.Scene();
{
  const c = document.createElement('canvas'); c.width = 2; c.height = 256;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#2a3242'); gr.addColorStop(1, '#0c0e13');
  g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  scene.background = tex;
}

export const camera = new THREE.PerspectiveCamera(28, innerWidth / innerHeight, 0.1, 500);

scene.add(new THREE.HemisphereLight(0xdfeaff, 0x3a3020, 1.1));
const sun = new THREE.DirectionalLight(0xfff1dd, 2.4);
sun.position.set(N / 2 - 12, 34, N / 2 + 8);
sun.target.position.set(N / 2, 0, N / 2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 90 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

// the cube itself: always the same size, drawn as a faint glass box
{
  const geo = new THREE.BoxGeometry(N, CUBE_H, N);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: 0x8fb3d9, transparent: true, opacity: 0.35 }));
  const glass = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x6d8db5, transparent: true, opacity: 0.05, side: THREE.BackSide, depthWrite: false }));
  for (const o of [edges, glass]) { o.position.set(N / 2, CUBE_H / 2 - BASE, N / 2); scene.add(o); }
}

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});
