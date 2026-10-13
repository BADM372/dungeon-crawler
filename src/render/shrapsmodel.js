import { loadEnemyModel } from './enemymodel.js';
export const shrapsModel = loadEnemyModel('assets/shraps.glb', 1, {
  walk: 'ShrapsWalk', attack: { pinch: 'ShrapsPinch', throw: 'ShrapsThrow' }, death: 'ShrapsDeath', props: ['ShrapsIceBall'],
});
