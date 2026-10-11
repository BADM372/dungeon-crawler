// Where spiders start: 1-7 per cube on plain ground away from the entry, spread out.
// Uses its own random stream so the map layout does not depend on it.
import { N } from '../core/constants.js';
import { mulberry32, hash32 } from '../core/util.js';
import { walkable, neighbors, groundY } from '../physics/spidernav.js';

export function spiderSpots(map) {
  const R = mulberry32(hash32(map.seed ^ 0x5b1d3a));
  const count = 1 + Math.floor(R() * 7);
  const e = map.entry;
  const cand = map.floors.filter(f => walkable(f) && f !== map.exit.floor && f.x < N - 1
    && Math.hypot(f.x - e.x, f.z - e.z) >= 4 && neighbors(f).length >= 2);
  for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
  const spots = [];
  for (const f of cand) {
    if (spots.length >= count) break;
    if (spots.some(g => Math.hypot(g.x - f.x, g.z - f.z) < 3 && Math.abs(g.top - f.top) < 6)) continue;
    spots.push(f);
  }
  return spots.map(f => ({ f, x: f.x + 0.5, z: f.z + 0.5, y: groundY(f, f.x + 0.5, f.z + 0.5), yaw: R() * Math.PI * 2 }));
}
