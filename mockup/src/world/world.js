// The world: a lazily grown set of cubes. Preparing a cube collapses it and its six neighbours
// (WFC), decides its faces, and then generates its map from a spec built out of those faces.
import { hash32 } from '../core/util.js';
import { worldNoise } from '../core/wnoise.js';
import { generate } from '../gen/index.js';
import { WFC } from './wfc.js';
import { key, parse, step, faceKey, hashKey, MIN_Y } from './coords.js';
import { decideFaces, LAYER_BASE } from './faces.js';
import { themeAt } from './depth.js';
import { makeLayouts } from './layout.js';
import { voidAllowed } from './voids.js';

// how much each WFC kind leans towards an archetype (times the theme's weights)
const LEAN = { highland: { mesa: 2, spire: 2, archipelago: 0.3 }, lake: { archipelago: 3, crater: 2 }, gorge: { chasm: 3 },
  river: { chasm: 1.5, archipelago: 0.5 }, meadow: { plain: 1.5 }, slope: { mesa: 1.5 } };
function archetype(theme, kind, R) {
  const w = Object.entries(theme.arche).map(([a, v]) => [a, v * (LEAN[kind]?.[a] ?? 1)]);
  let r = R() * w.reduce((s, [, v]) => s + v, 0);
  for (const [a, v] of w) if ((r -= v) < 0) return a;
  return 'plain';
}

export class World {
  // opts.arche: force one archetype everywhere (dev)
  constructor(seed, opts = {}) {
    this.seed = seed;
    this.opts = opts;
    this.wfc = new WFC(seed);
    this.noise = worldNoise(seed);
    this.faces = new Map();
    this.cubes = new Map();
    this.start = key(0, 0, 0);
    this.layout = makeLayouts(seed);   // depth -> which cubes exist and how they connect
  }

  prepare(k) {
    const around = [0, 1, 2, 3, 4, 5].map(d => step(k, d)).filter(n => { const y = parse(n)[1]; return y <= 0 && y >= MIN_Y; });
    this.wfc.collapse([k, ...around]);
    decideFaces(this, k);
  }

  spec(k) {
    const [X, Y, Z] = parse(k), t = this.wfc.tiles.get(k), theme = themeAt(-Y);
    const faces = [0, 1, 2, 3].map(d => {
      const f = this.faces.get(faceKey(k, d));
      return { sock: t.sock[d], profile: Int16Array.from(f.profile), river: f.river, portal: f.portal };
    });
    const portals = [];
    faces.forEach((f, d) => { if (f.portal) portals.push({ dir: d, ...f.portal }); });
    for (const d of [4, 5]) {
      const f = this.faces.get(faceKey(k, d));
      if (f?.portal) portals.push({ dir: d, ...f.portal });
    }
    return {
      key: k, X, Y, Z, kind: t.kind, K: t.K, B: LAYER_BASE.slice(0, t.K), faces, portals,
      spawn: k === this.start, noise: this.noise, depth: -Y,
      fluid: theme.river, fluidMix: theme.fluids, voidOK: voidAllowed(this, k), relief: theme.relief,
      // islands without pillars: lakes, the sky islands near the top and the abyss
      floating: t.kind === 'lake' || ((-Y <= 3 || -Y >= 19) && this.wfc.rng(k, 0xf10a7)() < 0.5),
      seed: hash32(this.seed ^ hashKey(k)),
      archetype: -Y === 0 ? 'plain' : this.opts.arche || archetype(theme, t.kind, this.wfc.rng(k, 0xa7c4)),
    };
  }

  // the generated cube (built on first use)
  cube(k) {
    let c = this.cubes.get(k);
    if (!c) {
      this.prepare(k);
      c = { key: k, map: generate(this.spec(k)), visits: 0 };
      this.cubes.set(k, c);
    }
    return c;
  }
}
