# Player progression, inventory and equipment

## Controls

- **I** opens/closes inventory; **Escape** or Close also closes it. The panel
  pauses simulation/animations and suppresses gameplay input, including attacks,
  movement, respawn, new world, portal debug controls, camera keys and zoom.
  Held/queued input is cleared on opening and closing; keyboard focus stays inside.
- Select a bag slot to inspect it; **Equip** switches to an owned sword.
- With **`?dev=1`**, inventory has a sword selector and **Grant & equip** button.
  It grants a missing sword (once) and equips it. Without that exact flag, the
  controls are hidden and the dev grant API refuses the operation.
- Equipment changes are blocked during attacks, travel, knockdown, stun, swimming
  and climbing. Close the panel to finish an action before changing weapons.

## Run state

A new run starts with level 1, 0 XP, 100 HP and one owned/equipped basic sword.
Progression, currency, inventory and equipment survive cube travel and death.
Death (or `R`) restores the current maximum HP; there is no death penalty yet.
`N` / `newWorld()` resets the run, including defeated enemy IDs and equipment.
State is **in memory only**, not saved across page reloads.

- Next-level cost: `100 + 50 × (level − 1)` XP.
- Lifetime XP threshold: `25 × (level − 1) × (level + 2)`.
- Maximum HP: `100 + 10 × (level − 1)`.
- Weapon damage bonus: `2 × (level − 1)`.
- Level-ups add the maximum-HP increase to living players, rather than fully healing.
- Grounded, non-swimming players regenerate 6 HP/s after five seconds without
  damage. All damage paths share the same timer; inventory pauses that timer.

## Inventory and coins

`core/items.js` defines item IDs, previews, assets, stack limits and weapon stats.
`core/inventory.js` implements atomic bag/currency/equipment operations.

There are 24 normal bag slots and three reserved currency slots. Stackable items
have a 99-item limit per slot; weapons have individual instance IDs and do not
stack. Equipped gear references an owned instance, rather than copying an item.
Inventory insertion is all-or-nothing if capacity is insufficient.

**10 copper = 1 silver; 100 silver = 1 gold; 1 gold = 1,000 copper.**
Coins are item/count records, normalized after each transaction. Copper is 0–9,
silver 0–99, and gold is not subject to a normal stack limit. Operations use safe
integer copper values; spending returns change automatically. A full bag never
blocks coin rewards. There is no second wallet balance to synchronize.

Potions, crystals and sticks are registered stackables but have no use actions,
crafting, trading or acquisition systems yet.

## Enemy levels and rewards

Base level is `1 + floor(depth / 2)`. Surface/depth-1 enemies are always level 1.
From depth 2, seeded variation is −1 / 0 / +1 with weights 25% / 50% / 25%, clamped
at level 1. Difficulty never follows the player's level. Town and its surface
buffer remain enemy-free. Animation timing, movement, body size and knockback do
not scale with level.

| Stat at enemy level L | Spider | Stunder |
|---|---|---|
| HP | `30 + 4 × (L−1)` | `120 + 14 × (L−1)` |
| Damage | `15 + 2 × (L−1)` | `30 + 3 × (L−1)` |
| XP | `20 + 5 × (L−1)` | `80 + 20 × (L−1)` |
| Coin range, copper | 4–8 | 20–35 |

Both coin-range endpoints are multiplied by `1 + .25 × (L−1)`, rounded, then a
seeded integer roll is taken inclusively. IDs, levels and rewards use the cube,
species and spawn-floor ID, with a separate stream from terrain/spawn placement.

On death, XP and coins auto-credit once with status feedback. No physical loot
pickup is implemented yet. The run remembers defeated enemy IDs, so revisiting
or rebuilding a cube cannot resurrect them or duplicate rewards. Surviving
monsters currently reset on re-entry; their levels/drop rolls remain unchanged.

## Swords

| Sword | Base damage | Cooldown, seconds | Reach, cells |
|---|---:|---:|---:|
| Basic | 30 | 1.12 | .85 |
| Short | 24 | .85 | .70 |
| Medium | 36 | 1.12 | .85 |
| Long | 40 | 1.22 | 1.05 |
| Broad | 48 | 1.35 | .85 |
| Greatsword | 60 | 1.65 | 1.15 |

All use the existing Slash clip, scaled in time with the corresponding wind-up,
active interval and recovery. Swing stats are captured at attack start, so even
leveling up during a sweep cannot change its remaining hits. Blade arc, vertical
overlap, line-of-sight and one-hit-per-target rules still apply. The greatsword
currently uses the same one-handed prototype animation, not a new moveset.

`game/equipment.js` prepares/caches assets and then commits ownership selection
and visual attachment together. Failed or stale asynchronous requests cannot
replace the current weapon or cross a new-run reset. Swords mount at unit local
scale under the already-scaled `hand.R`; swimming/climbing hides them. Only the
basic sword is normally acquired. Other swords can be granted in dev inventory;
no weapon drops, shops, durability or armor are implemented.

## Tests

`npm test` covers stacking/capacity/instance identity, conversion and
change, integer validation, XP thresholds and multi-level gains, scaled enemy
profiles, deterministic rewards, exactly-once deaths, regeneration, every sword's
assets/stats/timing and swing snapshots.

In the game console:

```js
const checks = await import('./tests/browser/inventory.js');
await checks.runInventoryChecks();
```

This resets to a seed-3 run before and after checking the real modal, input pause,
icons/counts, all six mounted swords, dev gating, ordinary slot equipment, death
rewards, cube revisits, max-HP respawn, new-run reset and asynchronous race handling.
The existing combat/climbing/travel browser checks remain available; see
[combat.md](combat.md).
