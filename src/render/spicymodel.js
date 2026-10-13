import { loadEnemyModel } from './enemymodel.js';
export const spicyModel = loadEnemyModel('assets/spicy.glb', 1, { walk: 'SpicyRoll', attack: 'SpicyLaser', death: 'SpicyDeath' });
