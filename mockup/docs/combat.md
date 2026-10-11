# Sword combat and Stunder

- **F / left-click:** one planted sword slash. **Space:** movement-only jump.
- Blade hits occur during Slash frames 15–21 (30 fps), in a forward arc,
  within blade reach and vertical overlap, with slab / prop line-of-sight.
  Each target can be hit once per swing. No contact / landing / stomp damage.
- Swimming, ladder climbing, stun, knockdown and travel cancel / block slashes.
- The basic sword deals 30 base damage. Level-1 spider has 30 HP / 15 damage;
  Stunder has 120 HP / 30 damage, a heavier collision body and an always-knockdown
  head-down ram. Player/enemy levels and alternative weapons scale these numbers;
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

## Water and falls

- Walking/running stops at water-facing edges; jumps and airborne falls can still
  enter water. Bridges and dry floors above water remain walkable.
- Entering water is fatal: the player ragdolls, then respawns at the cube entry
  with full health. Existing ragdolls can drown too.
- Falling through a cube into water preserves the landing position, but records
  a nearby dry entry so death does not cause a drowning/respawn loop.

## Development

Run the mockup and its tests from any checkout:

```sh
uv run --no-project mockup/serve.py 8001
# http://localhost:8001/mockup/game.html?seed=123
cd mockup && npm test
```

When working in a git worktree, the server automatically serves `/blender/*`
from the main checkout, while game code stays in the worktree. This permits
editing Blender assets in the main checkout without copying assets into the
worktree. Asset tests follow the same convention (`CRAWLER_ASSETS_ROOT` can
point them at a different checkout).

Use `--assets-root /path/to/repo` to override asset location. The player GLB
is unarmed: just the skinned body, clips and empty `hand.L` / `hand.R` sockets.
The mockup separately loads `blender/sword.glb` and mounts it on `hand.R` at
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
const checks = await import('./tests/browser-checks.js');
await checks.runCombatChecks(); // real input, controller, damage, GLB poses, cleanup
await checks.runClimbChecks(); // ladder controller, reverse / hold / exits, dynamic weapon
await checks.runTravelCheck(); // real portal; leaves the player in the next cube
const water = await import('./tests/water-browser-checks.js');
await water.runWaterChecks(); // edge guard, jumps/high falls, ragdolls, dry respawn
const inventory = await import('./tests/inventory-browser-checks.js');
await inventory.runInventoryChecks(); // resets the run; UI, equipment, rewards, revisits
```
