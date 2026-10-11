// What lies on each face between two cubes. Side faces carry the ground profile along the face
// (both cubes blend their edge into it), an optional river crossing and an optional portal.
// Vertical faces only carry a portal (a well below, a ring above). A face is decided once,
// by whichever of its two cubes gets prepared first; its layout comes from the face's own
// random stream, so it does not depend on who decided it.
import { N } from '../core/constants.js';
import { clamp } from '../core/util.js';
import { key, parse, step, faceKey } from './coords.js';

export const LAYER_BASE = [0, 10, 16, 22];   // the levels of the world-wide layers

const level = (noise, sock, wx, wz, Y) => (sock === 'H' ? 8 : 3) + Math.floor(clamp((noise(wx * 0.21 + Y * 101, wz * 0.21) - 0.25) / 0.5, 0, 1) * 3.99);

// socket of the east (d=0) or south (d=2) face of cube (X,Y,Z), from whichever side is collapsed
function sockAt(world, X, Y, Z, d) {
  const t = world.wfc.tiles, a = t.get(key(X, Y, Z)), b = t.get(d ? key(X, Y, Z + 1) : key(X + 1, Y, Z));
  return a ? a.sock[d] : b.sock[d + 1];
}

// the height at a corner column, where four faces meet (vertex between cubes vx-1..vx, vz-1..vz):
// highland if most of those faces are, so all four faces (and all four cubes) agree on it
function vertexLevel(world, vx, Y, vz) {
  const s = [sockAt(world, vx - 1, Y, vz - 1, 0), sockAt(world, vx - 1, Y, vz, 0), sockAt(world, vx - 1, Y, vz - 1, 2), sockAt(world, vx, Y, vz - 1, 2)];
  return level(world.noise, s.filter(x => x === 'H').length > 2 ? 'H' : 'L', vx * N, vz * N, Y);
}

function profile(world, fk, sock) {
  const [k, d] = fk.split('/'), [X, Y, Z] = parse(k), out = new Int16Array(N);
  for (let t = 0; t < N; t++) {
    const wx = d === '0' ? (X + 1) * N : X * N + t + 0.5, wz = d === '0' ? Z * N + t + 0.5 : (Z + 1) * N;
    out[t] = level(world.noise, sock, wx, wz, Y);
  }
  out[0] = d === '0' ? vertexLevel(world, X + 1, Y, Z) : vertexLevel(world, X, Y, Z + 1);
  out[N - 1] = vertexLevel(world, X + 1, Y, Z + 1);
  return out;
}

function sideFace(world, k, d, withPortal) {
  const fk = faceKey(k, d), R = world.wfc.rng(fk, 0x51de);
  const sock = world.wfc.tiles.get(k).sock[d];
  const f = { sock, profile: profile(world, fk, sock), river: null, portal: null };
  if (sock === 'W') f.river = { pos: 4 + Math.floor(R() * 7), w: R() < 0.5 ? 1 : 2 };
  if (!withPortal) return f;
  let pos;
  do pos = 3 + Math.floor(R() * 10); while (f.river && Math.abs(pos - f.river.pos - (f.river.w - 1) / 2) < 3.5);
  // the portal's layer: any layer both cubes have, mostly the highest one (sky routes)
  const maxL = Math.min(world.wfc.tiles.get(k).K, world.wfc.tiles.get(step(k, d)).K) - 1;
  const layer = maxL > 0 && R() < 0.5 ? maxL : Math.floor(R() * (maxL + 1));
  let level = LAYER_BASE[layer];
  if (!layer) {   // a flat pad of three cells at the highest ground level around it
    level = Math.max(f.profile[pos - 1], f.profile[pos], f.profile[pos + 1]);
    for (let t = pos - 1; t <= pos + 1; t++) f.profile[t] = level;
  }
  f.portal = { pos, layer, level };
  return f;
}

function verticalFace(world, k, d, withPortal) {
  const R = world.wfc.rng(faceKey(k, d), 0xd0e);
  return { vertical: true, portal: withPortal ? { x: 4 + Math.floor(R() * 8), z: 4 + Math.floor(R() * 8) } : null };
}

// faces follow the depth's layout (layout.js): side portals where it links two cubes, the
// well down / the ring up at the ends of its spine
export function decideFaces(world, k) {
  const L = world.layout(-parse(k)[1]);
  for (let d = 0; d < 6; d++) {
    const fk = faceKey(k, d);
    if (world.faces.has(fk)) continue;
    if (d < 4) world.faces.set(fk, sideFace(world, k, d, L.portals.has(fk)));
    else world.faces.set(fk, verticalFace(world, k, d, d === 4 ? L.down === k : L.up === k));
  }
}
