// Rope bridges (spaced slats hanging between two posts, rope hand lines) and iron bridges
// (a flat girder deck with railings and bracing).
import { WOOD, WOOD2, BEAM, ROPE, IRON, IRON2 } from './palette.js';
import { runFrame, slab } from './runframe.js';
import { pillarBox } from './stairs.js';

export function buildRopeBridge(r, L) {
  const W = L.wood, F = runFrame(r), k = r.k, slats = Math.round(k / 0.26);
  for (let i = 0; i < slats; i++) {
    const sc = (i + 0.5) * k / slats, sa = sc - 0.09, sb = sc + 0.09, w = 0.4 + (i % 3) * 0.03;
    slab(W, F, sa, sb, -w, w, F.Y(sa) - 0.06, F.Y(sa), F.Y(sb) - 0.06, F.Y(sb), i & 1 ? WOOD : WOOD2, BEAM);
  }
  // a post at each end, rope hand lines and the ropes under the slats
  for (const side of [-0.45, 0.45]) {
    for (const s of [0, k]) {
      const [px, py, pz] = F.P(s, side, F.Y(s));
      W.box(px - 0.05, py - 0.15, pz - 0.05, px + 0.05, py + 0.7, pz + 0.05, BEAM, BEAM);
    }
    let last = null;
    for (let i = 0; i <= k * 4; i++) {
      const s = i / 4, [px, py, pz] = F.P(s, side, F.Y(s));
      if (last) for (const ry of [-0.04, 0.6]) W.beam([last[0], last[1] + ry, last[2]], [px, py + ry, pz], 0.03, 0.03, ROPE);
      last = [px, py, pz];
    }
  }
}

export function buildIronBridge(r, L) {
  const W = L.wood, F = runFrame(r), k = r.k, segs = k * 4;
  for (let i = 0; i < segs; i++) {
    const s0 = i * k / segs, s1 = (i + 1) * k / segs, ya = F.Y(s0), yb = F.Y(s1);
    slab(W, F, s0, s1, -0.48, 0.48, ya - 0.08, ya, yb - 0.08, yb, i & 1 ? IRON : IRON2, IRON2);   // deck plates
    for (const [w0, w1] of [[-0.48, -0.4], [0.4, 0.48]]) slab(W, F, s0, s1, w0, w1, ya - 0.32, ya - 0.08, yb - 0.32, yb - 0.08, IRON2, IRON2);   // girders
  }
  for (const side of [-0.45, 0.45]) {
    let last = null;
    for (let s = 0; s <= k + 1e-6; s += 0.5) {
      const [px, py, pz] = F.P(s, side, F.Y(s));
      W.box(px - 0.03, py, pz - 0.03, px + 0.03, py + 0.55, pz + 0.03, IRON, IRON);
      if (last) {
        W.beam([last[0], last[1] + 0.55, last[2]], [px, py + 0.55, pz], 0.04, 0.04, IRON);
        W.beam([last[0], last[1] + 0.05, last[2]], [px, py + 0.5, pz], 0.025, 0.025, IRON2);   // bracing
      }
      last = [px, py, pz];
    }
  }
  for (const q of r.pillars || []) pillarBox(W, q, IRON2);
}
