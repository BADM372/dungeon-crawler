// The inventory is a paused DOM overlay. Item/equipment rules remain renderer-free.
// I opens the bag; V opens it with a Floor column: the items lying within C's reach. Items move
// between floor and bag (Take / Drop, Enter on a selected item, or a double-click). You can
// drop every weapon, even the last one: then you cannot attack until you pick one up.
import { player, state, setStatus } from './state.js';
import { ITEMS, COINS, WEAPONS } from '../core/items.js';
import { equippedItem, ownedItem } from '../core/inventory.js';
import { xpProgress, damageBonus } from '../core/progression.js';
import { RARITIES, rarityOf } from '../core/gear/rarities.js';
import { itemStats, displayName, baseLine, affixLines } from '../core/gear/stats.js';
import { equipmentAllowed, equipOwnedWeapon, devSwapWeapon, devDropWeapon, syncEquippedWeapon } from './equipment.js';
import { floorItems, takeNow, dropFromBag } from './loot.js';
import { clearInput } from './inputstate.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// selected: { from: 'bag', id: instanceId } | { from: 'floor', id: pickup id } | null
let selected = null, signature = '', previousFocus = null, floorMode = false;

export const inventoryFloor = () => state.inventoryOpen && floorMode;
// floor: open with the Floor column (V)
export function setInventoryOpen(open, floor = false) {
  if (open && (!state.map || state.transitioning)) return;
  state.inventoryOpen = open; clearInput();
  $('inventory-overlay').hidden = !open;
  if (open) {
    floorMode = floor; previousFocus = document.activeElement;
    const first = floor && floorItems()[0];
    selected = first ? { from: 'floor', id: first.id } : player.inventory.equipped ? { from: 'bag', id: player.inventory.equipped } : null;
    signature = ''; updateInventory();
    (first ? $('inventory-floor').querySelector('[data-floor]') : $('inventory-close')).focus();
  } else previousFocus?.focus();
}
export const toggleInventory = () => setInventoryOpen(!state.inventoryOpen);
// V: open with the floor, or close (also an inventory opened with I)
export const toggleFloor = () => setInventoryOpen(!state.inventoryOpen, true);

const floorPickup = id => floorItems().find(p => p.id === id) || null;
function selectedItem() {
  if (selected?.from === 'bag') return ownedItem(player.inventory, selected.id);
  if (selected?.from === 'floor') return floorPickup(selected.id);
  return null;
}

// the weapon's stats, and how they compare with what is equipped
function weaponText(item) {
  const s = itemStats(item), bonus = damageBonus(player.level), r = rarityOf(item);
  const lines = [`${r.name}${item.gen ? ` · item level ${item.gen.ilvl}` : ''}`,
    `Damage ${s.damage + bonus}`, `Attack time ${s.cooldown.toFixed(2)} s`, `Reach ${s.range.toFixed(2)} cells`];
  return lines.join('\n');
}
function compareText(item) {
  const eq = equippedItem(player.inventory);
  if (!eq) return 'You have no weapon equipped.';
  if (selected?.from === 'bag' && selected.id === eq.instanceId) return '';
  const a = itemStats(item), b = itemStats(eq);
  const diff = (label, d, better, fmt) => d ? `<span class="${better ? 'up' : 'down'}">${label} ${d > 0 ? '+' : '−'}${fmt(Math.abs(d))}</span>` : null;
  const parts = [diff('damage', a.damage - b.damage, a.damage > b.damage, n => n),
    diff('attack time', a.cooldown - b.cooldown, a.cooldown < b.cooldown, n => n.toFixed(2) + ' s'),
    diff('reach', a.range - b.range, a.range > b.range, n => n.toFixed(2))].filter(Boolean);
  return `Compared with ${esc(displayName(eq))}:\n${parts.join('\n') || 'same damage, speed and reach'}`;
}

