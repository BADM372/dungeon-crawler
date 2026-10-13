// Sounds from math. Several recipes copied from src/audio/sfx.js (tones that slide in pitch,
// noise, filters and volume envelopes), played on a button, with an oscilloscope showing the
// wave and a list of the recipe's layers.
import { canvas, loop, html, t as tr } from '../deck.js';

let ac = null, master = null, scope = null, noiseBuf = null;
function audio() {
  if (!ac) {
    ac = new AudioContext();
    master = ac.createGain(); master.gain.value = 0.45;
    scope = ac.createAnalyser(); scope.fftSize = 2048;
    master.connect(scope).connect(ac.destination);
    noiseBuf = ac.createBuffer(1, 3 * ac.sampleRate, ac.sampleRate);
    noiseBuf.getChannelData(0).forEach((_, i, d) => { d[i] = Math.random() * 2 - 1; });
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
// the building blocks, as in sfx.js
function amp(t, attack, peak, decay, out) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay); g.connect(out); return g;
}
function noise(t, dur, into) { const s = ac.createBufferSource(); s.buffer = noiseBuf; s.connect(into); s.start(t, Math.random() * 0.5, dur + 0.05); }
function filter(type, freq, q, into) { const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; f.connect(into); return f; }
function tone(type, f0, f1, t, dur, into) {
  const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  o.connect(into); o.start(t); o.stop(t + dur + 0.05);
}
const SOUNDS = {
  swing: { layers: ['hiss (noise) through a band-pass filter that sweeps from 500 up to 2600 Hz and back down to 800'],
    de: ['Zischen (Rauschen) durch einen Bandpass-Filter, der von 500 hoch auf 2600 Hz und zurück auf 800 gleitet'], play(t, out, p) {
    const f = filter('bandpass', 500 * p, 0.9, amp(t, 0.04, 1.3, 0.17, out));
    f.frequency.setValueAtTime(500 * p, t); f.frequency.exponentialRampToValueAtTime(2600 * p, t + 0.07); f.frequency.exponentialRampToValueAtTime(800 * p, t + 0.21);
    noise(t, 0.24, f);
  } },
  hit: { layers: ['a thump: a sine tone falling from 180 to 50 Hz', 'a body: muffled noise (low-pass)', 'a crack: a tiny burst of thin noise (high-pass)'],
    de: ['ein Wumms: ein Sinuston, der von 180 auf 50 Hz fällt', 'ein Körper: dumpfes Rauschen (Tiefpass)', 'ein Knacks: ein winziger Stoß dünnes Rauschen (Hochpass)'], play(t, out, p) {
    tone('sine', 180 * p, 50 * p, t, 0.12, amp(t, 0.002, 0.8, 0.12, out));
    noise(t, 0.1, filter('lowpass', 2200 * p, 0.7, amp(t, 0.002, 0.7, 0.08, out)));
    noise(t, 0.04, filter('highpass', 3500, 0.7, amp(t, 0.001, 0.3, 0.03, out)));
  } },
  kill: { layers: ['a deeper, longer thump: 120 down to 32 Hz', 'muffled noise', 'a crunch: noise through a narrow band-pass', 'a crack'],
    de: ['ein tieferer, längerer Wumms: 120 runter auf 32 Hz', 'dumpfes Rauschen', 'ein Knirschen: Rauschen durch einen schmalen Bandpass', 'ein Knacks'], play(t, out, p) {
    tone('sine', 120 * p, 32 * p, t, 0.35, amp(t, 0.002, 1, 0.35, out));
    noise(t, 0.32, filter('lowpass', 900 * p, 0.7, amp(t, 0.003, 0.8, 0.3, out)));
    noise(t, 0.2, filter('bandpass', 320 * p, 3, amp(t, 0.002, 0.7, 0.18, out)));
    noise(t, 0.05, filter('highpass', 3000, 0.7, amp(t, 0.001, 0.35, 0.04, out)));
  } },
  coin: { layers: ['two quick bright notes (triangle waves): G at 1568 Hz, then C at 2093 Hz'],
    de: ['zwei schnelle, helle Töne (Dreieckswellen): G mit 1568 Hz, dann C mit 2093 Hz'], play(t, out, p) {
    tone('triangle', 1568 * p, 1568 * p, t, 0.08, amp(t, 0.002, 0.32, 0.07, out));
    tone('triangle', 2093 * p, 2093 * p, t + 0.055, 0.2, amp(t + 0.055, 0.002, 0.3, 0.18, out));
  } },
  unlock: { layers: ['four notes one after the other, A C# E A: a rising chord'],
    de: ['vier Töne nacheinander, A Cis E A: ein steigender Akkord'], play(t, out, p) {
    for (const [i, hz] of [440, 554, 660, 880].entries()) { const at = t + i * 0.07; tone('triangle', hz * p, hz * p, at, 0.35, amp(at, 0.005, 0.25, 0.35, out)); }
  } },
  zap: { layers: ['a buzzy square wave falling from 900 to 160 Hz', 'a sine falling underneath'],
    de: ['eine summende Rechteckwelle, die von 900 auf 160 Hz fällt', 'ein Sinus, der darunter fällt'], play(t, out, p) {
    tone('square', 900 * p, 160 * p, t, 0.22, filter('lowpass', 2400, 2, amp(t, 0.004, 0.25, 0.22, out)));
    tone('sine', 300 * p, 90 * p, t, 0.18, amp(t, 0.004, 0.5, 0.18, out));
  } },
  fireball: { layers: ['a breathy roar: noise through a low-pass filter that opens and closes', 'a low sawtooth rumble'],
    de: ['ein hauchiges Brüllen: Rauschen durch einen Tiefpass, der auf- und zugeht', 'ein tiefes Sägezahn-Grollen'], play(t, out, p) {
    const f = filter('lowpass', 600 * p, 1, amp(t, 0.06, 1, 0.35, out));
    f.frequency.setValueAtTime(400 * p, t); f.frequency.exponentialRampToValueAtTime(1800 * p, t + 0.12); f.frequency.exponentialRampToValueAtTime(500 * p, t + 0.4);
    noise(t, 0.42, f);
    tone('sawtooth', 90 * p, 55 * p, t, 0.3, filter('lowpass', 300, 1, amp(t, 0.03, 0.35, 0.28, out)));
  } },
};

