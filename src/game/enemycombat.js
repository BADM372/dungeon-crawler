// Bites, rams, slaps, kicks and thrown blows, burning, and solid bodies. Contact never
// damages an enemy.
import { player, state, setStatus } from './state.js';
import { takeDamage } from '../core/progression.js';
import { flash } from './hud.js';
import { playerHurtFx, burnHurtFx } from './juice.js';
import { knockDown } from './ragdoll.js';
import { canMove } from '../physics/canmove.js';
import { walkable, stepEnemy } from '../physics/enemynav.js';
import { attackOf, blowOf } from '../core/enemies.js';
import { ignite, burnStep, burntOut } from '../core/projectiles.js';

export const resetEnemyCombat = () => { player.burning = null; };
export const playerFloor = height => player.grounded && !player.swimming && walkable(player.support, height) ? player.support : null;
// a blow (core/enemies.js blowOf) from (fx, fz) that shoves the player along (nx, nz)
export function hitPlayer(blow, fx, fz, nx, nz) {
  const p = player;
  p.vx = nx * blow.knock; p.vz = nz * blow.knock;
  playerHurtFx(Math.min(blow.damage, p.hp), fx, fz);
  if (blow.burn && p.hp > blow.damage) p.burning = ignite(blow.burn, blow.reason);
  // only a heavy blow or a deadly one knocks you over; the rest are a short flinch and a shove
  if (blow.knockDown || p.hp <= blow.damage) {
    knockDown({ damage: blow.damage, hop: blow.hop, reason: blow.reason }); return;
  }
  takeDamage(p, blow.damage, state.time); flash(); setStatus(blow.reason);
  p.vx *= 0.6; p.vz *= 0.6; p.stun = 0.15;
}
export function strikePlayer(e) {
  const p = player, a = attackOf(e), dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz);
  if (p.ragdoll || p.hp <= 0 || d > a.hitReach || Math.abs(p.y - e.y) > 0.65) return;
  if (d > 0.01 && Math.cos(Math.atan2(dx, dz) - e.yaw) < a.arc) return;
  hitPlayer(blowOf(e.profile, a), e.x, e.z, d ? dx / d : Math.sin(e.yaw), d ? dz / d : Math.cos(e.yaw));
}
// On fire: the burn ticks away (also while knocked down); water puts it out. A lethal
// tick knocks the player down for good.
export function updateBurning(dt) {
  const p = player, b = p.burning;
  if (!b) return;
  if (p.hp <= 0 || p.swimming || p.fluidDeath) { p.burning = null; return; }
  const damage = burnStep(b, dt);
  if (damage > 0) {
    burnHurtFx(Math.min(damage, p.hp));
    if (!p.ragdoll && p.hp <= damage) knockDown({ damage, reason: b.reason });
    else takeDamage(p, Math.min(damage, p.hp), state.time);
  }
  if (burntOut(b)) p.burning = null;
}
function pushPlayer(dx, dz) {
  const p = player;
  if (dx && canMove(p.x + dx, p.z, 'x', Math.sign(dx))) p.x += dx;
  if (dz && canMove(p.x, p.z + dz, 'z', Math.sign(dz))) p.z += dz;
}
export function contactEnemies(list, dt) {
  const p = player;
  for (const e of list) {
    if (e.mode === 'dead' || p.ragdoll) continue;
    const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz), body = p.r + e.profile.radius;
    if (d >= body || p.y >= e.y + e.profile.bodyHeight || p.y + p.h <= e.y) continue;
    const nx = d ? dx / d : 1, nz = d ? dz / d : 0, depth = body - d;
    const share = e.profile.mass / (e.profile.mass + 0.45);
    pushPlayer(nx * depth * share, nz * depth * share);
    stepEnemy(e, -nx * depth * (1 - share), -nz * depth * (1 - share));
  }
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    if (a.mode === 'dead' || b.mode === 'dead' || Math.abs(a.y - b.y) > 0.6) continue;
    const dx = a.x - b.x, dz = a.z - b.z, d = Math.hypot(dx, dz), r = a.profile.radius + b.profile.radius;
    if (d >= r) continue;
    const nx = d ? dx / d : 1, nz = d ? dz / d : 0, push = Math.min(r - d, dt * 1.5);
    const share = b.profile.mass / (a.profile.mass + b.profile.mass);
    stepEnemy(a, nx * push * share, nz * push * share);
    stepEnemy(b, -nx * push * (1 - share), -nz * push * (1 - share));
  }
}
