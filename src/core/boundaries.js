// Open side connections are run state, not changes to generated terrain or cube physics.
import { N, DIRS } from './constants.js';
import { faceKey, step } from '../world/coords.js';

export const isFaceOpen = (opened, key, dir) => dir < 4 && dir >= 0 && opened.has(faceKey(key, dir));
export const openedSides = (opened, key) => DIRS.map((_, dir) => isFaceOpen(opened, key, dir));
// All side faces open once the cubes on both sides have been discovered, with or without
// a gate. cubes: key -> { key, visits }; returns face keys.
export function discoveredFaces(cubes, c) {
  const out = [];
  if (c.visits) for (let d = 0; d < 4; d++) {
    if (!cubes.get(step(c.key, d))?.visits) continue;
    out.push(faceKey(c.key, d));
  }
  return out;
}

export const faceDistance = (p, dir) => [N - p.x, p.x, N - p.z, p.z][dir];

// Trigger before the body's rim hits the cube-local collision boundary. Require outward
// intent/velocity so standing near, or walking parallel to, a face does not take you through.
export function approachingFace(p, dir, dx = 0, dz = 0) {
  const [nx, nz] = DIRS[dir];
  return faceDistance(p, dir) < p.r + 0.14
    && (dx * nx + dz * nz > 0 || p.vx * nx + p.vz * nz > 0.05);
}

// Preserve the point along the face and the height; only the normal coordinate changes.
// A little room inside the new cube keeps the whole body in bounds and prevents bounce-back.
export function boundaryArrival(p, dir) {
  const inset = Math.max(0.6, p.r + 0.25);
  const x = dir === 0 ? inset : dir === 1 ? N - inset : p.x;
  const z = dir === 2 ? inset : dir === 3 ? N - inset : p.z;
  return { x, y: p.y, z };
}
