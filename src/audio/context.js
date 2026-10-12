// The one AudioContext shared by sound effects (sfx.js) and music (music.js). Browsers only
// let audio start after a user gesture, so it is made on the first key or click. Everything
// plays into `output`.
let ctx = null, output = null;
const starters = [];

function start() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    output = ctx.createGain();
    output.connect(ctx.destination);
    for (const fn of starters) fn(ctx, output);
  }
  if (ctx.state === 'suspended') ctx.resume();
}
addEventListener('pointerdown', start, true);
addEventListener('keydown', start, true);

// fn(ctx, output) runs once the context exists (right away if it already does)
export function onAudioStart(fn) {
  starters.push(fn);
  if (ctx) fn(ctx, output);
}
