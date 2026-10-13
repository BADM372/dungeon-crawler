// Ordered dithering, the way cubes fade in and out (src/render/fade.js): every pixel compares
// the fade amount with its number from a 4x4 table (a Bayer matrix). Below: drawn, above: not.
// The cube being left uses the opposite test, so the two together cover every pixel exactly once.
import { canvas, loop, html, t as tr } from '../deck.js';

const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];   // the same table as in fade.js

export default function mount(el) {
  const W = 640, H = 300, { g } = canvas(el, W, H);
  const row = html(el, `<div class="row"><label>${tr('fade', 'Überblendung')} <input type="range" class="f" min="0" max="1" step="0.01" value="0.4"> <b class="fv">0.40</b></label>
    <label>${tr('pixel size', 'Pixelgröße')} <input type="range" class="px" min="1" max="12" value="6"></label><button class="play">${tr('Play the trip', 'Reise abspielen')}</button></div>`);
  const out = html(el, '<div class="out"></div>');
  const $ = s => row.querySelector(s);
  const load = src => new Promise(r => { const im = new Image(); im.onload = () => r(im); im.src = src; });
  let A = null, Bimg = null, playing = false, t = 0;
  const grab = im => { const cv = document.createElement('canvas'); cv.width = 440; cv.height = 275; cv.getContext('2d').drawImage(im, 0, 0, 440, 275); return cv.getContext('2d').getImageData(0, 0, 440, 275); };
  Promise.all([load(new URL('../img/town.jpg', import.meta.url)), load(new URL('../img/sky-islands.jpg', import.meta.url))]).then(([a, b]) => { A = grab(a); Bimg = grab(b); });
  const pic = new ImageData(440, 275);
  function draw() {
    const fade = +$('.f').value, P = +$('.px').value;
    $('.fv').textContent = fade.toFixed(2);
    g.clearRect(0, 0, W, H);
    if (A) {
      // each block of P×P screen pixels counts as one pixel for the pattern
      for (let y = 0; y < 275; y++) for (let x = 0; x < 440; x++) {
        const qx = Math.floor(x / P) % 4, qy = Math.floor(y / P) % 4, threshold = (B[qx + qy * 4] + 0.5) / 16;
        const src = threshold < fade ? Bimg : A, i = (y * 440 + x) * 4;
        pic.data[i] = src.data[i]; pic.data[i + 1] = src.data[i + 1]; pic.data[i + 2] = src.data[i + 2]; pic.data[i + 3] = 255;
      }
      createImageBitmap(pic).then(bm => g.drawImage(bm, 0, 12, 440, 275));
    }
    // the 4x4 table: which numbers are below the fade right now
    const S = 38, ox = 470, oy = 40;
    g.font = 'bold 13px ui-monospace, monospace'; g.textAlign = 'center';
    for (let i = 0; i < 16; i++) {
      const x = ox + (i % 4) * S, y = oy + Math.floor(i / 4) * S, on = (B[i] + 0.5) / 16 < fade;
      g.fillStyle = on ? '#5fd3ff' : '#2a2f3a'; g.fillRect(x, y, S - 3, S - 3);
      g.fillStyle = on ? '#0b0d12' : '#aab3c2'; g.fillText(String(B[i]), x + S / 2 - 1, y + S / 2 + 4);
    }
    g.textAlign = 'left'; g.fillStyle = '#8a96a8'; g.font = '11px ui-monospace, monospace';
    g.fillText(tr('the pattern (repeats', 'das Muster (wiederholt'), ox, oy + 4 * S + 18); g.fillText(tr('across the screen)', 'sich übers Bild)'), ox, oy + 4 * S + 32);
    g.fillText(tr('blue: new cube', 'blau: neuer Würfel'), ox, oy + 4 * S + 54); g.fillText(tr('grey: old cube', 'grau: alter Würfel'), ox, oy + 4 * S + 68);
    const n = B.filter(v => (v + 0.5) / 16 < fade).length;
    out.innerHTML = tr(`<b>${n}</b> of 16 pixels in every 4\u00D74 square show the new cube, <b>${16 - n}</b> the old one. No pixel is see-through, and none is drawn twice.`,
      `<b>${n}</b> von 16 Pixeln in jedem 4\u00D74-Quadrat zeigen den neuen Würfel, <b>${16 - n}</b> den alten. Kein Pixel ist durchsichtig, und keins wird doppelt gemalt.`);
  }
  row.querySelectorAll('input').forEach(i => i.oninput = () => { playing = false; draw(); });
  $('.play').onclick = () => { playing = true; t = 0; };
  let lastF = -1, lastP = -1, ready = false;
  loop(el, dt => {
    if (playing) { t += dt / 1.2; $('.f').value = Math.min(1, t); if (t >= 1) playing = false; }
    const f = +$('.f').value, P = +$('.px').value;
    if (f !== lastF || P !== lastP || (A && !ready)) { lastF = f; lastP = P; ready = !!A; draw(); }
  });
}
