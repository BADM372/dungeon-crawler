// Level flow: the world of cubes, entering a cube, travelling through portals, spawning and
// taking damage.
import { DIRS } from '../core/constants.js';
import { isFaceOpen, openedSides, discoveredFaces } from '../core/boundaries.js';
import { showNeighbors, clearNeighbors, clearNeighborCache } from '../render/neighbors.js';
import { discoveredCubes } from '../core/viewdistance.js';
import { WorldClient } from '../world/client.js';
import { step } from '../world/coords.js';
import { buildWorld, disposeWorld } from '../render/world.js';
import { groundAt } from '../physics/collide.js';
import { respawnPoint } from '../physics/respawn.js';
import { player, state, setStatus } from './state.js';
import { showStats, flash, fadeOut, fadeIn, whenReady } from './hud.js';
import { resetCut } from './cut.js';
import { resetEnemies } from './enemies.js';
import { cancelSword } from './sword.js';
import { drawMinimap } from './minimap.js';
import { whenPropsReady } from '../render/props.js';
import { townAssetsReady } from '../render/townassets.js';
import { createPlayerStats, createRun, takeDamage } from '../core/progression.js';
import { restoreDefeated, gateLocked, guardianLockMessage } from '../core/guardians.js';
import { syncEquippedWeapon } from './equipment.js';
import { clearInput } from './inputstate.js';
import { lootMark, forgetLoot } from './loot.js';

export function spawnAt(x, y, z) {
  cancelSword(true);
  Object.assign(player, { x, y, z, vy: 0, vx: 0, vz: 0, visY: y, grounded: true, swimming: false, support: null, ragdoll: null, getUp: null, fluidDeath: 0, stun: 0, climb: null, burning: null });
  player.safe = respawnPoint({ x, y, z });
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
  const y = groundAt(x, z, p.y + 0.3, 0).h;
  return respawnPoint({ x, z, y: Number.isFinite(y) ? y : p.y });
}

// back to where you came into this cube
export function spawnEntry() {
  const a = state.arrival = respawnPoint(state.arrival);
  spawnAt(a.x, a.y, a.z);
  player.hp = player.maxHp;
}

export function hurt(amount, reason) {
  takeDamage(player, amount, state.time);
  flash();
  if (player.hp <= 0) { setStatus('You died (' + reason + ') - back to where you came in'); die(); }
  else { setStatus(reason); recover(); }
}

// The cube as you came in. A death puts it back: the enemies you defeated since return and
// the coins they dropped (and you did not pick up yet) go.
export function beginVisit() {
  state.visit = { key: state.cubeKey, defeated: new Set(state.run.defeated), loot: lootMark() };
}
function restoreVisit(v) {
  if (!v) return;
  restoreDefeated(state.run, v.defeated);
  forgetLoot(v.key, v.loot);
}

// died: back to where you came in, in the cube as it was then (after a fall through cubes:
// the cube the fall started in)
export function die() {
  if (state.fallFrom) { returnFromFall(true); return; }
  restoreVisit(state.visit);
  resetEnemies();
  spawnEntry();
}

// back on your feet at the last safe spot (after a fall through cubes: in the cube the fall
// started in)
export function recover() {
  if (state.fallFrom) { returnFromFall(false); return; }
  const a = respawnPoint(player.safe);
  spawnAt(a.x, a.y, a.z);
}

// For now you only enter a cube through a portal: a fall through the void ends back in the
// cube it started in, at its last safe spot (or its entry, if the landing killed you).
function returnFromFall(dead) {
  const f = state.fallFrom, cubes = state.cubes;
  state.fallFrom = null;
  state.transitioning = true;
  cancelSword(true);
  fadeOut();
  setTimeout(() => whenReady(cubes.get(f.key)).then(c => {
    if (state.cubes !== cubes) return;
    if (dead) restoreVisit(f.visit);
    enterCube(c, null, f);
    if (dead) spawnEntry();
    else { const a = respawnPoint(f.safe); spawnAt(a.x, a.y, a.z); }
    state.transitioning = false;
  }, () => {
    if (state.cubes !== cubes) return;
    state.transitioning = false;
    if (dead) die(); else recover();   // stay in this cube
  }), 380);
}

