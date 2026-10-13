// The player chilled by an ice ball (game/enemycombat.js): frost glittering around the body
// and a cold mist sinking off it, thinning out as the chill thaws.
import { glow, soft, emit, rand, ring } from './particles.js';
import { player } from '../game/state.js';
import { chillFactor } from '../core/projectiles.js';

const COLORS = ['#ffffff', '#d8f4ff', '#9fdcff'];

export function tickChill(dt) {
  const c = player.chilled;
  if (!c || dt <= 0) return;
  const k = (1 - chillFactor(c)) / (1 - c.slow || 1), x = player.x, y = player.visY, z = player.z;
  for (let i = Math.floor(80 * k * dt + Math.random()); i > 0; i--) {
    const [dx, dz] = ring(0.3);
    emit(glow, x + dx, y + rand(0.1, 1.2), z + dz, { v: [dx * 0.3, rand(-0.3, 0.1), dz * 0.3], spread: 0.15,
      life: rand(0.4, 0.7), size: rand(0.06, 0.11), color: COLORS[i % 3], gravity: 0.6, drag: 1.5 });
  }
  if (Math.random() < 16 * k * dt) {
    const [dx, dz] = ring(0.2);
    emit(soft, x + dx, y + rand(0.3, 0.9), z + dz, { v: [0, rand(-0.4, -0.2), 0], spread: 0.3, life: rand(0.6, 0.9),
      size: rand(0.2, 0.3), grow: 0.7, color: '#cfeeff', alpha: 0.3, drag: 0.8 });
  }
}
