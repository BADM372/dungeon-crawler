// Knocking the player over: the body turns into a ragdoll; once it has settled the player
// either gets up where the body lies or respawns.
import { Ragdoll } from '../physics/ragdoll.js';
import { groundAt } from '../physics/collide.js';
import { WATER, LAVA, LH } from '../core/constants.js';
import { inFluid } from '../physics/fluid.js';
import { character } from '../render/character.js';
import { beginRagdoll } from '../render/ragdollpose.js';
import { fluidDeathFx } from '../render/fluiddeath.js';
import { characterYaw } from '../render/animator.js';
import { player, state, setStatus } from './state.js';
import { takeDamage } from '../core/progression.js';
import { flash } from './hud.js';
import { hurt, spawnAt, spawnEntry } from './flow.js';
import { cancelSword } from './sword.js';

// respawn: 'safe' (last safe spot), or null (get up where you lie)
export function knockDown({ damage = 0, reason = '', respawn = null, push = 0, hop = 0 } = {}) {
  player.climb = null;
  cancelSword();
  if (!character.ready) { hurt(damage, reason); return; }
  takeDamage(player, damage, state.time);
  if (damage > 0) flash();
  if (reason) setStatus(reason);
  const yaw = characterYaw(), fx = Math.sin(yaw), fz = Math.cos(yaw);
  const r = new Ragdoll(beginRagdoll(player.x, player.y, player.z), [player.vx + fx * push, player.vy + hop, player.vz + fz * push]);
  // a push topples the upper body more than the feet
  if (push) for (const i of [2, 3]) r.kick(i, [fx * push, 0, fz * push]);
  player.ragdoll = r;
  player.ragdollThen = respawn;
}

// Entering any fluid is fatal, including when an existing ragdoll tumbles in.
// The body keeps ragdolling (slowed down, sinking) under a fluid-specific effect.
const DEATH = { [WATER]: 'Drowned!', [LAVA]: 'Burned up in lava!' };
const deathReason = fluid => DEATH[fluid] || 'Dissolved in acid!';
const FLUID_DEATH_TIME = 2.2;   // keep the body around long enough for the effect

export function dieInFluid(fluid, surface) {
  if (player.hp <= 0) return;
  player.swimming = false; player.fluid = 0;
  const { x, z } = player;   // before a no-asset fallback respawns the player
  if (!player.ragdoll) knockDown({ damage: player.hp, reason: deathReason(fluid) });
  else { takeDamage(player, player.hp, state.time); flash(); setStatus(deathReason(fluid)); }
  player.fluidDeath = player.ragdoll ? fluid : 0;
  fluidDeathFx(fluid, x, surface, z, player.ragdoll);
}

// viscous fluids: the body slows down and sinks instead of bouncing off the bed
function sink(r, fluid) {
  const keep = fluid === WATER ? 0.92 : 0.82;
  for (let i = 0; i < r.p.length; i++) for (let k = 0; k < 3; k++) r.o[i][k] = r.p[i][k] - (r.p[i][k] - r.o[i][k]) * keep;
}

export function stepRagdoll(dt) {
  const r = player.ragdoll, pel = r.p[0];
  r.step(dt);
  player.x = pel[0]; player.z = pel[2]; player.y = pel[1] - 0.35;
  const gr = groundAt(player.x, player.z, player.y, 0), fluid = inFluid(gr, player.y);
  if (fluid) dieInFluid(fluid, gr.s.surf * LH);
  if (player.fluidDeath) { sink(r, player.fluidDeath); if (r.t < FLUID_DEATH_TIME) r.done = false; }
  if (pel[1] < -3) r.done = true;
  if (!r.done) return;
  player.ragdoll = null; player.fluidDeath = 0;
  if (player.hp <= 0) { setStatus('You died - back to the entry'); spawnEntry(); return; }
  if (player.ragdollThen === 'safe' || pel[1] < -3) { spawnAt(player.safe.x, player.safe.y, player.safe.z); return; }
  // get up where the body came to rest
  const g = groundAt(pel[0], pel[2], pel[1] + 0.3, 0);
  Object.assign(player, { y: g.h, visY: g.h, vx: 0, vy: 0, vz: 0, grounded: true, swimming: false, support: g.s, stun: 0.8 });
  player.getUpCount++;
}
