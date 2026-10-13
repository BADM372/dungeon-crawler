import { state } from './state.js';
import { SHRAPS, makeEnemy } from '../core/enemies.js';
import { enemySpots } from './enemyspawn.js';
import { stepEnemies } from './enemyai.js';
import { removeEnemyViews } from '../render/enemies.js';

export let shraps = [];
export function resetShraps() {
  removeEnemyViews(shraps);
  shraps = enemySpots(state.map, SHRAPS).filter(spot => !state.run.defeated.has(spot.id)).map((spot, i) => makeEnemy(spot, spot.kind ?? SHRAPS, i));
}
export function updateShraps(dt) {
  stepEnemies(shraps, dt);
  shraps = shraps.filter(e => e.mode !== 'dead' || e.deadT < e.profile.corpseTime || (removeEnemyViews([e]), false));
}
export function detachShraps() { const list = shraps; shraps = []; return list; }
