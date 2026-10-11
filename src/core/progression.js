import { createInventory, addItem, equipItem, addCopper, copperTotal, whole } from './inventory.js';
import { BASIC_SWORD } from './items.js';

export const xpToNext = level => 100 + 50 * (level - 1);
export const xpForLevel = level => 25 * (level - 1) * (level + 2);
export const maxHealth = level => 100 + 10 * (level - 1);
export const damageBonus = level => 2 * (level - 1);
export function levelFromXP(xp) {
  whole(xp);
  let level = Math.floor((Math.sqrt(9 + 4 * xp / 25) - 1) / 2);
  // Correct possible rounding at an exact threshold.
  while (xpForLevel(level + 1) <= xp) level++;
  while (xpForLevel(level) > xp) level--;
  return level;
}
export function xpProgress(p) {
  return { current: p.xp - xpForLevel(p.level), required: xpToNext(p.level) };
}
export function createPlayerStats() {
  const inventory = createInventory();
  addItem(inventory, BASIC_SWORD.id); equipItem(inventory, inventory.slots[0].instanceId);
  return { xp: 0, level: 1, maxHp: 100, hp: 100, lastDamageAt: -Infinity, inventory };
}
export const createRun = () => ({ defeated: new Set() });
export function awardXP(p, amount) {
  whole(amount);
  const xp = whole(p.xp + amount), oldLevel = p.level, oldMax = p.maxHp;
  p.xp = xp; p.level = levelFromXP(xp); p.maxHp = maxHealth(p.level);
  if (p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + p.maxHp - oldMax);
  return p.level - oldLevel;
}
export function awardKill(p, run, enemy) {
  if (enemy.mode !== 'dead' || enemy.hp !== 0 || !enemy.id || run.defeated.has(enemy.id)) return null;
  const xp = whole(enemy.profile.xp), coins = whole(enemy.coinDrop);
  // Validate both totals before mutating any state.
  whole(p.xp + xp); whole(copperTotal(p.inventory) + coins);
  const levels = awardXP(p, xp);
  addCopper(p.inventory, coins); run.defeated.add(enemy.id);
  return { xp, coins, levels };
}
export function takeDamage(p, amount, time) {
  if (!Number.isFinite(amount) || amount < 0) throw new RangeError('Invalid damage');
  if (amount > 0) { p.hp = Math.max(0, p.hp - amount); p.lastDamageAt = time; }
}
export function regenerate(p, dt, time) {
  if (p.hp > 0 && time - p.lastDamageAt >= 5) p.hp = Math.min(p.maxHp, p.hp + 6 * dt);
}
