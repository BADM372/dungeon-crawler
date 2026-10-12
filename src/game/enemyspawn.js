// Independent seeded streams: enemies never alter the terrain generator's RNG.
// A level is a cube in the existing level flow. Its depth decides which species live there
// and how many (core/spawns.js); each species then places its count on dry floors with room
// for its body, away from entrances. A pack's first member keeps `profile.spacing` from
// every other enemy of its species; the rest of the pack gathers close around it.
// Each pack draws its kind from the roster's weights (core/spawns.js) on a stream of its own,
// so the kinds never move a spot. A spot carries its kind's profile as `kind`.
import { N } from '../core/constants.js';
import { enemyRoll, ENEMY_KINDS } from '../core/enemies.js';
import { population } from '../core/spawns.js';
import { mulberry32, hash32 } from '../core/util.js';
import { walkable, neighbors, groundY, floorAt } from '../physics/enemynav.js';

const CLOSE = 1.2;   // the least distance between two members of a pack

export function pickKind(kinds, r) {
  const list = Object.entries(kinds ?? {});
  let w = r * list.reduce((n, [, k]) => n + k, 0);
  for (const [type, k] of list) if ((w -= k) < 0) return ENEMY_KINDS[type];
  return ENEMY_KINDS[list.at(-1)?.[0]];
}

export function enemySpots(map, profile) {
  const spec = population(map).get(profile.type);
  if (!spec?.count) return [];
  const R = mulberry32(hash32(map.seed ^ profile.seedSalt)), { count, pack } = spec;
  const K = mulberry32(hash32(map.seed ^ profile.seedSalt ^ 0x6b1d5)), kinds = [];
  // room for the biggest kind the pack could draw
  const drawn = Object.keys(spec.kinds ?? {}).map(k => ENEMY_KINDS[k]).filter(Boolean);
  const height = Math.max(profile.height, ...drawn.map(k => k.height)), radius = Math.max(profile.radius, ...drawn.map(k => k.radius));
  const cand = map.floors.filter(f => !f.siteAnchor && !f.siteAccess && walkable(f, height)
    && f.x > 0 && f.z > 0 && f.x < N - 1 && f.z < N - 1
    && map.portals.every(p => Math.hypot(f.x - p.x, f.z - p.z) >= 4)
    && neighbors(f, height).length >= 2
    && [[radius, 0], [-radius, 0], [0, radius], [0, -radius]]
      .every(([x, z]) => floorAt(f, f.x + 0.5 + x, f.z + 0.5 + z, height)));
  for (let i = cand.length - 1; i > 0; i--) {
    const j = Math.floor(R() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]];
  }
  const spots = [], used = new Set();
  const clear = (f, d) => spots.every(g => Math.hypot(g.x - f.x, g.z - f.z) >= d || Math.abs(g.top - f.top) >= 6);
  for (const a of cand) {
    if (spots.length >= count) break;
    if (used.has(a) || !clear(a, profile.spacing)) continue;
    spots.push(a); used.add(a);
    const kind = pickKind(spec.kinds, K()) ?? profile;
    kinds.push(kind);
    // the rest of the pack: ceil(pack / 2)..pack in all, within reach of the first on its level
    const size = Math.min(count - spots.length + 1, Math.ceil(pack / 2) + Math.floor(R() * (Math.floor(pack / 2) + 1)));
    const reach = 1.5 + Math.sqrt(size);
    for (let n = 1; n < size;) {
      const f = cand.find(f => !used.has(f) && Math.abs(f.top - a.top) < 1
        && Math.hypot(f.x - a.x, f.z - a.z) <= reach && clear(f, CLOSE));
      if (!f) break;
      spots.push(f); used.add(f); kinds.push(kind); n++;
    }
  }
  return spots.map((f, i) => ({ ...enemyRoll(map, kinds[i], f.id), kind: kinds[i], f, x: f.x + 0.5, z: f.z + 0.5, y: groundY(f, f.x + 0.5, f.z + 0.5), yaw: R() * Math.PI * 2 }));
}
