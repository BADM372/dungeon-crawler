// Serializable circle / box colliders, shared by generation and runtime queries.
import { N } from './constants.js';

export function containsXZ(b, x, z, margin = 0) {
  return b.shape === 'box'
    ? x >= b.x0 - margin && x <= b.x1 + margin && z >= b.z0 - margin && z <= b.z1 + margin
    : Math.hypot(x - b.x, z - b.z) <= b.r + margin;
}

export function indexBlockers(list) {
  const cells = Array.from({ length: N * N }, () => []);
  for (const b of list) {
    const [x0, z0, x1, z1] = b.shape === 'box' ? [b.x0, b.z0, b.x1, b.z1]
      : [b.x - b.r, b.z - b.r, b.x + b.r, b.z + b.r];
    for (let z = Math.max(0, Math.floor(z0)); z <= Math.min(N - 1, Math.floor(z1)); z++)
      for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(N - 1, Math.floor(x1)); x++) cells[z * N + x].push(b);
  }
  return cells;
}

// Occlusion volumes are independent of body collision: foliage can hide the player
// while remaining walkable underneath. Used by the cutaway ray probes.
export function viewBlockedAt(map, x, y, z) {
  return (map.occluders || []).some(b => {
    if (b.shape === 'ellipsoid') {
      return ((x - b.x) / b.rx) ** 2 + ((y - b.y) / b.ry) ** 2 + ((z - b.z) / b.rz) ** 2 <= 1;
    }
    return y >= b.bottom && y <= b.top && containsXZ(b, x, z);
  });
}
