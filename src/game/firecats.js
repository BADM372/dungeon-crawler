import { state } from './state.js';
import { FIRECAT, makeEnemy } from '../core/enemies.js';
import { enemySpots } from './enemyspawn.js';
import { stepEnemies } from './enemyai.js';
import { removeEnemyViews } from '../render/enemies.js';

export let fireCats = [];
export function resetFireCats() {
  removeEnemyViews(fireCats);
  fireCats = enemySpots(state.map, FIRECAT).filter(spot => !state.run.defeated.has(spot.id)).map((spot, i) => makeEnemy(spot, spot.kind ?? FIRECAT, i));
}
export function updateFireCats(dt) {
  stepEnemies(fireCats, dt);
  fireCats = fireCats.filter(e => e.mode !== 'dead' || e.deadT < e.profile.corpseTime || (removeEnemyViews([e]), false));
}
export function detachFireCats() { const list = fireCats; fireCats = []; return list; }
