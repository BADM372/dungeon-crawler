// The game's Verlet ragdoll (src/physics/ragdoll.js), flattened to a side view: 16 dots at the
// joints, sticks that keep their distance, a few "keep apart" sticks so joints don't fold flat,
// gravity, 120 small steps a second, 6 rounds of fixing the sticks, and friction on the floor.
import { GRAV } from '../../src/core/constants.js';
import { canvas, loop, html } from '../deck.js';

// the same tables as src/physics/ragdoll.js
const BONES = [[0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [7, 8], [8, 9], [10, 11], [11, 12], [13, 14], [14, 15]];
const RIGID = [[0, 1, 10, 13], [1, 2, 4, 7]];
const APART = [[0, 2, 0.8], [1, 3, 0.85], [4, 6, 0.45], [7, 9, 0.45], [10, 12, 0.55], [13, 15, 0.55], [12, 15, 0.25], [6, 9, 0.2]];
const SUB = 1 / 120, ITERS = 6, PX = 120;
// a standing pose in game units (x, y): pelvis, chest, neck, head top, then arms and legs
const POSE = [[0, 0.5], [0, 0.72], [0, 0.85], [0, 1.05], [-0.06, 0.8], [-0.1, 0.62], [-0.12, 0.46], [0.06, 0.8], [0.1, 0.62], [0.12, 0.46],
  [-0.05, 0.48], [-0.06, 0.25], [-0.07, 0.02], [0.05, 0.48], [0.06, 0.25], [0.07, 0.02]];
const floorAt = x => x > 3.2 ? 0.35 : x < 0.6 ? 0.6 - x * 0.4 : 0;   // a slope on the left, a step on the right

export default function mount(el) {
  const W = 640, H = 260, { g, c, at } = canvas(el, W, H);
  const row = html(el, '<div class="row"><button class="knock">Knock over!</button><button class="kick">Big kick</button><button class="drop">Drop from high up</button><button class="stand">Stand up</button><span class="muted small">or grab a dot and throw it</span></div>');
  const out = html(el, '<div class="out"></div>');
  let P, O, sticks, apart, acc = 0, drag = -1, mouse = [0, 0];
  const dist = (a, b) => Math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1]);
  function build(x0, y0) {
    P = POSE.map(([x, y]) => [x0 + x, y0 + y]); O = P.map(q => q.slice());
    const pairs = BONES.slice();
    for (const grp of RIGID) for (let i = 0; i < grp.length; i++) for (let j = i + 1; j < grp.length; j++) pairs.push([grp[i], grp[j]]);
    sticks = pairs.map(([a, b]) => [a, b, dist(a, b)]);
    apart = APART.map(([a, b, f]) => [a, b, dist(a, b) * f]);
  }
  const kick = (i, vx, vy) => { O[i][0] -= vx * SUB; O[i][1] -= vy * SUB; };
  function solve(a, b, len, apartOnly) {
    const A = P[a], B = P[b], dx = B[0] - A[0], dy = B[1] - A[1], d = Math.hypot(dx, dy) || 1e-6;
    if (apartOnly && d >= len) return;
    const k = (d - len) / d * 0.5;
    A[0] += dx * k; A[1] += dy * k; B[0] -= dx * k; B[1] -= dy * k;
  }
  function substep() {
    const gr = GRAV * SUB * SUB;
    for (let i = 0; i < P.length; i++) {   // Verlet: the velocity is where we are minus where we were
      const q = P[i], o = O[i], vx = (q[0] - o[0]) * 0.998, vy = (q[1] - o[1]) * 0.998;
      o[0] = q[0]; o[1] = q[1]; q[0] += vx; q[1] += vy - gr;
    }
    if (drag >= 0) { P[drag][0] = mouse[0]; P[drag][1] = mouse[1]; }
    for (let it = 0; it < ITERS; it++) {
      for (const [a, b, len] of sticks) solve(a, b, len, false);
      for (const [a, b, len] of apart) solve(a, b, len, true);
      for (let i = 0; i < P.length; i++) {
        const q = P[i], o = O[i], f = floorAt(q[0]) + 0.03;
        q[0] = Math.max(0.05, Math.min(W / PX - 0.05, q[0]));
        if (q[1] < f) { q[1] = f; o[0] = q[0] - (q[0] - o[0]) * 0.55; o[1] = Math.max(o[1], q[1] - 0.001); }
      }
    }
  }
  function draw() {
    g.clearRect(0, 0, W, H);
    const X = x => x * PX, Y = y => H - 20 - y * PX;
    g.fillStyle = '#4e4436'; g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W / PX; x += 0.02) g.lineTo(X(x), Y(floorAt(x)));
    g.lineTo(W, H); g.fill();
    g.strokeStyle = '#aacbd7'; g.lineWidth = 1.5; g.beginPath();
    for (let x = 0; x <= W / PX; x += 0.02) g[x ? 'lineTo' : 'moveTo'](X(x), Y(floorAt(x)));
    g.stroke();
    g.lineCap = 'round';
    for (const [a, b] of apart) { g.strokeStyle = '#b98cff33'; g.lineWidth = 1; g.beginPath(); g.moveTo(X(P[a][0]), Y(P[a][1])); g.lineTo(X(P[b][0]), Y(P[b][1])); g.stroke(); }
    for (const [a, b] of sticks) { g.strokeStyle = BONES.some(([x, y]) => x === a && y === b) ? '#e6e9ef' : '#5fd3ff55'; g.lineWidth = BONES.some(([x, y]) => x === a && y === b) ? 4 : 1.5;
      g.beginPath(); g.moveTo(X(P[a][0]), Y(P[a][1])); g.lineTo(X(P[b][0]), Y(P[b][1])); g.stroke(); }
    P.forEach((q, i) => { g.fillStyle = i === 3 ? '#ffcf7a' : i === drag ? '#ff6a5a' : '#ffcf7a'; g.beginPath(); g.arc(X(q[0]), Y(q[1]), i === 3 ? 7 : 4, 0, 7); g.fill(); });
  }
  build(2, 0.05);
  row.querySelector('.knock').onclick = () => { kick(3, 3, 1); kick(2, 2.5, 0.5); kick(12, -1.5, 0); kick(15, -1.5, 0); };
  row.querySelector('.kick').onclick = () => { for (let i = 0; i < 16; i++) kick(i, -4 - (i < 4 ? 2 : 0), 4); };
  row.querySelector('.drop').onclick = () => { build(1.8, 1.0); kick(3, 1.5, 0); };
  row.querySelector('.stand').onclick = () => build(2, 0.05);
  const toWorld = e => { const [x, y] = at(e); return [x / PX, (H - 20 - y) / PX]; };
  c.onpointerdown = e => {
    mouse = toWorld(e);
    let best = -1, bd = 0.15;
    P.forEach((q, i) => { const d = Math.hypot(q[0] - mouse[0], q[1] - mouse[1]); if (d < bd) { bd = d; best = i; } });
    drag = best; if (drag >= 0) c.setPointerCapture(e.pointerId);
  };
  c.onpointermove = e => { if (drag >= 0) mouse = toWorld(e); };
  c.onpointerup = () => { drag = -1; };
  loop(el, dt => {
    acc += Math.min(dt, 0.05);
    let n = 0;
    while (acc >= SUB) { acc -= SUB; substep(); n++; }
    draw();
    out.innerHTML = `16 dots, ${sticks.length} sticks (white: bones, blue: stiff body parts), ${apart.length} keep-apart sticks (violet) \u00B7 <b>${n}</b> small steps this frame`;
  });
}
