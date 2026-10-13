// Generated sound effects (Web Audio, no sample files): a sword whoosh, hits, kills,
// getting hurt, pickups, thrown fireballs / punches and burning, the player's body (jumps,
// falls, knock-downs, fluid deaths), travel, items and the bag, and the enemies' voices
// (voices.js). Footsteps are footsteps.js, the continuous sounds loops.js. The audio context
// lives in context.js.
import * as THREE from 'three';
import { camera } from '../render/scene.js';
import { onAudioStart } from './context.js';
import { voices } from './voices.js';

const NOISE = 3;   // seconds of noise: a layer may last up to NOISE - 0.5 s

let ctx = null, master = null, noiseBuf = null;
const last = {};
let combo = 0, comboAt = 0;

onAudioStart((ac, output) => {
  ctx = ac;
  master = ctx.createGain(); master.gain.value = 0.45;
  // a gentle limiter, so many hits at once do not clip
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -10; comp.ratio.value = 6;
  master.connect(comp).connect(output);
  noiseBuf = ctx.createBuffer(1, NOISE * ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
});

// building blocks: a gain envelope, noise and pitch-swept oscillators
function amp(t, attack, peak, decay, out) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  g.connect(out);
  return g;
}
function noise(t, dur, into) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf; s.connect(into);
  s.start(t, Math.random() * 0.5, dur + 0.05);
}
function filter(type, freq, q, into) {
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q; f.connect(into);
  return f;
}
function tone(type, f0, f1, t, dur, into) {
  const o = ctx.createOscillator();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  o.connect(into); o.start(t); o.stop(t + dur + 0.05);
}

