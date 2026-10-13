// Painting 3D with triangles: a little block of terrain (made like the game's cubes: a grid of
// columns of different heights) turned into triangles, put through a perspective camera, shaded
// by how much each triangle faces the sun, and painted far to near.
import { canvas, loop, html } from '../deck.js';
import { makeNoise, mulberry32 } from '../../src/core/util.js';

export default function mount(el) {
  const W = 640, H = 330, { g } = canvas(el, W, H);
  const row = html(el, `<div class="row"><label><input type="checkbox" class="fill" checked> paint</label>
    <label><input type="checkbox" class="edges"> show triangles</label><label><input type="checkbox" class="light" checked> sunlight</label>
    <label><input type="checkbox" class="spin" checked> turn</label><label>sun <input type="range" class="sun" min="0" max="360" value="220"></label></div>`);
  const out = html(el, '<div class="out"></div>');
  const $ = s => row.querySelector(s);
  // a 6x6 grid of columns; heights from the game's own noise function
  const n = 6, noise = makeNoise(mulberry32(5)), hgt = [];
  for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) hgt.push(Math.round(noise(x * 0.35, z * 0.35) * 6) * 0.5);
  const tris = [];   // [a, b, c, colour]
  const quad = (a, b, cc, d, col) => { tris.push([a, b, cc, col], [a, cc, d, col]); };
  for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
    const h = hgt[z * n + x], X = x - n / 2, Z = z - n / 2;
    quad([X, h, Z], [X + 1, h, Z], [X + 1, h, Z + 1], [X, h, Z + 1], [118, 173, 80]);
    for (const [dx, dz, a, b] of [[1, 0, [1, 0], [1, 1]], [-1, 0, [0, 1], [0, 0]], [0, 1, [1, 1], [0, 1]], [0, -1, [0, 0], [1, 0]]]) {
      const nx = x + dx, nz = z + dz, nh = nx >= 0 && nz >= 0 && nx < n && nz < n ? hgt[nz * n + nx] : -1;
      if (nh >= h) continue;
      quad([X + a[0], h, Z + a[1]], [X + b[0], h, Z + b[1]], [X + b[0], nh, Z + b[1]], [X + a[0], nh, Z + a[1]], [122, 86, 56]);
    }
  }
  let yaw = 0.7;
  loop(el, dt => {
    if ($('.spin').checked) yaw += dt * 0.35;
    const pitch = 0.77, dist = 17, fov = 0.9, sun = +$('.sun').value * Math.PI / 180;
    const L = [Math.cos(sun) * 0.6, 0.75, Math.sin(sun) * 0.6], ll = Math.hypot(...L); L.forEach((v, i) => { L[i] = v / ll; });
    // camera: turn the world around, tilt it, push it away, then divide by the distance
    const view = ([x, y, z]) => {
      const cx = x * Math.cos(yaw) - z * Math.sin(yaw), cz = x * Math.sin(yaw) + z * Math.cos(yaw);
      const vy = y * Math.cos(pitch) + cz * Math.sin(pitch), vz = -y * Math.sin(pitch) + cz * Math.cos(pitch) + dist;
      return [cx, vy - 0.6, vz];
    };
    const proj = ([x, y, z]) => [W / 2 + x / z * W / fov * 0.9, H / 2 - y / z * W / fov * 0.9];
    const drawn = tris.map(([a, b, cc, col]) => {
      const va = view(a), vb = view(b), vc = view(cc);
      const u = b.map((v, i) => v - a[i]), w = cc.map((v, i) => v - a[i]);
      const nrm = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], nl = Math.hypot(...nrm) || 1;
      const lit = Math.max(0, Math.abs(nrm[0] * L[0] + nrm[1] * L[1] + nrm[2] * L[2]) / nl);
      return { pts: [va, vb, vc].map(proj), depth: (va[2] + vb[2] + vc[2]) / 3, col, lit };
    }).sort((p, q) => q.depth - p.depth);   // far first: the painter's way
    g.clearRect(0, 0, W, H);
    for (const t of drawn) {
      g.beginPath(); t.pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath();
      if ($('.fill').checked) {
        const k = $('.light').checked ? 0.35 + 0.75 * t.lit : 0.8;
        g.fillStyle = `rgb(${t.col.map(v => Math.min(255, v * k)).join(',')})`; g.fill();
      }
      if ($('.edges').checked || !$('.fill').checked) { g.strokeStyle = '#ffcf7acc'; g.lineWidth = 0.7; g.stroke(); }
    }
    out.innerHTML = `<b>${tris.length}</b> triangles, painted far-to-near. A cube in the real game has thousands, the whole screen often hundreds of thousands.`;
  });
}
