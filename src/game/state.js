// Mutable game state shared between modules.
import { CHAR_R, CHAR_H } from '../core/constants.js';
import { swordState } from '../core/combat.js';
import { DEFAULT_ZOOM } from '../core/zoom.js';
import { createPlayerStats, createRun } from '../core/progression.js';

export const player = {
  x: 0, z: 0, y: 0, vx: 0, vy: 0, vz: 0, visY: 0,
  r: CHAR_R, h: CHAR_H, layer: 0, yaw: 0,
  ...createPlayerStats(),
  sword: swordState(),
  grounded: true, swimming: false, fluid: 0, fluidDeath: 0, support: null,
  airTime: 0, coyote: 0, jumpBuf: 0, stun: 0,
  burning: null,   // on fire (core/projectiles.js ignite)
  // event counters the animator watches
  jumpCount: 0, landCount: 0, landImpact: 0,
  ragdoll: null, getUp: null,   // getting up after a ragdoll (game/ragdoll.js)
  ragdollThen: null, climb: null, climbV: 0,
  safe: { x: 0, y: 0, z: 0 }, safeTimer: 0,
  autoDir: null,   // overrides the movement keys (used by test bots)
};

const params = new URLSearchParams(location.search);

export const state = {
  map: null, world: null, time: 0,
  showPath: false, transitioning: false, inventoryOpen: false, equipping: false,
  showLabels: false,   // X: name labels over every item on the floor (game/lootlabels.js)
  run: createRun(),
  statusMsg: '', statusUntil: 0,
  // the world of cubes and where we are in it; lookDepth: the depth the lighting shows
  cubes: null, cubeKey: '', arrival: null, portalLock: 0, portalCharge: null, showNeighbors: true, lookDepth: 0,   // showNeighbors: tests only
  openedFaces: new Set(), boundaryLock: -1,   // shared side faces unlocked this world
  enemyGrace: 0,     // s left before enemies may attack (game/enemies.js ENTRY_GRACE)
  visit: null,       // this cube as you came in: what a death restores (game/flow.js)
  fallFrom: null,    // falling through cubes: the cube the fall started in (game/fall.js)
  dev: params.get('dev') === '1',   // debug tools (?dev=1)
  baseSeed: params.has('seed') ? (parseInt(params.get('seed'), 10) >>> 0) : (Math.random() * 1e9) >>> 0,
};

// camera orientation and zoom (eased towards the targets)
export const view = { yaw: -Math.PI / 4, yawTarget: -Math.PI / 4, zoom: DEFAULT_ZOOM, zoomTarget: DEFAULT_ZOOM };

export function setStatus(s) { state.statusMsg = s; state.statusUntil = state.time + 2.2; }
