// House door rules (no rendering, no game state; game/doors.js does the trip). A door
// (map.doors) is { id, building, to (the key on the other side), x, z (its centre on the wall
// face), nx, nz (towards the side you stand on), w, y }. The door on the other side is the one
// with the same building that leads back.
import { DOORSTEP } from '../world/town.js';

const REACH = 0.16;   // how close to its face (beyond the body's radius) a door takes you

// where you stand coming through door d: on its doorstep, facing away from it
export function doorArrival(d) {
  return { x: d.x + d.nx * DOORSTEP, y: d.y, z: d.z + d.nz * DOORSTEP, yaw: Math.atan2(d.nx, d.nz) };
}

// is body p walking into door d? On its side, within its width, against its face, and pushing
// towards it (input dx, dz or its velocity), so standing beside it does not take you through
export function atDoor(p, d, dx = 0, dz = 0) {
  const rx = p.x - d.x, rz = p.z - d.z, out = rx * d.nx + rz * d.nz, along = rz * d.nx - rx * d.nz;
  return Math.abs(p.y - d.y) < 0.6 && Math.abs(along) < d.w / 2 + 0.1 && out > -0.05 && out < p.r + REACH
    && (dx * d.nx + dz * d.nz < 0 || p.vx * d.nx + p.vz * d.nz < -0.05);
}

// the door in `map` that leads back through door d (coming from key `from`)
export const doorBack = (map, d, from) => map.doors?.find(e => e.building === d.building && e.to === from) || null;
