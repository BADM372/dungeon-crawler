// Grid helpers, seeded randomness and value noise.
import { N } from './constants.js';

export const idx = (x, z) => z * N + x;
export const inb = (x, z) => x >= 0 && z >= 0 && x < N && z < N;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const edgeKey = (a, b, c, d) => {
  const k1 = a + ',' + b, k2 = c + ',' + d;
  return k1 < k2 ? k1 + '|' + k2 : k2 + '|' + k1;
};

// kids-docs: random.html#mulberry (see kids-docs/README.md)
export function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function hash32(n) {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return (n ^ (n >>> 16)) >>> 0;
}

// 3-octave value noise on a 32x32 lattice, roughly in [0,1]
export function makeNoise(R) {
  const S = 32, g = new Float32Array(S * S);
  for (let i = 0; i < g.length; i++) g[i] = R();
  const at = (x, z) => g[(((z % S) + S) % S) * S + (((x % S) + S) % S)];
  const sm = t => t * t * (3 - 2 * t);
  const vn = (x, z) => {
    const xi = Math.floor(x), zi = Math.floor(z), fx = sm(x - xi), fz = sm(z - zi);
    const a = at(xi, zi), b = at(xi + 1, zi), c = at(xi, zi + 1), d = at(xi + 1, zi + 1);
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  };
  return (x, z) => {
    let s = 0, amp = 1, f = 1, norm = 0;
    for (let o = 0; o < 3; o++) { s += vn(x * f + o * 7.3, z * f + o * 3.1) * amp; norm += amp; amp *= 0.5; f *= 2; }
    return s / norm;
  };
}
