// Mutable game state shared between modules.

export const player = {
  x: 0, z: 0, y: 0, vy: 0, vx: 0, vz: 0, r: 0.3, hp: 100, layer: 0,
  grounded: true, swimming: false, fluid: 0, visY: 0, support: null,
  safe: { x: 0, y: 0, z: 0 }, safeTimer: 0,
  autoDir: null,   // overrides keyboard input (used by test bots)
};

const params = new URLSearchParams(location.search);

export const state = {
  map: null, world: null, time: 0,
  showPath: false, transitioning: false,
  statusMsg: '', statusUntil: 0,
  depth: 1,
  baseSeed: params.has('seed') ? (parseInt(params.get('seed'), 10) >>> 0) : (Math.random() * 1e9) >>> 0,
};

// camera orientation and zoom (eased towards the targets)
export const view = { yaw: -Math.PI / 4, yawTarget: -Math.PI / 4, zoom: 1, zoomTarget: 1 };

export function setStatus(s) { state.statusMsg = s; state.statusUntil = state.time + 2.2; }
