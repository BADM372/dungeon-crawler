// Stepping into a portal: through the face for side portals, onto the centre of a well or ring.
import { N } from '../core/constants.js';
import { player, state } from './state.js';
import { startTravel } from './travel.js';

function inside(q) {
  const p = player;
  if (Math.abs(p.y - q.y) > 0.6) return false;
  if (q.kind !== 'side') return Math.hypot(p.x - q.x - 0.5, p.z - q.z - 0.5) < 0.42 && p.grounded;
  const along = q.dir < 2 ? p.z - q.z - 0.5 : p.x - q.x - 0.5;
  const out = [p.x - N, -p.x, p.z - N, -p.z][q.dir];   // distance past the face (negative inside)
  return Math.abs(along) < 1.5 && out > -0.4;
}

export function checkPortals() {
  for (const q of state.map.portals) {
    if (q.kind === 'spawn') continue;
    const at = inside(q);
    if (state.portalLock === q.id) { if (!at) state.portalLock = 0; continue; }
    if (at) { startTravel(q); return true; }
  }
  return false;
}
