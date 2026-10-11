// Every species participates in combat, collision, loading and portal travel.
import { spiders, resetSpiders, updateSpiders, detachSpiders } from './spiders.js';
import { stunders, resetStunders, updateStunders, detachStunders } from './stunders.js';
import { snakes, resetSnakes, updateSnakes, detachSnakes } from './snakes.js';
import { octonauts, resetOctonauts, updateOctonauts, detachOctonauts } from './octonauts.js';
import { contactEnemies, resetEnemyCombat } from './enemycombat.js';
import { hitWithSword } from './sword.js';
import { animateEnemies } from '../render/enemies.js';
import { player, state, setStatus } from './state.js';
import { awardKill } from '../core/progression.js';
import { dropLoot } from './loot.js';

export const allEnemies = () => [...spiders, ...stunders, ...snakes, ...octonauts];
export function resetEnemies() { resetEnemyCombat(); resetSpiders(); resetStunders(); resetSnakes(); resetOctonauts(); }
export function updateEnemies(dt) {
  if (state.inventoryOpen || state.transitioning) return;
  const list = allEnemies();
  hitWithSword(list); // a connecting sword strike can interrupt an enemy's wind-up
  let xp = 0, levels = 0, killed = 0;
  for (const e of list) {
    const reward = awardKill(player, state.run, e);
    if (reward) { xp += reward.xp; levels += reward.levels; killed++; dropLoot(e, reward.coins); }
  }
  if (killed) setStatus(`Defeated ${killed} enem${killed === 1 ? 'y' : 'ies'} · +${xp} XP${levels ? ` · Level ${player.level}!` : ''}`);
  updateSpiders(dt); updateStunders(dt); updateSnakes(dt); updateOctonauts(dt);
  contactEnemies(allEnemies(), dt);
}
export const drawEnemies = (dt, off) => animateEnemies(allEnemies(), dt, off);
export const detachEnemies = () => [...detachSpiders(), ...detachStunders(), ...detachSnakes(), ...detachOctonauts()];
