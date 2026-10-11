// Real fluid hazard / ragdoll / effect / respawn checks, run from game.html's devtools:
// await (await import('./tests/water-browser-checks.js')).runWaterChecks()
import { N, LH, WATER, LAVA, ACID } from '../src/core/constants.js';
import { player, state } from '../src/game/state.js';
import { character } from '../src/render/character.js';
import { animateCharacter } from '../src/render/animator.js';
import { createPlayerStats } from '../src/core/progression.js';
import { spawnAt } from '../src/game/flow.js';
import { fallPoint } from '../src/game/fall.js';
import { updatePlayer } from '../src/game/update.js';
import { knockDown, stepRagdoll } from '../src/game/ragdoll.js';
import { movePlayer } from '../src/physics/move.js';
import { applyHazards } from '../src/physics/hazards.js';
import { groundAt } from '../src/physics/collide.js';
import { clearInput } from '../src/game/input.js';
import { paused } from './browser-checks.js';
import { fluidDeathState, tickFluidDeath } from '../src/render/fluiddeath.js';

const check = (condition, message) => { if (!condition) throw Error(message); };
function arena(fluid = WATER) {
  const floors = Array.from({ length: N * N }, (_, c) => ({ c, id: c, x: c % N, z: Math.floor(c / N),
    top: 0, bottom: -4, layer: 0, cs: [0, 0, 0, 0], split: 0, link: [] }));
  const water = floors[6 * N + 7];
  Object.assign(water, { fluid, surf: -1, top: -3, cs: [-1.5, -1.5, -1.5, -1.5] });
  return { K: 1, B: [0], floors, cols: floors.map(f => [f]), pieces: floors.map(() => []),
    blockers: floors.map(() => []), fences: new Map(), portals: [], ladders: [], falls: [],
    safe: new Uint8Array(N * N).fill(1) };
}
function reset(x = 6.5, y = 0, z = 6.5) {
  Object.assign(player, createPlayerStats(), { autoDir: null, autoRun: false, coyote: 0, jumpBuf: 0 });
  spawnAt(x, y, z);
  animateCharacter(1 / 60, 0);
}
const REASON = { [WATER]: 'Drowned!', [LAVA]: 'Burned up in lava!', [ACID]: 'Dissolved in acid!' };
function drowned(fluid = WATER) {
  check(player.hp === 0 && player.ragdoll && !player.swimming, 'Fluids must be fatal, not swimmable: ' + fluid);
  check(state.statusMsg === REASON[fluid], 'Death status missing: ' + REASON[fluid]);
  check(player.fluidDeath === fluid && fluidDeathState().fluid === fluid, 'Fluid death effect missing');
  check(fluidDeathState().tinted === (fluid !== WATER), 'Lava/acid should tint the body, water should not');
}
function respawned() {
  let steps = 0;
  for (; steps < 400 && player.ragdoll; steps++) { stepRagdoll(1 / 60); tickFluidDeath(1 / 60); }
  check(steps >= 120, 'Fluid deaths keep the body around for the effect');
  tickFluidDeath(1 / 60);
  check(!fluidDeathState().tinted, 'Respawn must restore the body tint');
  check(!player.ragdoll && player.hp === player.maxHp, 'Drowned player must respawn at full health');
  check(player.x === state.arrival.x && player.y === state.arrival.y && player.z === state.arrival.z,
    'Death must return to the dry entry point');
  for (let i = 0; i < 5; i++) updatePlayer(1 / 60);
  check(!player.ragdoll && player.hp === player.maxHp, 'Respawn must not drown again');
}

