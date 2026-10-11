import { loadEnemyModel, cloneEnemy } from './enemymodel.js';
export const SPIDER_SCALE = 0.4;
export const spiderModel = loadEnemyModel('../blender/spider.glb', SPIDER_SCALE, {
  walk: 'SpiderWalk', attack: 'SpiderAttack', death: 'SpiderDeath',
});
export const cloneSpider = () => cloneEnemy(spiderModel);
