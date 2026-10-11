// HUD text, health bar and screen fades.
import { clamp } from '../core/util.js';
import { themeAt } from '../themes/depth.js';
import { xpProgress } from '../core/progression.js';
import { isFaceOpen } from '../core/boundaries.js';
import { state } from './state.js';

const $ = id => document.getElementById(id);

export function showStats(map, cube, seed, visits) {
  $('depth').textContent = `${map.depth} · ${map.town ? 'Town' : map.merchantCamp ? 'Merchant camp' : themeAt(map.depth).name}${map.enemyFree ? ' · safe' : ''}`;
  $('seed').textContent = seed;
  const s = map.stats;
  const portals = map.portals.filter(p => p.kind !== 'spawn' && !isFaceOpen(state.openedFaces, cube, p.dir)).map(p => ['E', 'W', 'S', 'N', 'down', 'up'][p.dir] + (p.layer ? '@L' + p.layer : ''));
  const open = [0, 1, 2, 3].filter(d => isFaceOpen(state.openedFaces, cube, d)).map(d => ['E', 'W', 'S', 'N'][d]);
  $('stats').innerHTML =
    `cube ${cube} · ${map.kind} · ${map.archetype} · ${s.layers} layer${s.layers > 1 ? 's' : ''} · portals ${portals.join(' ')} · open ${open.join(' ') || '-'} · visit ${visits}<br>` +
    `slopes ${s.slopes} · cliffs ${s.cliffs} · ramps ${s.ramps} · pillars ${s.pillars} · ` +
    `stairs ${s.stairs} · landings ${s.landings} · bridges ${s.bridges} · fences ${s.fences}<br>` +
    `${s.fluids.join(', ') || 'no fluids'} · gen tries ${map.attempts}`;
}

export function updateHud(player, map, statusMsg) {
  const xp = xpProgress(player);
  $('hpbar').style.width = clamp(player.hp / player.maxHp * 100, 0, 100) + '%';
  $('player-stats').textContent = `Level ${player.level} · HP ${Math.ceil(player.hp)}/${player.maxHp}`;
  $('xpbar').style.width = clamp(xp.current / xp.required * 100, 0, 100) + '%';
  $('xp-text').textContent = `XP ${xp.current}/${xp.required}`;
  $('status').textContent = statusMsg;
  $('layer').textContent = map ? `${player.layer + 1}/${map.K}` : '-';
}

export function flash() {
  const f = $('flash');
  f.style.transition = 'none'; f.style.opacity = 0.45;
  requestAnimationFrame(() => { f.style.transition = 'opacity .5s'; f.style.opacity = 0; });
}

export const fadeOut = () => { $('fade').style.opacity = 1; };
export const fadeIn = () => requestAnimationFrame(() => { $('fade').style.opacity = 0; });

// a spinner while waiting for the world worker (only if it takes more than a moment)
export function whenReady(promise) {
  const t = setTimeout(() => $('loading').classList.add('on'), 80);
  const done = () => { clearTimeout(t); $('loading').classList.remove('on'); };
  return promise.then(v => { done(); return v; }, e => { done(); throw e; });
}
