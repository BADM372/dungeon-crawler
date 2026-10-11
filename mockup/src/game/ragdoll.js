// Knocking the player over: the body turns into a ragdoll; once it has settled the player
// either gets up where the body lies or respawns.
import { Ragdoll } from '../physics/ragdoll.js';
import { groundAt } from '../physics/collide.js';
import { character } from '../render/character.js';
import { beginRagdoll } from '../render/ragdollpose.js';
import { characterYaw } from '../render/animator.js';
import { player, setStatus } from './state.js';
import { flash } from './hud.js';
import { hurt, spawnAt, spawnEntry } from './flow.js';

// respawn: 'safe' (last safe spot), or null (get up where you lie)
export function knockDown({ damage = 0, reason = '', respawn = null, push = 0, hop = 0 } = {}) {
  if (!character.ready) { hurt(damage, reason); return; }
  player.hp -= damage;
  if (damage > 0) flash();
  if (reason) setStatus(reason);
  const yaw = characterYaw(), fx = Math.sin(yaw), fz = Math.cos(yaw);
  const r = new Ragdoll(beginRagdoll(player.x, player.y, player.z), [player.vx + fx * push, player.vy + hop, player.vz + fz * push]);
  // a push topples the upper body more than the feet
  if (push) for (const i of [2, 3]) r.kick(i, [fx * push, 0, fz * push]);
  player.ragdoll = r;
  player.ragdollThen = respawn;
}

export function stepRagdoll(dt) {
  const r = player.ragdoll, pel = r.p[0];
  r.step(dt);
  player.x = pel[0]; player.z = pel[2]; player.y = pel[1] - 0.35;
  if (pel[1] < -3) r.done = true;
  if (!r.done) return;
  player.ragdoll = null;
  if (player.hp <= 0) { setStatus('You died - back to the entry'); spawnEntry(); return; }
  if (player.ragdollThen === 'safe' || pel[1] < -3) { spawnAt(player.safe.x, player.safe.y, player.safe.z); return; }
  // get up where the body came to rest
  const g = groundAt(pel[0], pel[2], pel[1] + 0.3, 0);
  Object.assign(player, { y: g.h, visY: g.h, vx: 0, vy: 0, vz: 0, grounded: true, swimming: false, support: g.s, stun: 0.8 });
  player.getUpCount++;
}
