// The inventory is a paused DOM overlay. Item/equipment rules remain renderer-free.
import { player, state } from './state.js';
import { ITEMS, COINS, WEAPONS } from '../core/items.js';
import { equippedItem, ownedItem } from '../core/inventory.js';
import { xpProgress, damageBonus } from '../core/progression.js';
import { equipmentAllowed, equipOwnedWeapon, devSwapWeapon } from './equipment.js';
import { clearInput } from './inputstate.js';

const $ = id => document.getElementById(id);
let selected = null, signature = '', previousFocus = null;

export function setInventoryOpen(open) {
  if (open && (!state.map || state.transitioning)) return;
  state.inventoryOpen = open; clearInput();
  $('inventory-overlay').hidden = !open;
  if (open) {
    previousFocus = document.activeElement; selected = player.inventory.equipped;
    signature = ''; updateInventory(); $('inventory-close').focus();
  } else previousFocus?.focus();
}
export const toggleInventory = () => setInventoryOpen(!state.inventoryOpen);

export function updateInventory() {
  $('inventory-overlay').hidden = !state.inventoryOpen;
  if (!state.inventoryOpen) return;
  const inv = player.inventory, equipped = equippedItem(inv), slot = ownedItem(inv, selected), allowed = equipmentAllowed();
  const next = `${inv.version}:${selected}:${allowed}:${state.equipping}:${player.hp}:${player.xp}:${state.statusMsg}`;
  if (next === signature) return;
  signature = next;
  const xp = xpProgress(player);
  $('inventory-progress').textContent = `Level ${player.level} · XP ${xp.current}/${xp.required} · HP ${Math.ceil(player.hp)}/${player.maxHp}`;
  $('inventory-equipped').textContent = `Equipped: ${equipped ? ITEMS[equipped.itemId].name : 'None'} · damage bonus +${damageBonus(player.level)}`;
  $('inventory-currency').innerHTML = COINS.map((c, i) => `<div class="coin-slot"><img src="${c.icon}" alt=""><div><small>${c.name}</small><b>${inv.currency[i].count}</b></div></div>`).join('');
  const focusIndex = document.activeElement?.dataset.slot;
  $('inventory-grid').innerHTML = inv.slots.map((s, i) => {
    const def = s && ITEMS[s.itemId];
    return `<button class="inventory-slot${s && s.instanceId === selected ? ' selected' : ''}" data-slot="${i}" aria-pressed="${!!s && s.instanceId === selected}" aria-label="${def ? `${def.name}, ${s.count}${s.instanceId === inv.equipped ? ', equipped' : ''}` : `Empty slot ${i + 1}`}" title="${def?.name || 'Empty'}">${s ? `<img src="${def.icon}" alt=""><span class="count">${s.count}</span>${s.instanceId === inv.equipped ? '<span class="equipped">E</span>' : ''}` : ''}</button>`;
  }).join('');
  if (focusIndex !== undefined) $('inventory-grid').querySelector(`[data-slot="${focusIndex}"]`)?.focus();
  const def = slot && ITEMS[slot.itemId], image = $('inventory-item-icon'), button = $('inventory-equip');
  image.hidden = !def;
  if (def) image.src = def.icon;
  $('inventory-item-name').textContent = def?.name || 'Select an item';
  $('inventory-item-stats').textContent = def?.weapon
    ? `Damage ${def.weapon.damage + damageBonus(player.level)}\nReach ${def.weapon.range} cells\nCooldown ${def.weapon.cooldown.toFixed(2)} s\nCount ${slot.count}`
    : def ? `Count ${slot.count}\nStack limit ${def.stackLimit}\nNo use action yet` : 'Select a bag slot to inspect it.';
  button.hidden = !def?.weapon;
  button.disabled = !allowed || slot?.instanceId === inv.equipped;
  button.textContent = slot?.instanceId === inv.equipped ? 'Equipped' : 'Equip';
  button.title = allowed ? '' : 'Close inventory and finish your current action first';
  $('inventory-dev').hidden = !state.dev;
  $('dev-equip').disabled = !allowed;
  $('inventory-feedback').textContent = state.equipping ? 'Loading weapon…' : !allowed ? 'Finish your current action before changing weapons.' : state.statusMsg;
}

$('inventory-close').addEventListener('click', () => setInventoryOpen(false));
$('inventory-overlay').addEventListener('click', e => { if (e.target === $('inventory-overlay')) setInventoryOpen(false); });
$('inventory-grid').addEventListener('click', e => {
  const button = e.target.closest('[data-slot]');
  if (!button) return;
  selected = player.inventory.slots[Number(button.dataset.slot)]?.instanceId || null;
  signature = ''; updateInventory();
});
$('inventory-equip').addEventListener('click', async () => {
  if (await equipOwnedWeapon(selected)) selected = player.inventory.equipped;
  signature = ''; updateInventory();
});
$('dev-weapon').innerHTML = WEAPONS.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
$('dev-equip').addEventListener('click', async () => {
  if (await devSwapWeapon($('dev-weapon').value)) selected = player.inventory.equipped;
  signature = ''; updateInventory();
});
// Keep keyboard focus inside the modal, including when slots are re-rendered.
$('inventory-panel').addEventListener('keydown', e => {
  if (e.code !== 'Tab') return;
  const controls = [...$('inventory-panel').querySelectorAll('button, select')].filter(el => !el.disabled && el.getClientRects().length);
  const i = controls.indexOf(document.activeElement), next = (i + (e.shiftKey ? -1 : 1) + controls.length) % controls.length;
  e.preventDefault(); controls[next]?.focus();
});
