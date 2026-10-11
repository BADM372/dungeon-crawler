// Both species participate in combat, collision, loading and portal travel.
import { spiders, resetSpiders, updateSpiders, detachSpiders } from './spiders.js';
import { stunders, resetStunders, updateStunders, detachStunders } from './stunders.js';
import { contactEnemies, resetEnemyCombat } from './enemycombat.js';
import { hitWithSword } from './sword.js';
import { animateEnemies } from '../render/enemies.js';
import { player, state, setStatus } from './state.js';
import { awardKill } from '../core/progression.js';
import { formatCoins } from '../core/inventory.js';

export const allEnemies = () => [...spiders, ...stunders];
export function resetEnemies() { resetEnemyCombat(); resetSpiders(); resetStunders(); }
export function updateEnemies(dt) {
  if (state.inventoryOpen || state.transitioning) return;
  const list = allEnemies();
  hitWithSword(list); // a connecting sword strike can interrupt an enemy's wind-up
  let xp = 0, coins = 0, levels = 0, killed = 0;
  for (const e of list) {
    const reward = awardKill(player, state.run, e);
    if (reward) { xp += reward.xp; coins += reward.coins; levels += reward.levels; killed++; }
  }
  if (killed) setStatus(`Defeated ${killed} enem${killed === 1 ? 'y' : 'ies'} · +${xp} XP · +${formatCoins(coins)}${levels ? ` · Level ${player.level}!` : ''}`);
  updateSpiders(dt); updateStunders(dt);
  contactEnemies(allEnemies(), dt);
}
export const drawEnemies = (dt, off) => animateEnemies(allEnemies(), dt, off);
export const detachEnemies = () => [...detachSpiders(), ...detachStunders()];
