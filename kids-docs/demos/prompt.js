// A prompt builder: pick an idea (or write your own), tick the good habits, and get a prompt
// to paste into a coding agent. It only puts the parts of a good prompt together.
import { html, t as tr } from '../deck.js';

const IDEAS = [
  { t: 'Make the hero jump higher', de: 'Lass den Helden höher springen',
    now: ['Right now the hero can only jump onto low ledges.', 'Gerade kommt der Held nur auf niedrige Kanten.'],
    check: ['the tests still pass', 'die Tests noch durchlaufen'] },
  { t: 'Make spiders notice me from further away', de: 'Lass Spinnen mich von weiter weg bemerken',
    now: ['Right now spiders only notice me when I am almost next to them.', 'Gerade bemerken Spinnen mich erst, wenn ich fast neben ihnen stehe.'],
    check: ['npm test passes', 'npm test durchläuft'] },
  { t: 'Add a new snake kind with its own colours', de: 'Füge eine neue Schlangenart mit eigenen Farben hinzu',
    now: ['Right now the deepest snakes are the almost black Shadow mambas.', 'Gerade sind die tiefsten Schlangen die fast schwarzen Shadow mambas.'],
    check: ['npm test passes and I can see it in the game', 'npm test durchläuft und ich sie im Spiel sehen kann'] },
  { t: 'Make legendary swords a little more common', de: 'Mach legendäre Schwerter ein bisschen häufiger',
    now: ['Right now I almost never find a legendary sword.', 'Gerade finde ich fast nie ein legendäres Schwert.'],
    check: ['the loot table tool shows the new odds', 'das Beutetabellen-Werkzeug die neuen Chancen zeigt'] },
  { t: 'Give the meadow sky a sunset colour', de: 'Gib dem Wiesenhimmel Sonnenuntergangsfarben',
    now: ['Right now the sky above the town is a dark blue-green night.', 'Gerade ist der Himmel über der Stadt eine dunkle blaugrüne Nacht.'],
    check: ['a screenshot of the town looks right', 'ein Screenshot der Stadt gut aussieht'] },
  { t: 'Make the coin sound happier', de: 'Mach das Münzgeräusch fröhlicher',
    now: ['Right now picking up a coin plays two short high notes.', 'Gerade spielt das Aufsammeln einer Münze zwei kurze hohe Töne.'],
    check: ['I can hear it in the game', 'ich es im Spiel hören kann'] },
  { t: 'Add more islands in the sky', de: 'Mach mehr Inseln am Himmel',
    now: ['Right now only some cubes near the top are islands.', 'Gerade sind nur ein paar Würfel weit oben Inseln.'],
    check: ['npm test still passes, so every cube can be finished', 'npm test noch durchläuft, damit jeder Würfel schaffbar bleibt'] },
];

export default function mount(el) {
  const name = x => tr(x.t, x.de);
  const box = html(el, `<div>
    <div class="row"><label>${tr('idea', 'Idee')} <select class="idea"><option value="-1">${tr('my own idea...', 'meine eigene Idee...')}</option>${IDEAS.map((x, i) => `<option value="${i}" ${i === 0 ? 'selected' : ''}>${name(x)}</option>`).join('')}</select></label></div>
    <div class="row"><input type="text" class="own" placeholder="${tr('or type what you want to change', 'oder schreib, was du ändern willst')}" style="flex:1;min-width:260px"></div>
    <div class="row">
      <label><input type="checkbox" class="explain" checked> ${tr('explain first', 'erst erklären')}</label>
      <label><input type="checkbox" class="now" checked> ${tr('say what happens now', 'sagen, was jetzt passiert')}</label>
      <label><input type="checkbox" class="small" checked> ${tr('keep it small', 'klein halten')}</label>
      <label><input type="checkbox" class="check" checked> ${tr('say how to check', 'sagen, wie man prüft')}</label>
      <label><input type="checkbox" class="show" checked> ${tr('show what changed', 'Änderungen zeigen')}</label></div>
    <div class="prompt" data-title="${tr('YOUR PROMPT', 'DEIN PROMPT')}" style="margin-top:10px"><q class="result"></q></div></div>`);
  const out = html(el, '<div class="out"></div>');
  const $ = s => box.querySelector(s);
  const copy = document.createElement('button');
  copy.className = 'copy'; copy.textContent = tr('copy', 'kopieren');
  copy.onclick = async () => {
    try { await navigator.clipboard.writeText($('.result').textContent); copy.textContent = tr('copied!', 'kopiert!'); }
    catch { copy.textContent = tr('select & copy', 'markieren & kopieren'); }
    setTimeout(() => { copy.textContent = tr('copy', 'kopieren'); }, 1500);
  };
  box.querySelector('.prompt').append(copy);
  function build() {
    const i = +$('.idea').value, idea = IDEAS[i], own = $('.own').value.trim(), known = idea && !own;
    const goal = own || (idea && name(idea)) || tr('Describe what you want to change', 'Beschreib, was du ändern willst');
    const parts = [], score = [];
    if ($('.explain').checked) {
      parts.push(tr(`First, explain to me in simple words how this works in the game now. Then: ${goal.charAt(0).toLowerCase() + goal.slice(1)}.`,
        `Erklär mir zuerst in einfachen Worten, wie das gerade im Spiel funktioniert. Dann: ${goal}.`));
      score.push('explain');
    } else parts.push(goal + '.');
    if ($('.now').checked && known) { parts.push(tr(idea.now[0], idea.now[1])); score.push('now'); }
    if ($('.small').checked) { parts.push(tr("Keep the change small and don't change anything else.", 'Halte die Änderung klein und ändere sonst nichts.')); score.push('small'); }
    if ($('.check').checked) {
      parts.push(tr(`Check that it works: ${known ? idea.check[0] : 'run npm test'}.`, known ? `Prüf, dass es funktioniert: dass ${idea.check[1]}.` : 'Prüf, dass es funktioniert: führ npm test aus.'));
      score.push('check');
    }
    if ($('.show').checked) {
      parts.push(tr('When you are done, show me which files you changed and what the numbers were before and after.',
        'Wenn du fertig bist, zeig mir, welche Dateien du geändert hast und welche Zahlen vorher und nachher drinstanden.'));
      score.push('show');
    }
    $('.result').textContent = parts.join(' ');
    const n = score.length;
    out.innerHTML = `${tr('Prompt power', 'Prompt-Power')}: <b style="color:${['#ff8a7a', '#ff8a7a', '#ffcf7a', '#ffcf7a', '#61dc6b', '#61dc6b'][n]}">${'\u2605'.repeat(n)}${'\u2606'.repeat(5 - n)}</b>  `
      + (n === 5 ? tr('Every good habit is in there!', 'Alle guten Gewohnheiten sind drin!') : tr('Tick more habits to make it stronger.', 'Hak mehr Gewohnheiten an, um ihn stärker zu machen.'));
  }
  box.querySelectorAll('select, input').forEach(i => { i.oninput = build; i.onchange = build; });
  build();
}
