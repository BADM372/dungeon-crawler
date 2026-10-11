// Spider population; behaviour / sword combat are shared with Stunder.
import { state } from './state.js';
import { SPIDER, makeEnemy } from '../core/enemies.js';
import { spiderSpots } from './spiderspawn.js';
import { stepEnemies } from './enemyai.js';
import { animateSpiders, removeSpiderViews } from '../render/spiders.js';

export const SPIDER_R = SPIDER.radius;
export let spiders = [];
export function resetSpiders() {
  removeSpiderViews(spiders);
  spiders = spiderSpots(state.map).map((spot, i) => makeEnemy(spot, SPIDER, i));
}
export function updateSpiders(dt) {
  stepEnemies(spiders, dt);
  spiders = spiders.filter(e => e.mode !== 'dead' || e.deadT < SPIDER.corpseTime || (removeSpiderViews([e]), false));
}
export const drawSpiders = (dt, off) => animateSpiders(spiders, dt, off);
export function detachSpiders() { const list = spiders; spiders = []; return list; }
