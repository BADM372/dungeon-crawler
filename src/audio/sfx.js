// Generated sound effects (Web Audio, no sample files): a sword whoosh, hits, kills,
// getting hurt, pickups, and thrown fireballs / punches and burning. The audio context starts on the first key or click, as browsers
// require. M toggles mute (remembered).
import * as THREE from 'three';
import { camera } from '../render/scene.js';

let ctx = null, master = null, noiseBuf = null;
let muted = localStorage.getItem('crawler.muted') === '1';
const last = {};
let combo = 0, comboAt = 0;

function start() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.45;
    // a gentle limiter, so many hits at once do not clip
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10; comp.ratio.value = 6;
    master.connect(comp).connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
}
addEventListener('pointerdown', start, true);
addEventListener('keydown', start, true);

export const isMuted = () => muted;
export function toggleMute() {
  muted = !muted;
  localStorage.setItem('crawler.muted', muted ? '1' : '0');
  if (master) master.gain.setTargetAtTime(muted ? 0 : 0.45, ctx.currentTime, 0.02);
  return muted;
}

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
};

// checks: render a sound offline, returns its peak level (0 = silent)
export async function renderSfx(name, pitch = 1) {
  const live = ctx, liveNoise = noiseBuf;
  const off = new OfflineAudioContext(1, 44100, 44100);
  ctx = off;
  noiseBuf = off.createBuffer(1, 44100, 44100);
  noiseBuf.getChannelData(0).forEach((_, i, d) => { d[i] = Math.random() * 2 - 1; });
  try { SOUNDS[name](0.005, off.destination, pitch); } finally { ctx = live; noiseBuf = liveNoise; }
  const data = (await off.startRendering()).getChannelData(0);
  return data.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
}

const ndc = new THREE.Vector3();
// sfx(name, { at: {x,y,z} (pans by screen position), pitch, volume })
export function sfx(name, { at = null, pitch = 1, volume = 1 } = {}) {
  if (!ctx || muted || ctx.state !== 'running') return;
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
