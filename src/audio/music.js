// Music: Scrimshaw scores (music/<name>.scrim, docs/music.md) played by the vendored Web Audio
// synth (vendor/scrimshaw). One song at a time: switching fades the old one out and starts
// the new one from the top. The intensity (0 exploring, 1 an enemy near, 2 fighting) brings
// the voices of that level in on the next beat and takes them out on the next bar line.
// Off by default; M turns it on and off (remembered). Turned on, the song starts from the top.
import { createSynth } from '../../vendor/scrimshaw/synth.js';
import { loadScore } from './score.js';
import { onAudioStart } from './context.js';

const VOLUME = 0.4;                         // the music sits under the sound effects
const LOOKAHEAD = 0.3, HIDDEN_LOOKAHEAD = 1.6;   // seconds scheduled ahead; timers slow down in hidden tabs
const FADE = 0.35;                          // time constant of a song or voice fading out
const GAP = 0.8;                            // seconds between one song fading and the next starting

let ctx = null, syn = null;
const scores = new Map();                   // name -> score once loaded (null if it failed)
let want = null, level = 0;
let enabled = localStorage.getItem('crawler.music') === '1';
let cur = null;                             // the song playing
let nextAt = 0;                             // the next song may start from here

onAudioStart((ac, output) => {
  ctx = ac;
  syn = createSynth(ctx, output);
  syn.out.gain.value = VOLUME;
  setInterval(tick, 25);
});

function fetchScore(name) {
  if (scores.has(name)) return;
  scores.set(name, undefined);
  fetch(new URL(`../../music/${name}.scrim`, import.meta.url))
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
    .then(text => {
      const score = loadScore(text);
      if (score.errors.length) console.warn(`music/${name}.scrim:\n${score.errors.join('\n')}`);
      scores.set(name, { ...score, name });
    })
    .catch(e => { console.warn(`music/${name}.scrim: ${e.message}`); scores.set(name, null); });
}

// the song to play (null for silence); loads it on first use
export function playSong(name) {
  want = name;
  if (name) fetchScore(name);
}
export function setIntensity(n) {
  if (n === level) return;
  level = n;
  if (cur) retarget();
}

export const musicEnabled = () => enabled;
export function toggleMusic() {
  enabled = !enabled;
  localStorage.setItem('crawler.music', enabled ? '1' : '0');
  return enabled;
}

// for checks and the devtools console: what plays right now
export function musicInfo() {
  return {
    enabled, want, level, playing: cur?.score.name ?? null, time: cur ? ctx.currentTime - cur.startAt : 0,
    voices: cur ? cur.score.song.voices.filter((_, i) => cur.voices[i].on).map(v => v.name) : [],
  };
}

function tick() {
  if (ctx.state !== 'running') return;
  const name = enabled ? want : null;
  if (cur && cur.score.name !== name) stopSong();
  const score = name && scores.get(name);
  if (!cur && score && ctx.currentTime >= nextAt) startSong(score);
  if (cur) schedule();
}

function startSong(score) {
  const { song, levels } = score;
  const sess = syn.session(song);
  syn.warm(song);
  const voices = sess.ch.map((c, i) => ({ gain: c.input.gain.value, level: levels[i], on: levels[i] <= level, at: 0 }));
  voices.forEach((vc, i) => { if (!vc.on) sess.ch[i].input.gain.value = 0; });
  const startAt = ctx.currentTime + 0.1;
  cur = { score, sess, voices, startAt, list: 'intro', i: 0, offset: 0, until: startAt };
}

function stopSong() {
  cur.sess.stop(FADE);
  cur = null;
  nextAt = ctx.currentTime + GAP;
}

// a voice joining plays from its switch time on, one leaving plays up to it
const audible = (vc, t) => (vc.on ? t >= vc.at : t < vc.at);

// the jukebox's scheduler: the intro once, then the loop forever
function schedule() {
  const { song } = cur.score;
  const horizon = ctx.currentTime + (document.hidden ? HIDDEN_LOOKAHEAD : LOOKAHEAD);
  for (let guard = 0; guard < 5000; guard++) {
    const tl = cur.list === 'intro' ? song.intro : song.loop;
    if (cur.i >= tl.events.length) {
      if (cur.list === 'intro') { cur.list = 'loop'; cur.i = 0; cur.offset = song.intro.dur; continue; }
      const next = cur.offset + song.loop.dur;
      if (!song.loop.dur || cur.startAt + next > horizon) break;
      cur.i = 0; cur.offset = next;
      continue;
    }
    const ev = tl.events[cur.i], t = cur.startAt + cur.offset + ev.t;
    if (t > horizon) break;
    if (t >= ctx.currentTime - 0.03 && audible(cur.voices[ev.v], t)) cur.sess.play(ev, Math.max(t, ctx.currentTime + 0.005));
    cur.i++;
  }
  cur.until = Math.max(cur.until, horizon);
}

// the first beat or bar line at or after time t
function nextBoundary(t, bars) {
  const { song } = cur.score;
  let st = t - cur.startAt, base = cur.startAt, sections = song.intro.sections;
  if (st >= song.intro.dur && song.loop.dur) {
    st -= song.intro.dur;
    const n = Math.floor(st / song.loop.dur);
    st -= n * song.loop.dur;
    base += song.intro.dur + n * song.loop.dur;
    sections = song.loop.sections;
  }
  const s = sections.find(s => st < s.start + s.dur) ?? sections.at(-1);
  if (!s) return t;
  const unit = bars ? s.barDur : 60 / s.tempo;
  return base + s.start + Math.max(0, Math.ceil((st - s.start) / unit - 1e-6)) * unit;
}

// fade voices in or out for the new intensity, from the first boundary not scheduled yet
function retarget() {
  const from = Math.max(cur.until, ctx.currentTime), now = ctx.currentTime;
  const beat = nextBoundary(from, false), bar = nextBoundary(from, true);
  cur.voices.forEach((vc, i) => {
    const on = vc.level <= level;
    if (on === vc.on) return;
    const g = cur.sess.ch[i].input.gain;
    g.cancelScheduledValues(now);
    // the last change has not happened yet: dropping it is enough
    if (vc.at > now) { vc.on = on; vc.at = 0; return; }
    vc.on = on; vc.at = on ? beat : bar;
    g.setTargetAtTime(on ? vc.gain : 0, vc.at, on ? 0.01 : FADE);
  });
}
