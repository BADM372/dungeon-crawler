// Level flow: loading cubes, spawning, taking damage, moving to the next depth.
import { hash32 } from '../core/util.js';
import { generate } from '../gen/index.js';
import { buildWorld, disposeWorld } from '../render/world.js';
import { groundAt } from '../physics/collide.js';
import { player, state, setStatus } from './state.js';
import { showStats, flash, fadeOut, fadeIn } from './hud.js';
import { resetCut } from './cut.js';

const seedFor = d => d === 1 ? state.baseSeed : hash32(state.baseSeed + d * 2654435761) % 1000000000;

export function spawnAt(x, y, z) {
  Object.assign(player, { x, y, z, vy: 0, vx: 0, vz: 0, visY: y, grounded: true, swimming: false, support: null, ragdoll: null, stun: 0 });
  player.safe = { x, y, z };
  const gr = groundAt(x, z, y + 0.05, 0);
  player.support = gr.s;
  if (gr.s) player.layer = gr.s.kind ? gr.s.run.layer : gr.s.layer;
  resetCut();
}

export function spawnEntry() {
  const e = state.map.entry;
  spawnAt(e.x + 0.5, e.y, e.z + 0.5);
  player.hp = 100;
}

export function hurt(amount, reason) {
  player.hp -= amount;
  flash();
  if (player.hp <= 0) { setStatus('You died (' + reason + ') - back to the entry'); spawnEntry(); }
  else { setStatus(reason); spawnAt(player.safe.x, player.safe.y, player.safe.z); }
}

export function loadCube(seed = seedFor(state.depth)) {
  state.map = generate(seed);
  disposeWorld(state.world);
  state.world = buildWorld(state.map, state.showPath);
  spawnEntry();
  showStats(state.map, state.depth, seed);
  fadeIn();
}

// fresh = new random base seed at depth 1, otherwise one level deeper
export function nextCube(fresh = false) {
  if (state.transitioning) return;
  state.transitioning = true;
  fadeOut();
  setTimeout(() => {
    if (fresh) { state.baseSeed = (Math.random() * 1e9) >>> 0; state.depth = 1; } else state.depth++;
    loadCube();
    setStatus(fresh ? 'New cube' : `Depth ${state.depth}`);
    state.transitioning = false;
  }, 380);
}
