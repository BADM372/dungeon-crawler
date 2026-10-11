import { loadEnemyModel } from './enemymodel.js';
export const octonautModel = loadEnemyModel('assets/octonaut.glb', 1, {
  walk: 'OctoWalk', attack: { slap: 'OctoSlap', spin: 'OctoSpin' }, death: 'OctoDeath',
});
