// A sword swing on a timeline, with the game's timing (SWORD in src/core/combat.js) scaled by
// each weapon's interval (src/core/items.js), like combatStats: wind-up, the moment the blade
// can hit, recovery, the point where walking cuts it short, and the point where the next
// swing may start. Clicks are kept for 0.3 s, so a click a little early still chains.
import { SWORD } from '../../src/core/combat.js';
import { WEAPONS } from '../../src/core/items.js';
import { canvas, loop, html } from '../deck.js';

const TIMES = ['activeStart', 'activeEnd', 'moveCancel', 'chain', 'duration'];

export default function mount(el) {
  const W = 640, H = 230, { g, c } = canvas(el, W, H);
  const row = html(el, `<div class="row"><label>sword <select class="w">${WEAPONS.map((w, i) => `<option value="${i}" ${i === 0 ? 'selected' : ''}>${w.name}</option>`).join('')}</select></label>
    <button class="go">Swing! (click)</button><label><input type="checkbox" class="hold"> hold the button</label>
    <label><input type="checkbox" class="slow" checked> slow motion</label></div>`);
  const out = html(el, '<div class="out"></div>');
  const $ = s => row.querySelector(s);
  let stats, s = { active: false, t: 0, cool: 0, buffer: 0, count: 0, hits: 0 }, history = [];
  function pick() {
    const w = WEAPONS[+$('.w').value].weapon, speed = w.interval / SWORD.chain;
    stats = { ...SWORD, damage: w.damage, interval: w.interval, ...Object.fromEntries(TIMES.map(k => [k, SWORD[k] * speed])) };
  }
  const click = () => { s.buffer = 0.3; };
  function step(dt) {
    s.cool = Math.max(0, s.cool - dt);
    s.buffer = Math.max(0, s.buffer - dt);
    if ($('.hold').checked) s.buffer = 0.3;
    if (s.buffer > 0 && s.cool <= 0) {   // start a swing: idle, or past the chain point of the last one
      s.active = true; s.t = 0; s.cool = stats.chain; s.buffer = 0; s.count++; s.hit = false;
      history.push({ start: performance.now() / 1000 });
      if (history.length > 6) history.shift();
    }
    if (s.active) {
      s.t += dt;
      if (!s.hit && s.t >= stats.activeStart) { s.hit = true; s.hits++; }
      if (s.t >= stats.duration) s.active = false;
    }
  }
  function draw() {
    g.clearRect(0, 0, W, H);
    // the hero from above, the blade sweeping through its arc
    const cx = 110, cy = 120, R = 70;
    g.fillStyle = '#1f2a20'; g.beginPath(); g.arc(cx, cy, R + 14, 0, 7); g.fill();
    const t = s.active ? s.t : stats.duration;
    let a;   // blade angle: pulled back in the wind-up, through the arc while it can hit, back in the recovery
    if (t < stats.activeStart) a = -1.2 - 0.6 * (t / stats.activeStart);
    else if (t < stats.activeEnd) a = -1.8 + 3.4 * ((t - stats.activeStart) / (stats.activeEnd - stats.activeStart));
    else a = 1.6 - 1.6 * Math.min(1, (t - stats.activeEnd) / (stats.duration - stats.activeEnd)) - 0.9 * Math.min(1, (t - stats.activeEnd) / (stats.duration - stats.activeEnd));
    if (!s.active) a = -0.9;
    const hot = s.active && s.t >= stats.activeStart && s.t <= stats.activeEnd;
    if (hot) { g.fillStyle = '#ffcf7a33'; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, -1.8, a); g.fill(); }
    g.strokeStyle = hot ? '#ffcf7a' : '#c8d0dc'; g.lineWidth = hot ? 5 : 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx + Math.cos(a) * 16, cy + Math.sin(a) * 16); g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.stroke();
    g.fillStyle = '#e6e9ef'; g.beginPath(); g.arc(cx, cy, 14, 0, 7); g.fill();
    g.fillStyle = '#0b0d12'; g.beginPath(); g.arc(cx + 8, cy, 3, 0, 7); g.fill();
    // the timeline, scaled so the greatsword fits
    const x0 = 230, x1 = W - 20, max = 1.0, X = v => x0 + v / max * (x1 - x0);
    const seg = (a0, a1, col, label) => { g.fillStyle = col; g.fillRect(X(a0), 40, X(a1) - X(a0), 34); g.fillStyle = '#0b0d12'; g.font = 'bold 11px ui-monospace, monospace';
      if (X(a1) - X(a0) > 40) g.fillText(label, X(a0) + 4, 61); };
    seg(0, stats.activeStart, '#51a9ff', 'wind-up');
    seg(stats.activeStart, stats.activeEnd, '#ffcf7a', 'HIT');
    seg(stats.activeEnd, stats.duration, '#4a5466', 'recovery');
    g.font = '11px ui-monospace, monospace';
    const mark = (v, col, label, y) => {
      g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.moveTo(X(v), 34); g.lineTo(X(v), y); g.stroke();
      g.fillStyle = col; g.fillText(label, Math.min(X(v) - 4, W - 6 - g.measureText(label).width), y + 13);
    };
    mark(stats.moveCancel, '#70d6aa', `${stats.moveCancel.toFixed(2)}s you may walk away`, 100);
    mark(stats.chain, '#ff8adf', `${stats.chain.toFixed(2)}s next swing may start`, 130);
    g.fillStyle = '#8a96a8';
    for (let v = 0; v <= max + 1e-9; v += 0.2) { g.fillRect(X(v), 76, 1, 5); g.fillText(v.toFixed(1) + 's', X(v) - 8, 92); }
    if (s.active) { g.fillStyle = '#fff'; g.fillRect(X(s.t) - 1, 30, 3, 50); }
    if (s.buffer > 0 && s.active) { g.fillStyle = '#ff8adf'; g.fillText('click saved for later!', x0, 25); }
    g.fillStyle = '#aab3c2'; g.font = '12px ui-monospace, monospace';
    g.fillText(`damage per hit: ${stats.damage}   swings per second: ${(1 / stats.interval).toFixed(1)}`, x0, 170);
    g.fillText(`damage per second: ${Math.round(stats.damage / stats.interval)}`, x0, 190);
  }
  pick();
  $('.w').onchange = pick;
  $('.go').onclick = click;
  c.onpointerdown = click;
  loop(el, dt => {
    step(dt * ($('.slow').checked ? 0.25 : 1));
    draw();
    out.innerHTML = `swings: <b>${s.count}</b> \u00B7 the blade connects <b>${stats.activeStart.toFixed(2)} s</b> after the click. Click again during the swing: the click is kept for 0.3 s and the next swing starts right at the pink line.`;
  });
}
