// Live projectiles in the current cube: thrown by enemies at their attack's hit frame, they
// fly until they hit the player, run into the level or out of range (core/projectiles.js).
// Travel and level resets clear them.
import { player } from './state.js';
import { insideSolid } from '../physics/collide.js';
import { launch, stepProjectile } from '../core/projectiles.js';
import { blowOf } from '../core/enemies.js';
import { hitPlayer } from './enemycombat.js';
import { projectileFx } from './juice.js';
import { drawProjectiles, removeProjectileViews } from '../render/projectiles.js';

export let projectiles = [];
const solid = (x, y, z) => insideSolid(x, z, y);

export function launchProjectile(e, a) {
  const p = player, pr = launch(e, a.projectile, { x: p.x, y: p.y + p.h * 0.55, z: p.z });
  pr.blow = blowOf(e.profile, a);
  projectiles.push(pr);
  projectileFx(pr, 'launch');
  return pr;
}
export function updateProjectiles(dt) {
  const target = player.ragdoll || player.hp <= 0 ? null : player;   // flies through a fallen player
  projectiles = projectiles.filter(pr => {
    const end = stepProjectile(pr, dt, target, solid);
    if (!end) return true;
    if (end === 'hit') {
      const l = Math.hypot(pr.vx, pr.vz) || 1;
      hitPlayer(pr.blow, pr.x - pr.vx / l, pr.z - pr.vz / l, pr.vx / l, pr.vz / l);
    }
    projectileFx(pr, end);
    removeProjectileViews([pr]);
    return false;
  });
}
export const drawAllProjectiles = (dt, off) => drawProjectiles(projectiles, dt, off);
export function clearProjectiles() { removeProjectileViews(projectiles); projectiles = []; }