export function updateInventory() {
  $('inventory-overlay').hidden = !state.inventoryOpen;
  if (!state.inventoryOpen) return;
  const inv = player.inventory, equipped = equippedItem(inv), allowed = equipmentAllowed(), floor = floorMode ? floorItems() : [];
  if (selected && !selectedItem()) selected = null;
  const item = selectedItem(), sel = selected ? `${selected.from}:${selected.id}` : '';
  const next = `${inv.version}:${sel}:${floorMode}:${floor.map(p => p.id)}:${allowed}:${state.equipping}:${player.hp}:${player.xp}:${state.statusMsg}`;
  if (next === signature) return;
  signature = next;
  const xp = xpProgress(player);
  $('inventory-panel').classList.toggle('with-floor', floorMode);
  $('inventory-floor-col').hidden = !floorMode;
  $('inventory-progress').textContent = `Level ${player.level} · XP ${xp.current}/${xp.required} · HP ${Math.ceil(player.hp)}/${player.maxHp}`;
  $('inventory-equipped').textContent = `Equipped: ${equipped ? displayName(equipped) : 'None (you cannot attack)'} · damage bonus +${damageBonus(player.level)}`;
  $('inventory-currency').innerHTML = COINS.map((c, i) => `<div class="coin-slot"><img src="${c.icon}" alt=""><div><small>${c.name}</small><b>${inv.currency[i].count}</b></div></div>`).join('');
  const focus = document.activeElement?.dataset;
  const focusSlot = focus?.slot, focusFloor = focus?.floor;
  if (floorMode) $('inventory-floor').innerHTML = floor.length ? floor.map(p => {
    const def = ITEMS[p.itemId], on = selected?.from === 'floor' && selected.id === p.id, color = p.gen ? rarityOf(p).css : '';
    return `<button class="floor-item${on ? ' selected' : ''}" role="option" aria-selected="${on}" data-floor="${p.id}"${color ? ` style="--rarity:${color};color:${color}"` : ''} title="${esc(displayName(p))}"><img src="${def.icon}" alt=""><span>${esc(displayName(p))}${p.count > 1 ? ` ×${p.count}` : ''}</span></button>`;
  }).join('') : '<div class="floor-empty">Nothing on the floor within reach.</div>';
  $('inventory-grid').innerHTML = inv.slots.map((s, i) => {
    const def = s && ITEMS[s.itemId], on = !!s && selected?.from === 'bag' && s.instanceId === selected.id;
    const rarity = s?.gen && rarityOf(s).glow ? ` style="--rarity:${rarityOf(s).css}"` : '';
    return `<button class="inventory-slot${on ? ' selected' : ''}"${rarity} data-slot="${i}" aria-pressed="${on}" aria-label="${def ? `${esc(displayName(s))}, ${s.count}${s.instanceId === inv.equipped ? ', equipped' : ''}` : `Empty slot ${i + 1}`}" title="${esc(def ? displayName(s) : 'Empty')}">${s ? `<img src="${def.icon}" alt="">${s.count > 1 ? `<span class="count">${s.count}</span>` : ''}${s.instanceId === inv.equipped ? '<span class="equipped">E</span>' : ''}` : ''}</button>`;
  }).join('');
  if (focusSlot !== undefined) $('inventory-grid').querySelector(`[data-slot="${focusSlot}"]`)?.focus();
  if (focusFloor !== undefined) ($('inventory-floor').querySelector(`[data-floor="${focusFloor}"]`)
    || $('inventory-floor').querySelector('[data-floor]') || $('inventory-grid').querySelector('[data-slot]'))?.focus();
  const def = item && ITEMS[item.itemId], image = $('inventory-item-icon');
  image.hidden = !def;
  if (def) image.src = def.icon;
  $('inventory-item-name').textContent = item ? displayName(item) : 'Select an item';
  $('inventory-item-name').style.color = item?.gen ? rarityOf(item).css : '';
  $('inventory-item-base').textContent = item ? baseLine(item) ?? '' : '';
  $('inventory-item-stats').textContent = def?.weapon ? weaponText(item)
    : def ? `Count ${item.count}\nStack limit ${def.stackLimit}\nNo use action yet` : selected ? '' : 'Select a bag slot to inspect it.';
  $('inventory-item-affixes').innerHTML = item ? affixLines(item).map(l => `<li>${esc(l)}</li>`).join('') : '';
  $('inventory-item-compare').innerHTML = def?.weapon ? compareText(item) : '';
  const inBag = selected?.from === 'bag', isEquipped = inBag && item?.instanceId === inv.equipped;
  const equip = $('inventory-equip'), take = $('inventory-take'), drop = $('inventory-drop');
  equip.hidden = !inBag || !def?.weapon;
  equip.disabled = !allowed || isEquipped;
  equip.textContent = isEquipped ? 'Equipped' : 'Equip';
  equip.title = allowed ? '' : 'Close inventory and finish your current action first';
  take.hidden = selected?.from !== 'floor' || !item;
  take.disabled = !!item?.gen && !inv.slots.includes(null);
  take.title = take.disabled ? 'Your bag is full' : '';
  drop.hidden = !inBag || !item;
  drop.disabled = isEquipped && !allowed;
  $('inventory-dev').hidden = !state.dev;
  $('dev-equip').disabled = !allowed;
  $('inventory-feedback').textContent = state.equipping ? 'Loading weapon…' : !allowed ? 'Finish your current action before changing weapons.' : state.statusMsg;
}
const refresh = () => { signature = ''; updateInventory(); };

