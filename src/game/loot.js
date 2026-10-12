// Loot lying in the cubes: defeated enemies scatter their coins, walking over a pickup takes
// it, coins within a cell pull themselves in, and C pulls in every stackable pickup within four
// cells. Pickups stay where they fell
// (per cube, for the whole run) until collected. They are credited when they reach the player.
import { player, state, setStatus } from './state.js';
import { coinDrops, inCollectReach, inMagnetReach, steppedOn } from '../core/loot.js';
import { addItem, formatCoins } from '../core/inventory.js';
import { ITEMS } from '../core/items.js';
import { groundAt } from '../physics/collide.js';
import { inFluid } from '../physics/fluid.js';
import { drawLoot } from '../render/loot.js';
import { floatText } from '../render/floattext.js';
import { sfx } from '../audio/sfx.js';

export const TOSS_TIME = 0.55;   // the arc out of the body
let nextId = 1, collectRequested = false;
let gained = null, quiet = 0;      // pickups credited recently, shown together

export const lootHere = () => state.run.loot.get(state.cubeKey) || [];
export function requestCollect() { collectRequested = true; }
// pickups dropped from now on have ids >= lootMark(); forgetLoot takes them out of a cube again
export const lootMark = () => nextId;
export function forgetLoot(key, mark) {
  const list = state.run.loot.get(key);
  if (list) state.run.loot.set(key, list.filter(p => p.id < mark || p.fly));
}

// a dry landing spot near (x, y, z) on about the same level; the body's spot otherwise
function landing(x, y, z) {
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2, r = 0.3 + Math.random() * 0.5;
    const tx = x + Math.cos(a) * r, tz = z + Math.sin(a) * r, g = groundAt(tx, tz, y + 0.5, 0.6);
    if (g.s && Math.abs(g.h - y) < 0.6 && !inFluid(g, g.h + 0.01)) return { x: tx, y: g.h, z: tz };
  }
  return { x, y, z };
}

export function dropLoot(e, copper) {
  const drops = coinDrops(copper);
  if (!drops.length) return;
  const list = state.run.loot.get(state.cubeKey) || [];
  state.run.loot.set(state.cubeKey, list);
  drops.forEach((d, i) => list.push({
    id: nextId++, ...d, ...landing(e.x, e.y, e.z),
    from: { x: e.x, y: e.y + 0.4, z: e.z }, toss: -i * 0.06,   // staggered: the coins burst out one after another
    phase: Math.random() * Math.PI * 2, fly: null, refused: false,
  }));
}

// start pulling p towards the player: delay before it lifts off, dur of the flight
function pull(p, delay, dur) { p.fly = { t: -delay, dur }; }

function credit(p) {
  if (!addItem(player.inventory, p.itemId, p.count)) return false;
  gained ||= { copper: 0, items: new Map() };
  const def = ITEMS[p.itemId];
  if (def.category === 'currency') { gained.copper += def.value * p.count; sfx('coin', { pitch: def.value >= 1000 ? 0.8 : def.value >= 10 ? 0.9 : 1 }); }
  else { gained.items.set(def.name, (gained.items.get(def.name) || 0) + p.count); sfx('pickup'); }
  quiet = 0;
  return true;
}

function announce(dt) {
  if (!gained || (quiet += dt) < 0.25) return;
  const parts = [...gained.copper ? ['+' + formatCoins(gained.copper)] : [], ...[...gained.items].map(([n, c]) => `+${c} ${n}`)];
  floatText(parts.join('  '), q => q.set(player.x, player.visY + 1.55, player.z), { life: 1.2 });
  setStatus('Picked up ' + parts.join(', ').replace(/\+/g, ''));
  gained = null;
}

export function updateLoot(dt, time) {
  const list = lootHere(), collect = collectRequested;
  collectRequested = false;
  if (!state.transitioning && !player.ragdoll && player.hp > 0 && dt > 0) {
    for (const p of list) {
      if (p.fly) continue;
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
    if (p.toss < 1) p.toss = Math.min(1, p.toss + dt / TOSS_TIME);
    if (!p.fly) continue;
    p.fly.t += dt;
    if (p.fly.t < p.fly.dur) continue;
    if (credit(p)) list.splice(i, 1);
    else { p.fly = null; p.refused = true; setStatus('Inventory is full'); }
  }
  announce(dt);
  drawLoot(list, state.world, time);
}
