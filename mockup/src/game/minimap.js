// Overview of the cubes visited at the current depth, centred on the current cube. Cubes are
// coloured by their WFC tile; edges show rivers (blue) and portals (gold: leads somewhere new,
// cyan: explored); triangles are wells / rings.
import { KIND_COLOR } from '../world/tiles.js';
import { key, parse, step } from '../world/coords.js';
import { state } from './state.js';
import { isFaceOpen } from '../core/boundaries.js';

const R = 3, CELL = 24, PAD = 6, SIZE = (2 * R + 1) * CELL + PAD * 2;
const canvas = Object.assign(document.createElement('canvas'), { id: 'minimap', width: SIZE, height: SIZE + 14 });
document.body.appendChild(canvas);
const g = canvas.getContext('2d');

// a point on edge d of the cell at (px, pz), t in [0,1] along it
const edgePt = (px, pz, d, t) => [[px + CELL, pz + t * CELL], [px, pz + t * CELL], [px + t * CELL, pz + CELL], [px + t * CELL, pz]][d];

function tri(x, y, up, color) {
  g.fillStyle = color; g.beginPath();
  g.moveTo(x - 4, y + (up ? 3 : -3)); g.lineTo(x + 4, y + (up ? 3 : -3)); g.lineTo(x, y + (up ? -4 : 4)); g.fill();
}

export function drawMinimap() {
  const W = state.cubes, [X0, Y, Z0] = parse(state.cubeKey);
  const visited = k => !!W.cubes.get(k)?.visits;
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = '#0b0d12cc'; g.fillRect(0, 0, SIZE, SIZE);
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
    const k = key(X0 + dx, Y, Z0 + dz), c = W.cubes.get(k);
    if (!c?.visits) continue;
    const t = c.info;
    const px = PAD + (dx + R) * CELL, pz = PAD + (dz + R) * CELL;
    g.fillStyle = KIND_COLOR[t.kind]; g.fillRect(px + 1, pz + 1, CELL - 2, CELL - 2);
    for (let d = 0; d < 4; d++) {
      const f = t.faces[d];
      if (!f) continue;
      if (f.river) { const [x, y] = edgePt(px, pz, d, (f.river.pos + f.river.w / 2) / 16); g.fillStyle = '#2e86de'; g.fillRect(x - 2, y - 2, 4, 4); }
      if (f.portal) {
        if (isFaceOpen(state.openedFaces, k, d)) {
          const [x, y] = edgePt(px, pz, d, 0.5);
          g.fillStyle = '#70d6aa';
          if (d < 2) g.fillRect(x - 1, y - CELL / 2 + 3, 2, CELL - 6);
          else g.fillRect(x - CELL / 2 + 3, y - 1, CELL - 6, 2);
        } else {
          const [x, y] = edgePt(px, pz, d, (f.portal.pos + 0.5) / 16);
          g.fillStyle = visited(step(k, d)) ? '#5fd3ff' : '#ffc94a';
          g.fillRect(x - 3, y - 3, 6, 6);
        }
      }
    }
    for (const d of [4, 5]) if (t.faces[d]?.portal)
      tri(px + CELL / 2 + (d === 4 ? -5 : 5), pz + CELL / 2, d === 5, visited(step(k, d)) ? '#5fd3ff' : '#ffc94a');
  }
  const c = PAD + R * CELL;
  g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(c, c, CELL, CELL);
  g.fillStyle = '#aab3c2'; g.font = '11px ui-monospace, monospace';
  g.fillText(`depth ${-Y}   ${[...W.cubes.values()].filter(c => c.visits).length} cubes visited`, PAD, SIZE + 10);
}
