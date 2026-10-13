// Every species participates in combat, collision, loading and portal travel.
import { spiders, resetSpiders, updateSpiders, detachSpiders } from './spiders.js';
import { stunders, resetStunders, updateStunders, detachStunders } from './stunders.js';
import { snakes, resetSnakes, updateSnakes, detachSnakes } from './snakes.js';
import { octonauts, resetOctonauts, updateOctonauts, detachOctonauts } from './octonauts.js';
import { fireFaces, resetFireFaces, updateFireFaces, detachFireFaces } from './firefaces.js';
import { triangles, resetTriangles, updateTriangles, detachTriangles } from './triangles.js';
import { fireCats, resetFireCats, updateFireCats, detachFireCats } from './firecats.js';
import { contactEnemies, resetEnemyCombat, updateBurning } from './enemycombat.js';
import { stepEnemies } from './enemyai.js';
import { removeEnemyViews } from '../render/enemies.js';
import { updateProjectiles, drawAllProjectiles, clearProjectiles } from './projectiles.js';
import { hitWithSword } from './sword.js';
import { animateEnemies } from '../render/enemies.js';
import { player, state, setStatus } from './state.js';
import { awardKill } from '../core/progression.js';
import { dropLoot } from './loot.js';
import { coordinateDefence } from './defence.js';
import { setGuardianGate } from '../render/world.js';
import { drawMinimap } from './minimap.js';
import { refreshOpenFaces } from './flow.js';
import { sfx } from '../audio/sfx.js';

let defenceThink = 0;

// coming into a cube (or back after a death), enemies hold their attacks this long, or until
// you land a hit: a bad spawn spot is not an instant beating
// kids-docs: enemies.html#fair (see kids-docs/README.md)
export const ENTRY_GRACE = 1.2;

// enemies spawned with the dev tools (game/devspawn.js), of any species; gone when the cube resets
let spawned = [];
export function addEnemies(list) { spawned.push(...list); }

export const allEnemies = () => [...spiders, ...stunders, ...snakes, ...octonauts, ...fireFaces, ...triangles, ...fireCats, ...spawned];
export function resetEnemies() {
  resetEnemyCombat(); clearProjectiles();
  removeEnemyViews(spawned); spawned = [];
  state.enemyGrace = ENTRY_GRACE;
  resetSpiders(); resetStunders(); resetSnakes(); resetOctonauts(); resetFireFaces(); resetTriangles(); resetFireCats();
  defenceThink = 0;
  coordinateDefence(state.map, state.run, allEnemies(), player);
}
export function updateEnemies(dt) {
  if (state.inventoryOpen || state.transitioning) return;
  state.enemyGrace = Math.max(0, state.enemyGrace - dt);
  const list = allEnemies();
  hitWithSword(list); // a connecting sword strike can interrupt an enemy's wind-up
  let xp = 0, levels = 0, killed = 0, unlocked = false;
  for (const e of list) {
    const reward = awardKill(player, state.run, e);
    if (reward) {
      xp += reward.xp; levels += reward.levels; killed++; dropLoot(e, reward.coins);
      if (e.guardianGate) unlocked = true;
    }
  }
  if (killed) setStatus(`${unlocked ? 'Guardian defeated · Gate unlocked!' : `Defeated ${killed} enem${killed === 1 ? 'y' : 'ies'}`} · +${xp} XP${levels ? ` · Level ${player.level}!` : ''}`);
  if (unlocked) { setGuardianGate(state.world, false); refreshOpenFaces(); drawMinimap(); sfx('unlock'); }
  if (levels) sfx('levelUp');
  if ((defenceThink -= dt) <= 0 || unlocked) {
    defenceThink = .25;
    coordinateDefence(state.map, state.run, list, player);
  }
  updateSpiders(dt); updateStunders(dt); updateSnakes(dt); updateOctonauts(dt);
  updateFireFaces(dt); updateTriangles(dt); updateFireCats(dt);
  stepEnemies(spawned, dt);
  spawned = spawned.filter(e => e.mode !== 'dead' || e.deadT < e.profile.corpseTime || (removeEnemyViews([e]), false));
  updateProjectiles(dt); updateBurning(dt);
  contactEnemies(allEnemies(), dt);
}
export function drawEnemies(dt, off) { animateEnemies(allEnemies(), dt, off); drawAllProjectiles(dt, off); }
function detachSpawned() { const list = spawned; spawned = []; return list; }
// projectiles in flight do not travel along
export function detachEnemies() {
  clearProjectiles();
  return [...detachSpiders(), ...detachStunders(), ...detachSnakes(), ...detachOctonauts(),
    ...detachFireFaces(), ...detachTriangles(), ...detachFireCats(), ...detachSpawned()];
}
