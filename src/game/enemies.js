// Every species participates in combat, collision, loading and portal travel.
import { spiders, resetSpiders, updateSpiders, detachSpiders } from './spiders.js';
import { stunders, resetStunders, updateStunders, detachStunders } from './stunders.js';
import { snakes, resetSnakes, updateSnakes, detachSnakes } from './snakes.js';
import { octonauts, resetOctonauts, updateOctonauts, detachOctonauts } from './octonauts.js';
import { fireFaces, resetFireFaces, updateFireFaces, detachFireFaces } from './firefaces.js';
import { triangles, resetTriangles, updateTriangles, detachTriangles } from './triangles.js';
import { fireCats, resetFireCats, updateFireCats, detachFireCats } from './firecats.js';
import { contactEnemies, resetEnemyCombat, updateBurning } from './enemycombat.js';
import { updateProjectiles, drawAllProjectiles, clearProjectiles } from './projectiles.js';
import { hitWithSword } from './sword.js';
import { animateEnemies } from '../render/enemies.js';
import { player, state, setStatus } from './state.js';
import { awardKill } from '../core/progression.js';
import { dropLoot } from './loot.js';

// coming into a cube (or back after a death), enemies hold their attacks this long, or until
// you land a hit: a bad spawn spot is not an instant beating
export const ENTRY_GRACE = 1.2;

export const allEnemies = () => [...spiders, ...stunders, ...snakes, ...octonauts, ...fireFaces, ...triangles, ...fireCats];
export function resetEnemies() {
  resetEnemyCombat(); clearProjectiles();
  state.enemyGrace = ENTRY_GRACE;
  resetSpiders(); resetStunders(); resetSnakes(); resetOctonauts(); resetFireFaces(); resetTriangles(); resetFireCats();
}
export function updateEnemies(dt) {
  if (state.inventoryOpen || state.transitioning) return;
  state.enemyGrace = Math.max(0, state.enemyGrace - dt);
  const list = allEnemies();
  hitWithSword(list); // a connecting sword strike can interrupt an enemy's wind-up
  let xp = 0, levels = 0, killed = 0;
  for (const e of list) {
    const reward = awardKill(player, state.run, e);
    if (reward) { xp += reward.xp; levels += reward.levels; killed++; dropLoot(e, reward.coins); }
  }
  if (killed) setStatus(`Defeated ${killed} enem${killed === 1 ? 'y' : 'ies'} · +${xp} XP${levels ? ` · Level ${player.level}!` : ''}`);
  updateSpiders(dt); updateStunders(dt); updateSnakes(dt); updateOctonauts(dt);
  updateFireFaces(dt); updateTriangles(dt); updateFireCats(dt);
  updateProjectiles(dt); updateBurning(dt);
  contactEnemies(allEnemies(), dt);
}
export function drawEnemies(dt, off) { animateEnemies(allEnemies(), dt, off); drawAllProjectiles(dt, off); }
// projectiles in flight do not travel along
export function detachEnemies() {
  clearProjectiles();
  return [...detachSpiders(), ...detachStunders(), ...detachSnakes(), ...detachOctonauts(),
    ...detachFireFaces(), ...detachTriangles(), ...detachFireCats()];
}
