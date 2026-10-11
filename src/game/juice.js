// Hit feedback: a brief hit pause, a camera nudge, sparks and ichor, damage numbers and
// sounds. Gameplay never depends on any of this.
import { player } from './state.js';
import { emit, glow, soft, rand } from '../render/particles.js';
import { floatText } from '../render/floattext.js';
import { sfx } from '../audio/sfx.js';

let stop = 0;
// world-space camera offset that springs back (camera.js)
export const kick = { x: 0, y: 0, z: 0 };

export function hitstop(seconds) { stop = Math.max(stop, seconds); }
// the frame's time scale: nearly frozen during a hit pause
export function timeScale(elapsed) {
  if (stop <= 0) return 1;
  stop -= elapsed;
  return 0.03;
}
export function cameraKick(dx, dz, amount, dy = 0) {
  const l = Math.hypot(dx, dz) || 1;
  kick.x += dx / l * amount; kick.z += dz / l * amount; kick.y += dy;
}

// the player's blade hit enemy e for dmg (killed: that was the last of its health);
// (dx, dz): the direction of the blow
export function enemyHitFx(e, dmg, killed, dx, dz) {
  const l = Math.hypot(dx, dz) || 1, nx = dx / l, nz = dz / l;
  const x = e.x - nx * e.profile.radius * 0.5, y = e.y + Math.min(e.profile.bodyHeight * 0.6, 0.7), z = e.z - nz * e.profile.radius * 0.5;
  const [c1, c2] = e.profile.ichor ?? ['#a6d84e', '#5f8f22'], n = killed ? 16 : 9;
  emit(glow, x, y, z, { life: 0.14, size: killed ? 0.8 : 0.55, grow: 0.8, color: '#ffc870', alpha: 0.9 });
  for (let i = 0; i < n; i++) {   // sparks fanning out along the blow
    const s = rand(2.5, 5.5), a = rand(-0.9, 0.9), cx = nx * Math.cos(a) - nz * Math.sin(a), cz = nz * Math.cos(a) + nx * Math.sin(a);
    emit(glow, x, y, z, { v: [cx * s, rand(0.5, 2.5), cz * s], life: rand(0.18, 0.32), size: rand(0.07, 0.11),
      color: i % 3 ? '#ffd27a' : '#ffffff', gravity: 9, drag: 3 });
  }
  for (let i = 0; i < n; i++) {   // ichor droplets
    const s = rand(1, 3);
    emit(soft, x, y, z, { v: [nx * s + rand(-0.8, 0.8), rand(1, 3), nz * s + rand(-0.8, 0.8)], life: rand(0.35, 0.6),
      size: rand(0.08, 0.14), color: i % 2 ? c1 : c2, alpha: 0.95, gravity: 11 });
  }
  const top = { x: e.x, y: e.y + e.profile.bodyHeight + 0.25, z: e.z };
  floatText(String(dmg), top, { color: killed ? '#ffb347' : '#ffffff', size: killed ? 0.3 : 0.24, life: 0.8, rise: 0.9,
    drift: rand(-0.35, 0.35), pop: 0.7 });
  hitstop(killed ? 0.09 : 0.055);
  cameraKick(nx, nz, killed ? 0.16 : 0.08);
  sfx(killed ? 'kill' : 'hit', { at: e, pitch: e.profile.pitch ?? 1.1 });
}

export function swingFx() { sfx('swing', { at: player, pitch: 0.9 + 0.2 * Math.random() }); }

// the player took dmg from something at (fx, fz)
export function playerHurtFx(dmg, fx, fz) {
  floatText('-' + Math.ceil(dmg), q => q.set(player.x, player.visY + 1.3, player.z), { color: '#ff6a5a', size: 0.24, life: 0.9, rise: 0.7, pop: 0.6 });
  hitstop(0.05);
  cameraKick(player.x - fx, player.z - fz, 0.12, -0.05);
  sfx('hurt', { at: player });
}
