// Dev tools (?dev=1): spawn any enemy kind, at any level, into the current cube.
//   J: spawn the picked kind at the cursor (else in front of the player)
// The dev panel row: kind, level (empty: the level this depth rolls), count, spawn (in front
// of the player), kill all (with XP / loot), clear (without), passive (enemies stand still).
// Spawns are ordinary enemies with ids of their own (never in the run's defeated set) and
// vanish when the cube resets. Guardian kinds get their bars and drops but no gate.
import { N } from '../core/constants.js';
import { ENEMY_KINDS, ENEMY_PROFILES, enemyRoll, makeEnemy } from '../core/enemies.js';
import { damageEnemy } from '../core/combat.js';
import { walkable, floorAt, groundY } from '../physics/enemynav.js';
import { removeEnemyViews } from '../render/enemies.js';
import { player, state, setStatus } from './state.js';
import { addEnemies, allEnemies, detachEnemies } from './enemies.js';
import { pickFloor, pointer } from './pointer.js';

const SPREAD = 1.1;   // the least distance between enemies of one spawn
let serial = 0;

// the n floors nearest (x, y, z) that fit the kind's body, apart from each other
function spotsNear(kind, x, y, z, n) {
  const h = kind.height, r = kind.radius;
  const fits = f => walkable(f, h) && [[r, 0], [-r, 0], [0, r], [0, -r]].every(([dx, dz]) => floorAt(f, f.x + 0.5 + dx, f.z + 0.5 + dz, h));
  const near = state.map.floors.filter(fits).map(f => {
    const fy = groundY(f, f.x + 0.5, f.z + 0.5);
    return { f, y: fy, d: Math.hypot(f.x + 0.5 - x, f.z + 0.5 - z) + Math.abs(fy - y) * 2 };
  }).sort((a, b) => a.d - b.d);
  const out = [];
  for (const c of near) {
    if (out.length >= n) break;
    if (out.every(o => Math.hypot(o.f.x - c.f.x, o.f.z - c.f.z) >= SPREAD || Math.abs(o.y - c.y) > 1)) out.push(c);
  }
  return out;
}

// spawn n enemies of kind `type` around at = { x, y, z } (default: the cursor, else in front of
// the player); level: a whole number, else the level this depth gives the kind. Returns them.
export function spawnEnemies(type, { level = null, n = 1, at = null } = {}) {
  const kind = ENEMY_KINDS[type];
  if (!kind) throw Error('Unknown enemy kind: ' + type);
  if (!state.map || state.transitioning) return [];
  at ??= (pointer.inside && pickFloor()) || { x: player.x + Math.sin(player.yaw) * 2.5, y: player.y, z: player.z + Math.cos(player.yaw) * 2.5 };
  const x = Math.min(N - 0.5, Math.max(0.5, at.x)), z = Math.min(N - 0.5, Math.max(0.5, at.z));
  const list = spotsNear(kind, x, at.y, z, n).map(({ f, y }, i) => {
    const roll = enemyRoll(state.map, kind, f.id), lv = level ?? roll.level;
    const factor = 1 + 0.25 * (lv - 1), [lo, hi] = kind.coins.map(c => Math.round(c * factor));
    const ex = f.x + 0.5, ez = f.z + 0.5;
    return makeEnemy({
      id: `dev:${++serial}`, level: lv, coinDrop: lo + Math.floor(Math.random() * (hi - lo + 1)),
      kind, f, x: ex, y, z: ez, yaw: Math.atan2(player.x - ex, player.z - ez),
      ...(kind.guardian && { guardian: true, guardianRole: kind.guardianRole, bossPlaceholder: kind.bossPlaceholder }),
    }, kind, i);
  });
  addEnemies(list);
  return list;
}

// every living enemy dies (and pays out as if slain)
export function killEnemies() {
  let n = 0;
  for (const e of allEnemies()) if (damageEnemy(e, e.hp)) n++;
  return n;
}

// every enemy (and projectile) leaves the cube, without XP or loot
export function clearEnemies() {
  const list = detachEnemies();
  removeEnemyViews(list);
  return list.length;
}

if (state.dev) {
  const $ = id => document.getElementById(id);
  const kindSel = $('dev-kind'), levelIn = $('dev-elevel'), countIn = $('dev-count');
  for (const base of ENEMY_PROFILES) {
    const group = document.createElement('optgroup');
    group.label = base.label;
    for (const k of Object.values(ENEMY_KINDS).filter(k => k.species === base.species)) group.append(new Option(k.label, k.type));
    kindSel.append(group);
  }
  const level = () => { const v = parseInt(levelIn.value, 10); return v >= 1 ? Math.min(v, 99) : null; };
  const count = () => Math.min(20, Math.max(1, parseInt(countIn.value, 10) || 1));
  function spawn(at) {
    const list = spawnEnemies(kindSel.value, { level: level(), n: count(), at });
    const k = ENEMY_KINDS[kindSel.value];
    setStatus(list.length ? `Spawned ${list.length} × ${k.label} (level ${list[0].level})` : `No room for a ${k.label} here`);
  }
  // the controls keep their keys (typing a level must not walk or zoom)
  $('dev-spawn').addEventListener('keydown', e => e.stopPropagation());
  $('dev-spawn-go').addEventListener('click', e => { e.currentTarget.blur(); spawn({ x: player.x + Math.sin(player.yaw) * 2.5, y: player.y, z: player.z + Math.cos(player.yaw) * 2.5 }); });
  $('dev-kill').addEventListener('click', e => { e.currentTarget.blur(); setStatus(`Killed ${killEnemies()} enemies`); });
  $('dev-clear').addEventListener('click', e => { e.currentTarget.blur(); setStatus(`Removed ${clearEnemies()} enemies`); });
  $('dev-passive').addEventListener('change', e => { state.devPassive = e.target.checked; e.target.blur(); });
  addEventListener('keydown', e => {
    if (e.code === 'KeyJ' && !e.repeat && !state.inventoryOpen && !e.ctrlKey && !e.metaKey) spawn(null);
  });
}
