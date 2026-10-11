import { loadEnemyModel } from './enemymodel.js';
export const stunderModel = loadEnemyModel('assets/stunder.glb', 1, {
  walk: 'StunderWalk', fast: 'StunderWalkFast', attack: 'StunderAttack', death: 'StunderDeath',
});
