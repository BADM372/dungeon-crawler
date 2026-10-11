// Spider behaviour: sit around, wander near home, notice the player close by, chase, lunge
// and bite; give up and walk home when the player gets away.
import { player, state } from './state.js';
import { spiderSpots } from './spiderspawn.js';
import { playerFloor, bite, contact } from './spidercombat.js';
import { stepSpider, findPath, around, clearLine } from '../physics/spidernav.js';
import { animateSpiders, removeSpiderViews } from '../render/spiders.js';

export const SPIDER_R = 0.3;
const AGGRO = 3, GIVE_UP = 6, CHASE = 2.6, WANDER = 0.6, HOME = 1.2;
const REACH = 0.85, BITE_AT = 0.42, ATTACK_LEN = 1.07, COOLDOWN = 1.2;

export let spiders = [];

export function resetSpiders() {
  removeSpiderViews(spiders);
  spiders = spiderSpots(state.map).map((p, i) => ({
    ...p, home: p.f, mode: 'idle', t: 1 + i * 0.7, think: i * 0.05, speed: 0,
    path: null, lost: 0, cool: 0, attacks: 0, bit: false, deadT: 0, phase: (i * 0.37) % 1,
  }));
}

const turn = (s, yaw, k) => { s.yaw += Math.atan2(Math.sin(yaw - s.yaw), Math.cos(yaw - s.yaw)) * k; };

// turn towards (tx, tz) and walk forwards; the body turns first, then moves
function steer(s, tx, tz, speed, dt) {
  const dx = tx - s.x, dz = tz - s.z, d = Math.hypot(dx, dz);
  if (d < 0.05) { s.speed = 0; return true; }
  turn(s, Math.atan2(dx, dz), Math.min(1, dt * 8));
  const fwd = Math.max(0, (Math.sin(s.yaw) * dx + Math.cos(s.yaw) * dz) / d);
  const step = Math.min(d, speed * fwd * dt);
  const x0 = s.x, z0 = s.z;
  stepSpider(s, Math.sin(s.yaw) * step, Math.cos(s.yaw) * step, SPIDER_R);
  s.speed = Math.hypot(s.x - x0, s.z - z0) / dt;
  return false;
}

// along s.path; returns true at the end
function follow(s, speed, dt, end) {
  const i = s.path.indexOf(s.f);
  if (i > 0) s.path = s.path.slice(i);
  const next = s.path[1];
  if (next) { steer(s, next.x + 0.5, next.z + 0.5, speed, dt); return false; }
  return steer(s, end ? end[0] : s.f.x + 0.5, end ? end[1] : s.f.z + 0.5, speed, dt);
}

// periodic decisions: notice the player, keep the chase path fresh, give up
function decide(s) {
  const p = player, target = playerFloor(), alive = !p.ragdoll && !state.transitioning;
  const dist = Math.hypot(p.x - s.x, p.z - s.z);
  if (s.mode !== 'chase' && s.mode !== 'attack') {
    if (!alive || !target || dist > AGGRO || Math.abs(p.y - s.y) > 1) return;
    if (!clearLine(s.x, s.y + 0.3, s.z, p.x, p.y + 0.6, p.z)) return;
    s.path = findPath(s.f, target, 8);
    if (s.path) { s.mode = 'chase'; s.lost = 0; }
    return;
  }
  if (s.mode === 'attack') return;
  s.path = alive && target ? findPath(s.f, target, 14) : null;
  s.lost = !s.path || dist > GIVE_UP ? s.lost + 0.2 : 0;
  if (s.lost > 1.4) { s.mode = 'home'; s.path = findPath(s.f, s.home, 40) || [s.f]; }
}

function act(s, dt) {
  const p = player, dx = p.x - s.x, dz = p.z - s.z, dist = Math.hypot(dx, dz);
  if (s.mode === 'attack') {
    s.t += dt; s.speed = 0;
    if (s.t < BITE_AT) turn(s, Math.atan2(dx, dz), Math.min(1, dt * 6));
    if (!s.bit && s.t >= BITE_AT) { s.bit = true; bite(s, REACH + 0.3); }
    if (s.t >= ATTACK_LEN) { s.mode = 'chase'; s.cool = COOLDOWN; }
    return;
  }
  if (s.mode === 'chase') {
    if (!s.path) { s.speed = 0; return; }
    const facing = Math.cos(Math.atan2(dx, dz) - s.yaw) > 0.7;
    if (dist < REACH && Math.abs(p.y - s.y) < 0.5 && !p.ragdoll) {
      s.speed = 0;
      turn(s, Math.atan2(dx, dz), Math.min(1, dt * 8));
      if (s.cool <= 0 && facing) { s.mode = 'attack'; s.t = 0; s.bit = false; s.attacks++; }
      return;
    }
    follow(s, CHASE, dt, [p.x, p.z]);
    return;
  }
  if (s.mode === 'walk' || s.mode === 'home') {
    if (follow(s, s.mode === 'home' ? HOME : WANDER, dt)) { s.mode = 'idle'; s.t = 2 + Math.random() * 4; s.speed = 0; }
    return;
  }
  // idle: keep an eye on the player when near, now and then wander off a little
  s.speed = 0;
  if (dist < 5 && !p.ragdoll) turn(s, Math.atan2(dx, dz), Math.min(1, dt * 1.5));
  if ((s.t -= dt) > 0) return;
  const spots = around(s.home, 2);
  s.path = findPath(s.f, spots[Math.floor(Math.random() * spots.length)], 6);
  s.mode = s.path ? 'walk' : 'idle'; s.t = 2;
}

export function updateSpiders(dt) {
  for (const s of spiders) {
    if (s.mode === 'dead') { s.deadT += dt; continue; }
    s.cool -= dt;
    if ((s.think -= dt) <= 0) { s.think = 0.2; decide(s); }
    act(s, dt);
  }
  contact(spiders, dt);
  spiders = spiders.filter(s => s.mode !== 'dead' || s.deadT < 1.5 || (removeSpiderViews([s]), false));
}

export const drawSpiders = dt => animateSpiders(spiders, dt);
