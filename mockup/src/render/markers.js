// Portals and the spawn pad, plus the debug route line. Every portal is two-way; gold ones lead
// somewhere unexplored, cyan ones somewhere you have been. Side portals are stone gates on the
// cube face, down portals wells in the ground, up portals rings hovering above a pad.
import * as THREE from 'three';
import { N, CUBE_H } from '../core/constants.js';

const STONE = new THREE.MeshStandardMaterial({ color: 0x9aa3b0, roughness: 0.8, flatShading: true });
STONE.userData.keep = true;
const COLORS = { new: [0xffc94a, 0xffa500], seen: [0x5fd3ff, 0x1f8fd0] };
const glowMat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, side: THREE.DoubleSide, depthWrite: false });
const box = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), STONE); m.position.set(x, y, z); m.castShadow = true; return m; };

function gate(p, [c, e]) {
  const g = new THREE.Group();
  g.add(box(0.24, 1.8, 0.24, -0.78, 0.9, 0), box(0.24, 1.8, 0.24, 0.78, 0.9, 0), box(1.9, 0.26, 0.3, 0, 1.9, 0));
  const curtain = new THREE.Mesh(new THREE.PlaneGeometry(1.32, 1.76), glowMat(c, 0.4));
  curtain.position.y = 0.88; curtain.renderOrder = 900;
  g.add(curtain, new THREE.PointLight(e, 3, 4, 2));
  const out = 0.14;
  const pos = [[N - out, p.z + 0.5], [out, p.z + 0.5], [p.x + 0.5, N - out], [p.x + 0.5, out]][p.dir];
  g.position.set(pos[0], p.y, pos[1]);
  if (p.dir < 2) g.rotation.y = Math.PI / 2;
  return { obj: g, tick: t => { curtain.material.opacity = 0.32 + Math.sin(t * 3 + p.id) * 0.1; } };
}

function well(p, [c, e]) {
  const g = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.13, 8, 24), STONE);
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.08; rim.castShadow = true;
  const swirl = new THREE.Mesh(new THREE.CircleGeometry(0.56, 24), glowMat(c, 0.75));
  swirl.rotation.x = -Math.PI / 2; swirl.position.y = 0.03; swirl.renderOrder = 900;
  const inner = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.32, 5), glowMat(0x2a1440, 0.8));
  inner.rotation.x = -Math.PI / 2; inner.position.y = 0.04; inner.renderOrder = 901;
  g.add(rim, swirl, inner, new THREE.PointLight(e, 3, 3, 2));
  g.position.set(p.x + 0.5, p.y, p.z + 0.5);
  return { obj: g, tick: t => { inner.rotation.z = -t * 2.5; swirl.material.opacity = 0.6 + Math.sin(t * 4) * 0.15; } };
}

function ring(p, [c, e]) {
  const g = new THREE.Group();
  const r = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.07, 10, 32), new THREE.MeshStandardMaterial({ color: c, emissive: e, emissiveIntensity: 1.4 }));
  r.rotation.x = Math.PI / 2; r.position.y = 1.5;
  const beamH = CUBE_H - p.y;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, beamH, 20, 1, true), glowMat(c, 0.12));
  beam.position.y = beamH / 2; beam.renderOrder = 900;
  g.add(r, beam, new THREE.PointLight(e, 5, 5, 2));
  g.position.set(p.x + 0.5, p.y, p.z + 0.5);
  return { obj: g, tick: t => { r.position.y = 1.5 + Math.sin(t * 2) * 0.12; beam.material.opacity = 0.1 + Math.sin(t * 2) * 0.04; } };
}

function spawnPad(p) {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1, 0.08, 8), STONE);
  disc.position.y = 0.04; disc.receiveShadow = true;
  const glow = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 8), glowMat(0xe8f4ff, 0.4));
  glow.rotation.x = -Math.PI / 2; glow.position.y = 0.09;
  g.add(disc, glow);
  g.position.set(p.x + 0.5, p.y, p.z + 0.5);
  return { obj: g, tick: t => { glow.material.opacity = 0.3 + Math.sin(t * 2.5) * 0.1; } };
}

// seen: portal id -> leads somewhere explored
export function buildMarkers(m, group, showPath, seen = {}) {
  const portalFx = m.portals.map(p => {
    const col = COLORS[seen[p.id] ? 'seen' : 'new'];
    const fx = p.kind === 'side' ? gate(p, col) : p.kind === 'down' ? well(p, col) : p.kind === 'up' ? ring(p, col) : spawnPad(p);
    group.add(fx.obj);
    return fx;
  });
  const pathLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(m.pathPts),
    new THREE.LineBasicMaterial({ color: 0xff3df2, depthTest: false, transparent: true }));
  pathLine.renderOrder = 998;
  pathLine.visible = showPath;
  group.add(pathLine);
  return { pathLine, portalFx };
}
