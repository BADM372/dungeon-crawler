// A prompt builder: pick an idea (or write your own), tick the good habits, and get a prompt
// to paste into a coding agent. It only puts the parts of a good prompt together.
import { html } from '../deck.js';

const IDEAS = [
  { t: 'Make the hero jump higher', where: 'JUMP_V in src/core/constants.js', check: 'the movement tests in tests/movement.test.js still pass' },
  { t: 'Make spiders notice me from further away', where: 'the SPIDER profile in src/core/enemies.js (aggro)', check: 'npm test passes' },
  { t: 'Add a new snake kind with its own colours', where: 'src/core/enemies.js and src/core/spawns.js, following docs/enemy-kinds.md', check: 'npm test passes and it shows up in tools/kinds.html' },
  { t: 'Make legendary swords a little more common', where: 'the weights in src/core/gear/rarities.js', check: 'node tools/loot-table.mjs shows the new odds' },
  { t: 'Give the meadow sky a sunset colour', where: 'the light settings of the meadow theme in src/themes/index.js', check: 'a screenshot of the town looks right' },
  { t: 'Make the coin sound happier', where: 'the coin recipe in src/audio/sfx.js', check: 'I can hear it in the game' },
  { t: 'Add more islands in the sky', where: 'the arche weights in src/themes/index.js', check: 'npm test still passes, so every cube can be finished' },
];

export default function mount(el) {
  const box = html(el, `<div>
    <div class="row"><label>idea <select class="idea"><option value="-1">my own idea...</option>${IDEAS.map((x, i) => `<option value="${i}" ${i === 0 ? 'selected' : ''}>${x.t}</option>`).join('')}</select></label></div>
    <div class="row"><input type="text" class="own" placeholder="or type what you want to change" style="flex:1;min-width:260px"></div>
    <div class="row">
      <label><input type="checkbox" class="explain" checked> explain first</label>
      <label><input type="checkbox" class="where" checked> say where</label>
      <label><input type="checkbox" class="small" checked> keep it small</label>
      <label><input type="checkbox" class="check" checked> say how to check</label>
      <label><input type="checkbox" class="show" checked> show what changed</label></div>
    <div class="prompt" data-title="YOUR PROMPT" style="margin-top:10px"><q class="result"></q></div></div>`);
  const out = html(el, '<div class="out"></div>');
  const $ = s => box.querySelector(s);
  const copy = document.createElement('button');
  copy.className = 'copy'; copy.textContent = 'copy';
  copy.onclick = async () => { try { await navigator.clipboard.writeText($('.result').textContent); copy.textContent = 'copied!'; } catch { copy.textContent = 'select & copy'; } setTimeout(() => { copy.textContent = 'copy'; }, 1500); };
  box.querySelector('.prompt').append(copy);
  function build() {
    const i = +$('.idea').value, idea = IDEAS[i], own = $('.own').value.trim();
    const goal = own || idea?.t || 'Describe what you want to change';
    const parts = [], score = [];
    if ($('.explain').checked) { parts.push(`First, explain to me in simple words how this works in the game now. Then: ${goal.charAt(0).toLowerCase() + goal.slice(1)}.`); score.push('explain'); }
    else parts.push(goal + '.');
    if ($('.where').checked && idea && !own) { parts.push(`I think it is in ${idea.where}.`); score.push('where'); }
    if ($('.small').checked) { parts.push("Keep the change small and don't change anything else."); score.push('small'); }
    if ($('.check').checked) { parts.push(`Check that it works: ${idea && !own ? idea.check : 'run npm test'}.`); score.push('check'); }
    if ($('.show').checked) { parts.push('When you are done, show me which files you changed and what the numbers were before and after.'); score.push('show'); }
    $('.result').textContent = parts.join(' ');
    const n = score.length;
    out.innerHTML = `Prompt power: <b style="color:${['#ff8a7a', '#ff8a7a', '#ffcf7a', '#ffcf7a', '#61dc6b', '#61dc6b'][n]}">${'\u2605'.repeat(n)}${'\u2606'.repeat(5 - n)}</b>  ` + (n === 5 ? 'Every good habit is in there!' : 'Tick more habits to make it stronger.');
  }
  box.querySelectorAll('select, input').forEach(i => { i.oninput = build; i.onchange = build; });
  build();
}
