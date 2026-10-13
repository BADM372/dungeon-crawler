// Shared floor-bound behaviour. Species tuning controls health, speed, clearance,
// wind-up / strike / recovery, and what a hit does; a species with several attacks
// picks one each time it strikes. A ranged species throws from `reach` away when it has a
// clear shot; a pouncing one is carried forward through its leap.
import { player, state } from './state.js';
import { playerFloor, strikePlayer } from './enemycombat.js';
import { stepEnemy, findPath, around, clearLine } from '../physics/enemynav.js';
import { attackOf, pickAttack, lungeDistance, lungeAt } from '../core/enemies.js';
import { launchProjectile } from './projectiles.js';
import { tryHordeAttack } from './hordes.js';

// learn: space.html#angles (see learn/README.md)
const turn = (e, yaw, dt, rate = 8) => { e.yaw += Math.atan2(Math.sin(yaw - e.yaw), Math.cos(yaw - e.yaw)) * Math.min(1, dt * rate); };
function steer(e, x, z, speed, dt) {
  const dx = x - e.x, dz = z - e.z, d = Math.hypot(dx, dz);
  if (d < 0.05) { e.speed = 0; return true; }
  turn(e, Math.atan2(dx, dz), dt);
  const forward = Math.max(0, (Math.sin(e.yaw) * dx + Math.cos(e.yaw) * dz) / d);
  const step = Math.min(d, speed * forward * dt), x0 = e.x, z0 = e.z;
  stepEnemy(e, Math.sin(e.yaw) * step, Math.cos(e.yaw) * step);
  e.speed = Math.hypot(e.x - x0, e.z - z0) / dt;
  return false;
}
function follow(e, speed, dt, end) {
  if (!e.path) { e.speed = 0; return true; }
  const i = e.path.indexOf(e.f);
  if (i > 0) e.path = e.path.slice(i);
  const next = e.path[1];
  if (next) { steer(e, next.x + 0.5, next.z + 0.5, speed, dt); return false; }
  return steer(e, end ? end[0] : e.f.x + 0.5, end ? end[1] : e.f.z + 0.5, speed, dt);
}
// learn: enemies.html#decide-code #state-machine, paths.html#bfs (see learn/README.md)
function decide(e) {
  const p = player, cfg = e.profile, target = playerFloor(cfg.height);
  const alive = !p.ragdoll && p.hp > 0 && !state.transitioning, dist = Math.hypot(p.x - e.x, p.z - e.z);
  if (e.defence) {
    if (e.mode === 'attack') return;   // never cancel a committed wind-up
    const engage = alive && target && e.defence.engage;
    e.path = findPath(e.f, engage ? target : e.defence.post, 40, cfg.height);
    e.mode = engage && e.path ? 'chase' : 'defend'; e.lost = 0;
    return;
  }
  if (e.horde) {
    if (e.mode === 'attack') return;
    const active = e.horde.group.active && e.horde.wakeIn <= 0 && alive && target;
    if (active) {
      // Approach from different neighbouring floors, then close for the actual bite.
      const flank = dist > 2.5 ? around(target, 1, cfg.height).filter(f => f !== target) : [];
      const goal = flank.length ? flank[e.hordeSlot % flank.length] : target;
      e.path = findPath(e.f, goal, 32, cfg.height);
      e.mode = 'chase'; e.lost = 0;
    } else if (e.mode === 'chase') {
      e.mode = 'home'; e.path = findPath(e.f, e.home, 40, cfg.height) || [e.f];
    }
    return;
  }
  if (e.mode !== 'chase' && e.mode !== 'attack') {
    if (!alive || !target || dist > cfg.aggro || Math.abs(p.y - e.y) > 1) return;
    if (!clearLine(e.x, e.y + 0.4, e.z, p.x, p.y + 0.6, p.z)) return;
    const path = findPath(e.f, target, 10, cfg.height);
    if (path) { e.path = path; e.mode = 'chase'; e.lost = 0; }
    return;
  }
  if (e.mode === 'attack') return;
  e.path = alive && target ? findPath(e.f, target, 16, cfg.height) : null;
  e.lost = !e.path || dist > cfg.giveUp ? e.lost + 0.2 : 0;
  if (e.lost > 1.4) { e.mode = 'home'; e.path = findPath(e.f, e.home, 40, cfg.height) || [e.f]; }
}
// a thrown attack needs a free line from its muzzle height to the player's chest
const clearShot = e => clearLine(e.x, e.y + e.profile.projectile.muzzle[1], e.z, player.x, player.y + player.h * 0.55, player.z);
// The leap of a pounce: once it takes off it commits to a distance (along its heading, up to
// lunge.stop short of the player) and covers it between lunge.from and lunge.to.
function leap(e, lunge, t0, dx, dz) {
  const fx = Math.sin(e.yaw), fz = Math.cos(e.yaw);
  if (t0 < lunge.from && e.t >= lunge.from) e.leap = lungeDistance(lunge, Math.max(0, fx * dx + fz * dz));
  const step = (lungeAt(lunge, e.t) - lungeAt(lunge, t0)) * e.leap;
  if (step > 0) stepEnemy(e, fx * step, fz * step);
}
// learn: enemies.html#state-machine, paths.html#bfs (see learn/README.md)
function act(e, dt) {
  const p = player, cfg = e.profile, dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz);
  if (e.mode === 'attack') {
    const a = attackOf(e), t0 = e.t;
    e.t += dt; e.speed = 0;
    if (e.t < a.trackUntil) turn(e, Math.atan2(dx, dz), dt, 6);
    if (a.lunge) leap(e, a.lunge, t0, dx, dz);
    if (!e.bit && e.t >= a.hitAt) { e.bit = true; if (a.projectile) launchProjectile(e, a); else strikePlayer(e); }
    if (e.t >= a.attackTime) { e.mode = 'chase'; e.cool = cfg.cooldown; }
    return;
  }
  if (e.mode === 'chase') {
    if (!e.path) { e.speed = 0; return; }
    const facing = Math.cos(Math.atan2(dx, dz) - e.yaw) > 0.7;
    if (d < cfg.reach && Math.abs(p.y - e.y) < (cfg.projectile ? 1.5 : 0.5) && !p.ragdoll && (!cfg.projectile || clearShot(e))) {
      e.speed = 0; turn(e, Math.atan2(dx, dz), dt);
      if (e.cool <= 0 && facing && state.enemyGrace <= 0 && tryHordeAttack(e)) { e.mode = 'attack'; e.t = 0; e.bit = false; e.attacks++; e.attack = pickAttack(cfg); e.leap = 0; }
      return;
    }
    follow(e, cfg.chase, dt, [p.x, p.z]); return;
  }
  if (e.mode === 'defend') {
    if (follow(e, e.guardian ? cfg.homeSpeed : cfg.chase, dt)) turn(e, Math.atan2(dx, dz), dt, 2);
    return;
  }
  if (e.mode === 'walk' || e.mode === 'home') {
    if (follow(e, e.mode === 'home' ? cfg.homeSpeed : cfg.wander, dt)) {
      e.mode = 'idle'; e.t = 2 + Math.random() * 4; e.speed = 0;
    }
    return;
  }
  e.speed = 0;
  if (d < 5 && !p.ragdoll) turn(e, Math.atan2(dx, dz), dt, 1.5);
  if ((e.t -= dt) > 0) return;
  const spots = around(e.home, 2, cfg.height);
  e.path = findPath(e.f, spots[Math.floor(Math.random() * spots.length)], 6, cfg.height);
  e.mode = e.path ? 'walk' : 'idle'; e.t = 2;
}
// a blow's push, sliding along the floor graph and dying away quickly
function knockback(e, dt) {
  if (!e.kbx && !e.kbz) return;
  stepEnemy(e, e.kbx * dt, e.kbz * dt);
  const k = Math.exp(-dt * 10);
  e.kbx *= k; e.kbz *= k;
  if (Math.hypot(e.kbx, e.kbz) < 0.05) e.kbx = e.kbz = 0;
}
// learn: enemies.html#decide-code #fair (see learn/README.md)
export function stepEnemies(list, dt) {
  for (const e of list) {
    knockback(e, dt);
    if (e.mode === 'dead') { e.deadT += dt; continue; }
    e.cool = Math.max(0, e.cool - dt); e.hurtT = Math.max(0, e.hurtT - dt); e.poised = Math.max(0, (e.poised || 0) - dt);
    if (e.stun > 0) { e.stun -= dt; e.speed = 0; continue; }
    if (state.devPassive) { e.speed = 0; e.path = null; if (e.mode !== 'idle') { e.mode = 'idle'; e.t = 1; } continue; }
    if ((e.think -= dt) <= 0) { e.think = 0.2; decide(e); }
    act(e, dt);
  }
}
