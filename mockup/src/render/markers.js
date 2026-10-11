// Entry arch, exit portal with beam, door outlines and the debug route line.
import * as THREE from 'three';
import { N, CUBE_H, BASE } from '../core/constants.js';

function entryArch(m, group) {
  const stone = new THREE.MeshStandardMaterial({ color: 0x9aa3b0, roughness: 0.8, flatShading: true });
  const ey = m.entry.y, ez = m.entry.z;
  for (const pz of [0.12, 0.88]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.5, 0.2), stone);
    p.position.set(0.12, ey + 0.75, ez + pz); p.castShadow = true; group.add(p);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 1.0), stone);
  lintel.position.set(0.12, ey + 1.58, ez + 0.5); lintel.castShadow = true; group.add(lintel);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 1.45),
    new THREE.MeshBasicMaterial({ color: 0x5fd3ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  glow.rotation.y = Math.PI / 2; glow.position.set(0.03, ey + 0.74, ez + 0.5); glow.renderOrder = 900;
  group.add(glow);
  return glow;
}

function exitPortal(m, group) {
  const xy = m.exit.y, xz = m.exit.z;
  const portal = new THREE.Group();
  portal.position.set(N - 0.5, xy + 0.8, xz + 0.5);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.07, 10, 32),
    new THREE.MeshStandardMaterial({ color: 0xffc94a, emissive: 0xffa500, emissiveIntensity: 1.4 }));
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.44, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
  disc.renderOrder = 900;
  ring.rotation.y = disc.rotation.y = Math.PI / 2;
  portal.add(ring, disc, new THREE.PointLight(0xffc94a, 8, 6, 2));
  group.add(portal);
  const beamH = CUBE_H - BASE - xy;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, beamH, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.set(N - 0.5, xy + beamH / 2, xz + 0.5);
  beam.renderOrder = 900;
  group.add(beam);
  return { ring, disc, beam };
}

const door = (x, y, z, color) => {
  const pts = [[x, y, z], [x, y + 1.7, z], [x, y + 1.7, z + 1], [x, y, z + 1], [x, y, z]].map(p => new THREE.Vector3(...p));
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color }));
};

export function buildMarkers(m, group, showPath) {
  const entryGlow = entryArch(m, group);
  const portal = exitPortal(m, group);
  group.add(door(0, m.entry.y, m.entry.z, 0x5fd3ff), door(N, m.exit.y, m.exit.z, 0xffc94a));
  const pathLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(m.pathPts),
    new THREE.LineBasicMaterial({ color: 0xff3df2, depthTest: false, transparent: true }));
  pathLine.renderOrder = 998;
  pathLine.visible = showPath;
  group.add(pathLine);
  return { entryGlow, pathLine, ...portal };
}
