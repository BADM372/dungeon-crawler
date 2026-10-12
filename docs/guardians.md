# Guardian descents

Depth 2 introduces a guardian arena. Thereafter the world seed selects one guarded
descent in each two-depth band (3–4, 5–6, …); the core has no descent to guard.
Only the cube containing a real well down is eligible. Guardian descents have one
side entrance, not a collection of sideways gates. Branches and loops attach elsewhere;
fringe cubes that could only attach through the arena are omitted.

## Encounter

- Double the ordinary seeded local population, promoting exactly one member to guardian.
  Species still come from that depth's roster. All species share arena placement so their
  bodies do not overlap and the full doubled population fits.
- Every species has a separate guardian kind in `core/enemies.js` (`GUARDIAN_KINDS`),
  registered in `ENEMY_KINDS` but excluded from ordinary spawn rosters. Guardians use
  reserved hot-pink body/glow colours, pale eyes and a persistent Guardian/level label
  and pink health bar. No new model assets are needed.
- Guardians keep their species' movement and attack timing. Their kinds have 1.5× base
  health and 1.05× base damage, with a level bonus of `6 + floor(depth / 3)` above their
  normal depth roll. Their rewards scale with that strength and level.
- The guardian starts two cells before the well, facing its approach. It pursues within
  4.5 cells of that position and otherwise returns to guard it.
- The well has a stone arch and a red seal. While locked it cannot charge or transport
  the player, including direct/debug portal activation. The entrance always permits retreat.

**Guardian death alone unlocks the descent.** Ordinary enemies may remain alive. The
seal disappears, the well changes to its normal gold/cyan glow, a rising chime plays,
and the minimap updates. Unlocks last for the current run: death rollback, re-entry,
returning from below and late asset rebuilds cannot restore a defeated guardian.
Ordinary enemies retain the existing visit/death respawn rules. A new world/run resets
both unlocks and defeated enemy IDs.

## Defenders

`game/defence.js` coordinates room-level intentions while the guardian lives. Existing
species AI (`game/enemyai.js`) remains responsible for paths, movement and attacks.

Defenders occupy separate posts across the approach; ranged enemies cover from nearer
the guardian. Advancing towards the gate causes interception beyond ordinary local
aggro. Hurting the guardian rallies surviving defenders towards the fight. At most one
third can be lured towards the entrance, with a leash to their original positions;
the others hold the approach. Committed attack wind-ups are never cancelled by a new
assignment. Guardian death immediately removes defence intentions and surviving
enemies return to normal behaviour, including after they respawn.

## Generation

`cubegen/guardian.js` builds a deliberate, single-layer dry arena instead of applying
arbitrary terrain archetypes. The shared entrance is forced to the ground on both
sides of its face. Its height is shared by the interior, guardian and well. All combat
positions are connected by the enemy floor graph: no jumps, ladders, cramped slabs,
blocking clutter or rivers interrupt the fight. Perimeter rails protect drops towards
lower shared edge terrain. Cave walls and boundary profiles remain shared. Guardian
rooms cannot open onto the depth below through voids or waterfall shafts.

The generated `map.guardian` carries the reserved floor, position, approach and portal
ID. Persistent state lives separately in `run.unlockedGates`; regenerating or cloning
terrain never changes encounter identity. `core/guardians.js` owns lock queries and
the death-rollback exception. Actual travel checks the lock as well as portal charging.

## Checks

```sh
npm test
```

In browser devtools:

```js
await (await import('./tests/browser/guardians.js')).runGuardianChecks();
```

Checks cover seeded placement/graph connectivity, all seven kinds, shared entrances,
full doubled populations, navigation/spacing, defender rally and retreat, lock charging,
models/shaders, real travel, persistent unlocks, ordinary respawns and new-run reset.
