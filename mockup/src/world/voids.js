// Where the ground opens onto the depth below. A cube may only have void above a cube that
// exists one depth down (falling through lands you there); how much depends on the theme.
// The void field is world-space noise, so open areas continue across cube faces.
import { key, parse } from './coords.js';
import { themeAt, MAX_DEPTH } from './depth.js';

export function voidAllowed(world, k) {
  const [X, Y, Z] = parse(k), d = -Y;
  return d < MAX_DEPTH && themeAt(d).void > 0 && world.layout(d + 1).exists.has(key(X, Y - 1, Z));
}

// is the world-space cell centre (wx, wz) at depth d open?
export function isVoid(noise, wx, wz, d) {
  const a = themeAt(d).void;
  return a > 0 && noise(wx * 0.11 + 500 + d * 37, wz * 0.11 - 300) < 0.22 + a * 0.55;
}
