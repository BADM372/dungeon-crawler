import { createInventory, addInstance, addItem, equipItem, assignBar, whole } from './inventory.js';
import { OLD_SWORD, TOWN_PORTAL, HEALTH_POTION } from './items.js';
import { fixedWeapon } from './gear/generate.js';

// The player's numbers. docs/balance.md explains the targets; tools/balance.mjs plays them through.
//   a level costs XP_BASE + XP_STEP (L - 1) + XP_CURVE (L - 1)² XP, so the first levels come in a
//     few kills and later ones take about one depth each
//   maximum health: HP + HP_PER_LEVEL per level; weapon damage: + DAMAGE_PER_LEVEL per level
//   regeneration: REGEN of the maximum per second, after REGEN_DELAY s without damage
// learn: stronger.html#formula #levels (see learn/README.md)
export const PLAYER = Object.freeze({ HP: 100, HP_PER_LEVEL: 10, DAMAGE_PER_LEVEL: 0.02,
  XP_BASE: 500, XP_STEP: 1000, XP_CURVE: 60, REGEN: 0.04, REGEN_DELAY: 5 });
// learn: code.html#functions, stronger.html#curve #formula (see learn/README.md)
export const xpToNext = level => PLAYER.XP_BASE + PLAYER.XP_STEP * (level - 1) + PLAYER.XP_CURVE * (level - 1) ** 2;
// the XP that reaching `level` takes in all: the sum of xpToNext below it
export const xpForLevel = level => {
  const n = level - 1;
  return PLAYER.XP_BASE * n + PLAYER.XP_STEP * n * (n - 1) / 2 + PLAYER.XP_CURVE * (n - 1) * n * (2 * n - 1) / 6;
};
// learn: code.html#functions, stronger.html#levels (see learn/README.md)
export const maxHealth = level => PLAYER.HP + PLAYER.HP_PER_LEVEL * (level - 1);
// what the player's level multiplies weapon damage by
// learn: code.html#functions, combat.html#damage, stronger.html#levels (see learn/README.md)
export const levelDamage = level => 1 + PLAYER.DAMAGE_PER_LEVEL * (level - 1);
export function levelFromXP(xp) {
  whole(xp);
  let lo = 1, hi = 2;
  while (xpForLevel(hi) <= xp) hi *= 2;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (xpForLevel(mid) <= xp) lo = mid; else hi = mid; }
  return lo;
}
// What a kill is worth against the player's level: enemies more than two levels below give
// less and less (a tenth at the least), so going back up to farm does not pay; enemies above
// give a tenth more per level, up to half again.
// learn: stronger.html#curve #farming (see learn/README.md)
export function xpScale(playerLevel, enemyLevel) {
  const d = playerLevel - enemyLevel;
  return (d < 0 ? 10 + Math.min(5, -d) : Math.max(1, 10 - 2 * Math.max(0, d - 2))) / 10;   // in tenths: exact
}
export function xpProgress(p) {
  return { current: p.xp - xpForLevel(p.level), required: xpToNext(p.level) };
}
// a new run: the Old Sword in hand, the town portal scroll on quick bar slot 1 and a few health
// potions on slot 2
export const START_POTIONS = 3;
export function createPlayerStats() {
  const inventory = createInventory();
  equipItem(inventory, addInstance(inventory, fixedWeapon(OLD_SWORD.id)));
  assignBar(inventory, 0, addInstance(inventory, { itemId: TOWN_PORTAL.id }));
  addItem(inventory, HEALTH_POTION.id, START_POTIONS);
  assignBar(inventory, 1, inventory.slots.find(s => s?.itemId === HEALTH_POTION.id).instanceId);
  return { xp: 0, level: 1, maxHp: maxHealth(1), hp: maxHealth(1), lastDamageAt: -Infinity, drankAt: -Infinity, inventory };
}
// defeated: enemy IDs; loot: cube key -> pickups lying there (game/loot.js); chests: the reward
// sites whose chests are open (game/chests.js); townPortal: the open town portal, if any
// (game/townportal.js)
// learn: memory.html#notes (see learn/README.md)
export const createRun = () => ({ defeated: new Set(), unlockedGates: new Set(), loot: new Map(), chests: new Set(), townPortal: null });
// learn: stronger.html#xp-code (see learn/README.md)
export function awardXP(p, amount) {
  whole(amount);
  const xp = whole(p.xp + amount), oldLevel = p.level, oldMax = p.maxHp;
  p.xp = xp; p.level = levelFromXP(xp); p.maxHp = maxHealth(p.level);
  if (p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + p.maxHp - oldMax);
  return p.level - oldLevel;
}
// XP is granted at once; the coins are only returned: they drop as loot to be picked up
// learn: stronger.html#xp-code (see learn/README.md)
export function awardKill(p, run, enemy) {
  if (enemy.mode !== 'dead' || enemy.hp !== 0 || !enemy.id || run.defeated.has(enemy.id)) return null;
  const xp = whole(Math.round(enemy.profile.xp * xpScale(p.level, enemy.level || 1))), coins = whole(enemy.coinDrop);
  whole(p.xp + xp);   // validate before mutating any state
  const levels = awardXP(p, xp);
  run.defeated.add(enemy.id);
  if (enemy.guardian && enemy.guardianGate) run.unlockedGates.add(enemy.guardianGate);
  return { xp, coins, levels };
}
export function takeDamage(p, amount, time) {
  if (!Number.isFinite(amount) || amount < 0) throw new RangeError('Invalid damage');
  if (amount > 0) { p.hp = Math.max(0, p.hp - amount); p.lastDamageAt = time; }
}
// Drink a health potion (def: its item): it restores def.heal of the maximum health, at most one
// every def.cooldown s. The health restored, or why not: 'dead', 'wait' (too soon), 'full'.
export function drinkPotion(p, def, time) {
  if (p.hp <= 0) return 'dead';
  if (time < p.drankAt + def.cooldown) return 'wait';
  if (p.hp >= p.maxHp) return 'full';
  const before = p.hp;
  p.hp = Math.min(p.maxHp, p.hp + def.heal * p.maxHp); p.drankAt = time;
  return p.hp - before;
}
export function regenerate(p, dt, time) {
  if (p.hp > 0 && time - p.lastDamageAt >= PLAYER.REGEN_DELAY) p.hp = Math.min(p.maxHp, p.hp + PLAYER.REGEN * p.maxHp * dt);
}
