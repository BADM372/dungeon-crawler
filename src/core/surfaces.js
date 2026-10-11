// Walkable surface heights shared by the generator, physics and rendering.

// A floor is a solid slab in one column: solid from `bottom` up to its smoothed top.
// The top of a cell is two triangles (`split` picks the diagonal); rendering uses the
// exact same triangles. (fx, fz) are local coordinates in [0,1].
export function floorY(f, fx, fz) {
  const c00 = f.cs[0], c10 = f.cs[1], c01 = f.cs[2], c11 = f.cs[3];
  if (!f.split) {
    if (fx >= fz) return c00 + (c10 - c00) * fx + (c11 - c10) * fz;
    return c00 + (c11 - c01) * fx + (c01 - c00) * fz;
  }
  if (fx + fz <= 1) return c00 + (c10 - c00) * fx + (c01 - c00) * fz;
  return c11 + (c01 - c11) * (1 - fx) + (c10 - c11) * (1 - fz);
}

// Height of a stair / bridge / landing piece: linear along the whole run, plank bridges sag.
export function runY(p, fx, fz) {
  const r = p.run;
  if (r.kind === 'landing') return r.y0;
  const t = p.dx > 0 ? fx : p.dx < 0 ? 1 - fx : p.dz > 0 ? fz : 1 - fz;
  const T = (p.j + t) / r.k;
  return r.y0 + (r.y1 - r.y0) * T - r.sag * Math.sin(Math.PI * T);
}

export const topOf = (s, fx, fz) => s.kind ? runY(s, fx, fz) : floorY(s, fx, fz);
