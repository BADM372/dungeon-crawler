// HUD text, health bar and screen fades.
import { clamp } from '../core/util.js';

const $ = id => document.getElementById(id);

export function showStats(map, cube, seed, visits) {
  $('depth').textContent = cube;
  $('seed').textContent = seed;
  const s = map.stats;
  const portals = map.portals.filter(p => p.kind !== 'spawn').map(p => ['E', 'W', 'S', 'N', 'down', 'up'][p.dir] + (p.layer ? '@L' + p.layer : ''));
  $('stats').innerHTML =
    `${map.kind} · ${s.layers} layer${s.layers > 1 ? 's' : ''} · portals ${portals.join(' ')} · visit ${visits}<br>` +
    `slopes ${s.slopes} · cliffs ${s.cliffs} · ramps ${s.ramps} · pillars ${s.pillars} · ` +
    `stairs ${s.stairs} · landings ${s.landings} · bridges ${s.bridges} · fences ${s.fences}<br>` +
    `${s.fluids.join(', ') || 'no fluids'} · gen tries ${map.attempts}`;
}

export function updateHud(player, map, statusMsg) {
  $('hpbar').style.width = clamp(player.hp, 0, 100) + '%';
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
