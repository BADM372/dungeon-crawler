// In the game console: await (await import('/tests/browser/respawn.js')).runRespawnChecks()
// Resets to a fresh seed-3 run before and after testing.
import { N } from '../../src/core/constants.js';
import { player, state } from '../../src/game/state.js';
import { newWorld, spawnEntry, recover, die } from '../../src/game/flow.js';
import { groundAt } from '../../src/physics/collide.js';
import { updatePlayer } from '../../src/game/update.js';
import { clearInput } from '../../src/game/input.js';
import { paused } from './combat.js';

const check = (condition, message) => { if (!condition) throw Error(message); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function arena() {
  const floors = Array.from({ length: N * N }, (_, c) => ({ c, id: c, x: c % N, z: Math.floor(c / N),
    top: 0, bottom: -2, layer: 0, cs: [0, 0, 0, 0], split: 0, link: [] }));
  const cols = floors.map(f => [f]);
  cols[8 * N + 8] = [];
  return { K: 1, B: [0], floors, cols, pieces: floors.map(() => []), blockers: floors.map(() => []),
    fences: new Map(), portals: [], ladders: [], falls: [] };
}
function remainsGrounded() {
  const cube = state.cubeKey, hp = player.hp;
  const g = groundAt(player.x, player.z, player.y, 0);
  check(Number.isFinite(player.y) && g.s && !g.s.fluid && g.h === player.y, 'Respawn must put the player on dry solid ground');
  for (let i = 0; i < 120; i++) updatePlayer(1 / 60);
  check(state.cubeKey === cube && !state.transitioning && !state.fallFrom && player.grounded
    && !player.ragdoll && player.hp === hp, 'Respawn must not fall or die again while idle');
}

export async function runRespawnChecks() {
  return paused(async () => {
    try {
      await newWorld(3); clearInput();
      state.map = arena();
      state.arrival = { x: 8.5, y: 5, z: 8.5 };
      spawnEntry(); remainsGrounded();
      state.arrival = { x: 8.5, y: -Infinity, z: 8.5 };
      spawnEntry(); remainsGrounded();
      player.safe = { x: 8.5, y: 5, z: 8.5 };
      recover(); remainsGrounded();

      await newWorld(3); clearInput();
      for (const respawn of [recover, die]) {
        const invalid = { x: -1, y: 5, z: -1 };
        state.fallFrom = { key: state.cubeKey, arrival: invalid, safe: invalid,
          portalLock: state.portalLock, boundaryLock: state.boundaryLock, visit: state.visit };
        respawn();
        for (let i = 0; i < 200 && state.transitioning; i++) await delay(20);
        check(!state.transitioning, 'Return from a fall must finish');
        remainsGrounded();
      }
      return ['void entry / non-finite entry / unsafe recovery repaired', 'fall recovery and death return to solid ground without repeating'];
    } finally { clearInput(); await newWorld(3); }
  });
}
