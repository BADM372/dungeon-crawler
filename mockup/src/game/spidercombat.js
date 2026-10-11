// Player vs spider: bites, stomping on them, and bodies pushing each other apart.
import { player, setStatus } from './state.js';
import { flash } from './hud.js';
import { knockDown } from './ragdoll.js';
import { canMove } from '../physics/canmove.js';
import { walkable, stepSpider } from '../physics/spidernav.js';

const BITE = 20;          // damage
const KNOCK = 4.5;        // knock-back speed
const TOP = 0.32;         // height of the spider's back
const BODY = 0.5;         // centre distance at which bodies touch
const BOUNCE = 6.5;       // upwards speed after a stomp
let bites = 0;

export const playerFloor = () => {
  const s = player.support;
  return player.grounded && !player.swimming && walkable(s) ? s : null;
};

export function bite(s, reach) {
  const p = player, dx = p.x - s.x, dz = p.z - s.z, d = Math.hypot(dx, dz) || 1;
  if (p.ragdoll || d > reach || Math.abs(p.y - s.y) > 0.6) return;
  if (Math.cos(Math.atan2(dx, dz) - s.yaw) < 0.5) return;
  p.vx = dx / d * KNOCK; p.vz = dz / d * KNOCK;
  // every third bite (or a deadly one) knocks the player over
  if (++bites % 3 === 0 || p.hp <= BITE) { knockDown({ damage: BITE, hop: 3.5, reason: 'Bitten by a spider!' }); return; }
  p.hp -= BITE; flash(); setStatus('Bitten by a spider!');
  p.vy = 3; p.grounded = false; p.stun = 0.35;
}

// push the player out of the spider's body, along the ground and only where it can stand
function pushPlayer(dx, dz) {
  const p = player;
  if (dx && canMove(p.x + dx, p.z, 'x', Math.sign(dx))) p.x += dx;
  if (dz && canMove(p.x, p.z + dz, 'z', Math.sign(dz))) p.z += dz;
}

export function contact(list, dt) {
  const p = player;
  for (const s of list) {
    if (s.mode === 'dead') continue;
    const dx = p.x - s.x, dz = p.z - s.z, d = Math.hypot(dx, dz), up = p.y - s.y;
    if (p.ragdoll || d > BODY) continue;
    // coming down onto its back: squashed
    if (p.vy < -0.5 && !p.grounded && up > 0.05 && up < TOP + 0.35) {
      s.mode = 'dead'; s.deadT = 0; s.speed = 0;
      p.vy = BOUNCE; p.grounded = false; p.jumpCount++;
      setStatus('Squashed a spider!');
      continue;
    }
    if (up < TOP && up > -0.6) {
      const k = (BODY - d) / (d || 1), ex = d ? dx : 1;
      pushPlayer(ex * k * 0.7, dz * k * 0.7);
      stepSpider(s, -ex * k * 0.3, -dz * k * 0.3, 0.3);
    }
  }
  // spiders keep a little apart from each other
  for (const a of list) for (const b of list) {
    if (a === b || a.mode === 'dead' || b.mode === 'dead') continue;
    const dx = a.x - b.x, dz = a.z - b.z, d = Math.hypot(dx, dz);
    if (d < 0.55 && d > 1e-4) stepSpider(a, dx / d * dt * 0.8, dz / d * dt * 0.8, 0.3);
  }
}
