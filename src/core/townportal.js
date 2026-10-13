// Town portal rules (no rendering, no game state). The run keeps at most one open portal:
//   run.townPortal = { key, depth, pad: {x, y, z}, back: {x, y, z} }
// `pad` is the dungeon end (cube-local), `back` where you stood when you cast it. The town end
// stands on the spot the town plan reserves for it (map.town.portal, world/town.js).
// kids-docs: code.html#text (see kids-docs/README.md)
export const CAST_TIME = 5;              // s standing still to open it
// kids-docs: code.html#text (see kids-docs/README.md)
export const TOWN_PORTAL_CHARGE = 1;     // s standing in it to go through
export const PAD_RADIUS = 0.62;          // drawn size; you step in within TRIGGER_RADIUS
const TRIGGER_RADIUS = 0.42;

// the end of the open portal in this map (null: none here)
export function townPadIn(map, run) {
  const tp = run?.townPortal;
  if (!tp || !map) return null;
  if (map.town) return map.town.portal;
  return map.key === tp.key ? tp.pad : null;
}

// standing in it on purpose, as with wells and rings (not stunned, knocked or running through)
// kids-docs: space.html#distance (see kids-docs/README.md)
export const onPad = (p, pad) => Math.abs(p.y - pad.y) <= 0.6 && Math.hypot(p.x - pad.x, p.z - pad.z) < TRIGGER_RADIUS
  && p.grounded && p.stun <= 0 && Math.hypot(p.vx, p.vz) < 4.4;
