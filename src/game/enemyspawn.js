// Independent seeded streams: enemies never alter the terrain generator's RNG.
// A level is a cube in the existing level flow. Each species draws its own count
// (profile.minCount..maxCount, at every depth for now) and places it on dry floors
// with room for its body, away from entrances and from others of its kind.
import { N } from '../core/constants.js';
import { enemyRoll } from '../core/enemies.js';
import { mulberry32, hash32 } from '../core/util.js';
import { walkable, neighbors, groundY, floorAt } from '../physics/enemynav.js';

export function enemySpots(map, profile) {
  if (map.enemyFree) return [];
  const R = mulberry32(hash32(map.seed ^ profile.seedSalt));
  const count = profile.minCount + Math.floor(R() * (profile.maxCount - profile.minCount + 1));
  if (!count) return [];
  const cand = map.floors.filter(f => !f.siteAnchor && !f.siteAccess && walkable(f, profile.height)
    && f.x > 0 && f.z > 0 && f.x < N - 1 && f.z < N - 1
    && map.portals.every(p => Math.hypot(f.x - p.x, f.z - p.z) >= 4)
    && neighbors(f, profile.height).length >= 2
    && [[profile.radius, 0], [-profile.radius, 0], [0, profile.radius], [0, -profile.radius]]
      .every(([x, z]) => floorAt(f, f.x + 0.5 + x, f.z + 0.5 + z, profile.height)));
  for (let i = cand.length - 1; i > 0; i--) {
    const j = Math.floor(R() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]];
  }
  const spots = [];
  for (const f of cand) {
    if (spots.length >= count) break;
    if (spots.some(g => Math.hypot(g.x - f.x, g.z - f.z) < profile.spacing && Math.abs(g.top - f.top) < 6)) continue;
    spots.push(f);
  }
  return spots.map(f => ({ ...enemyRoll(map, profile, f.id), f, x: f.x + 0.5, z: f.z + 0.5, y: groundY(f, f.x + 0.5, f.z + 0.5), yaw: R() * Math.PI * 2 }));
}
