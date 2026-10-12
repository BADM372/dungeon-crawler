// Which song plays and how intense it is (audio/music.js plays it): the overworld march above
// ground, the caves theme below; level 1 while an enemy is near, 2 while one is after you.
import { player, state } from './state.js';
import { allEnemies } from './enemies.js';
import { themeAt } from '../themes/depth.js';
import { playSong, setIntensity } from '../audio/music.js';

const NEAR = 8;      // cells: an enemy this close raises the music to level 1
const CALM = 4;      // seconds without a reason before the music steps down one level
let level = 0, calm = 0;

export function updateMusic(dt) {
  if (!state.map) return;
  playSong(themeAt(state.map.depth).cave ? 'caves' : 'overworld');
  let want = 0;
  if (player.hp > 0) for (const e of allEnemies()) {
    if (e.mode === 'dead' || e.hp <= 0) continue;
    if (e.mode === 'chase' || e.mode === 'attack') { want = 2; break; }
    if (Math.hypot(e.x - player.x, e.z - player.z) < NEAR && Math.abs(e.y - player.y) < 3) want = 1;
  }
  if (want >= level) { level = want; calm = 0; }
  else if ((calm += dt) > CALM) { level--; calm = 0; }
  setIntensity(level);
}