const SOUNDS = {
  swing(t, out, p) {   // band-passed noise sweeping up and back down
    const f = filter('bandpass', 500 * p, 0.9, amp(t, 0.04, 1.3, 0.17, out));
    f.frequency.setValueAtTime(500 * p, t);
    f.frequency.exponentialRampToValueAtTime(2600 * p, t + 0.07);
    f.frequency.exponentialRampToValueAtTime(800 * p, t + 0.21);
    noise(t, 0.24, f);
  },
  hit(t, out, p) {     // a thump, a body of noise and a bright crack
    tone('sine', 180 * p, 50 * p, t, 0.12, amp(t, 0.002, 0.8, 0.12, out));
    noise(t, 0.1, filter('lowpass', 2200 * p, 0.7, amp(t, 0.002, 0.7, 0.08, out)));
    noise(t, 0.04, filter('highpass', 3500, 0.7, amp(t, 0.001, 0.3, 0.03, out)));
  },
  kill(t, out, p) {    // deeper and longer, with a crunch
    tone('sine', 120 * p, 32 * p, t, 0.35, amp(t, 0.002, 1, 0.35, out));
    noise(t, 0.32, filter('lowpass', 900 * p, 0.7, amp(t, 0.003, 0.8, 0.3, out)));
    noise(t, 0.2, filter('bandpass', 320 * p, 3, amp(t, 0.002, 0.7, 0.18, out)));
    noise(t, 0.05, filter('highpass', 3000, 0.7, amp(t, 0.001, 0.35, 0.04, out)));
  },
  hurt(t, out, p) {    // a dull grunt-like buzz over a thud
    tone('sawtooth', 260 * p, 120 * p, t, 0.18, filter('lowpass', 1000, 1, amp(t, 0.005, 0.3, 0.18, out)));
    tone('sine', 90 * p, 50 * p, t, 0.15, amp(t, 0.003, 0.7, 0.15, out));
    noise(t, 0.08, filter('lowpass', 700, 0.7, amp(t, 0.002, 0.4, 0.07, out)));
  },
  unlock(t, out, p) {   // rising chord: the red seal breaks
    for (const [i, hz] of [440, 554, 660, 880].entries()) {
      const at = t + i * .07;
      tone('triangle', hz * p, hz * p, at, .35, amp(at, .005, .25, .35, out));
    }
  },
  coin(t, out, p) {    // two quick bright notes; rapid pickups climb in pitch
    tone('triangle', 1568 * p, 1568 * p, t, 0.08, amp(t, 0.002, 0.32, 0.07, out));
    tone('triangle', 2093 * p, 2093 * p, t + 0.055, 0.2, amp(t + 0.055, 0.002, 0.3, 0.18, out));
  },
  fireball(t, out, p) {   // a breathy roar: low-passed noise swelling, with a low rumble
    const f = filter('lowpass', 600 * p, 1, amp(t, 0.06, 1, 0.35, out));
    f.frequency.setValueAtTime(400 * p, t); f.frequency.exponentialRampToValueAtTime(1800 * p, t + 0.12);
    f.frequency.exponentialRampToValueAtTime(500 * p, t + 0.4);
    noise(t, 0.42, f);
    tone('sawtooth', 90 * p, 55 * p, t, 0.3, filter('lowpass', 300, 1, amp(t, 0.03, 0.35, 0.28, out)));
  },
  whump(t, out, p) {      // a fireball bursting: a soft thud and crackle
    tone('sine', 140 * p, 45 * p, t, 0.2, amp(t, 0.003, 0.8, 0.2, out));
    noise(t, 0.3, filter('bandpass', 1400 * p, 0.6, amp(t, 0.005, 0.6, 0.28, out)));
  },
  sizzle(t, out, p) {     // burning: hissing high noise
    noise(t, 0.22, filter('highpass', 3000 * p, 0.7, amp(t, 0.01, 0.35, 0.2, out)));
  },
  zap(t, out, p) {        // the Triangle's punch: a falling buzzy chirp
    tone('square', 900 * p, 160 * p, t, 0.22, filter('lowpass', 2400, 2, amp(t, 0.004, 0.25, 0.22, out)));
    tone('sine', 300 * p, 90 * p, t, 0.18, amp(t, 0.004, 0.5, 0.18, out));
  },
  shatter(t, out, p) {    // the punch landing: a glassy ping over a thump
    tone('triangle', 1760 * p, 1320 * p, t, 0.25, amp(t, 0.002, 0.25, 0.25, out));
    tone('sine', 160 * p, 60 * p, t, 0.15, amp(t, 0.002, 0.7, 0.15, out));
    noise(t, 0.08, filter('highpass', 2500, 0.7, amp(t, 0.001, 0.35, 0.07, out)));
  },
  portal(t, out, p) {     // the town portal opening or taking you: a rising shimmer over a soft rush
    const f = filter('bandpass', 300 * p, 1.2, amp(t, 0.15, 0.6, 0.6, out));
    f.frequency.setValueAtTime(300 * p, t); f.frequency.exponentialRampToValueAtTime(2400 * p, t + 0.6);
    noise(t, 0.75, f);
    for (const [i, hz] of [523, 659, 784, 1047].entries()) {
      const at = t + i * 0.08;
      tone('sine', hz * p, hz * p * 1.02, at, 0.5, amp(at, 0.01, 0.12, 0.5, out));
    }
  },
  pickup(t, out, p) {
    tone('sine', 660 * p, 990 * p, t, 0.1, amp(t, 0.004, 0.3, 0.1, out));
  },
  drop(t, out, p) {      // a good weapon landing: a soft clink and a shimmering rising chime
    tone('triangle', 1200 * p, 900 * p, t, 0.06, amp(t, 0.001, 0.25, 0.06, out));
    for (const [i, hz] of [784, 988, 1175, 1568].entries()) {
      const at = t + 0.05 + i * 0.06;
      tone('sine', hz * p, hz * p * 1.005, at, 0.5, amp(at, 0.004, 0.16, 0.5, out));
    }
  },
  clink(t, out, p) {     // any other item landing: a small dull clink
    tone('triangle', 1400 * p, 1150 * p, t, 0.06, amp(t, 0.001, 0.2, 0.06, out));
    tone('sine', 2100 * p, 2000 * p, t + 0.01, 0.05, amp(t + 0.01, 0.001, 0.08, 0.05, out));
    noise(t, 0.03, filter('lowpass', 1200, 0.7, amp(t, 0.001, 0.15, 0.03, out)));
  },
  toss(t, out, p) {      // dropping an item from the bag: a little whoosh, then it lands
    sweep(t, 0.16, 500 * p, 1600 * p, 700 * p, 1.2, 0.35, out);
    tone('sine', 160 * p, 70 * p, t + 0.17, 0.08, amp(t + 0.17, 0.002, 0.4, 0.08, out));
  },

  // --- the player's body --------------------------------------------------------------------
  levelUp(t, out, p) {   // a bright rising arpeggio over a swelling sparkle
    for (const [i, hz] of [523, 659, 784, 1047, 1319].entries()) {
      const at = t + i * 0.07, last = i === 4;
      tone('triangle', hz * p, hz * p, at, last ? 0.9 : 0.35, amp(at, 0.005, 0.22, last ? 0.9 : 0.35, out));
      tone('sine', hz * 2 * p, hz * 2 * p, at, 0.3, amp(at, 0.005, 0.06, 0.3, out));
    }
    sweep(t, 0.9, 1000 * p, 6000 * p, 3000 * p, 1.5, 0.18, out, 0.3);
  },
  jump(t, out, p) {      // a short upward whoosh off a light scuff
    sweep(t, 0.14, 400 * p, 1500 * p, 900 * p, 1, 0.6, out, 0.02);
    noise(t, 0.04, filter('lowpass', 900, 0.7, amp(t, 0.002, 0.4, 0.035, out)));
  },
  knock(t, out, p) {     // knocked over: a whoosh and a grunt
    sweep(t, 0.3, 300 * p, 1200 * p, 300 * p, 1, 0.5, out, 0.05);
    tone('sawtooth', 220 * p, 110 * p, t, 0.15, filter('lowpass', 900, 1, amp(t, 0.005, 0.25, 0.15, out)));
  },
  thud(t, out, p) {      // the body hitting the ground (volume: how hard)
    tone('sine', 110 * p, 45 * p, t, 0.15, amp(t, 0.002, 0.9, 0.15, out));
    noise(t, 0.1, filter('lowpass', 600 * p, 0.7, amp(t, 0.002, 0.6, 0.09, out)));
  },
  getUp(t, out, p) {     // getting up: two soft rustles of cloth
    for (const at of [t, t + 0.22]) noise(at, 0.12, filter('bandpass', 1300 * p, 0.9, amp(at, 0.03, 0.4, 0.1, out)));
  },
  dizzy(t, out, p) {     // seeing stars after a hard landing: little twinkles going round
    for (let i = 0; i < 6; i++) {
      const at = t + i * 0.11, hz = [1568, 1976, 1760][i % 3] * p;
      tone('sine', hz, hz * 1.03, at, 0.12, amp(at, 0.004, 0.18, 0.12, out));
    }
  },
  fall(t, out, p) {      // a long fall: a whistle dropping away over rushing air
    tone('sine', 1400 * p, 300 * p, t, 1.3, amp(t, 0.15, 0.08, 1.15, out));
    sweep(t, 1.4, 2000 * p, 2200 * p, 500 * p, 0.8, 0.25, out, 0.3);
  },
  splash(t, out, p) {    // into the water: a big splash and gloops of air going up
    tone('sine', 120 * p, 50 * p, t, 0.2, amp(t, 0.002, 0.6, 0.2, out));
    sweep(t, 0.7, 4000 * p, 1500 * p, 400 * p, 0.6, 0.8, out, 0.005, 'lowpass');
    for (let i = 0; i < 7; i++) {
      const at = t + 0.2 + i * 0.12 + Math.random() * 0.06, hz = (300 + Math.random() * 300) * p;
      tone('sine', hz, hz * 2.2, at, 0.05, amp(at, 0.003, 0.18 * (1 - i / 9), 0.05, out));
    }
  },
  burn(t, out, p) {      // into the lava: a roaring whoomph and a long sizzle
    sweep(t, 0.8, 300 * p, 1500 * p, 250 * p, 1, 0.9, out, 0.04, 'lowpass');
    tone('sawtooth', 55 * p, 40 * p, t, 0.7, filter('lowpass', 200, 1, amp(t, 0.03, 0.5, 0.65, out)));
    noise(t + 0.1, 1.1, filter('highpass', 4000 * p, 0.7, amp(t + 0.1, 0.1, 0.35, 1, out)));
  },
  dissolve(t, out, p) {  // into the acid: fizzing, then sinking gloops
    for (let i = 0; i < 26; i++) {
      const at = t + Math.random() * 1.1;
      noise(at, 0.02, filter('bandpass', (2500 + Math.random() * 4000) * p, 4, amp(at, 0.001, 0.25, 0.015, out)));
    }
    noise(t, 1.1, filter('highpass', 3000 * p, 0.7, amp(t, 0.05, 0.25, 1, out)));
    for (let i = 0; i < 4; i++) {
      const at = t + 0.3 + i * 0.2, hz = (500 - i * 80) * p;
      tone('sine', hz, hz * 0.6, at, 0.08, amp(at, 0.003, 0.15, 0.08, out));
    }
  },
  death(t, out, p) {     // a low, falling tone; then a soft shimmer: back at the entry
    tone('sawtooth', 330 * p, 80 * p, t, 0.6, filter('lowpass', 900, 1, amp(t, 0.01, 0.3, 0.6, out)));
    tone('sine', 165 * p, 40 * p, t, 0.6, amp(t, 0.01, 0.4, 0.6, out));
    for (const [i, hz] of [523, 784, 1047].entries()) {
      const at = t + 0.6 + i * 0.06;
      tone('sine', hz * p, hz * p, at, 0.6, amp(at, 0.05, 0.1, 0.55, out));
    }
  },

  // --- travel ---------------------------------------------------------------------------------
  gate(t, out, p) {      // through a side portal: an airy whoosh with a soft shimmer
    sweep(t, 0.6, 600 * p, 2400 * p, 900 * p, 1, 0.45, out, 0.1);
    tone('sine', 880 * p, 1320 * p, t, 0.5, amp(t, 0.1, 0.07, 0.4, out));
  },
  wellDown(t, out, p) {  // down the well: a swirl sinking away
    sweep(t, 1, 2000 * p, 1200 * p, 250 * p, 1.4, 0.45, out, 0.08);
    tone('triangle', 660 * p, 180 * p, t, 0.9, amp(t, 0.05, 0.12, 0.85, out));
  },
  ringUp(t, out, p) {    // up through the ring: a swirl rising, with sparkles
    sweep(t, 1, 300 * p, 1200 * p, 2600 * p, 1.4, 0.4, out, 0.15);
    tone('triangle', 330 * p, 990 * p, t, 0.9, amp(t, 0.1, 0.12, 0.8, out));
    for (let i = 0; i < 5; i++) {
      const at = t + 0.3 + i * 0.1, hz = (1568 + i * 220) * p;
      tone('sine', hz, hz, at, 0.15, amp(at, 0.004, 0.06, 0.15, out));
    }
  },
  cloud(t, out, p) {     // the cloud bridge puffing out of the gate
    noise(t, 0.6, filter('lowpass', 900 * p, 0.7, amp(t, 0.08, 0.45, 0.5, out)));
  },
  castStart(t, out, p) { // reading the scroll: a soft two-note chime
    for (const [i, hz] of [523, 784].entries()) {
      const at = t + i * 0.08;
      tone('sine', hz * p, hz * p, at, 0.35, amp(at, 0.005, 0.15, 0.35, out));
    }
  },
  fizzle(t, out, p) {    // a cast or charge broken off: a crackle falling away
    sweep(t, 0.3, 1500 * p, 900 * p, 300 * p, 2, 0.35, out, 0.005);
    tone('sine', 660 * p, 330 * p, t, 0.25, amp(t, 0.005, 0.12, 0.25, out));
  },

  // --- items and the bag ----------------------------------------------------------------------
  equip(t, out, p) {     // a blade in hand: a metallic shing
    sweep(t, 0.18, 3000 * p, 8000 * p, 6000 * p, 1.5, 0.25, out, 0.01, 'highpass');
    tone('triangle', 1760 * p, 1760 * p, t + 0.03, 0.35, amp(t + 0.03, 0.002, 0.12, 0.35, out));
    tone('sine', 2637 * p, 2637 * p, t + 0.03, 0.25, amp(t + 0.03, 0.002, 0.06, 0.25, out));
  },
  bagOpen(t, out, p) {   // leather flap and a rummage, rising
    noise(t, 0.08, filter('bandpass', 900 * p, 1, amp(t, 0.01, 0.6, 0.07, out)));
    noise(t + 0.07, 0.1, filter('bandpass', 1500 * p, 1, amp(t + 0.07, 0.01, 0.45, 0.09, out)));
  },
  bagClose(t, out, p) {  // and back down, with a soft thump
    noise(t, 0.08, filter('bandpass', 1300 * p, 1, amp(t, 0.01, 0.2, 0.07, out)));
    tone('sine', 140 * p, 80 * p, t + 0.06, 0.06, amp(t + 0.06, 0.002, 0.3, 0.06, out));
  },
  use(t, out, p) {       // using a quick bar slot: a soft pop
    tone('sine', 900 * p, 600 * p, t, 0.05, amp(t, 0.002, 0.2, 0.05, out));
  },
  drink(t, out, p) {     // a health potion: three gulps, then a warm rising glow
    for (let i = 0; i < 3; i++) {
      const at = t + i * 0.13, hz = (260 + i * 30) * p;
      tone('sine', hz, hz * 0.55, at, 0.09, amp(at, 0.004, 0.35, 0.09, out));
      noise(at, 0.05, filter('lowpass', 700 * p, 1, amp(at, 0.003, 0.15, 0.05, out)));
    }
    for (const [i, hz] of [392, 523, 659].entries()) {
      const at = t + 0.38 + i * 0.05;
      tone('sine', hz * p, hz * p * 1.01, at, 0.45, amp(at, 0.03, 0.07, 0.42, out));
    }
  },
  chest(t, out, p) {     // a chest lid: a creaking hinge, the lid knocking back, a glint of treasure
    sweep(t, 0.35, 500 * p, 900 * p, 650 * p, 9, 0.25, out, 0.05);
    tone('sawtooth', 110 * p, 140 * p, t, 0.3, filter('bandpass', 700 * p, 6, amp(t, 0.05, 0.12, 0.28, out)));
    tone('sine', 150 * p, 70 * p, t + 0.33, 0.12, amp(t + 0.33, 0.003, 0.6, 0.12, out));
    noise(t + 0.33, 0.08, filter('lowpass', 900 * p, 1, amp(t + 0.33, 0.003, 0.4, 0.08, out)));
    for (const [i, hz] of [1047, 1319, 1568, 2093].entries()) {
      const at = t + 0.42 + i * 0.07;
      tone('sine', hz * p, hz * p, at, 0.3, amp(at, 0.004, 0.08, 0.3, out));
    }
  },
};