// discovering a cube opens all side faces towards cubes already discovered
export function discover(c) {
  c.visits++;
  for (const f of discoveredFaces(state.cubes.cubes, c, state.run)) state.openedFaces.add(f);
}

// which portals lead somewhere already explored
export const portalSeen = (k, m) => Object.fromEntries(m.portals.map(p => [p.id, p.kind !== 'spawn' && !!state.cubes.cubes.get(step(k, p.dir))?.visits]));

// enter cube c (a ready cube from the world client), arriving through its portal on face
// `from` (null: the spawn pad). `back`: returning to a cube left by a fall, with the
// entry and visit it had then (see game/fall.js)
export function enterCube(c, from = null, back = null) {
  const k = c.key;
  if (!back) discover(c);
  state.cubeKey = k; state.map = c.map; state.lookDepth = c.map.depth;
  disposeWorld(state.world);
  state.world = buildWorld(c.map, state.showPath, portalSeen(k, c.map), c.geo, openedSides(state.openedFaces, k), gateLocked(c.map, state.run));
  if (back) {
    const { arrival, portalLock, boundaryLock, visit } = back;
    Object.assign(state, { arrival, portalLock, boundaryLock, visit });
  } else {
    const p = c.map.portals.find(q => from === null ? q.kind === 'spawn' : q.dir === from);
    state.arrival = arrivalPoint(p);
    state.portalLock = isFaceOpen(state.openedFaces, k, p.dir) ? 0 : p.id;
    state.boundaryLock = p.kind === 'side' ? p.dir : -1;
    beginVisit();
  }
  resetEnemies();
  const hp = player.hp;
  state.arrival = respawnPoint(state.arrival);
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
  if (neighbors) showNeighbors(visitedNeighbors(state.cubeKey));
  if (gateLocked(state.map, state.run)) setStatus(guardianLockMessage(state.map));
  // get the cubes behind our portals ready in the background
  state.cubes.prefetch(c.map.portals.filter(p => p.kind !== 'spawn').map(p => step(state.cubeKey, p.dir)));
}

// Discovered cubes within the render budget, on the active stratum only.
export function visitedNeighbors(k) {
  if (!state.showNeighbors) return [];
  return discoveredCubes(state.cubes.cubes, k)
    .map(c => ({ ...c, open: openedSides(state.openedFaces, c.key) }));
}

export function updateNeighbors() {
  // Travel owns detached proxy sets; do not build a third set while it runs.
  if (!state.transitioning) showNeighbors(visitedNeighbors(state.cubeKey));
}

// the props library may arrive after the first cube was built: build that cube again
whenPropsReady(() => {
  if (!state.world || state.transitioning) return;
  const c = state.cubes.cubes.get(state.cubeKey);
  disposeWorld(state.world);
  state.world = buildWorld(c.map, state.showPath, portalSeen(state.cubeKey, c.map), c.geo, openedSides(state.openedFaces, state.cubeKey), gateLocked(c.map, state.run));
  // Props add blockers after a late load. Re-select safe, seeded spawn sites.
  cancelSword(); resetEnemies();
});

export function newWorld(seed = (Math.random() * 1e9) >>> 0) {
  clearNeighbors(); clearNeighborCache();
  state.cubes?.dispose();
  state.cubes = new WorldClient(seed, { arche: state.dev && new URLSearchParams(location.search).get('arche') });
  state.openedFaces.clear(); state.boundaryLock = -1; state.fallFrom = null;
  state.transitioning = true;
  cancelSword(true);
  clearInput();
  Object.assign(player, createPlayerStats());
  state.run = createRun(); state.inventoryOpen = false;
  return whenReady(Promise.all([state.cubes.get(state.cubes.start), townAssetsReady, syncEquippedWeapon()]))
    .then(([c]) => { enterCube(c); state.transitioning = false; });
}

export function nextCube() {
  if (state.transitioning) return;
  state.transitioning = true;
  fadeOut();
  setTimeout(() => newWorld().then(() => setStatus('A new world')), 380);
}
export const loadCube = () => newWorld(state.baseSeed);
