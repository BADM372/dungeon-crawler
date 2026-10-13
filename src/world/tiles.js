// The WFC tile set. A cube's tile fixes the sockets of its four side faces:
//   L = lowland, H = highland (ground up at the first layer), W = lowland with a river crossing.
// Every combination of sockets is covered by some tile, so collapsing a cube next to any set of
// already collapsed neighbours always succeeds. Uniform tiles weigh more, which grows regions;
// the mixed tiles (slope, gorge) appear where regions meet.
const SOCKETS = ['L', 'H', 'W'];
// kids-docs: world.html#wfc (see kids-docs/README.md)
const W = { meadow: 6, highland: 5, slope: 0.35, river: 0.6, lake: 0.12, gorge: 0.03 };
const LAYERS = { meadow: [1, 3], highland: [2, 4], slope: [2, 4], river: [1, 3], lake: [2, 3], gorge: [2, 4] };
export const KIND_COLOR = { meadow: '#6fae4f', highland: '#a08052', slope: '#8f9a4c', river: '#3f8fd8', lake: '#2fb6c4', gorge: '#7a5a8c' };

function kindsFor(s) {
  const h = s.filter(x => x === 'H').length, w = s.filter(x => x === 'W').length;
  if (!h && !w) return ['meadow'];
  if (h === 4) return ['highland'];
  if (!w) return ['slope'];
  if (!h) return w === 2 ? ['river', 'lake'] : ['lake'];
  return ['gorge'];
}

export const TILES = [];
for (let i = 0; i < 81; i++) {
  const sock = [0, 1, 2, 3].map(d => SOCKETS[Math.floor(i / 3 ** d) % 3]);
  for (const kind of kindsFor(sock)) TILES.push({ id: TILES.length, kind, sock, weight: W[kind] });
}

// layer count of a collapsing cube: within its kind's range, drawn towards the counts of its
// collapsed neighbours so tall (many-layered) regions form, where portals can link up high
export function layersOf(kind, r, near) {
  const [a, b] = LAYERS[kind], w = [];
  for (let K = a; K <= b; K++) w.push(1 + 2.5 * near.filter(n => n === K).length);
  let x = r * w.reduce((s, v) => s + v, 0);
  for (let i = 0; i < w.length; i++) if ((x -= w[i]) < 0) return a + i;
  return b;
}
