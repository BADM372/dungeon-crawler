// Lazy wave function collapse over the (unbounded) grid of cubes. Each depth Y is its own
// horizontal grid; a cube's domain is every tile whose side sockets match the collapsed
// neighbours. Collapsing a set of cubes picks the lowest-entropy one first, with a random
// stream per cube so results only depend on the world seed and the order of exploration.
import { mulberry32, hash32 } from '../core/util.js';
import { TILES, layersOf } from './tiles.js';
import { OPP6, step, hashKey } from './coords.js';
import { themeAt, depthOf } from './depth.js';
import { TOWN_KEY } from './town.js';

// tile weight at cube k: the base weight scaled by the depth's theme
const weightAt = k => { const m = themeAt(depthOf(k)).tiles; return t => t.weight * (m[t.kind] ?? 1); };

export class WFC {
  constructor(seed) {
    this.seed = seed;
    // Pin before any collapse, including neighbours prepared before the town.
    const town = TILES.find(t => t.kind === 'meadow' && t.sock.every(s => s === 'L'));
    this.tiles = new Map([[TOWN_KEY, { ...town, K: 1 }]]);
  }

  domain(k) {
    const nb = [0, 1, 2, 3].map(d => this.tiles.get(step(k, d)));
    return TILES.filter(t => nb.every((n, d) => !n || n.sock[OPP6[d]] === t.sock[d]));
  }

  entropy(dom, w) {
    const sum = dom.reduce((s, t) => s + w(t), 0);
    return Math.log(sum) - dom.reduce((s, t) => s + w(t) * Math.log(w(t)), 0) / sum;
  }

  rng(k, salt = 0) { return mulberry32(hash32(this.seed ^ hashKey(k) ^ salt)); }

  collapse(keys) {
    const todo = new Set(keys.filter(k => !this.tiles.has(k)));
    while (todo.size) {
      let best = null, bestE = Infinity, bestDom = null;
      for (const k of todo) {
        const dom = this.domain(k), e = this.entropy(dom, weightAt(k)) + (hashKey(k) % 1000) * 1e-6;   // tiny tie-break
        if (e < bestE) { best = k; bestE = e; bestDom = dom; }
      }
      const R = this.rng(best), w = weightAt(best), sum = bestDom.reduce((s, t) => s + w(t), 0);
      let r = R() * sum, tile = bestDom[bestDom.length - 1];
      for (const t of bestDom) if ((r -= w(t)) < 0) { tile = t; break; }
      const near = [0, 1, 2, 3].map(d => this.tiles.get(step(best, d))?.K).filter(Boolean);
      this.tiles.set(best, { ...tile, K: layersOf(tile.kind, R(), near) });
      todo.delete(best);
    }
  }
}
