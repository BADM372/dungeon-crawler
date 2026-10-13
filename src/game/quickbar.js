// The quick bar: six slots along the bottom of the screen, on keys 1-6 (or a click). A slot
// points at a bag item (core/inventory.js assignBar): a weapon is equipped, a usable item used
// (the town portal scroll starts its cast; game/townportal.js; a health potion is drunk). With the
// inventory open, 1-6 or a click puts the selected bag item on that slot instead (again on the
// same slot: off). A potion's slot fills while the next drink is not ready.
import { player, state, setStatus } from './state.js';
import { sfx } from '../audio/sfx.js';
import { ITEMS } from '../core/items.js';
import { BAR_SIZE, barEntry, ownedItem, removeItem } from '../core/inventory.js';
import { drinkPotion } from '../core/progression.js';
import { floatText } from '../render/floattext.js';
import { displayName } from '../core/gear/stats.js';
import { rarityOf } from '../core/gear/rarities.js';
import { equipOwnedWeapon } from './equipment.js';
import { useTownPortal } from './townportal.js';
import { assignSelectedToBar } from './inventory.js';

const bar = document.getElementById('quickbar');
bar.innerHTML = Array.from({ length: BAR_SIZE }, (_, i) => `<button class="qb-slot" data-bar="${i}" tabindex="-1">`
  + `<img alt="" hidden><span class="qb-cast"></span><span class="qb-key">${i + 1}</span><span class="qb-count"></span></button>`).join('');
const buttons = [...bar.querySelectorAll('[data-bar]')];
let signature = '', shown = null;   // shown: the inventory drawn (a new run has a new one)

// use the bag item (from the bar or the inventory's Use button)
export function useItem(instanceId) {
  const inv = player.inventory, slot = ownedItem(inv, instanceId), def = ITEMS[slot?.itemId];
  if (!def || state.transitioning) return false;
  if (def.weapon) {
    if (inv.equipped === instanceId) { setStatus(`${displayName(slot)} is already equipped`); return false; }
    equipOwnedWeapon(instanceId);
    return true;
  }
  if (def.use === 'townPortal') return useTownPortal();
  if (def.use === 'heal') return drink(slot, def);
  setStatus(`${def.name} cannot be used yet`);
  return false;
}

function drink(slot, def) {
  if (player.ragdoll) { setStatus('Not while knocked down'); return false; }
  const healed = drinkPotion(player, def, state.time);
  if (typeof healed !== 'number') {
    setStatus({ full: 'Already at full health', wait: 'Not so fast', dead: '' }[healed]);
    return false;
  }
  removeItem(player.inventory, slot.instanceId, 1);
  sfx('drink');
  floatText(`+${Math.round(healed)}`, q => q.set(player.x, player.visY + 1.3, player.z), { color: '#ff6b6b', life: 1 });
  setStatus(`${def.name}: +${Math.round(healed)} health`);
  return true;
}

export function useBarSlot(i) {
  const e = barEntry(player.inventory, i);
  if (!e) return false;
  if (!e.slot) { setStatus(`No ${ITEMS[e.itemId].name} left`); return false; }
  sfx('use', { volume: 0.6 });
  return useItem(e.slot.instanceId);
}

// keys 1-6: use the slot, or assign to it while the inventory is open
export function barKey(i) {
  if (state.inventoryOpen) assignSelectedToBar(i);
  else useBarSlot(i);
}

bar.addEventListener('pointerdown', e => {
  const b = e.target.closest('[data-bar]');
  if (!b || e.button !== 0) return;
  e.preventDefault();   // no focus: Space and Enter must stay with the game
  barKey(Number(b.dataset.bar));
});

function draw() {
  const inv = player.inventory;
  buttons.forEach((b, i) => {
    const e = barEntry(inv, i), def = e && ITEMS[e.itemId], img = b.querySelector('img');
    img.hidden = !def;
    if (def && img.getAttribute('src') !== def.icon) img.src = def.icon;
    const glow = e?.slot?.gen && rarityOf(e.slot).glow;
    b.style.setProperty('--rarity', glow ? rarityOf(e.slot).css : 'transparent');
    b.classList.toggle('rare', !!glow);
    b.classList.toggle('equipped', !!e?.slot && e.slot.instanceId === inv.equipped);
    b.classList.toggle('none-left', !!e && !e.slot);
    b.querySelector('.qb-count').textContent = def && def.stackLimit > 1 ? String(e.count) : '';
    b.title = def ? `${e.slot ? displayName(e.slot) : def.name} (${i + 1})` : `Empty (${i + 1}): select a bag item in the inventory and press ${i + 1}`;
  });
}

// every frame: redraw on inventory changes, and fill the slot being cast
export function updateQuickbar() {
  const inv = player.inventory, next = `${inv.version}:${inv.equipped}`;
  if (next !== signature || inv !== shown) { signature = next; shown = inv; draw(); }
  bar.classList.toggle('assigning', state.inventoryOpen);
  const c = state.cast;
  buttons.forEach((b, i) => {
    const e = barEntry(inv, i), def = e && ITEMS[e.itemId], on = !!c && def?.use === c.kind;
    const wait = def?.use === 'heal' ? (player.drankAt + def.cooldown - state.time) / def.cooldown : 0;
    b.classList.toggle('casting', on);
    b.classList.toggle('cooling', wait > 0);
    b.querySelector('.qb-cast').style.height = on ? `${Math.min(1, c.t / c.duration) * 100}%` : wait > 0 ? `${Math.min(1, wait) * 100}%` : '0';
  });
}