export default function mount(el) {
  const W = 640, H = 150, { g } = canvas(el, W, H);
  const row = html(el, `<div><div class="row">${Object.keys(SOUNDS).map(n => `<button data-s="${n}">${n}</button>`).join('')}</div>
    <div class="row"><label>${tr('pitch', 'Tonhöhe')} <input type="range" class="p" min="0.5" max="2" step="0.05" value="1"> <b class="pv">1.00</b></label></div></div>`);
  const out = html(el, `<div class="out">${tr('Press a sound. (Turn your volume down a bit first!)', 'Drück auf ein Geräusch. (Mach vorher den Ton etwas leiser!)')}</div>`);
  const pitch = () => +row.querySelector('.p').value;
  row.querySelector('.p').oninput = () => { row.querySelector('.pv').textContent = pitch().toFixed(2); };
  row.querySelectorAll('[data-s]').forEach(b => b.onclick = () => {
    audio();
    const s = SOUNDS[b.dataset.s];
    s.play(ac.currentTime + 0.005, master, pitch());
    out.innerHTML = `<b>${b.dataset.s}</b> ${tr('is made of', 'besteht aus')}:\n${tr(s.layers, s.de).map(l => '  \u2022 ' + l).join('\n')}`;
  });
  const data = new Uint8Array(2048);
  loop(el, () => {
    g.fillStyle = '#070910'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#2a2f3a'; g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
    if (!scope) return;
    scope.getByteTimeDomainData(data);
    g.strokeStyle = '#ff8a2a'; g.lineWidth = 2; g.beginPath();
    for (let i = 0; i < 1024; i++) { const x = i / 1024 * W, y = H / 2 + (data[i] - 128) / 128 * H * 0.9; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  });
}
