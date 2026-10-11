// Both species participate in combat, collision, loading and portal travel.
import { spiders, resetSpiders, updateSpiders, detachSpiders } from './spiders.js';
import { stunders, resetStunders, updateStunders, detachStunders } from './stunders.js';
import { contactEnemies, resetEnemyCombat } from './enemycombat.js';
import { hitWithSword } from './sword.js';
import { animateEnemies } from '../render/enemies.js';

export const allEnemies = () => [...spiders, ...stunders];
export function resetEnemies() { resetEnemyCombat(); resetSpiders(); resetStunders(); }
export function updateEnemies(dt) {
  hitWithSword(allEnemies()); // a connecting sword strike can interrupt an enemy's wind-up
  updateSpiders(dt); updateStunders(dt);
  contactEnemies(allEnemies(), dt);
}
export const drawEnemies = (dt, off) => animateEnemies(allEnemies(), dt, off);
export const detachEnemies = () => [...detachSpiders(), ...detachStunders()];
