// The player's shots in flight in the current cube (core/shots.js): arrows, bolts and spells.
// They hit the enemies they meet, stop at walls and props or at their range; a spell bursts
// where it ends. Travel and level resets clear them.
import { player, state, setStatus } from './state.js';
import { insideSolid } from '../physics/collide.js';
import { clearLine } from '../physics/enemynav.js';
import { weaponHit } from '../core/combat.js';
import { launchShot, stepShot, burstTargets, aimPoint, BURST_SHARE, MUZZLES } from '../core/shots.js';
import { hitEnemy, rolls } from './sword.js';
import { shotFx } from './juice.js';
import { drawShots, removeShotViews } from '../render/shots.js';

export let shots = [];
const solid = (x, y, z) => insideSolid(x, z, y);

// can p's ranged weapon of `stats` hit enemy e from where p stands: is the line from where the
// shot leaves to the middle of its body clear of the level?
export function lineOfFire(p, e, stats) {
  const a = aimPoint(e);
  return clearLine(p.x, p.y + MUZZLES[stats.kind][1], p.z, a.x, a.y, a.z);
}
// the attack with stats `stats` lets its shot go at `target`, from p turned to `yaw`
export function fireShot(p, stats, target, yaw) {
  const shot = launchShot(p, stats, target, yaw);
  shots.push(shot);
  shotFx(shot, 'launch');
  return shot;
}

function strike(shot, e, share = 1) {
  const before = e.hp, hit = weaponHit(player, shot.stats, e, rolls.crit(), share);
  if (!hit) return;
  // knocked back along the flight (a burst: away from where it went off)
  const [dx, dz] = share < 1 ? [e.x - shot.x, e.z - shot.z] : [shot.vx, shot.vz];
  hitEnemy(e, hit, before, dx, dz, shot.stats.knockback ?? 1);
  if (e.hp) setStatus(`Hit Lv ${e.level} ${e.profile.label} (${e.hp}/${e.profile.hp})`);
}

export function updateShots(dt, enemies) {
  if (state.inventoryOpen || state.transitioning || !shots.length) return;
  shots = shots.filter(shot => {
    const { hits, end } = stepShot(shot, dt, enemies, solid);
    for (const e of hits) strike(shot, e);
    if (!end) return true;
    if (shot.stats.burst) for (const e of burstTargets(shot, enemies)) strike(shot, e, BURST_SHARE);
    shotFx(shot, end);
    removeShotViews([shot]);
    return false;
  });
}
export const drawAllShots = (dt, off) => drawShots(shots, dt, off);
export function clearShots() { removeShotViews(shots); shots = []; }
