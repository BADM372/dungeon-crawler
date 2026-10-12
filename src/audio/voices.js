// The enemies' voices, stylized like the other sound effects: per species an `alert` (it
// noticed you), a `windup` (an attack is coming) and a `death` (on top of the shared kill
// thump). Registered with sfx.js as `<species>_<kind>`; pitch: the kind's profile pitch.
// h: sfx.js's building blocks (amp, noise, filter, tone, sweep).
export const VOICE_KINDS = ['alert', 'windup', 'death'];

export function voices({ amp, noise, filter, tone, sweep }) {
  // n quick band-passed clicks: chitter
  const clicks = (t, n, gap, f, level, out) => {
    for (let i = 0; i < n; i++) {
      const at = t + i * gap * (0.8 + Math.random() * 0.4);
      noise(at, 0.015, filter('bandpass', f * (0.85 + Math.random() * 0.3), 6, amp(at, 0.001, level, 0.012, out)));
    }
  };
  // a sawtooth bending f0 -> f1 -> f2 through a band: growls, yowls and groans
  const bend = (t, dur, f0, f1, f2, band, level, out) => {
    const o = filter('bandpass', band, 2, amp(t, 0.02, level, dur - 0.02, out));
    const s = o.context.createOscillator();
    s.type = 'sawtooth';
    s.frequency.setValueAtTime(f0, t);
    s.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.4);
    s.frequency.exponentialRampToValueAtTime(f2, t + dur);
    s.connect(o); s.start(t); s.stop(t + dur + 0.05);
  };
  const gloops = (t, n, lo, hi, spread, level, out, up = true) => {
    for (let i = 0; i < n; i++) {
      const at = t + i * spread, hz = lo + Math.random() * (hi - lo);
      tone('sine', hz, up ? hz * 2 : hz * 0.5, at, 0.06, amp(at, 0.003, level, 0.06, out));
    }
  };

  const V = {
    spider: {   // dry chitters and a hiss
      alert: (t, out, p) => clicks(t, 6, 0.035, 4200 * p, 0.7, out),
      windup: (t, out, p) => { noise(t, 0.3, filter('highpass', 4000 * p, 0.7, amp(t, 0.1, 0.25, 0.2, out))); clicks(t, 3, 0.04, 3500 * p, 0.25, out); },
      death: (t, out, p) => { tone('square', 1800 * p, 600 * p, t, 0.2, filter('lowpass', 3000, 1, amp(t, 0.003, 0.15, 0.2, out))); clicks(t + 0.05, 8, 0.04, 3000 * p, 0.5, out); },
    },
    stunder: {  // a heavy beast: a low growl, a snort, a groan
      alert: (t, out, p) => bend(t, 0.5, 70 * p, 90 * p, 60 * p, 400 * p, 0.5, out),
      windup: (t, out, p) => { noise(t, 0.25, filter('lowpass', 700 * p, 1, amp(t, 0.02, 0.5, 0.22, out))); bend(t, 0.3, 90 * p, 110 * p, 80 * p, 500 * p, 0.3, out); },
      death: (t, out, p) => bend(t, 0.9, 110 * p, 80 * p, 40 * p, 350 * p, 0.55, out),
    },
    snake: {    // hisses
      alert: (t, out, p) => noise(t, 0.5, filter('highpass', 4500 * p, 0.7, amp(t, 0.05, 0.3, 0.45, out))),
      windup: (t, out, p) => sweep(t, 0.25, 3000 * p, 7000 * p, 5000 * p, 2, 0.35, out, 0.03),
      death: (t, out, p) => sweep(t, 0.7, 6000 * p, 3000 * p, 1500 * p, 1.2, 0.3, out, 0.01),
    },
    octonaut: { // bubbly blips
      alert: (t, out, p) => gloops(t, 4, 400 * p, 900 * p, 0.06, 0.2, out),
      windup: (t, out, p) => { tone('sine', 300 * p, 700 * p, t, 0.2, amp(t, 0.02, 0.25, 0.18, out)); gloops(t + 0.1, 2, 600 * p, 900 * p, 0.05, 0.15, out); },
      death: (t, out, p) => gloops(t, 8, 300 * p, 800 * p, 0.07, 0.2, out, false),
    },
    fireface: { // flames: a whoomph, a swelling roar, sputtering out
      alert: (t, out, p) => { sweep(t, 0.4, 300 * p, 1200 * p, 400 * p, 1, 0.6, out, 0.05, 'lowpass'); clicks(t + 0.05, 5, 0.05, 2500 * p, 0.3, out); },
      windup: (t, out, p) => sweep(t, 0.45, 300 * p, 900 * p, 2000 * p, 1, 0.4, out, 0.25, 'lowpass'),
      death: (t, out, p) => { sweep(t, 0.8, 1500 * p, 800 * p, 200 * p, 1, 0.4, out, 0.01, 'lowpass'); clicks(t + 0.2, 10, 0.06, 2500 * p, 0.15, out); },
    },
    triangle: { // a machine: beeps, a rising charge, a glitching fall
      alert: (t, out, p) => {
        for (const [i, hz] of [880, 1320].entries())
          tone('square', hz * p, hz * p, t + i * 0.09, 0.07, filter('lowpass', 3000, 1, amp(t + i * 0.09, 0.003, 0.18, 0.07, out)));
      },
      windup: (t, out, p) => tone('square', 300 * p, 1200 * p, t, 0.35, filter('lowpass', 2500, 2, amp(t, 0.05, 0.2, 0.3, out))),
      death: (t, out, p) => {
        for (let i = 0; i < 6; i++) {
          const at = t + i * 0.07, hz = [1320, 990, 1175, 784, 880, 523][i] * p;
          tone('square', hz, hz * 0.97, at, 0.06, filter('lowpass', 2500, 1, amp(at, 0.002, 0.18, 0.06, out)));
        }
      },
    },
    firecat: {  // a yowl, a spitting hiss, a falling wail
      alert: (t, out, p) => bend(t, 0.45, 350 * p, 650 * p, 420 * p, 1200 * p, 0.3, out),
      windup: (t, out, p) => noise(t, 0.3, filter('bandpass', 3500 * p, 1.5, amp(t, 0.01, 0.4, 0.28, out))),
      death: (t, out, p) => bend(t, 0.7, 600 * p, 450 * p, 150 * p, 1000 * p, 0.3, out),
    },
  };
  const out = {};
  for (const [species, kinds] of Object.entries(V)) for (const k of VOICE_KINDS) out[`${species}_${k}`] = kinds[k];
  return out;
}
