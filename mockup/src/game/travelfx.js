// What portal travel looks like: both cubes slide with their low-detail proxies and fade. The
// cube we leave dissolves while it moves off, the new one appears while it arrives. A proxy of
// either cube cross-fades with the full version of that cube (complementary dither patterns);
// all other proxies fade out with the old cube or in with the new one.
import { disposeWorld } from '../render/world.js';
import { removeEnemyViews, animateEnemies } from '../render/enemies.js';
import { disposeNeighbors, adoptNeighbors } from '../render/neighbors.js';
import { setFade } from '../render/fade.js';
import { state } from './state.js';
import { allEnemies } from './enemies.js';

const ease = t => t * t * (3 - 2 * t);

function ghosts(tr, fadeOld, fadeNew, off, oldOff) {
  for (const g of tr.old.ghosts) {
    g.group.position.copy(g.base).add(oldOff);
    if (g.key === tr.k) setFade(g.group, fadeNew, true); else setFade(g.group, Math.min(fadeOld, g.fade0));
  }
  for (const g of tr.ghosts) {
    g.group.position.copy(g.base).add(off);
    if (g.key === tr.oldKey) setFade(g.group, fadeOld, true); else setFade(g.group, fadeNew);
  }
}

// t: slide progress; off / oldOff: where the new / old cube is drawn
export function slideVisuals(tr, t, off, oldOff) {
  const fadeOld = 1 - ease(Math.min(1, t / 0.65)), fadeNew = ease(Math.max(0, (t - 0.3) / 0.7));
  state.world.group.position.copy(off);
  setFade(state.world.group, fadeNew);
  tr.old.world.group.position.copy(oldOff);
  setFade(tr.old.world.group, fadeOld);
  ghosts(tr, fadeOld, fadeNew, off, oldOff);
  animateEnemies(tr.old.enemies, 0, oldOff);
  for (const e of tr.old.enemies) if (e.view) e.view.group.visible = fadeOld > 0.5 && e.view.group.visible;
  tr.fadeNew = fadeNew;
}

export function endVisuals(tr) {
  disposeWorld(tr.old.world);
  removeEnemyViews(tr.old.enemies);
  disposeNeighbors(tr.old.ghosts);
  for (const g of tr.ghosts) { g.group.position.copy(g.base); setFade(g.group, 1); }
  adoptNeighbors(tr.ghosts);
  state.world.group.position.set(0, 0, 0);
  setFade(state.world.group, 1);
  for (const e of allEnemies()) if (e.view) e.view.group.visible = e.mode !== 'dead' || e.deadT < e.profile.corpseTime;
}
