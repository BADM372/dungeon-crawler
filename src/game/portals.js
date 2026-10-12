// Stepping into a portal: through the face for side portals, onto the centre of a well or ring.
// Vertical portals charge while standing in the circle: 0.75s down, 1.5s up.
import { N } from '../core/constants.js';
import { isFaceOpen, approachingFace, faceDistance } from '../core/boundaries.js';
import { player, state, setStatus } from './state.js';
import { portalLocked, guardianLockMessage } from '../core/guardians.js';
import { startTravel } from './travel.js';

export const PORTAL_CHARGE = 1.5;
export const portalChargeDuration = kind => kind === 'down' ? PORTAL_CHARGE / 2 : PORTAL_CHARGE;

function inside(q) {
  const p = player;
  if (Math.abs(p.y - q.y) > 0.6) return false;
  // wells and rings only take you when you step on them yourself (not stunned or knocked there)
  if (q.kind !== 'side') return Math.hypot(p.x - q.x - 0.5, p.z - q.z - 0.5) < 0.42 && p.grounded && p.stun <= 0 && Math.hypot(p.vx, p.vz) < 4.4;
  const along = q.dir < 2 ? p.z - q.z - 0.5 : p.x - q.x - 0.5;
  const out = [p.x - N, -p.x, p.z - N, -p.z][q.dir];   // distance past the face (negative inside)
  return Math.abs(along) < 1.5 && out > -0.4;
}

// dt: time spent this step (charges vertical portals); charge: carried over from the last
// step. state.portalCharge only survives while we keep standing in the same portal.
export function checkPortals(dx = 0, dz = 0, dt = 0, charge = state.portalCharge) {
  state.portalCharge = null;
  if (state.boundaryLock >= 0 && faceDistance(player, state.boundaryLock) > player.r + 0.25) state.boundaryLock = -1;
  // open side faces take you across anywhere along them, whether they ever had a gate or not
  for (let d = 0; d < 4; d++) {
    if (!isFaceOpen(state.openedFaces, state.cubeKey, d) || state.boundaryLock === d || !approachingFace(player, d, dx, dz)) continue;
    if (portalLocked(state.map, state.run, { dir: d })) { setStatus(guardianLockMessage(state.map)); continue; }
    startTravel(state.map.portals.find(q => q.kind === 'side' && q.dir === d) || { kind: 'side', dir: d });
    return true;
  }
  for (const q of state.map.portals) {
    if (q.kind === 'spawn' || q.kind === 'side' && isFaceOpen(state.openedFaces, state.cubeKey, q.dir)) continue;
    const at = inside(q);
    if (state.portalLock === q.id) { if (!at) state.portalLock = 0; continue; }
    if (!at) continue;
    if (portalLocked(state.map, state.run, q)) { setStatus(guardianLockMessage(state.map)); continue; }
    if (q.kind === 'up' || q.kind === 'down') {
      const c = charge?.key === state.cubeKey && charge.id === q.id ? charge : { key: state.cubeKey, id: q.id, t: 0 };
      c.t += dt;
      if (c.t < portalChargeDuration(q.kind)) { state.portalCharge = c; continue; }
    }
    startTravel(q); return true;
  }
  return false;
}
