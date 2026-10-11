// Water contact uses the exposed landing surface, not just the column's fluid.
import { LH, WATER } from '../core/constants.js';

export function inWater(gr, y) {
  const f = gr.s;
  return !!f && !f.kind && f.fluid === WATER && y < f.surf * LH;
}
