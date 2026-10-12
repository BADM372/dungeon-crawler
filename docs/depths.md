# Depths

Quick reference for every depth (`Y = 0` to `Y = -20`, `depth = -Y`). Themes come from
`src/themes/index.js` and `src/themes/caves.js`. A theme starts at its depth and lasts until
the next one. The layout comes from `src/world/layout.js`, and enemy levels come from
`enemyRoll` in `src/core/enemies.js`.

> **Status:** the "intended enemies" column is the **planned roster**. It is not implemented
> yet. Right now every species spawns at every depth (4–14 spiders, 0–2 Stunders, 0–3
> snakes, 0–2 each of Octonauts, Fire-faces, Triangles and Fire-cats per cube; see
> `src/game/enemyspawn.js` and [combat.md](combat.md)). The **levels are implemented** and
> already apply to all species.

## Overview

| Depth | Theme | Kind | Layout (ring radius) | Fluids / river | Enemy level (base, range) | Intended enemies |
|---:|---|---|---|---|---|---|
| 0 | Meadow islands | surface | town + road to the first well | water | 1 (always 1) | none in the town / merchant camp; spiders, snakes on the road |
| 1 | Meadow islands | surface, sky islands | arc, r=3 | water | 1 (always 1) | spiders, snakes |
| 2 | Meadow islands | surface, sky islands | arc, r=3 | water | 2 (1–3) | spiders, snakes |
| 3 | Snowy peaks | surface, sky islands | arc, r=3 | water | 2 (1–3) | spiders, snakes, rare Stunder |
| 4 | Badlands | surface | arc, r=3 | water (some lava / acid) | 3 (2–4) | snakes, Stunders, spiders |
| 5 | Root caves | cave | arc, r=3 | water | 3 (2–4) | spiders, snakes, Stunders |
| 6 | Root caves | cave | arc, r=2 | water | 4 (3–5) | spiders, snakes, Stunders |
| 7 | Frozen caves | cave | arc, r=2 | water | 4 (3–5) | Octonauts, Stunders, spiders |
| 8 | Frozen caves | cave | arc, r=2 | water | 5 (4–6) | Octonauts, Stunders, spiders |
| 9 | Fungal swamp | cave | arc, r=2 | acid river | 5 (4–6) | Octonauts, snakes, spiders |
| 10 | Fungal swamp | cave | arc, r=2 | acid river | 6 (5–7) | Octonauts, snakes, spiders |
| 11 | Spider nests | cave | arc, r=2 | acid river | 6 (5–7) | spiders (heavy), Stunders, few Octonauts |
| 12 | Spider nests | cave | arc, r=2 | acid river | 7 (6–8) | spiders (heavy), Stunders, few Octonauts |
| 13 | Crystal mines | cave | arc, r=1 | water (some lava) | 7 (6–8) | Triangles, Stunders, Octonauts |
| 14 | Crystal mines | cave | arc, r=1 | water (some lava) | 8 (7–9) | Triangles, Stunders, Octonauts |
| 15 | Buried ruins | cave | arc, r=1 | acid river, lava | 8 (7–9) | Triangles, Octonauts, snakes, first Fire-cats |
| 16 | Buried ruins | cave | arc, r=1 | acid river, lava | 9 (8–10) | Triangles, Octonauts, snakes, first Fire-cats |
| 17 | Volcanic depths | cave | arc, r=1 | lava river | 9 (8–10) | Fire-faces, Fire-cats, Stunders |
| 18 | Volcanic depths | cave | arc, r=1 | lava river | 10 (9–11) | Fire-faces, Fire-cats, Stunders |
| 19 | Obsidian abyss | cave, large voids | arc, r=1 | lava only | 10 (9–11) | Fire-faces, Fire-cats, Triangles |
| 20 | Obsidian abyss | cave, the core | 3×3 core around the axis | lava only | 11 (10–12) | Fire-faces, Fire-cats, Triangles |

## Enemy levels

- Base level: `1 + floor(depth / 2)`.
- Depths 0 and 1: always level 1.
- From depth 2: a seeded −1 / 0 / +1 roll, weighted 25% / 50% / 25%, clamped to at least 1.
  The roll is per cube, species and spawn floor, so it is stable when you come back.
- Levels never follow the player's level. Only HP, damage, XP and coins scale. Size, speed,
  timing and knockback stay the same.
- Coins: both ends of the species' coin range are multiplied by `1 + 0.25 × (L − 1)` and
  rounded.

## Species stats by level

At enemy level `L`:

| Species | Tier | HP | Damage | XP | Coins at L1 (copper) |
|---|---|---|---|---|---|
| Spider | weak | `30 + 4(L−1)` | `15 + 2(L−1)` | `20 + 5(L−1)` | 4–8 |
| Snake | weak | `40 + 5(L−1)` | `16 + 2(L−1)` | `30 + 7(L−1)` | 6–12 |
| Octonaut | medium | `80 + 9(L−1)` | `20 + 3(L−1)` | `55 + 13(L−1)` | 12–22 |
| Stunder | heavy | `120 + 14(L−1)` | `30 + 3(L−1)` | `80 + 20(L−1)` | 20–35 |
| Fire-face | strong, ranged | `110 + 12(L−1)` | `22 + 3(L−1)` (+6 burn) | `90 + 20(L−1)` | 24–40 |
| Fire-cat | strong | `120 + 13(L−1)` | `26 + 3(L−1)` | `95 + 22(L−1)` | 22–38 |
| Triangle | strong, ranged | `150 + 16(L−1)` | `28 + 4(L−1)` | `110 + 25(L−1)` | 28–46 |

For example, at depth 20 (base level 11): spider 70 HP / 35 damage, Stunder 260 HP /
60 damage, Triangle 310 HP / 68 damage.

## Notes on the intended roster

- The roster rises from weak species near the surface to the strong fire and Triangle
  species at the bottom. Each theme has one or two signature species:
  - Stunders in the badlands and root caves.
  - Octonauts (pale blue) in the frozen caves and the swamp.
  - Spiders in the nests.
  - Triangles (purple, crystalline) in the mines and ruins.
  - Fire-faces and Fire-cats in the volcanic depths and the abyss.
- Depth 0 is enemy-free around the town and the merchant camp (`enemyFreeAt` in
  `src/world/town.js`: `Y = 0` and `max(|X|, |Z|) ≤ 1`).
- To implement it, `enemySpots` (or the per-species spawners) needs a per-theme list of
  species and counts, for example a `enemies` field on each theme in `src/themes/`.
