import { state } from './state.js';
import { STUNDER, makeEnemy } from '../core/enemies.js';
import { enemySpots } from './enemyspawn.js';
import { stepEnemies } from './enemyai.js';
import { removeEnemyViews } from '../render/enemies.js';

export let stunders = [];
export function resetStunders() {
  removeEnemyViews(stunders);
  stunders = enemySpots(state.map, STUNDER).filter(spot => !state.run.defeated.has(spot.id)).map((spot, i) => makeEnemy(spot, spot.kind ?? STUNDER, i));
}
export function updateStunders(dt) {
  stepEnemies(stunders, dt);
  stunders = stunders.filter(e => e.mode !== 'dead' || e.deadT < e.profile.corpseTime || (removeEnemyViews([e]), false));
}
export function detachStunders() { const list = stunders; stunders = []; return list; }
