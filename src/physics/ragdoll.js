// Verlet ragdoll: 16 particles at the skeleton's joints held together by distance constraints,
// colliding with the world through the same queries as the character controller.
import { N, GRAV } from '../core/constants.js';
import { clamp } from '../core/util.js';
import { groundAt, insideSolid } from './collide.js';

// particle order (see render/ragdollpose.js)
// 0 pelvis 1 chest 2 neck 3 head top | 4 shoulder 5 elbow 6 hand (L) | 7 8 9 (R)
// 10 hip 11 knee 12 foot (L) | 13 14 15 (R)
const BONES = [[0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [7, 8], [8, 9], [10, 11], [11, 12], [13, 14], [14, 15]];
const RIGID = [[0, 1, 10, 13], [1, 2, 4, 7]];   // pelvis block and chest block keep their shape
// keep-apart constraints [a, b, fraction of rest length]: stop joints folding flat
const APART = [[0, 2, 0.8], [1, 3, 0.85], [4, 6, 0.45], [7, 9, 0.45], [10, 12, 0.55], [13, 15, 0.55], [12, 15, 0.25], [6, 9, 0.2]];
const RAD = 0.06, SUB = 1 / 120, ITERS = 6;

export class Ragdoll {
  constructor(points, vel) {
    this.p = points.map(q => q.slice());
    this.o = points.map(q => [q[0] - vel[0] * SUB, q[1] - vel[1] * SUB, q[2] - vel[2] * SUB]);
    const dist = (a, b) => Math.hypot(...[0, 1, 2].map(k => this.p[a][k] - this.p[b][k]));
    const pairs = BONES.slice();
    for (const g of RIGID) for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) pairs.push([g[i], g[j]]);
    this.sticks = pairs.map(([a, b]) => [a, b, dist(a, b)]);
    this.apart = APART.map(([a, b, f]) => [a, b, dist(a, b) * f]);
    this.acc = 0; this.t = 0; this.calm = 0; this.done = false;
  }

  // a push on one particle (e.g. a blow to the head)
  kick(i, v) { for (let k = 0; k < 3; k++) this.o[i][k] -= v[k] * SUB; }

  step(dt) {
    this.acc += Math.min(dt, 0.05);
    while (this.acc >= SUB) { this.acc -= SUB; this.substep(); }
    this.t += dt;
    // settled once nothing moves for a while (or after a timeout)
    let vmax = 0;
    for (let i = 0; i < this.p.length; i++) vmax = Math.max(vmax, Math.hypot(...[0, 1, 2].map(k => this.p[i][k] - this.o[i][k])) / SUB);
    this.calm = vmax < 0.35 ? this.calm + dt : 0;
    if ((this.calm > 0.25 && this.t > 0.6) || this.t > 4) this.done = true;
  }

  substep() {
    const g = GRAV * SUB * SUB;
    for (let i = 0; i < this.p.length; i++) {
      const q = this.p[i], o = this.o[i];
      const vx = (q[0] - o[0]) * 0.998, vy = (q[1] - o[1]) * 0.998, vz = (q[2] - o[2]) * 0.998;
      o[0] = q[0]; o[1] = q[1]; o[2] = q[2];
      q[0] += vx; q[1] += vy - g; q[2] += vz;
    }
    for (let it = 0; it < ITERS; it++) {
      for (const [a, b, len] of this.sticks) this.solve(a, b, len, false);
      for (const [a, b, len] of this.apart) this.solve(a, b, len, true);
      for (let i = 0; i < this.p.length; i++) this.collide(i);
    }
  }

  solve(a, b, len, apartOnly) {
    const A = this.p[a], B = this.p[b];
    const dx = B[0] - A[0], dy = B[1] - A[1], dz = B[2] - A[2];
    const d = Math.hypot(dx, dy, dz) || 1e-6;
    if (apartOnly && d >= len) return;
    const k = (d - len) / d * 0.5;
    A[0] += dx * k; A[1] += dy * k; A[2] += dz * k;
    B[0] -= dx * k; B[1] -= dy * k; B[2] -= dz * k;
  }

  collide(i) {
    const q = this.p[i], o = this.o[i];
    q[0] = clamp(q[0], 0.05, N - 0.05); q[2] = clamp(q[2], 0.05, N - 0.05);
    // ran into a wall sideways: undo the horizontal part of the move
    if (insideSolid(q[0], q[2], q[1]) && !insideSolid(o[0], o[2], q[1])) { q[0] = o[0]; q[2] = o[2]; }
    const floor = groundAt(q[0], q[2], Math.max(q[1], o[1]) + 0.05, 0).h + RAD;
    if (q[1] < floor) {
      q[1] = floor;
      // ground friction: bleed off the sliding velocity
      o[0] = q[0] - (q[0] - o[0]) * 0.55; o[2] = q[2] - (q[2] - o[2]) * 0.55;
      o[1] = Math.max(o[1], q[1] - 0.001);
    }
  }
}
