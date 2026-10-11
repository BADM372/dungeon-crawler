// Collision queries against floors, structure pieces, pillars and fences.
import { N, LH, STEP, SWIM_STEP } from '../core/constants.js';
import { idx, inb, clamp, edgeKey } from '../core/util.js';
import { floorY, runY, topOf } from '../core/surfaces.js';
import { player, state } from '../game/state.js';

export function cellAt(x, z) {
  const cx = Math.floor(x), cz = Math.floor(z);
  return inb(cx, cz) ? idx(cx, cz) : -1;
}
const pieceBottom = (p, top) => p.kind === 'bridge' ? top - 0.2 : p.base;
const inPillar = (p, fx, fz) => fx >= p.x0 && fx <= p.x1 && fz >= p.z0 && fz <= p.z1;

// highest walkable surface at (x,z) that is not above y+step: { h, s (floor or piece), i (cell) }
export function groundAt(x, z, y, step) {
  const i = cellAt(x, z);
  if (i < 0) return { h: -Infinity, s: null, i };
  const fx = x - Math.floor(x), fz = z - Math.floor(z);
  let h = -Infinity, s = null;
  for (const f of state.map.cols[i]) { const t = floorY(f, fx, fz); if (t <= y + step && t > h) { h = t; s = f; } }
  for (const p of state.map.pieces[i]) {
    if (p.kind === 'pillar') continue;
    const t = runY(p, fx, fz);
    if (t <= y + step && t > h) { h = t; s = p; }
  }
  return { h, s, i };
}

// does something solid occupy the ball's body (between y+step and the top of the ball)?
function blockedAt(x, z, y, step, piecesOnly = false) {
  const i = cellAt(x, z);
  if (i < 0) return true;
  const fx = x - Math.floor(x), fz = z - Math.floor(z), head = y + 2 * player.r;
  if (!piecesOnly) for (const f of state.map.cols[i]) if (floorY(f, fx, fz) > y + step && f.bottom * LH < head) return true;
  for (const p of state.map.pieces[i]) {
    if (p.kind === 'pillar') {
      if (inPillar(p, fx, fz) && p.bottom < head && p.top > y + step) return true;
      continue;
    }
    const t = runY(p, fx, fz), b = pieceBottom(p, t);
    // inside our own cell only structures hanging overhead count (not the one we roll on)
    if (piecesOnly ? b > y + 0.05 && b < head : t > y + step && b < head) return true;
  }
  return false;
}

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
  // our side of the edge: the surface we roll on if it is in that cell, else whatever is there
  const sup = player.support, qi = cellAt(qx, qz);
  const own = sup && sup.c === qi ? topOf(sup, qx - Math.floor(qx), qz - Math.floor(qz)) : groundAt(qx, qz, y + 0.6, 0).h;
  const ref = Math.max(y, own);
  const q2x = clamp(qx, Math.floor(px) + e, Math.floor(px) + 1 - e), q2z = clamp(qz, Math.floor(pz) + e, Math.floor(pz) + 1 - e);
  return blockedAt(q2x, q2z, ref, step);
}

// can the ball's center move to (nx,nz) along one axis? probes the center and three rim points
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

// surface gradient of the solid the ball rests on
export function slopeAt(s, x, z) {
  if (!s) return [0, 0];
  const e = 0.04;
  const fx = clamp(x - Math.floor(x), e, 1 - e), fz = clamp(z - Math.floor(z), e, 1 - e);
  const gx = (topOf(s, fx + e, fz) - topOf(s, fx - e, fz)) / (2 * e);
  const gz = (topOf(s, fx, fz + e) - topOf(s, fx, fz - e)) / (2 * e);
  return [gx || 0, gz || 0];
}
