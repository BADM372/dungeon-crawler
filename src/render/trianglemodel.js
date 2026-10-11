import { loadEnemyModel } from './enemymodel.js';
export const triangleModel = loadEnemyModel('assets/triangle.glb', 1, {
  walk: 'TriFloat', attack: 'TriPunch', death: 'TriDeath', props: ['TrianglePunch'],
});
