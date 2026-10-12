import { state } from './state.js';
import { OCTONAUT, makeEnemy } from '../core/enemies.js';
import { enemySpots } from './enemyspawn.js';
import { stepEnemies } from './enemyai.js';
import { removeEnemyViews } from '../render/enemies.js';

export let octonauts = [];
export function resetOctonauts() {
  removeEnemyViews(octonauts);
  octonauts = enemySpots(state.map, OCTONAUT).filter(spot => !state.run.defeated.has(spot.id)).map((spot, i) => makeEnemy(spot, spot.kind ?? OCTONAUT, i));
}
export function updateOctonauts(dt) {
  stepEnemies(octonauts, dt);
  octonauts = octonauts.filter(e => e.mode !== 'dead' || e.deadT < e.profile.corpseTime || (removeEnemyViews([e]), false));
}
export function detachOctonauts() { const list = octonauts; octonauts = []; return list; }
