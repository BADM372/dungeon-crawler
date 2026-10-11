// Ground profiles along side faces (shared by the two cubes of a face): levels from world-space
// noise in the face socket's band (highlands get taller where the theme has more relief), and
// VOID where both cubes may open onto the depth below. Where four faces meet, the corner
// column gets one value all four agree on.
import { N } from '../core/constants.js';
import { clamp } from '../core/util.js';
import { key, parse } from './coords.js';
import { themeAt } from './depth.js';
import { voidAllowed, isVoid } from './voids.js';

export const VOID = -1;

export function levelAt(noise, sock, wx, wz, Y) {
  const n = clamp((noise(wx * 0.21 + Y * 101, wz * 0.21) - 0.25) / 0.5, 0, 1);
  return sock === 'H' ? 8 + Math.floor(n * (3.99 + 6 * themeAt(-Y).relief)) : 3 + Math.floor(n * 3.99);
}

// socket of the east (d=0) or south (d=2) face of cube (X,Y,Z), from whichever side is collapsed
function sockAt(world, X, Y, Z, d) {
  const t = world.wfc.tiles, a = t.get(key(X, Y, Z)), b = t.get(d ? key(X, Y, Z + 1) : key(X + 1, Y, Z));
  return a ? a.sock[d] : b.sock[d + 1];
}

// vertex between cubes vx-1..vx, vz-1..vz: void only if all four cubes may open, otherwise
// highland if most of the four faces there are
function vertexLevel(world, vx, Y, vz) {
  const cubes = [key(vx - 1, Y, vz - 1), key(vx, Y, vz - 1), key(vx - 1, Y, vz), key(vx, Y, vz)];
  if (cubes.every(c => voidAllowed(world, c)) && isVoid(world.noise, vx * N, vz * N, -Y)) return VOID;
  const s = [sockAt(world, vx - 1, Y, vz - 1, 0), sockAt(world, vx - 1, Y, vz, 0), sockAt(world, vx - 1, Y, vz - 1, 2), sockAt(world, vx, Y, vz - 1, 2)];
  return levelAt(world.noise, s.filter(x => x === 'H').length > 2 ? 'H' : 'L', vx * N, vz * N, Y);
}

export function profile(world, fk, sock) {
  const [k, d] = fk.split('/'), [X, Y, Z] = parse(k), out = new Int16Array(N);
  const open = voidAllowed(world, k) && voidAllowed(world, d === '0' ? key(X + 1, Y, Z) : key(X, Y, Z + 1));
  for (let t = 0; t < N; t++) {
    const wx = d === '0' ? (X + 1) * N : X * N + t + 0.5, wz = d === '0' ? Z * N + t + 0.5 : (Z + 1) * N;
    out[t] = open && isVoid(world.noise, wx, wz, -Y) ? VOID : levelAt(world.noise, sock, wx, wz, Y);
  }
  out[0] = d === '0' ? vertexLevel(world, X + 1, Y, Z) : vertexLevel(world, X, Y, Z + 1);
  out[N - 1] = vertexLevel(world, X + 1, Y, Z + 1);
  return out;
}
