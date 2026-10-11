// The WFC tile set. A cube's tile fixes the sockets of its four side faces:
//   L = lowland, H = highland (ground up at the first layer), W = lowland with a river crossing.
// Every combination of sockets is covered by some tile, so collapsing a cube next to any set of
// already collapsed neighbours always succeeds. Uniform tiles weigh more, which grows regions;
// the mixed tiles (slope, gorge) appear where regions meet.
const SOCKETS = ['L', 'H', 'W'];
const W = { meadow: 6, highland: 5, slope: 0.35, river: 0.6, lake: 0.12, gorge: 0.03 };
const LAYERS = { meadow: [1, 2], highland: [2, 4], slope: [2, 3], river: [1, 3], lake: [2, 3], gorge: [2, 3] };
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

// layer count of a collapsed cube (r in [0,1) from the cube's hash)
export function layersOf(kind, r) {
  const [a, b] = LAYERS[kind];
  return a + Math.floor(r * (b - a + 1));
}
