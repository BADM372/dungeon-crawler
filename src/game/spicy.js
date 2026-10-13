import { state } from './state.js';
import { SPICY, makeEnemy } from '../core/enemies.js';
import { enemySpots } from './enemyspawn.js';
import { stepEnemies } from './enemyai.js';
import { removeEnemyViews } from '../render/enemies.js';

export let spicies = [];
export function resetSpicies() {
  removeEnemyViews(spicies);
  spicies = enemySpots(state.map, SPICY).filter(spot => !state.run.defeated.has(spot.id)).map((spot, i) => makeEnemy(spot, spot.kind ?? SPICY, i));
}
export function updateSpicies(dt) {
  stepEnemies(spicies, dt);
  spicies = spicies.filter(e => e.mode !== 'dead' || e.deadT < e.profile.corpseTime || (removeEnemyViews([e]), false));
}
export function detachSpicies() { const list = spicies; spicies = []; return list; }
