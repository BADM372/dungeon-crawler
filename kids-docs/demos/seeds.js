// Seeded randomness with the game's own functions (src/core/util.js, src/world/coords.js).
//   dice:  two seeded rows of dice (same seed, same dice) and a Math.random() row
//   cubes: every cube's own random stream, mulberry32(hash32(seed ^ hashKey(key))), like wfc.rng
import { mulberry32, hash32 } from '../../src/core/util.js';
import { hashKey } from '../../src/world/coords.js';
import { html, t as tr } from '../deck.js';

const FACES = ['\u2680', '\u2681', '\u2682', '\u2683', '\u2684', '\u2685'];
const die = n => `<span title="${n + 1}" style="font-size:38px;line-height:1;color:${['#e6e9ef', '#ffcf7a', '#5fd3ff', '#61dc6b', '#b98cff', '#ff8a7a'][n]}">${FACES[n]}</span>`;

export default function mount(el) {
  if (el.dataset.mode === 'cubes') return cubes(el);
  const box = html(el, `<div>
    <div class="row"><label>seed A <input type="number" class="a" value="123"></label><span class="da"></span></div>
    <div class="row"><label>seed B <input type="number" class="b" value="123"></label><span class="db"></span></div>
    <div class="row"><label style="min-width:9.5em">Math.random()</label><span class="dr"></span></div>
    <div class="row"><button class="roll">${tr('Roll all three again!', 'Alle drei nochmal würfeln!')}</button></div></div>`);
  const out = html(el, '<div class="out"></div>');
  let rolls = 0;
  const row = (rng) => Array.from({ length: 10 }, () => die(Math.floor(rng() * 6))).join(' ');
  function roll() {
    rolls++;
    const a = +box.querySelector('.a').value | 0, b = +box.querySelector('.b').value | 0;
    box.querySelector('.da').innerHTML = row(mulberry32(a));
    box.querySelector('.db').innerHTML = row(mulberry32(b));
    box.querySelector('.dr').innerHTML = row(Math.random);
    out.innerHTML = rolls > 1
      ? tr(`Rolled ${rolls} times. The seeded rows never change. ${a === b ? 'A and B have the same seed, so they match. Change seed B!' : 'A and B have different seeds, so they differ.'}`,
        `${rolls}-mal gewürfelt. Die Reihen mit Seed ändern sich nie. ${a === b ? 'A und B haben denselben Seed, also sind sie gleich. Ändere Seed B!' : 'A und B haben verschiedene Seeds, also sind sie verschieden.'}`)
      : tr('Press the button a few times. Then change one of the seeds.', 'Drück ein paarmal auf den Knopf. Dann ändere einen der Seeds.');
  }
  box.querySelector('.roll').onclick = roll;
  box.querySelectorAll('input').forEach(i => i.oninput = roll);
  roll();
}

function cubes(el) {
  const box = html(el, `<div><div class="row"><label>${tr('world seed', 'Welt-Seed')} <input type="number" value="123"></label>
    <span class="muted small">${tr('each square is one cube of depth 1; click one', 'jedes Feld ist ein Würfel in Tiefe 1; klick eins an')}</span></div><div class="grid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:8px"></div></div>`);
  const out = html(el, '<div class="out">&nbsp;</div>');
  const grid = box.querySelector('.grid'), input = box.querySelector('input');
  let pick = '0,-1,0';
  function draw() {
    const seed = +input.value | 0;
    const rng = k => mulberry32(hash32(seed ^ hashKey(k)));   // the same as WFC.rng in src/world/wfc.js
    grid.innerHTML = '';
    for (let z = -2; z <= 2; z++) for (let x = -3; x <= 3; x++) {
      const k = `${x},-1,${z}`, v = rng(k)();
      const b = document.createElement('button');
      b.style.cssText = `padding:6px 2px;background:hsl(${Math.round(v * 360)} 45% 32%);border-color:${k === pick ? '#ffcf7a' : '#0006'};font-size:11px`;
      b.innerHTML = `${x},${z}<br><b style="font-size:13px">${v.toFixed(3)}</b>`;
      b.onclick = () => { pick = k; draw(); };
      grid.append(b);
    }
    const r = rng(pick);
    out.innerHTML = `${tr('cube', 'Würfel')} <b>${pick}</b>: hash32(${seed} ^ hashKey("${pick}")) = <b>${hash32(seed ^ hashKey(pick))}</b>\n${tr('its first five rolls', 'seine ersten fünf Würfe')}: <b>${Array.from({ length: 5 }, () => r().toFixed(3)).join('  ')}</b>`;
  }
  input.oninput = draw;
  draw();
}
