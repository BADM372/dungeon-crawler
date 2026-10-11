// Unbounded value noise in world coordinates: neighbouring cubes sample the same field, so
// terrain derived from it lines up across cube faces.
import { hash32 } from './util.js';

export function worldNoise(seed) {
  const at = (x, z) => hash32((Math.imul(x, 374761393) + Math.imul(z, 668265263) + seed) | 0) / 4294967296;
  const sm = t => t * t * (3 - 2 * t);
  const vn = (x, z) => {
    const xi = Math.floor(x), zi = Math.floor(z), fx = sm(x - xi), fz = sm(z - zi);
    const a = at(xi, zi), b = at(xi + 1, zi), c = at(xi, zi + 1), d = at(xi + 1, zi + 1);
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  };
  return (x, z) => {
    let s = 0, amp = 1, f = 1, norm = 0;
    for (let o = 0; o < 3; o++) { s += vn(x * f + o * 17.3, z * f + o * 9.1) * amp; norm += amp; amp *= 0.5; f *= 2; }
    return s / norm;
  };
}