// a band of noise sweeping f0 -> f1 -> f2 over dur (q: band width); attack: swell time;
// type: the filter (bandpass by default)
function sweep(t, dur, f0, f1, f2, q, level, out, attack = 0.02, type = 'bandpass') {
  const f = filter(type, f0, q, amp(t, attack, level, Math.max(0.02, dur - attack), out));
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.35);
  f.frequency.exponentialRampToValueAtTime(f2, t + dur);
  noise(t, dur, f);
}
Object.assign(SOUNDS, voices({ amp, noise, filter, tone, sweep }));
export const SOUND_NAMES = Object.keys(SOUNDS);

// checks: render a sound offline, returns its peak level (0 = silent)
export async function renderSfx(name, pitch = 1) {
  const live = ctx, liveNoise = noiseBuf;
  const off = new OfflineAudioContext(1, 3 * 44100, 44100);
  ctx = off;
  noiseBuf = off.createBuffer(1, NOISE * 44100, 44100);
  noiseBuf.getChannelData(0).forEach((_, i, d) => { d[i] = Math.random() * 2 - 1; });
  try { SOUNDS[name](0.005, off.destination, pitch); } finally { ctx = live; noiseBuf = liveNoise; }
  const data = (await off.startRendering()).getChannelData(0);
  return data.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
}

const ndc = new THREE.Vector3();
// sfx(name, { at: {x,y,z} (pans by screen position), pitch, volume })
export function sfx(name, { at = null, pitch = 1, volume = 1 } = {}) {
  if (!ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  if (name === 'coin') {
    combo = now - comboAt < 0.4 ? combo + 1 : 0; comboAt = now;
    pitch *= 1 + Math.min(combo, 10) * 0.035;
  } else if (now - (last[name] ?? -1) < 0.03) return;   // the same sound twice in a frame
  last[name] = now;
  let out = ctx.createGain();
  out.gain.value = volume;
  if (at && ctx.createStereoPanner) {
    const pan = ctx.createStereoPanner();
    ndc.set(at.x, at.y, at.z).project(camera);
    pan.pan.value = Math.max(-1, Math.min(1, ndc.x * 0.6));
    out.connect(pan).connect(master);
  } else out.connect(master);
  SOUNDS[name](now + 0.005, out, pitch * (0.95 + Math.random() * 0.1));
}
