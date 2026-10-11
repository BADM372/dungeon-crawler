// Can the character's body move to a new position? Cliffs, walls, structures and fences.
import { N, STEP, SWIM_STEP } from '../core/constants.js';
import { clamp, edgeKey } from '../core/util.js';
import { topOf } from '../core/surfaces.js';
import { player, state } from '../game/state.js';
import { cellAt, groundAt, blockedAt } from './collide.js';

function fenceBlocks(a, b, y) {
  if (a < 0 || b < 0 || a === b) return false;
  const ax = a % N, az = (a / N) | 0, bx = b % N, bz = (b / N) | 0;
  if (Math.abs(ax - bx) + Math.abs(az - bz) !== 1) return false;
  const f = state.map.fences.get(edgeKey(ax, az, bx, bz));
  return !!f && f.some(e => y > e.ymin - 0.45 && y < e.ymax + 0.6);
}

// Surfaces are continuous inside a cell, so the only real obstacles are height jumps across a
// cell edge (cliffs, slab sides, stair sides) and structures at body height. (rx,rz) is a
// reference point on our side, (px,pz) the probe point.
function hopBlocked(rx, rz, px, pz, y, step) {
  const ri = cellAt(rx, rz), pi = cellAt(px, pz);
  if (pi < 0) return true;
  if (ri === pi || ri < 0) return blockedAt(px, pz, y, step, true);
  const e = 0.002;
  const qx = clamp(px, Math.floor(rx) + e, Math.floor(rx) + 1 - e), qz = clamp(pz, Math.floor(rz) + e, Math.floor(rz) + 1 - e);
  // our side of the edge: the surface we stand on if it is in that cell, else whatever is there
  const sup = player.support, qi = cellAt(qx, qz);
  const own = sup && sup.c === qi ? topOf(sup, qx - Math.floor(qx), qz - Math.floor(qz)) : groundAt(qx, qz, y + 0.6, 0).h;
  // in the air we only compare against our feet, not the ground below
  const ref = player.grounded ? Math.max(y, own) : y;
  const q2x = clamp(qx, Math.floor(px) + e, Math.floor(px) + 1 - e), q2z = clamp(qz, Math.floor(pz) + e, Math.floor(pz) + 1 - e);
  return blockedAt(q2x, q2z, ref, step);
}

// can the body's center move to (nx,nz) along one axis? probes the center and three rim points
export function canMove(nx, nz, axis, sign) {
  const r = player.r, y = player.y, step = player.swimming ? SWIM_STEP : STEP;
  const ci = cellAt(nx, nz);
  if (ci < 0) return false;
  if (fenceBlocks(cellAt(player.x, player.z), ci, y)) return false;
  const pts = [[nx, nz]];
  if (axis === 'x') { const lx = nx + sign * r; pts.push([lx, nz], [lx, nz - 0.7 * r], [lx, nz + 0.7 * r]); }
  else { const lz = nz + sign * r; pts.push([nx, lz], [nx - 0.7 * r, lz], [nx + 0.7 * r, lz]); }
  for (let k = 0; k < pts.length; k++) {
    const [sx, sz] = pts[k];
    const si = cellAt(sx, sz);
    if (si < 0) return false;
    const [rx, rz] = k ? [nx, nz] : [player.x, player.z];
    if (hopBlocked(rx, rz, sx, sz, y, step)) return false;
    if (fenceBlocks(ci, si, y)) return false;
  }
  return true;
}
