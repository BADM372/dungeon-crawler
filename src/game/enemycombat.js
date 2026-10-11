// Bites / head-down rams and solid bodies. Contact never damages an enemy.
import { player, state, setStatus } from './state.js';
import { takeDamage } from '../core/progression.js';
import { flash } from './hud.js';
import { knockDown } from './ragdoll.js';
import { canMove } from '../physics/canmove.js';
import { walkable, stepEnemy } from '../physics/enemynav.js';

let bites = 0;
export const resetEnemyCombat = () => { bites = 0; };
export const playerFloor = height => player.grounded && !player.swimming && walkable(player.support, height) ? player.support : null;
export function strikePlayer(e) {
  const p = player, cfg = e.profile, dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz);
  if (p.ragdoll || p.hp <= 0 || d > cfg.hitReach || Math.abs(p.y - e.y) > 0.65) return;
  if (d > 0.01 && Math.cos(Math.atan2(dx, dz) - e.yaw) < 0.5) return;
  p.vx = (d ? dx / d : Math.sin(e.yaw)) * cfg.knock;
  p.vz = (d ? dz / d : Math.cos(e.yaw)) * cfg.knock;
  const reason = e.type === 'stunder' ? 'Rammed by a Stunder!' : 'Bitten by a spider!';
  if (e.type === 'stunder' || ++bites % 3 === 0 || p.hp <= cfg.damage) {
    knockDown({ damage: cfg.damage, hop: e.type === 'stunder' ? 4 : 3.5, reason }); return;
  }
  takeDamage(p, cfg.damage, state.time); flash(); setStatus(reason);
  p.vy = 3; p.grounded = false; p.stun = 0.35;
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
