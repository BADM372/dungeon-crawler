// Level flow: the world of cubes, entering a cube, travelling through portals, spawning and
// taking damage.
import { DIRS } from '../core/constants.js';
import { showNeighbors } from '../render/neighbors.js';
import { WorldClient } from '../world/client.js';
import { step } from '../world/coords.js';
import { buildWorld, disposeWorld } from '../render/world.js';
import { groundAt } from '../physics/collide.js';
import { player, state, setStatus } from './state.js';
import { showStats, flash, fadeOut, fadeIn, whenReady } from './hud.js';
import { resetCut } from './cut.js';
import { resetEnemies } from './enemies.js';
import { cancelSword } from './sword.js';
import { drawMinimap } from './minimap.js';
import { whenPropsReady } from '../render/props.js';

export function spawnAt(x, y, z) {
  cancelSword(true);
  Object.assign(player, { x, y, z, vy: 0, vx: 0, vz: 0, visY: y, grounded: true, swimming: false, support: null, ragdoll: null, stun: 0, climb: null });
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

// enter cube c (a ready cube from the world client), arriving through its portal on face
// `from` (null: the spawn pad)
export function enterCube(c, from = null) {
  const k = c.key;
  c.visits++;
  state.cubeKey = k; state.map = c.map; state.lookDepth = c.map.depth;
  disposeWorld(state.world);
  state.world = buildWorld(c.map, state.showPath, portalSeen(k, c.map), c.geo);
  resetEnemies();
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
export function settleIn(neighbors = true) {
  const c = state.cubes.cubes.get(state.cubeKey);
  showStats(c.map, state.cubeKey, state.cubes.seed, c.visits);
  drawMinimap();
  if (neighbors) updateNeighbors();
  // get the cubes behind our portals ready in the background
  state.cubes.prefetch(c.map.portals.filter(p => p.kind !== 'spawn').map(p => step(state.cubeKey, p.dir)));
}

// the visited cubes next to cube k (for the low-detail proxies)
export function visitedNeighbors(k) {
  if (!state.showNeighbors) return [];
  return [0, 1, 2, 3].map(d => ({ c: state.cubes.cubes.get(step(k, d)), dx: DIRS[d][0], dz: DIRS[d][1] }))
    .filter(n => n.c?.visits).map(n => ({ key: n.c.key, geo: n.c.geo, dx: n.dx, dz: n.dz }));
}

export function updateNeighbors() { showNeighbors(visitedNeighbors(state.cubeKey)); }

// the props library may arrive after the first cube was built: build that cube again
whenPropsReady(() => {
  if (!state.world || state.transitioning) return;
  const c = state.cubes.cubes.get(state.cubeKey);
  disposeWorld(state.world);
  state.world = buildWorld(c.map, state.showPath, portalSeen(state.cubeKey, c.map), c.geo);
  // Props add blockers after a late load. Re-select safe, seeded spawn sites.
  cancelSword(); resetEnemies();
});

export function newWorld(seed = (Math.random() * 1e9) >>> 0) {
  state.cubes?.dispose();
  state.cubes = new WorldClient(seed, { arche: state.dev && new URLSearchParams(location.search).get('arche') });
  state.transitioning = true;
  cancelSword(true);
  player.hp = 100;
  return whenReady(state.cubes.get(state.cubes.start)).then(c => { enterCube(c); state.transitioning = false; });
}

export function nextCube() {
  if (state.transitioning) return;
  state.transitioning = true;
  fadeOut();
  setTimeout(() => newWorld().then(() => setStatus('A new world')), 380);
}
export const loadCube = () => newWorld(state.baseSeed);