export async function runWaterChecks() {
  check(character.ready && !state.transitioning && !state.inventoryOpen, 'Wait for assets/travel and close inventory');
  return paused(async () => {
    const savedPlayer = { ...player }, savedState = { map: state.map, arrival: state.arrival,
      statusMsg: state.statusMsg, statusUntil: state.statusUntil }, results = [];
    clearInput();
    try {
      for (const fluid of [LAVA, ACID]) {
        state.map = arena(fluid); state.arrival = { x: 3.5, y: 0, z: 3.5 };
        reset(6.74);
        for (let i = 0; i < 120; i++) movePlayer(1 / 60, 1, 0, true, false);
        check(player.x < 7 && player.grounded && player.y === 0, 'Run must stop at the bank: ' + fluid);
        movePlayer(1 / 60, 1, 0, false, true);
        for (let i = 0; i < 120 && !player.ragdoll; i++) {
          const gr = movePlayer(1 / 60, player.x < 7.5 ? 1 : 0, 0, false, false);
          if (!applyHazards(1 / 60, gr)) break;
        }
        drowned(fluid); respawned();
        reset(); knockDown({ reason: 'Test tumble' });
        for (const points of [player.ragdoll.p, player.ragdoll.o]) for (const p of points) { p[0] += 1; p[1] -= 1; }
        stepRagdoll(1 / 60); drowned(fluid); respawned();
        results.push((fluid === LAVA ? 'lava' : 'acid') + ': edge guard, jump and ragdoll deaths, effect, tint restore, respawn');
      }

      state.map = arena(); state.arrival = { x: 3.5, y: 0, z: 3.5 };
      const water = state.map.floors[6 * N + 7];
      reset(6.74);
      for (let i = 0; i < 120; i++) movePlayer(1 / 60, 1, 0, true, false);
      check(player.x < 7 && player.grounded && player.y === 0, 'Run must stop at the bank');
      results.push('walking/running water-edge guard');

      movePlayer(1 / 60, 1, 0, false, true);
      let crossed = false;
      for (let i = 0; i < 120 && !player.ragdoll; i++) {
        const gr = movePlayer(1 / 60, player.x < 7.5 ? 1 : 0, 0, false, false);
        crossed ||= player.x > 7;
        if (!applyHazards(1 / 60, gr)) break;
      }
      check(crossed, 'Jump must bypass the edge guard'); drowned(); respawned();
      results.push('jump into water drowns and respawns');

      reset(7.5, 8);
      Object.assign(player, { grounded: false, vy: -18, support: null });
      for (let i = 0; i < 120 && !player.ragdoll; i++) updatePlayer(1 / 60);
      drowned(); respawned();
      results.push('high fall drowns instead of recovering from a hard landing');

      reset(); knockDown({ reason: 'Test tumble' });
      const ragdoll = player.ragdoll;
      // Move a real existing ragdoll into the pool, preserving its particle layout.
      for (const points of [ragdoll.p, ragdoll.o]) for (const p of points) { p[0] += 1; p[1] -= 1; }
      stepRagdoll(1 / 60); drowned();
      check(player.ragdoll === ragdoll, 'Drowning must not recreate an existing ragdoll');
      respawned(); results.push('existing ragdoll drowns and respawns');

      reset(7.5, 5);
      state.map.safe[water.id] = 0; // even unreachable water must not redirect the fall
      const fall = fallPoint(state.map);
      check(fall.air.x === 7.5 && fall.air.z === 6.5, 'Cube fall must keep its horizontal position over water');
      check(!groundAt(fall.rest.x, fall.rest.z, fall.rest.y, 0).s.fluid, 'Cube fall needs a dry death entry');
      state.arrival = fall.rest;
      spawnAt(fall.air.x, fall.air.y, fall.air.z);
      player.safe = { ...fall.rest };
      Object.assign(player, { grounded: false, vy: -6, support: null });
      for (let i = 0; i < 120 && !player.ragdoll; i++) updatePlayer(1 / 60);
      drowned(); respawned(); results.push('cube-fall arrival drowns once and respawns on dry ground');

      reset(7.5, water.surf * LH - 0.1);
      const ready = character.ready;
      try {
        character.ready = false;
        applyHazards(1 / 60, groundAt(player.x, player.z, player.y, 0));
        check(!player.ragdoll && player.hp === player.maxHp && player.x === state.arrival.x,
          'Before assets load, drowning must still immediately respawn');
      } finally { character.ready = ready; }
      results.push('asset-loading fallback still respawns');
      return results;
    } finally {
      Object.assign(state, savedState); Object.assign(player, savedPlayer); clearInput();
      animateCharacter(1 / 60, 0);
    }
  });
}
