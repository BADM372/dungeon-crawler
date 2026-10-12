// Loot lying in the cubes: defeated enemies scatter their coins and sometimes a weapon. Walking
// over coins and stackables takes them, coins within a cell pull themselves in, and C pulls in
// every stackable pickup within four cells. Weapons are only taken on purpose: click one (or
// its label) to walk there and pick it up, or use the V panel (game/inventory.js), which also
// puts things from the bag back on the floor. Pickups stay where they fell (per cube, for the
// whole run) until collected. They are credited when they reach the player.
// A pickup: { id, itemId, count, gen?, x, y, z, from, toss, phase, fly, refused, kept? };
// gen: a generated weapon's own data; kept: put down by the player (a death leaves it).
import { player, state, setStatus } from './state.js';
import { coinDrops, inCollectReach, inMagnetReach, inFloorReach, steppedOn, walkTakes } from '../core/loot.js';
import { addItem, addInstance, takeItem, formatCoins } from '../core/inventory.js';
import { ITEMS } from '../core/items.js';
import { RARITY, rarityOf } from '../core/gear/rarities.js';
import { weaponDrops } from '../core/gear/drops.js';
import { displayName } from '../core/gear/stats.js';
import { groundAt } from '../physics/collide.js';
import { inFluid } from '../physics/fluid.js';
import { drawLoot, lootLanded } from '../render/loot.js';
import { floatText } from '../render/floattext.js';
import { sfx } from '../audio/sfx.js';

export const TOSS_TIME = 0.55;   // the arc out of the body
const TAKE_REACH = 0.6;          // a clicked pickup is taken from this close (cells)
let nextId = 1, collectRequested = false;
let gained = null, quiet = 0;      // pickups credited recently, shown together

export const lootHere = () => state.run.loot.get(state.cubeKey) || [];
export function requestCollect() { collectRequested = true; }
// pickups dropped from now on have ids >= lootMark(); forgetLoot takes them out of a cube again
// (except what the player put down)
export const lootMark = () => nextId;
export function forgetLoot(key, mark) {
  const list = state.run.loot.get(key);
  if (list) state.run.loot.set(key, list.filter(p => p.id < mark || p.fly || p.kept));
}

// a dry landing spot near (x, y, z) on about the same level, between near and far away; the
// spot itself otherwise
function landing(x, y, z, near = 0.3, far = 0.8) {
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2, r = near + Math.random() * (far - near);
    const tx = x + Math.cos(a) * r, tz = z + Math.sin(a) * r, g = groundAt(tx, tz, y + 0.5, 0.6);
    if (g.s && Math.abs(g.h - y) < 0.6 && !inFluid(g, g.h + 0.01)) return { x: tx, y: g.h, z: tz };
  }
  return { x, y, z };
}

function place(item, at, from, extra = {}) {
  const list = state.run.loot.get(state.cubeKey) || [];
  state.run.loot.set(state.cubeKey, list);
  const p = { id: nextId++, itemId: item.itemId, count: item.count ?? 1, ...item.gen ? { gen: item.gen } : {},
    ...at, from, toss: 0, phase: Math.random() * Math.PI * 2, fly: null, refused: false, ...extra };
  list.push(p);
  return p;
}

// what enemy e leaves behind: its coins and its seeded weapon drops (core/gear/drops.js)
export function dropLoot(e, copper) {
  const from = { x: e.x, y: e.y + 0.4, z: e.z };
  coinDrops(copper).forEach((d, i) => place(d, landing(e.x, e.y, e.z), from, { toss: -i * 0.06 }));   // they burst out one after another
  weaponDrops(e, state.map?.seed ?? 0).forEach((item, i) => place(item, landing(e.x, e.y, e.z, 0.5, 1.1), from, { toss: -0.15 - i * 0.18 }));
}

// put item ({ itemId, count, gen? }) down at the player's feet; it stays there through a death
export function dropAtFeet(item) {
  return place(item, landing(player.x, player.y, player.z, 0.35, 0.8), { x: player.x, y: player.y + 0.5, z: player.z },
    { kept: true, refused: true });   // refused: not straight back in when walking over it
}
// a bag item onto the floor (the V panel): false when there is no such item
export function dropFromBag(instanceId) {
  const item = takeItem(player.inventory, instanceId);
  if (!item) return false;
  dropAtFeet(item);
  setStatus(`Dropped ${displayName(item)}`);
  return true;
}

// start pulling p towards the player: delay before it lifts off, dur of the flight
function pull(p, delay, dur) { p.fly = { t: -delay, dur }; }

