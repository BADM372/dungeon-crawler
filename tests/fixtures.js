import { N, DIRS } from '../src/core/constants.js';
globalThis.location = { search: '?seed=123' };
export const { state } = await import('../src/game/state.js');

export function flatMap(seed = 1) {
  const floors = Array.from({ length: N * N }, (_, c) => ({
    c, id: c, x: c % N, z: Math.floor(c / N), top: 0, bottom: -2,
    cs: [0, 0, 0, 0], split: 0, link: [null, null, null, null],
  }));
  for (const f of floors) f.link = DIRS.map(([dx, dz]) => {
    const x = f.x + dx, z = f.z + dz;
    return x >= 0 && z >= 0 && x < N && z < N ? floors[z * N + x] : null;
  });
  return state.map = { seed, floors, cols: floors.map(f => [f]), pieces: floors.map(() => []),
    blockers: floors.map(() => []), fences: new Map(), portals: [{ x: 0, z: 0 }] };
}
