// Wooden ladders against cliff faces: two rails and rungs, from the foot to a little over the top.
import { DIRS } from '../core/constants.js';
import { POST, RAIL } from './palette.js';

export function buildLadder(l, L) {
  const [dx, dz] = DIRS[l.d], wx = l.x + 0.5 + dx * 0.44, wz = l.z + 0.5 + dz * 0.44;   // just off the wall
  const sx = -dz, sz = dx;   // along the wall
  const top = l.y1 + 0.45;
  for (const s of [-0.22, 0.22]) {   // rails: vertical boxes (a beam needs a non-vertical direction)
    const x = wx + sx * s, z = wz + sz * s;
    L.wood.box(x - 0.03, l.y0, z - 0.03, x + 0.03, top, z + 0.03, POST, POST);
  }
  for (let y = l.y0 + 0.25; y < top - 0.1; y += 0.28)
    L.wood.beam([wx - sx * 0.22, y, wz - sz * 0.22], [wx + sx * 0.22, y, wz + sz * 0.22], 0.045, 0.045, RAIL);
}