function credit(p) {
  if (p.gen ? !addInstance(player.inventory, p) : !addItem(player.inventory, p.itemId, p.count)) return false;
  gained ||= { copper: 0, items: new Map(), color: null };
  const def = ITEMS[p.itemId];
  if (def.category === 'currency') { gained.copper += def.value * p.count; sfx('coin', { pitch: def.value >= 1000 ? 0.8 : def.value >= 10 ? 0.9 : 1 }); }
  else {
    const name = displayName(p);
    gained.items.set(name, (gained.items.get(name) || 0) + p.count);
    if (p.gen) gained.color = rarityOf(p).css;
    sfx('pickup');
  }
  quiet = 0;
  return true;
}

function announce(dt) {
  if (!gained || (quiet += dt) < 0.25) return;
  const parts = [...gained.copper ? ['+' + formatCoins(gained.copper)] : [], ...[...gained.items].map(([n, c]) => c > 1 ? `+${c} ${n}` : `+${n}`)];
  const single = gained.items.size === 1 && !gained.copper && gained.color;
  floatText(parts.join('  '), q => q.set(player.x, player.visY + 1.55, player.z), { life: single ? 1.6 : 1.2, ...single ? { color: single } : {} });
  setStatus('Picked up ' + parts.join(', ').replace(/\+/g, ''));
  gained = null;
}

const available = p => p.toss >= 1 && !p.fly && lootHere().includes(p);
// the clicked pickup p: the player is at it (game/orders.js); fly it in, or say why not
export function takePickup(p) {
  if (!available(p)) return false;
  if (p.gen && !player.inventory.slots.includes(null)) { setStatus('Inventory is full'); return false; }
  pull(p, 0, 0.22);
  return true;
}
export const canReachPickup = p => Math.hypot(p.x - player.x, p.z - player.z) <= TAKE_REACH && Math.abs(p.y - player.y) <= 0.8;
// straight into the bag (the V panel, game paused): false when there is no room
export function takeNow(p) {
  const list = lootHere(), i = list.indexOf(p);
  if (i < 0 || p.fly) return false;
  if (!credit(p)) { setStatus('Inventory is full'); return false; }
  list.splice(i, 1);
  return true;
}
// labelled pickups within C's reach, best first, then nearest: what the V panel lists
export function floorItems() {
  const d = p => Math.hypot(p.x - player.x, p.z - player.z);
  return lootHere().filter(p => !p.fly && p.toss >= 0 && inFloorReach(p, player.x, player.y, player.z))
    .sort((a, b) => (b.gen ? rarityOf(b).rank : -1) - (a.gen ? rarityOf(a).rank : -1) || d(a) - d(b));
}

export function updateLoot(dt, time) {
  const list = lootHere(), collect = collectRequested;
  collectRequested = false;
  if (!state.transitioning && !player.ragdoll && player.hp > 0 && dt > 0) {
    for (const p of list) {
      if (p.fly || !walkTakes(p)) continue;
      const settled = p.toss >= 1;
      // a refused pickup waits until the player has moved out of its reach again
      const near = steppedOn(p, player.x, player.y, player.z) || inMagnetReach(p, player.x, player.y, player.z);
      if (p.refused) { p.refused = near; continue; }
      if (settled && near) {
        const d = Math.hypot(p.x - player.x, p.z - player.z);
        pull(p, 0, 0.16 + d * 0.12);
      }
      else if (collect && inCollectReach(p, player.x, player.y, player.z)) {
        const d = Math.hypot(p.x - player.x, p.z - player.z);
        pull(p, d * 0.07 + Math.random() * 0.05, 0.28 + d * 0.1);   // the near ones first
      }
    }
  }
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    if (p.toss < 1) {
      p.toss = Math.min(1, p.toss + dt / TOSS_TIME);
      if (p.toss === 1 && p.gen) landed(p);
    }
    if (!p.fly) continue;
    p.fly.t += dt;
    if (p.fly.t < p.fly.dur) continue;
    if (credit(p)) list.splice(i, 1);
    else { p.fly = null; p.refused = true; setStatus('Inventory is full'); }
  }
  announce(dt);
  drawLoot(list, state.world, time, dt);
}

// a weapon hit the floor: the better it is, the more it announces itself
function landed(p) {
  const r = rarityOf(p);
  if (r.rank >= RARITY.rare.rank) sfx('drop', { at: p, pitch: 1 + 0.12 * (r.rank - RARITY.rare.rank), volume: 0.5 + 0.12 * r.rank });
  lootLanded(p, state.world);
}
