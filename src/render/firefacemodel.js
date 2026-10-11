import { loadEnemyModel } from './enemymodel.js';
export const fireFaceModel = loadEnemyModel('assets/fireface.glb', 1, {
  walk: 'FireFloat', attack: 'FireAttack', death: 'FireDeath', props: ['FireFaceBall'],
});
