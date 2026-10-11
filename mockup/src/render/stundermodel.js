import { loadEnemyModel } from './enemymodel.js';
export const stunderModel = loadEnemyModel('../blender/stunder.glb', 1, {
  walk: 'StunderWalk', fast: 'StunderWalkFast', attack: 'StunderAttack', death: 'StunderDeath',
});
