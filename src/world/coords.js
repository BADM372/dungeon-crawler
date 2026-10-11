// Cube coordinates and the six faces. Y = 0 is the surface, deeper cubes have Y < 0.
// Directions 0-3 match DIRS (+x, -x, +z, -z); 4 = down, 5 = up.
export const D6 = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0], [0, 1, 0]];
export const OPP6 = [1, 0, 3, 2, 5, 4];
export const DIR_NAME = ['east', 'west', 'south', 'north', 'down', 'up'];
export const MIN_Y = -20;   // deepest stratum (depth 20)

export const key = (X, Y, Z) => `${X},${Y},${Z}`;
export const parse = k => k.split(',').map(Number);
export const step = (k, d) => { const [X, Y, Z] = parse(k); return key(X + D6[d][0], Y + D6[d][1], Z + D6[d][2]); };
// a face is stored once, under the cube on its low side (east / south / down face of that cube)
export const faceKey = (k, d) => d % 2 ? `${step(k, d)}/${OPP6[d]}` : `${k}/${d}`;
export const hashKey = k => { let h = 2166136261; for (let i = 0; i < k.length; i++) h = Math.imul(h ^ k.charCodeAt(i), 16777619); return h >>> 0; };
