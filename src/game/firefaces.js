import { state } from './state.js';
import { FIREFACE, makeEnemy } from '../core/enemies.js';
import { enemySpots } from './enemyspawn.js';
import { stepEnemies } from './enemyai.js';
import { removeEnemyViews } from '../render/enemies.js';

export let fireFaces = [];
export function resetFireFaces() {
  removeEnemyViews(fireFaces);
  fireFaces = enemySpots(state.map, FIREFACE).filter(spot => !state.run.defeated.has(spot.id)).map((spot, i) => makeEnemy(spot, FIREFACE, i));
}
export function updateFireFaces(dt) {
  stepEnemies(fireFaces, dt);
  fireFaces = fireFaces.filter(e => e.mode !== 'dead' || e.deadT < FIREFACE.corpseTime || (removeEnemyViews([e]), false));
}
export function detachFireFaces() { const list = fireFaces; fireFaces = []; return list; }
