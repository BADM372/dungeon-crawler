import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/world/world.js';
import { WFC } from '../src/world/wfc.js';
import { makeLayouts } from '../src/world/layout.js';
import { step, OPP6 } from '../src/world/coords.js';
import { mulberry32 } from '../src/core/util.js';

const shuffle = (a, R) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

test('every depth collapses the same, whichever depth or cube is asked for first', () => {
  for (const seed of [0, 7, 42]) {
    const L = makeLayouts(seed), a = new WFC(seed, L), b = new WFC(seed, L), depths = [...Array(21).keys()];
    for (const d of depths) a.collapseDepth(d);
    for (const d of shuffle([...depths], mulberry32(seed))) b.collapseDepth(d);
    assert.deepEqual([...b.tiles].sort(), [...a.tiles].sort());
  }
});

test('collapsed neighbours agree on every face', () => {
  for (const seed of [1, 3]) {
    const L = makeLayouts(seed), w = new WFC(seed, L);
    for (let d = 0; d <= 20; d++) w.collapseDepth(d);
    for (const [k, t] of w.tiles) for (let d = 0; d < 4; d++) {
      const n = w.tiles.get(step(k, d));
      if (n) assert.equal(t.sock[d], n.sock[OPP6[d]], `${k} side ${d}`);
    }
  }
});

test('generated cubes are the same whichever way a depth is explored', () => {
  const sig = m => JSON.stringify({ kind: m.kind, K: m.K, archetype: m.archetype,
    floors: m.floors.map(f => [f.c, f.bottom, f.top]), portals: m.portals.map(q => [q.dir, q.pos, q.layer, q.level, q.x, q.z]) });
  for (const [seed, d] of [[11, 2], [5, 9]]) {
    const route = new World(seed).layout(d).route, fwd = new World(seed), back = new World(seed);
    const a = route.map(k => sig(fwd.cube(k).map));
    const b = [...route].reverse().map(k => sig(back.cube(k).map)).reverse();
    assert.deepEqual(b, a);
  }
});

test('cubes outside a depth\'s layout are refused instead of collapsed on the fly', () => {
  // an unbounded world would need these to collapse deterministically too (docs/world.md)
  assert.throws(() => new World(3).cube('40,-4,40'), /not part of depth 4/);
});
