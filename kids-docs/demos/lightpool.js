// The light pool (src/render/lightpool.js): a cave full of glowing things, but only the 8
// nearest to the hero really shine. Changing how many lights there are would make three.js
// rebuild every lit material; a fixed pool of 8 that moves around never does.
import { mulberry32 } from '../../src/core/util.js';
import { canvas, loop, html, t as tr } from '../deck.js';

const POOL = 8;
const KINDS = [['#ff6a1a', 'lava'], ['#7dff3a', 'glowing mushroom'], ['#8fd8ff', 'crystal'], ['#ffc94a', 'portal'], ['#ffb347', 'lamp']];

export default function mount(el) {
  const W = 640, H = 300, { g, c, at } = canvas(el, W, H);
  const row = html(el, `<div class="row"><label><input type="checkbox" class="pool" checked> ${tr('use the pool of 8', 'den 8er-Vorrat benutzen')}</label>
    <span class="muted small">${tr('move your mouse (or finger) over the cave', 'beweg die Maus (oder den Finger) über die Höhle')}</span></div>`);
  const out = html(el, '<div class="out"></div>');
  const R = mulberry32(42), lamps = Array.from({ length: 34 }, () => ({ x: 20 + R() * (W - 40), y: 20 + R() * (H - 40), k: KINDS[Math.floor(R() * KINDS.length)] }));
  const hero = { x: W / 2, y: H / 2 }, aim = { x: W / 2, y: H / 2 };
  let changes = 0, lastCount = -1;
  c.onpointermove = e => { [aim.x, aim.y] = at(e); };
  loop(el, dt => {
    hero.x += (aim.x - hero.x) * Math.min(1, dt * 6); hero.y += (aim.y - hero.y) * Math.min(1, dt * 6);
    const pool = row.querySelector('.pool').checked;
    const sorted = lamps.map(l => ({ l, d: Math.hypot(l.x - hero.x, l.y - hero.y) })).sort((a, b) => a.d - b.d);
    // without the pool: every light within reach counts, and that number keeps changing
    const lit = pool ? sorted.slice(0, POOL) : sorted.filter(s => s.d < 170);
    if (!pool && lit.length !== lastCount) { changes++; lastCount = lit.length; }
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#07060a'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (const { l } of lit) {
      const grd = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, 90);
      grd.addColorStop(0, l.k[0] + '88'); grd.addColorStop(1, l.k[0] + '00');
      g.fillStyle = grd; g.fillRect(l.x - 90, l.y - 90, 180, 180);
    }
    g.globalCompositeOperation = 'source-over';
    if (pool) lit.forEach(({ l }, i) => {
      g.strokeStyle = '#ffffff22'; g.beginPath(); g.moveTo(hero.x, hero.y); g.lineTo(l.x, l.y); g.stroke();
      g.fillStyle = '#ffffffcc'; g.font = '10px ui-monospace, monospace'; g.fillText(String(i + 1), l.x + 6, l.y - 6);
    });
    for (const l of lamps) { const on = lit.some(s => s.l === l); g.fillStyle = on ? l.k[0] : '#3a3540'; g.beginPath(); g.arc(l.x, l.y, on ? 5 : 3, 0, 7); g.fill(); }
    g.fillStyle = '#e6e9ef'; g.beginPath(); g.arc(hero.x, hero.y, 8, 0, 7); g.fill();
    out.innerHTML = pool
      ? tr(`<b>${lamps.length}</b> glowing things in this cave, <b>${POOL}</b> lights shining: always the 8 closest to you. The number never changes, so nothing has to be rebuilt.`,
        `<b>${lamps.length}</b> leuchtende Dinge in dieser Höhle, <b>${POOL}</b> Lichter leuchten: immer die 8, die dir am nächsten sind. Die Zahl ändert sich nie, also muss nichts neu gebaut werden.`)
      : tr(`<b>${lit.length}</b> lights near you right now. The number changed <b>${changes}</b> times: in the real game, each change would rebuild every material, and the game would stutter.`,
        `<b>${lit.length}</b> Lichter gerade in deiner Nähe. Die Zahl hat sich <b>${changes}</b>-mal geändert: im echten Spiel würde jede Änderung alle Materialien neu bauen, und das Spiel würde ruckeln.`);
  });
}
