import { state } from './state.js';
import { TRIANGLE, makeEnemy } from '../core/enemies.js';
import { enemySpots } from './enemyspawn.js';
import { stepEnemies } from './enemyai.js';
import { removeEnemyViews } from '../render/enemies.js';

export let triangles = [];
export function resetTriangles() {
  removeEnemyViews(triangles);
  triangles = enemySpots(state.map, TRIANGLE).filter(spot => !state.run.defeated.has(spot.id)).map((spot, i) => makeEnemy(spot, TRIANGLE, i));
}
export function updateTriangles(dt) {
  stepEnemies(triangles, dt);
  triangles = triangles.filter(e => e.mode !== 'dead' || e.deadT < TRIANGLE.corpseTime || (removeEnemyViews([e]), false));
}
export function detachTriangles() { const list = triangles; triangles = []; return list; }
