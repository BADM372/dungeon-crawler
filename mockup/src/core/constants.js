// Shared dimensions, fluid ids, grid directions and physics tuning.

export const N = 16;            // cube footprint in cells
export const LH = 0.5;          // height of one terrain level
export const CUBE_H = 16;       // visual height of the cube
export const BASE = 0.6;        // thickness of the bedrock slab under the map
export const MAX_L = 24;        // highest level a floor may reach
export const HEAD = 3;          // min free levels between two stacked floors
export const SHEAD = 3;         // clearance (levels) kept around stairs and bridges

export const WATER = 1, LAVA = 2, ACID = 3;
export const FLUIDS = [WATER, LAVA, ACID];
export const FLUID_NAME = { 1: 'water', 2: 'lava', 3: 'acid' };

// grid directions: +x, -x, +z, -z
export const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const OPP = [1, 0, 3, 2];
export const DIRV = DIRS.map(([x, z]) => [x, 0, z]);

// corners of a cell are indexed oz*2+ox: 0=(0,0) 1=(1,0) 2=(0,1) 3=(1,1)
// EDGE_CORNERS[d] lists the two corners on side d, ordered like edgePts()
export const EDGE_CORNERS = [[1, 3], [0, 2], [2, 3], [0, 1]];
export const edgePts = (x, z, d) => [
  [[x + 1, z], [x + 1, z + 1]], [[x, z], [x, z + 1]],
  [[x, z + 1], [x + 1, z + 1]], [[x, z], [x + 1, z]]][d];

// physics tuning
export const STEP = 0.3;        // max ledge the ball can roll onto
export const SWIM_STEP = 0.85;  // climbing out of water is more generous
export const GRAV = 28;
export const ROLL = 0.5;        // fraction of gravity that turns into downhill rolling
export const DRAG = 4.5;
export const SNAP = 0.25;       // stick to the ground when rolling downhill
