// Level flow: the world of cubes, entering a cube, travelling through portals, spawning and
// taking damage.
import { DIRS } from '../core/constants.js';
import { showNeighbors, clearNeighbors } from '../render/neighbors.js';
import { World } from '../world/world.js';
import { step } from '../world/coords.js';
import { buildWorld, disposeWorld } from '../render/world.js';
import { groundAt } from '../physics/collide.js';
import { player, state, setStatus } from './state.js';
import { showStats, flash, fadeOut, fadeIn } from './hud.js';
import { resetCut } from './cut.js';
import { resetSpiders } from './spiders.js';
import { drawMinimap } from './minimap.js';

export function spawnAt(x, y, z) {
  Object.assign(player, { x, y, z, vy: 0, vx: 0, vz: 0, visY: y, grounded: true, swimming: false, support: null, ragdoll: null, stun: 0 });
  player.safe = { x, y, z };
  const gr = groundAt(x, z, y + 0.05, 0);
  player.support = gr.s;
  if (gr.s) player.layer = gr.s.kind ? gr.s.run.layer : gr.s.layer;
  resetCut();
}

// where you stand after coming through portal p: a step inside side portals, next to the
// centre of wells and rings (so you do not fall straight back through)
export function arrivalPoint(p) {
  const [x, z] = p.kind === 'side' ? [p.x + 0.5 - DIRS[p.dir][0], p.z + 0.5 - DIRS[p.dir][1]]
    : p.kind === 'spawn' ? [p.x + 0.5, p.z + 0.5] : [p.x + 1.5, p.z + 0.5];
  return { x, z, y: groundAt(x, z, p.y + 0.3, 0).h };
}

// back to where you came into this cube
export function spawnEntry() {
  const a = state.arrival;
  spawnAt(a.x, a.y, a.z);
  player.hp = 100;
}

export function hurt(amount, reason) {
  player.hp -= amount;
  flash();
  if (player.hp <= 0) { setStatus('You died (' + reason + ') - back to where you came in'); spawnEntry(); }
  else { setStatus(reason); spawnAt(player.safe.x, player.safe.y, player.safe.z); }
}

// which portals lead somewhere already explored
export const portalSeen = (k, m) => Object.fromEntries(m.portals.map(p => [p.id, p.kind !== 'spawn' && !!state.cubes.cubes.get(step(k, p.dir))?.visits]));

// enter cube k, arriving through its portal on face `from` (null: the spawn pad)
export function enterCube(k, from = null) {
  const c = state.cubes.cube(k);
  c.visits++;
  state.cubeKey = k; state.map = c.map;
  disposeWorld(state.world);
  state.world = buildWorld(c.map, state.showPath, portalSeen(k, c.map));
  resetSpiders();
  const p = c.map.portals.find(q => from === null ? q.kind === 'spawn' : q.dir === from);
  state.arrival = arrivalPoint(p);
  state.portalLock = p.id;   // released once you step off the portal you came through
  const hp = player.hp;
  spawnAt(state.arrival.x, state.arrival.y, state.arrival.z);
  player.hp = hp;
  settleIn();
  fadeIn();
}

// HUD, minimap and neighbours for the cube we are in now
export function settleIn() {
  const c = state.cubes.cubes.get(state.cubeKey);
  showStats(c.map, state.cubeKey, state.cubes.seed, c.visits);
  drawMinimap();
  updateNeighbors();
}

// low-detail copies of the neighbouring cubes you have already been to
export function updateNeighbors() {
  if (!state.showNeighbors) { clearNeighbors(); return; }
  const near = [0, 1, 2, 3].map(d => ({ c: state.cubes.cubes.get(step(state.cubeKey, d)), dx: DIRS[d][0], dz: DIRS[d][1] }));
  showNeighbors(near.filter(n => n.c?.visits).map(n => ({ map: n.c.map, dx: n.dx, dz: n.dz })));
}

export function newWorld(seed = (Math.random() * 1e9) >>> 0) {
  state.cubes = new World(seed);
  player.hp = 100;
  enterCube(state.cubes.start);
}

function transition(fn) {
  if (state.transitioning) return;
  state.transitioning = true;
  fadeOut();
  setTimeout(() => { fn(); state.transitioning = false; }, 380);
}

export const nextCube = () => transition(() => { newWorld(); setStatus('A new world'); });
export const loadCube = () => newWorld(state.baseSeed);
