// Step through a real function line by line: spendCopper (src/core/inventory.js), the rule that
// decides whether you can pay a price. The code is read live from the game; the steps say what
// each line does with your numbers (the lines are found by what they say, so if the function is
// rewritten, the demo says it can't follow any more). At the end the real function is called.
import { createInventory, addCopper, spendCopper, copperTotal, formatCoins } from '../../src/core/inventory.js';
import { extract } from '../refs.js';
import { highlight, html, t as tr } from '../deck.js';

const PATH = 'src/core/inventory.js', NAME = 'spendCopper';

// what happens on each line, for a bag holding `bag` copper and a price of `price`
function steps(bag, price) {
  const c = formatCoins;
  const out = [
    { re: /function spendCopper\(/, say: tr(`The machine starts. <b>inv</b> is your bag (${c(bag)}), <b>amount</b> is the price: ${price}.`,
      `Die Maschine startet. <b>inv</b> ist deine Tasche (${c(bag)}), <b>amount</b> ist der Preis: ${price}.`), vars: { amount: price } },
    { re: /^\s*whole\(amount\)/, say: tr('A check: is the price a whole number, and not below zero? Yes, so go on. (Otherwise the game would stop with an error.)',
      'Eine Prüfung: Ist der Preis eine ganze Zahl und nicht unter null? Ja, also weiter. (Sonst würde das Spiel mit einem Fehler anhalten.)') },
    { re: /const total = copperTotal\(/, say: tr(`Count everything in the bag in copper and call it <b>total</b>: ${bag}.`,
      `Zähl alles in der Tasche in Kupfer zusammen und nenn es <b>total</b>: ${bag}.`), vars: { total: bag } },
    { re: /if \(total < amount\)/, say: bag < price
      ? tr(`Is ${bag} less than ${price}? <b>Yes!</b> So <b>return false</b>: "no, you can't pay". The machine stops right here, the lines below never run.`,
        `Ist ${bag} kleiner als ${price}? <b>Ja!</b> Also <b>return false</b>: "Nein, das kannst du nicht bezahlen." Die Maschine hört genau hier auf, die Zeilen darunter laufen nie.`)
      : tr(`Is ${bag} less than ${price}? No. So the rest of this line is skipped.`, `Ist ${bag} kleiner als ${price}? Nein. Also wird der Rest dieser Zeile übersprungen.`) },
  ];
  if (bag >= price) out.push(
    { re: /if \(amount\)/, say: price
      ? tr(`Is there a price at all? Yes: put ${bag} \u2212 ${price} = ${bag - price} copper back in the bag (${c(bag - price)}).`,
        `Gibt es überhaupt einen Preis? Ja: ${bag} \u2212 ${price} = ${bag - price} Kupfer zurück in die Tasche legen (${c(bag - price)}).`)
      : tr('Is there a price at all? No, it\'s free: nothing to take.', 'Gibt es überhaupt einen Preis? Nein, es ist umsonst: nichts wegnehmen.') },
    { re: /return true/, say: tr('<b>return true</b>: "yes, paid!" The machine is done.', '<b>return true</b>: "Ja, bezahlt!" Die Maschine ist fertig.') });
  return out;
}

export default async function mount(el) {
  const row = html(el, `<div class="row"><label>${tr('copper in your bag', 'Kupfer in deiner Tasche')} <input type="number" class="bag" min="0" max="99999" value="250"></label>
    <label>${tr('the price', 'der Preis')} <input type="number" class="price" min="0" max="99999" value="120"></label>
    <button class="step">${tr('Next line \u25B8', 'Nächste Zeile \u25B8')}</button><button class="again">${tr('Start over', 'Von vorn')}</button></div>`);
  const pre = html(el, '<pre class="stepper"></pre>');
  const out = html(el, '<div class="out"></div>');
  const $ = s => row.querySelector(s);
  let lines = [], plan = [], at = -1;
  try {
    const text = await (await fetch(new URL('../../' + PATH, import.meta.url))).text(), e = extract(text, PATH, NAME);
    if (e.error) throw new Error(e.error);
    const tmp = document.createElement('pre');
    tmp.dataset.label = '';
    tmp.textContent = e.text;
    highlight(tmp);
    lines = e.text.split('\n');
    pre.innerHTML = `<span class="file">${PATH} \u00B7 ${NAME} <span class="live">LIVE</span></span>` + tmp.innerHTML.split('\n').map(l => `<span class="ln">${l || ' '}</span>`).join('');
  } catch (err) {
    out.textContent = tr('The game\'s code could not be read: ', 'Der Code des Spiels ließ sich nicht lesen: ') + err.message;
    return;
  }
  const rows = [...pre.querySelectorAll('.ln')];

  function start() {
    const bag = Math.max(0, Math.round(+$('.bag').value || 0)), price = Math.max(0, Math.round(+$('.price').value || 0));
    plan = steps(bag, price).map(s => ({ ...s, line: lines.findIndex(l => s.re.test(l)) }));
    plan.bag = bag; plan.price = price;
    at = -1;
    if (plan.some(s => s.line < 0)) {
      out.innerHTML = tr('The game\'s code for this changed, so this demo can\'t follow it line by line any more.', 'Der Code dafür hat sich geändert, darum kann diese Demo ihm nicht mehr Zeile für Zeile folgen.');
      $('.step').disabled = true;
      return;
    }
    $('.step').disabled = false;
    rows.forEach(r => r.classList.remove('on', 'ran'));
    out.innerHTML = tr('Press <b>Next line</b> to run the function one line at a time.', 'Drück <b>Nächste Zeile</b>, um die Funktion Zeile für Zeile laufen zu lassen.');
  }
  function step() {
    if (at >= plan.length - 1) return;
    at++;
    rows.forEach(r => r.classList.remove('on'));
    rows[plan[at].line].classList.add('on', 'ran');
    let text = `${at + 1}. ${plan[at].say}`;
    if (at === plan.length - 1) {
      // the real thing, for comparison
      const inv = createInventory();
      addCopper(inv, plan.bag);
      const paid = spendCopper(inv, plan.price);
      text += '\n\n' + tr(`The real function, called just now, says <b>${paid}</b>. Your bag: ${formatCoins(copperTotal(inv))}.`,
        `Die echte Funktion, gerade eben aufgerufen, sagt <b>${paid}</b>. Deine Tasche: ${formatCoins(copperTotal(inv))}.`);
      $('.step').disabled = true;
    }
    out.innerHTML = text;
  }
  $('.step').onclick = step;
  $('.again').onclick = start;
  $('.bag').onchange = start;
  $('.price').onchange = start;
  start();
}
