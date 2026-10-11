import { loadEnemyModel } from './enemymodel.js';
export const snakeModel = loadEnemyModel('assets/snake.glb', 1.2, {
  walk: 'SnakeWalk', attack: 'SnakeAttack', death: 'SnakeDeath',
});
