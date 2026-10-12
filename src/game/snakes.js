import { state } from './state.js';
import { SNAKE, makeEnemy } from '../core/enemies.js';
import { enemySpots } from './enemyspawn.js';
import { stepEnemies } from './enemyai.js';
import { removeEnemyViews } from '../render/enemies.js';

export let snakes = [];
export function resetSnakes() {
  removeEnemyViews(snakes);
  snakes = enemySpots(state.map, SNAKE).filter(spot => !state.run.defeated.has(spot.id)).map((spot, i) => makeEnemy(spot, spot.kind ?? SNAKE, i));
}
export function updateSnakes(dt) {
  stepEnemies(snakes, dt);
  snakes = snakes.filter(e => e.mode !== 'dead' || e.deadT < e.profile.corpseTime || (removeEnemyViews([e]), false));
}
export function detachSnakes() { const list = snakes; snakes = []; return list; }
