// Mutable game state shared between modules.
import { CHAR_R, CHAR_H } from '../core/constants.js';

export const player = {
  x: 0, z: 0, y: 0, vx: 0, vy: 0, vz: 0, visY: 0,
  r: CHAR_R, h: CHAR_H, hp: 100, layer: 0,
  grounded: true, swimming: false, fluid: 0, support: null,
  airTime: 0, coyote: 0, jumpBuf: 0, stun: 0,
  // event counters the animator watches
  jumpCount: 0, landCount: 0, landImpact: 0, getUpCount: 0,
  ragdoll: null, ragdollThen: null,
  safe: { x: 0, y: 0, z: 0 }, safeTimer: 0,
  autoDir: null, autoRun: false,   // override keyboard input (used by test bots)
};

const params = new URLSearchParams(location.search);

export const state = {
  map: null, world: null, time: 0,
  showPath: false, transitioning: false,
  statusMsg: '', statusUntil: 0,
  cubes: null, cubeKey: '', arrival: null, portalLock: 0, showNeighbors: true,   // the world of cubes and where we are in it
  baseSeed: params.has('seed') ? (parseInt(params.get('seed'), 10) >>> 0) : (Math.random() * 1e9) >>> 0,
};

// camera orientation and zoom (eased towards the targets)
export const view = { yaw: -Math.PI / 4, yawTarget: -Math.PI / 4, zoom: 1, zoomTarget: 1 };

export function setStatus(s) { state.statusMsg = s; state.statusUntil = state.time + 2.2; }
