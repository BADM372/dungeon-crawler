// Changing the game's numbers while it runs, with a way back. Every change remembers the value it
// replaced, so untune() puts them back exactly. For teaching experiments (game/teach.js): "what if
// the spider saw twice as far?"
//
//   await tune('src/core/enemies.js#SPIDER.aggro', 6)   a value in one of the game's modules
//   tune(player, 'maxHp', 500)                          a value of any object
//
// Copies keep the old value: an enemy carries its own copy of its kind (e.profile, made when it
// appears) and an attack its weapon's numbers (player.sword.stats, made when it starts). So
// tuning an enemy kind also tunes the living enemies of that kind (except hp, damage, xp and coins,
// which grow with their level); the cubes the worker builds (src/world/, src/cubegen/) use their
// own copies of the modules and are not changed at all. Plain numbers a module exports
// (export const RUN_SPEED = 2.8) cannot be changed from outside.
import { ENEMY_KINDS, GROWTH } from '../core/enemies.js';
import { allEnemies } from './enemies.js';

const ROOT = new URL('../../', import.meta.url);
const changes = [];   // { obj, key, before, label }, oldest first

const isModule = o => Object.prototype.toString.call(o) === '[object Module]';
const show = v => typeof v === 'string' ? JSON.stringify(v) : Array.isArray(v) ? `[${v.join(', ')}]` : String(v);

function set(obj, key, value, label) {
  if (!changes.some(c => c.obj === obj && c.key === key)) changes.push({ obj, key, before: obj[key], label });
  obj[key] = value;
}

// tune('path#NAME.part', value) (resolves once the module is loaded) or tune(obj, 'part.part', value)
export async function tune(target, ...rest) {
  let obj, path, value, label;
  if (typeof target === 'string') {
    const [file, ref] = target.split('#');
    if (!ref) throw new Error('Say which value: "src/core/enemies.js#SPIDER.aggro"');
    obj = await import(new URL(file.replace(/^\.?\//, ''), ROOT).href);
    [value] = rest; path = ref; label = `${ref} (${file.split('/').pop()})`;
  } else {
    obj = target; [path, value, label = path] = rest;
  }
  const keys = String(path).split('.'), key = keys.pop();
  for (const k of keys) {
    if (obj?.[k] == null || typeof obj[k] !== 'object') throw new Error(`There is no object ${k} in ${label}`);
    obj = obj[k];
  }
  if (isModule(obj)) throw new Error(`${key} is a plain value the module exports (export const); it cannot be changed from outside. Look for an object that holds it.`);
  if (!(key in obj)) throw new Error(`There is no ${key} in ${label}`);
  if (Object.isFrozen(obj)) throw new Error(`${label} is frozen and cannot be changed`);
  const before = obj[key];
  set(obj, key, value, label);
  let note = '';
  // a kind of enemy: the ones already walking about get it too
  if (Object.values(ENEMY_KINDS).includes(obj) && !(key in GROWTH)) {
    const live = allEnemies().filter(e => e.mode !== 'dead' && e.profile.type === obj.type && key in e.profile);
    for (const e of live) set(e.profile, key, value, `${label} of a living ${obj.label ?? obj.type}`);
    if (live.length) note = ` (and ${live.length} living ${obj.label ?? obj.type}${live.length > 1 ? 's' : ''})`;
  }
  return `${label}: ${show(before)} -> ${show(value)}${note}`;
}

// put the values back: all of them, or those whose label starts with `which`
export function untune(which = null) {
  let n = 0;
  for (let i = changes.length - 1; i >= 0; i--) {
    const c = changes[i];
    if (which && !c.label.startsWith(which)) continue;
    c.obj[c.key] = c.before;
    changes.splice(i, 1); n++;
  }
  return n;
}

// what is changed now: [{ label, before, now }]
export const tuned = () => changes.map(c => ({ label: c.label, before: c.before, now: c.obj[c.key] }));
