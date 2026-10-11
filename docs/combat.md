# Sword combat and Stunder

- **Mouse (Diablo style):** click the floor to walk there (pathing over the floor
  graph, to the closest reachable floor if the spot cannot be reached), click an enemy
  to walk up and swing at it. Holding the button keeps following the cursor / keeps
  attacking. **Shift+click** and **F** swing towards the cursor without moving. WASD
  still moves and cancels any mouse order. The character only turns when you click
  (or move), never just from hovering. **Space:** movement-only jump.
- A swing is fast and buffered (`core/combat.js`, `game/sword.js`): the blade connects
  0.16–0.27 s after it starts; from 0.3 s moving cuts the recovery short; from 0.42 s
  a queued click chains into the next swing (clicks are kept for 0.3 s). Heavier
  swords scale these times. The Slash clip (frames 15–21 are its contact) is retimed
  to fit (`swingClipTime`). During the wind-up the player steps in towards an enemy
  that is just out of reach.
- Blade hits land in a forward arc, within blade reach and vertical overlap, with
  slab / prop line-of-sight. Each target can be hit once per swing. No contact /
  landing / stomp damage.
- Hit feedback (`game/juice.js`): a short hit pause, a camera nudge, sparks and
  ichor, a knockback, a damage number and generated sounds (`audio/sfx.js`, M mutes).
  Spider bites are a short flinch; a Stunder ram or a lethal bite knocks you over.
- Swimming, ladder climbing, stun, knockdown and travel cancel / block slashes.
- The basic sword deals 30 base damage. Level-1 spider has 30 HP / 15 damage;
  Stunder has 120 HP / 30 damage, a heavier collision body and an always-knockdown
  head-down ram. The enemy under the cursor is highlighted and shows its health. Player/enemy levels and alternative weapons scale these numbers;
  see [progression.md](progression.md). Inventory (`I`) pauses simulation and input.
- Every cube/level has a separate seeded 0–2 Stunder draw. Spawn sites must be
  dry, clear for its 2.8-cell height, linked to walkable floors, at least four
  cells from portals and spaced apart. If no safe site exists, spawn fewer.
- Both species share navigation / AI / melee. Stunder walks at 0.45 cells/s,
  pursues at 1.05 cells/s using its fast wiggling walk, commits its heading
  before the ram, and contacts at animation frame 16.
- Actual GLB death clips play once and hold their corpse poses, then fade and
  release their skeletons, mixers and instance materials. Portals detach /
  slide / dispose both species, rather than leaving enemies in the old cube.

## Fluids and falls

- Walking/running stops at edges facing water, lava or acid; jumps, knockbacks and
  airborne falls can still enter them. Bridges and dry floors above fluids remain walkable.
- Entering any fluid is fatal (`physics/fluid.js`, `dieInFluid` in `game/ragdoll.js`):
  you drown in water, burn up in lava, dissolve in acid. The player ragdolls, slowed
  down and sinking, for at least 2.2 s, then respawns at the cube entry with full
  health. Existing ragdolls die the same way when they tumble in.
- There are no dedicated death animations; `render/fluiddeath.js` layers an effect
  over the ragdoll: a splash and bubbles (water); embers, smoke, a glowing then
  charred body and an orange light (lava); fizz, vapour and a green body that fades
  away (acid). The shared character material is restored when that ragdoll ends.
- Falling through a cube into a fluid preserves the landing position, but records
  a nearby dry entry so death does not cause a death/respawn loop.
- Lava and acid *falls* (the sheets pouring off ledges) are unchanged: lavafalls knock
  you down for 50 damage, acid falls hurt over time.

## Development

Run the game and its tests from any checkout:

```sh
uv run --no-project tools/serve.py 8001   # or: npm run serve -- 8001
# http://localhost:8001/?seed=123
npm test
```

When working in a git worktree, the server automatically serves `/assets/*`
from the main checkout, while game code stays in the worktree. This permits
re-exporting Blender assets in the main checkout without copying them into the
worktree. Asset tests follow the same convention (`CRAWLER_ASSETS_ROOT` can
point them at a different checkout).

Use `--assets-root /path/to/repo` to override asset location. The player GLB
is unarmed: just the skinned body, clips and empty `hand.L` / `hand.R` sockets.
The game separately loads `assets/sword.glb` and mounts it on `hand.R` at
runtime. Gameplay equipment uses `game/equipment.js`: it loads a weapon first,
then atomically updates inventory equipment and the hand-held model. `?dev=1`
adds a grant-and-equip sword selector to inventory. `render/character.js` also
exposes low-level `loadSword(url)` / `equipSword(null)` for renderer tests only;
these do not change inventory or combat stats. Swimming / climbing hides the prop.
`Climb` is an in-place IK loop covering two ladder rungs (0.56 game units);
vertical speed advances its phase, descent reverses it, and stopping holds
the grip. Regenerate via the Blender commands in
`character.py`, `spider.py` and `sword.py`. Tests check balance, hit timing,
direction / reach / height, cancellations, deterministic spawns, clearance,
navigation and the exported asset/clip contract.

For browser integration checks, load the game, wait for the assets, then run
in the browser console:

```js
const checks = await import('./tests/browser/combat.js');
await checks.runCombatChecks(); // real input (click on an enemy, F), controller, damage, GLB poses, cleanup
await checks.runClimbChecks(); // ladder controller, reverse / hold / exits, dynamic weapon
await checks.runTravelCheck(); // real portal; leaves the player in the next cube
const water = await import('./tests/browser/water.js');
await water.runWaterChecks(); // all fluids: edge guard, jumps/high falls, ragdolls, effects, dry respawn
const inventory = await import('./tests/browser/inventory.js');
await inventory.runInventoryChecks(); // resets the run; UI, equipment, rewards, revisits
```
