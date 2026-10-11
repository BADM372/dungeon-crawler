// Fluid contact uses the exposed landing surface, not just the column's fluid.
// Every fluid is fatal on entry: water drowns, lava burns, acid dissolves.
import { LH } from '../core/constants.js';

// the fluid the body is submerged in (0 when dry or above the surface)
export function inFluid(gr, y) {
  const f = gr.s;
  return f && !f.kind && f.fluid && y < f.surf * LH ? f.fluid : 0;
}
