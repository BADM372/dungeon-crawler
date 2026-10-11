// Rolling-ball movement: input force, downhill gravity, drag, collisions and falling.
import { STEP, SWIM_STEP, GRAV, ROLL, DRAG, SNAP, ACID } from '../core/constants.js';
import { clamp } from '../core/util.js';
import { player } from '../game/state.js';
import { canMove, groundAt, slopeAt } from './collide.js';

// (dx, dz): desired direction in world space, length <= 1. Returns the ground info.
export function movePlayer(dt, dx, dz) {
  const sp = player.fluid === ACID ? 1.4 : player.swimming ? 1.8 : 3.6;
  const drag = player.swimming ? 6 : player.grounded ? DRAG : 1.2;
  const accK = player.swimming ? 6 : DRAG;
  const ctl = player.grounded ? 1 : 0.15;
  let ax = dx * sp * accK * ctl, az = dz * sp * accK * ctl;
  if (player.grounded && !player.swimming) {
    const [gx, gz] = slopeAt(player.support, player.x, player.z);
    const k = player.support?.kind === 'stair' ? 0.25 : 1, den = 1 + gx * gx + gz * gz;
    ax -= GRAV * ROLL * gx / den * k;
    az -= GRAV * ROLL * gz / den * k;
  }
  player.vx += ax * dt; player.vz += az * dt;
  const damp = Math.exp(-drag * dt);
  player.vx *= damp; player.vz *= damp;

  // axis-separated moves so the ball slides along walls
  const mx = player.vx * dt, mz = player.vz * dt;
  if (Math.abs(mx) > 1e-6) { if (canMove(player.x + mx, player.z, 'x', Math.sign(mx))) player.x += mx; else player.vx *= -0.15; }
  if (Math.abs(mz) > 1e-6) { if (canMove(player.x, player.z + mz, 'z', Math.sign(mz))) player.z += mz; else player.vz *= -0.15; }

  // vertical: stick to slopes while grounded, otherwise fall
  const gr = groundAt(player.x, player.z, player.y, player.swimming ? SWIM_STEP : STEP);
  if (player.swimming) {
    if (gr.h > player.y) player.y = gr.h;   // climbing out onto a bank
    player.vy = 0;
  } else if (player.grounded && player.vy <= 0 && gr.h >= player.y - SNAP) {
    player.y = gr.h; player.vy = 0;
  } else {
    player.vy -= GRAV * dt;
    player.y += player.vy * dt;
    if (player.y <= gr.h) {
      // hard landings kill most of the horizontal momentum
      if (player.vy < -6) { const k = clamp(1 + (player.vy + 6) * 0.08, 0.25, 1); player.vx *= k; player.vz *= k; }
      player.y = gr.h; player.vy = 0; player.grounded = true;
    } else player.grounded = false;
  }
  player.support = gr.s;
  return gr;
}

// which layer the ball is on (for fading): the floor's layer, or the nearer end of a structure
export function updateLayer(gr) {
  if (!player.grounded || !gr.s) return;
  const s = gr.s;
  if (!s.kind) { player.layer = s.layer; return; }
  const r = s.run, up = r.y1 > r.y0;
  player.layer = (player.y > r.ymid ? (up ? r.to : r.from) : (up ? r.from : r.to)).layer;
}
