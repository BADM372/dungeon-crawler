import { loadEnemyModel } from './enemymodel.js';
export const fireCatModel = loadEnemyModel('assets/firecat.glb', 1, {
  walk: 'CatWalk', fast: 'CatRun', attack: 'CatPounce', death: 'CatDeath',
});