// move the selected item across: floor -> bag, bag -> floor
function take() {
  const p = selected?.from === 'floor' && floorPickup(selected.id);
  if (!p) return;
  const at = floorItems().indexOf(p);
  if (takeNow(p)) {
    const rest = floorItems(), next = rest[Math.min(at, rest.length - 1)];
    selected = next ? { from: 'floor', id: next.id } : null;
  }
  refresh();
}
async function drop() {
  const id = selected?.from === 'bag' && selected.id;
  if (!id) return;
  const wasEquipped = player.inventory.equipped === id;
  if (wasEquipped && !equipmentAllowed()) return;
  const index = player.inventory.slots.findIndex(s => s?.instanceId === id);
  if (!dropFromBag(id)) return;
  if (wasEquipped) { syncEquippedWeapon(); setStatus('No weapon equipped: you cannot attack'); }
  const next = player.inventory.slots.slice(index).find(Boolean) || player.inventory.slots.find(Boolean);
  selected = next ? { from: 'bag', id: next.instanceId } : null;
  refresh();
}
function act() {
  if (selected?.from === 'floor') take();
  else if (selected?.from === 'bag' && floorMode) drop();
  else if (!$('inventory-equip').hidden && !$('inventory-equip').disabled) $('inventory-equip').click();
}

$('inventory-close').addEventListener('click', () => setInventoryOpen(false));
$('inventory-overlay').addEventListener('click', e => { if (e.target === $('inventory-overlay')) setInventoryOpen(false); });
$('inventory-grid').addEventListener('click', e => {
  const button = e.target.closest('[data-slot]');
  if (!button) return;
  const s = player.inventory.slots[Number(button.dataset.slot)];
  selected = s ? { from: 'bag', id: s.instanceId } : null;
  refresh();
});
$('inventory-grid').addEventListener('dblclick', e => { if (e.target.closest('[data-slot]') && floorMode) drop(); });
$('inventory-floor').addEventListener('click', e => {
  const button = e.target.closest('[data-floor]');
  if (!button) return;
  selected = { from: 'floor', id: Number(button.dataset.floor) };
  refresh();
});
$('inventory-floor').addEventListener('dblclick', e => { if (e.target.closest('[data-floor]')) take(); });
$('inventory-equip').addEventListener('click', async () => {
  if (await equipOwnedWeapon(selected?.id)) selected = { from: 'bag', id: player.inventory.equipped };
  refresh();
});
$('inventory-take').addEventListener('click', take);
$('inventory-drop').addEventListener('click', drop);

$('dev-weapon').innerHTML = WEAPONS.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
$('dev-rarity').innerHTML = RARITIES.map(r => `<option value="${r.id}"${r.id === 'rare' ? ' selected' : ''}>${r.name}</option>`).join('');
const devRoll = () => [$('dev-weapon').value, $('dev-rarity').value, Number($('dev-level').value) || 1];
$('dev-equip').addEventListener('click', async () => {
  if (await devSwapWeapon(...devRoll())) selected = { from: 'bag', id: player.inventory.equipped };
  refresh();
});
$('dev-drop').addEventListener('click', () => { devDropWeapon(...devRoll()); refresh(); });

// Keyboard: arrows move through the floor list and the bag (left/right cross between them),
// Enter or Space on the selected item moves it across (in the bag without the floor: equips).
// Tab stays inside the modal, including when slots are re-rendered.
$('inventory-panel').addEventListener('keydown', e => {
  const el = document.activeElement, slot = el?.dataset?.slot, row = el?.dataset?.floor;
  if (e.code === 'Tab') {
    const controls = [...$('inventory-panel').querySelectorAll('button, select, input')].filter(c => !c.disabled && c.getClientRects().length);
    const i = controls.indexOf(el), next = (i + (e.shiftKey ? -1 : 1) + controls.length) % controls.length;
    e.preventDefault(); controls[next]?.focus();
    return;
  }
  if (slot === undefined && row === undefined) return;
  const rows = [...$('inventory-floor').querySelectorAll('[data-floor]')], slots = [...$('inventory-grid').querySelectorAll('[data-slot]')];
  const pick = target => { if (!target) return; e.preventDefault(); target.focus(); target.click(); };
  if (e.code === 'Enter' || e.code === 'Space') {
    const on = row !== undefined ? selected?.from === 'floor' && selected.id === Number(row)
      : selected?.from === 'bag' && player.inventory.slots[Number(slot)]?.instanceId === selected.id;
    if (on) { e.preventDefault(); act(); }
    return;
  }
  if (row !== undefined) {
    const i = rows.indexOf(el);
    if (e.code === 'ArrowDown') pick(rows[i + 1]);
    else if (e.code === 'ArrowUp') pick(rows[i - 1]);
    else if (e.code === 'ArrowRight') pick(slots[0]);
  } else {
    const i = Number(slot), col = i % 6;
    if (e.code === 'ArrowRight' && col < 5) pick(slots[i + 1]);
    else if (e.code === 'ArrowLeft' && col > 0) pick(slots[i - 1]);
    else if (e.code === 'ArrowLeft' && floorMode) pick(rows[0]);
    else if (e.code === 'ArrowDown') pick(slots[i + 6]);
    else if (e.code === 'ArrowUp') pick(slots[i - 6]);
  }
});
