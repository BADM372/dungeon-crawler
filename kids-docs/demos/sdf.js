// Digital clay: signed distance fields in 2D, the way the creatures in blender/ are built in 3D
// (creature.py, figure.py). Every shape is a function "how far is this point from my surface"
// (negative inside); shapes are joined with a smooth minimum, so they melt together like clay.
import { canvas, loop, html, t as tr } from '../deck.js';

// the same smooth minimum as _smin in blender/figure.py
const smin = (a, b, k) => { if (k <= 0) return Math.min(a, b); const h = Math.min(1, Math.max(0, 0.5 + 0.5 * (b - a) / k)); return b * (1 - h) + a * h - k * h * (1 - h); };

export default function mount(el) {
  const W = 640, H = 300, { g, c, at } = canvas(el, W, H);
  const row = html(el, `<div class="row"><label>${tr('melt (smoothness)', 'Schmelzen (Glätte)')} <input type="range" class="k" min="0" max="60" value="25"> <b class="kv">25</b></label>
    <label><input type="checkbox" class="dist"> ${tr('show distances', 'Abstände zeigen')}</label><button class="eyes">${tr('Add eyes', 'Augen dazu')}</button><span class="muted small">${tr('drag the blobs', 'zieh die Klumpen')}</span></div>`);
  const out = html(el, '<div class="out"></div>');
  const $ = s => row.querySelector(s);
  // a body (ellipse), a head (circle), and two "legs" (capsules)
  const shapes = [
    { kind: 'ellipse', x: 300, y: 160, rx: 90, ry: 55 },
    { kind: 'circle', x: 410, y: 110, r: 42 },
    { kind: 'capsule', x: 250, y: 215, x2: 235, y2: 265, r: 14 },
    { kind: 'capsule', x: 345, y: 215, x2: 360, y2: 265, r: 14 },
  ];
  let eyes = false, drag = null, dirty = true;
  const dist = (s, x, y) => {
    if (s.kind === 'circle') return Math.hypot(x - s.x, y - s.y) - s.r;
    if (s.kind === 'ellipse') { const k0 = Math.hypot((x - s.x) / s.rx, (y - s.y) / s.ry), k1 = Math.hypot((x - s.x) / s.rx ** 2, (y - s.y) / s.ry ** 2); return k1 > 1e-8 ? k0 * (k0 - 1) / k1 : -Math.min(s.rx, s.ry); }
    const px = x - s.x, py = y - s.y, bx = s.x2 - s.x, by = s.y2 - s.y, t = Math.max(0, Math.min(1, (px * bx + py * by) / (bx * bx + by * by)));
    return Math.hypot(px - bx * t, py - by * t) - s.r;
  };
  const img = g.createImageData(W / 2, H / 2), cv = document.createElement('canvas'); cv.width = W / 2; cv.height = H / 2;
  function draw() {
    const k = +$('.k').value, show = $('.dist').checked;
    $('.kv').textContent = k;
    for (let py = 0; py < H / 2; py++) for (let px = 0; px < W / 2; px++) {
      const x = px * 2 + 1, y = py * 2 + 1;
      let d = Infinity;
      for (const s of shapes) d = smin(d === Infinity ? 1e9 : d, dist(s, x, y), k);
      let r, gg, b;
      if (d < 0) {   // inside: clay, a little lighter towards the middle
        const shade = Math.min(1, -d / 40);
        [r, gg, b] = [150 + 40 * shade, 190 + 30 * shade, 215 + 20 * shade];
        if (eyes) for (const ex of [395, 425]) { const ed = Math.hypot(x - ex, y - 100); if (ed < 9) [r, gg, b] = ed < 4 ? [29, 10, 41] : [155, 61, 255]; }
      } else if (show) {   // outside: bands every 10 units of distance
        const band = Math.floor(d / 10) % 2;
        [r, gg, b] = band ? [30, 34, 48] : [20, 22, 32];
        if (Math.abs(d % 10) < 1) [r, gg, b] = [90, 100, 130];
      } else [r, gg, b] = [7, 9, 16];
      const i = (py * W / 2 + px) * 4;
      img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
    cv.getContext('2d').putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true; g.clearRect(0, 0, W, H); g.drawImage(cv, 0, 0, W, H);
    for (const s of shapes) { g.strokeStyle = '#ffcf7a66'; g.setLineDash([4, 4]); g.beginPath();
      if (s.kind === 'circle') g.arc(s.x, s.y, s.r, 0, 7); else if (s.kind === 'ellipse') g.ellipse(s.x, s.y, s.rx, s.ry, 0, 0, 7);
      else { g.moveTo(s.x, s.y); g.lineTo(s.x2, s.y2); }
      g.stroke(); g.setLineDash([]); }
    out.innerHTML = k ? tr(`Melt <b>${k}</b>: where two shapes come closer than that, they blend into one smooth surface.`, `Schmelzen <b>${k}</b>: wo zwei Formen sich näher kommen, verschmelzen sie zu einer glatten Oberfläche.`)
      : tr('Melt 0: the shapes are just stuck together, with sharp creases.', 'Schmelzen 0: die Formen kleben nur aneinander, mit scharfen Kanten.');
  }
  c.onpointerdown = e => {
    const [x, y] = at(e);
    drag = shapes.map(s => ({ s, d: dist(s, x, y) })).sort((a, b) => a.d - b.d)[0];
    if (drag.d > 20) { drag = null; return; }
    drag.ox = x; drag.oy = y; c.setPointerCapture(e.pointerId);
  };
  c.onpointermove = e => {
    if (!drag) return;
    const [x, y] = at(e), dx = x - drag.ox, dy = y - drag.oy, s = drag.s;
    s.x += dx; s.y += dy; if (s.x2 !== undefined) { s.x2 += dx; s.y2 += dy; }
    drag.ox = x; drag.oy = y; dirty = true;
  };
  c.onpointerup = () => { drag = null; };
  row.querySelectorAll('input').forEach(i => i.oninput = () => { dirty = true; });
  $('.eyes').onclick = () => { eyes = !eyes; dirty = true; };
  loop(el, () => { if (dirty) { dirty = false; draw(); } });
}
