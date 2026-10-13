// Live beams in the current cube (core/beams.js): the Spicy's laser. One shines from its
// enemy's eyes from the attack's fire time (core/enemies.js fireAt) and bursts at the hit frame;
// the aim follows the player meanwhile, and the beam follows its enemy's turning. A stagger or
// death of the enemy puts it out. Travel and level resets clear them.
import { player } from './state.js';
import { insideSolid } from '../physics/collide.js';
import { startBeam, aimBeam, castBeam, muzzleAt, beamHits } from '../core/beams.js';
import { blowOf } from '../core/enemies.js';
import { hitPlayer } from './enemycombat.js';
import { beamFx } from './juice.js';
import { drawBeams, removeBeamViews } from '../render/beams.js';

export let beams = [];
const solid = (x, y, z) => insideSolid(x, z, y);
const chest = () => ({ x: player.x, y: player.y + player.h * 0.55, z: player.z });
const target = () => player.ragdoll || player.hp <= 0 ? null : player;   // a fallen player is not followed or hit

export function fireBeam(e, a) {
  const b = castBeam(startBeam(e, a.beam, chest()), solid, target());
  Object.assign(b, { enemy: e, attack: e.attacks, blow: blowOf(e.profile, a), profile: e.profile });
  e.beam = b;
  beams.push(b);
  beamFx(b, 'start');
  return b;
}
function end(b, what) {
  beamFx(b, what);
  removeBeamViews([b]);
  if (b.enemy.beam === b) b.enemy.beam = null;
  return false;
}
export function updateBeams(dt) {
  beams = beams.filter(b => {
    const p = target(), e = b.enemy;
    if (e.mode !== 'attack' || e.attacks !== b.attack) return end(b, 'fizzle');
    b.t += dt;
    Object.assign(b, muzzleAt(e, b.spec.muzzle));
    if (p) aimBeam(b, chest(), dt);
    castBeam(b, solid, p);
    if (b.t < b.spec.time) return true;
    if (p && beamHits(b, p)) {
      const dx = player.x - b.x, dz = player.z - b.z, l = Math.hypot(dx, dz) || 1;
      hitPlayer(b.blow, b.x, b.z, dx / l, dz / l);
    }
    return end(b, 'burst');
  });
}
export const drawAllBeams = (dt, off) => drawBeams(beams, dt, off);
export function clearBeams() {
  removeBeamViews(beams);
  for (const b of beams) if (b.enemy.beam === b) b.enemy.beam = null;
  beams = [];
}
