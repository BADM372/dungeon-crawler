// Character controller: walk / run / swim, jumping, gravity, ceilings and slopes.
import { STEP, SWIM_STEP, GRAV, SNAP, ACID, WALK_SPEED, RUN_SPEED, SWIM_SPEED, JUMP_V } from '../core/constants.js';
import { player } from '../game/state.js';
import { groundAt, ceilingAt, slopeAt } from './collide.js';
import { canMove } from './canmove.js';

function horizontal(dt, dx, dz, run) {
  const p = player;
  const speed = p.swimming ? (p.fluid === ACID ? 0.6 : SWIM_SPEED) : run ? RUN_SPEED : WALK_SPEED;
  let tx = dx * speed, tz = dz * speed;
  if (p.grounded && !p.swimming && p.support) {
    const [gx, gz] = slopeAt(p.support, p.x, p.z), g = Math.hypot(gx, gz);
    // walking uphill is slower
    const up = (tx * gx + tz * gz) / speed;
    if (up > 0) { tx /= 1 + 0.35 * up; tz /= 1 + 0.35 * up; }
    // too steep to stand on (stairs excepted): slide down
    if (g > 3 && p.support.kind !== 'stair') { const s = 2.5 * (g - 3) + 0.5; tx -= gx / g * s; tz -= gz / g * s; }
  }
  // grounded characters accelerate fast, in the air there is only a little control
  const k = Math.min(1, (p.swimming ? 5 : p.grounded ? 14 : 2.5) * dt);
  p.vx += (tx - p.vx) * k; p.vz += (tz - p.vz) * k;

  // axis-separated moves so the body slides along walls
  const mx = p.vx * dt, mz = p.vz * dt;
  if (Math.abs(mx) > 1e-6) { if (canMove(p.x + mx, p.z, 'x', Math.sign(mx))) p.x += mx; else p.vx = 0; }
  if (Math.abs(mz) > 1e-6) { if (canMove(p.x, p.z + mz, 'z', Math.sign(mz))) p.z += mz; else p.vz = 0; }
}

const LEAP = 3.4;   // horizontal speed of a jump while moving

// jump with a little coyote time (just walked off a ledge) and a short input buffer
function jumping(dt, jump) {
  const p = player;
  p.coyote = p.grounded && !p.swimming ? 0.12 : p.coyote - dt;
  p.jumpBuf = jump ? 0.15 : p.jumpBuf - dt;
  if (p.jumpBuf <= 0 || !(p.coyote > 0 || p.swimming)) return;
  p.vy = p.swimming ? 4.8 : JUMP_V;
  // jumping while moving is a leap: enough speed to clear a one-cell gap
  const s = Math.hypot(p.vx, p.vz);
  if (!p.swimming && s > 0.8 && s < LEAP) { p.vx *= LEAP / s; p.vz *= LEAP / s; }
  p.grounded = p.swimming = false;
  p.coyote = p.jumpBuf = 0;
  p.jumpCount++;
}

// returns the ground info plus `landed` (impact speed of a landing this step, else 0)
export function movePlayer(dt, dx, dz, run, jump) {
  const p = player;
  if (p.stun > 0) { p.stun -= dt; dx = dz = 0; jump = false; }
  horizontal(dt, dx, dz, run);
  jumping(dt, jump);

  const gr = groundAt(p.x, p.z, p.y, p.swimming ? SWIM_STEP : STEP);
  gr.landed = 0;
  if (p.swimming) {
    if (gr.h > p.y) p.y = gr.h;   // climbing out onto a bank
    p.vy = 0;
  } else if (p.grounded && p.vy <= 0 && gr.h >= p.y - SNAP) {
    p.y = gr.h; p.vy = 0;
  } else {
    p.vy -= GRAV * dt;
    let ny = p.y + p.vy * dt;
    if (p.vy > 0) {   // bump the head
      const c = ceilingAt(p.x, p.z, p.y + 0.1);
      if (ny + p.h > c) { ny = Math.max(p.y, c - p.h); p.vy = 0; }
    }
    if (ny <= gr.h) {
      gr.landed = -p.vy;
      p.landImpact = gr.landed; p.landCount++;
      p.y = gr.h; p.vy = 0; p.grounded = true;
    } else { p.y = ny; p.grounded = false; }
  }
  p.airTime = p.grounded || p.swimming ? 0 : p.airTime + dt;
  p.support = gr.s;
  return gr;
}

// which layer the character is on (for fading): the floor's layer, or the nearer end of a structure
export function updateLayer(gr) {
  if (!player.grounded || !gr.s) return;
  const s = gr.s;
  if (!s.kind) { player.layer = s.layer; return; }
  const r = s.run, up = r.y1 > r.y0;
  player.layer = (player.y > r.ymid ? (up ? r.to : r.from) : (up ? r.from : r.to)).layer;
}
