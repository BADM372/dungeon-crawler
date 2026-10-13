// The game's weapon machine (src/core/gear/): roll real weapons, see what the dice did at each
// step, and (data-mode="odds") how the rarity odds change with the item level and luck.
import { rollWeapon } from '../../src/core/gear/generate.js';
import { RARITIES, RARITY, rarityOdds } from '../../src/core/gear/rarities.js';
import { itemStats, weaponDps, affixLines, displayName, baseLine } from '../../src/core/gear/stats.js';
import { AFFIX } from '../../src/core/gear/affixes.js';
import { ITEMS } from '../../src/core/items.js';
import { mulberry32 } from '../../src/core/util.js';
import { canvas, html } from '../deck.js';

export default function mount(el) {
  if (el.dataset.mode === 'odds') return odds(el);
  const row = html(el, `<div><div class="row"><label>item level <input type="range" class="lv" min="1" max="25" value="5"> <b class="lvv">5</b></label>
    <label><input type="checkbox" class="guard"> guardian luck</label>
    <button class="roll">Roll a weapon!</button><button class="many">Open 100 chests</button></div></div>`);
  const card = html(el, '<div style="margin-top:10px"></div>');
  const out = html(el, '<div class="out"></div>');
  const $ = s => row.querySelector(s);
  let seed = Math.floor(Math.random() * 1e9);
  const opts = () => $('.guard').checked ? { luck: 0.2, floor: RARITY.uncommon.rank, ancient: true } : {};
  function show(item) {
    const r = RARITY[item.gen.rarity], s = itemStats(item), base = ITEMS[item.itemId];
    card.innerHTML = `<div class="weapon" style="--rarity:${r.css}"><img src="../${base.icon}" alt="">
      <div><h4>${displayName(item)}</h4><div class="base">${r.name} \u00B7 item level ${item.gen.ilvl}${baseLine(item) ? ' \u00B7 ' + baseLine(item) : ''}</div>
      <div class="stats">${s.damage} damage \u00B7 ${(1 / s.interval).toFixed(2)} attacks per second \u00B7 ${Math.round(weaponDps(s))} damage per second
reach ${s.range.toFixed(2)} cells \u00B7 ${Math.round(s.crit * 100)}% critical hits</div>
      <ul>${affixLines(item).map((t, i) => `<li>${t} <span style="color:#5a6678">(${AFFIX[item.gen.affixes[i].id].name}, tier ${item.gen.affixes[i].tier})</span></li>`).join('')}</ul></div></div>`;
    const kinds = item.gen.affixes.map(a => AFFIX[a.id].kind);
    out.innerHTML = `The dice decided, step by step:\n1. rarity: <b style="color:${r.css}">${r.name}</b> \u2192 ${r.affixes} affix${r.affixes === 1 ? '' : 'es'}, damage \u00D7${r.damage}\n`
      + `2. base: <b>${base.name}</b> (${base.weapon.damage} damage at level 1, +5% per item level)\n`
      + `3. affixes: ${kinds.length ? item.gen.affixes.map((a, i) => `<b>${AFFIX[a.id].name}</b> (${kinds[i]})`).join(', ') : 'none'}\n4. name: <b>${displayName(item)}</b>`;
  }
  $('.lv').oninput = () => { $('.lvv').textContent = $('.lv').value; };
  $('.roll').onclick = () => show(rollWeapon(mulberry32(seed++), +$('.lv').value, opts()));
  $('.many').onclick = () => {
    const n = {};
    for (let i = 0; i < 100; i++) { const it = rollWeapon(mulberry32(seed++), +$('.lv').value, opts()); n[it.gen.rarity] = (n[it.gen.rarity] || 0) + 1; }
    card.innerHTML = `<div class="card">${RARITIES.filter(r => n[r.id]).map(r => `<span class="chip" style="border-color:${r.css};color:${r.css}">${r.name}: ${n[r.id]}</span>`).join('')}</div>`;
    out.innerHTML = '100 weapons rolled. Try a higher item level, or guardian luck.';
  };
  $('.roll').click();
}

function odds(el) {
  const W = 640, H = 250, { g } = canvas(el, W, H);
  const row = html(el, `<div class="row"><label>item level <input type="range" class="lv" min="1" max="25" value="1"> <b class="lvv">1</b></label>
    <label>luck <input type="range" class="luck" min="0" max="0.45" step="0.05" value="0"> <b class="lk">0</b></label></div>`);
  const out = html(el, '<div class="out"></div>');
  const $ = s => row.querySelector(s);
  function draw() {
    const lv = +$('.lv').value, luck = +$('.luck').value;
    $('.lvv').textContent = lv; $('.lk').textContent = luck.toFixed(2);
    const p = rarityOdds(lv, { luck });
    g.clearRect(0, 0, W, H);
    const bw = (W - 40) / RARITIES.length;
    RARITIES.forEach((r, i) => {
      const share = p[i], x = 20 + i * bw, h = Math.max(share > 0 ? 2 : 0, Math.sqrt(share) * 180);
      g.fillStyle = r.css; g.globalAlpha = share ? 1 : 0.25; g.fillRect(x + 6, 200 - h, bw - 12, h); g.globalAlpha = 1;
      g.fillStyle = '#e6e9ef'; g.font = '12px ui-monospace, monospace'; g.textAlign = 'center';
      g.fillText(r.name, x + bw / 2, 218);
      g.fillStyle = share ? r.css : '#5a6678';
      g.fillText(share ? (share >= 0.01 ? (share * 100).toFixed(1) + '%' : (share * 100).toFixed(2) + '%') : r.guardianOnly ? 'guardians' : `lv ${r.minLevel}+`, x + bw / 2, 238);
    });
    g.textAlign = 'left';
    const best = RARITIES.filter((r, i) => p[i] > 0).at(-1);
    out.innerHTML = `At item level <b>${lv}</b>, the best possible is <b style="color:${best.css}">${best.name}</b>. Bars are drawn by the square root, so tiny chances stay visible.`;
  }
  row.querySelectorAll('input').forEach(i => i.oninput = draw);
  draw();
}
