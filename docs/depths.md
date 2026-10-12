# Depths

Quick reference for every depth (`Y = 0` to `Y = -20`, `depth = -Y`). Themes come from
`src/themes/index.js` and `src/themes/caves.js`. A theme starts at its depth and lasts until
the next one. The layout comes from `src/world/layout.js`, the enemy roster per depth from
`DEPTH_SPAWNS` in `src/core/spawns.js`, and enemy levels from `enemyRoll` in
`src/core/enemies.js`. Enemy kinds (recoloured, stronger versions of a species) are described
in `docs/enemy-kinds.md`.

## Overview

| Depth | Theme | Kind | Layout (ring radius) | Fluids / river | Enemy level (base, range) |
|---:|---|---|---|---|---|
| 0 | Meadow islands | surface | town + road to the first well | water | 1 (always 1) |
| 1 | Meadow islands | surface, sky islands | arc, r=3 | water | 1 (always 1) |
| 2 | Meadow islands | surface, sky islands | arc, r=3 | water | 2 (1–3) |
| 3 | Snowy peaks | surface, sky islands | arc, r=3 | water | 2 (1–3) |
| 4 | Badlands | surface | arc, r=3 | water (some lava / acid) | 3 (2–4) |
| 5 | Root caves | cave | arc, r=3 | water | 3 (2–4) |
| 6 | Root caves | cave | arc, r=2 | water | 4 (3–5) |
| 7 | Frozen caves | cave | arc, r=2 | water | 4 (3–5) |
| 8 | Frozen caves | cave | arc, r=2 | water | 5 (4–6) |
| 9 | Fungal swamp | cave | arc, r=2 | acid river | 5 (4–6) |
| 10 | Fungal swamp | cave | arc, r=2 | acid river | 6 (5–7) |
| 11 | Spider nests | cave | arc, r=2 | acid river | 6 (5–7) |
| 12 | Spider nests | cave | arc, r=2 | acid river | 7 (6–8) |
| 13 | Crystal mines | cave | arc, r=1 | water (some lava) | 7 (6–8) |
| 14 | Crystal mines | cave | arc, r=1 | water (some lava) | 8 (7–9) |
| 15 | Buried ruins | cave | arc, r=1 | acid river, lava | 8 (7–9) |
| 16 | Buried ruins | cave | arc, r=1 | acid river, lava | 9 (8–10) |
| 17 | Volcanic depths | cave | arc, r=1 | lava river | 9 (8–10) |
| 18 | Volcanic depths | cave | arc, r=1 | lava river | 10 (9–11) |
| 19 | Obsidian abyss | cave, large voids | arc, r=1 | lava only | 10 (9–11) |
| 20 | Obsidian abyss | cave, the core | 3×3 core around the axis | lava only | 11 (10–12) |

## Enemies per depth

Each depth has its own roster (`DEPTH_SPAWNS` in `src/core/spawns.js`). The town and the
merchant camp have no enemies (`enemyFreeAt` in `src/world/town.js`: `Y = 0` and
`max(|X|, |Z|) ≤ 1`). The rest of the depth-0 road uses the row for depth 0.

A roster entry is `species chance count (packs) [kinds]`:

- **chance**: how likely a cube is to have the species at all. No percentage means always.
- **count**: how many spawn when it is there.
- **packs**: the biggest group it spawns in. No value means each one spawns on its own.
- **kinds**: which kinds of the species spawn, and how often. Each pack draws one kind, so a
  pack is all Redbacks or all plain spiders. No value means the species' base kind.

`mix` is the most species a single cube can hold.

| Depth | mix | Roster |
|---:|---:|---|
| 0 | 1 | snakes 1–2 |
| 1 | 2 | snakes 2–4, Stunders 20% 1 |
| 2 | 3 | snakes 2–5 [80% Grass snake, 20% Sand viper], spiders 60% 2–4 (packs ≤2), Stunders 25% 1 |
| 3 | 3 | spiders 8–14 (packs ≤3) [75% Frost spider, 25% Spider], Stunders 50% 1–2 [Frost stunder], Triangles 12% 1 |
| 4 | 3 | snakes 3–6 (packs ≤2) [67% Sand viper, 22% Grass snake, 11% Blood viper], spiders 80% 4–8 (packs ≤3) [80% Spider, 20% Redback], Stunders 60% 1–2 [50% Stone stunder, 50% Stunder] |
| 5 | 3 | spiders 6–10 (packs ≤3) [75% Spider, 25% Bog spider], snakes 80% 3–6 (packs ≤2) [67% Grass snake, 33% Sand viper], Stunders 60% 1–2 [67% Stunder, 33% Stone stunder] |
| 6 | 3 | spiders 7–12 (packs ≤3) [67% Spider, 22% Bog spider, 11% Redback], snakes 80% 4–7 (packs ≤2) [29% Grass snake, 57% Sand viper, 14% Blood viper], Stunders 60% 1–3 [67% Stunder, 33% Stone stunder], Octonauts 20% 1 |
| 7 | 3 | Octonauts 2–4, spiders 80% 6–10 (packs ≤3) [75% Frost spider, 25% Spider], Stunders 50% 1–2 [Frost stunder], snakes 30% 3–5 (packs ≤2) [50% Grass snake, 50% Sand viper] |
| 8 | 3 | Octonauts 3–5 (packs ≤2), spiders 80% 7–12 (packs ≤4) [75% Frost spider, 25% Spider], Stunders 60% 1–2 [67% Frost stunder, 33% Stone stunder], Triangles 15% 1 |
| 9 | 3 | snakes 6–10 (packs ≤3) [50% Grass snake, 25% Sand viper, 25% Blood viper], Octonauts 80% 2–4 (packs ≤2) [75% Bog octonaut, 25% Octonaut], spiders 60% 6–10 (packs ≤4) [75% Bog spider, 25% Spider], Stunders 25% 1–2 |
| 10 | 3 | snakes 7–12 (packs ≤3) [33% Grass snake, 33% Sand viper, 33% Blood viper], Octonauts 80% 3–5 (packs ≤2) [75% Bog octonaut, 25% Octonaut], spiders 60% 8–12 (packs ≤4) [75% Bog spider, 25% Spider], Fire-faces 10% 1 |
| 11 | 3 | spiders 16–24 (packs ≤6) [60% Spider, 20% Bog spider, 20% Redback], Stunders 50% 1–2 [50% Stunder, 50% Stone stunder], Octonauts 30% 1–2 [50% Octonaut, 50% Bog octonaut], snakes 30% 4–6 (packs ≤3) [50% Sand viper, 50% Blood viper] |
| 12 | 3 | spiders 20–28 (packs ≤7) [44% Spider, 22% Bog spider, 33% Redback], Stunders 60% 1–3 [50% Stunder, 50% Stone stunder], Octonauts 40% 1–2 [40% Octonaut, 40% Bog octonaut, 20% Coral octonaut], Triangles 15% 1 |
| 13 | 3 | Triangles 1–2 [67% Emerald triangle, 33% Triangle], Stunders 60% 1–2 [Stone stunder], Octonauts 70% 2–4 (packs ≤2) [50% Octonaut, 50% Coral octonaut], spiders 60% 10–14 (packs ≤4) [50% Spider, 25% Frost spider, 25% Redback] |
| 14 | 3 | Triangles 2–3 [67% Emerald triangle, 33% Triangle], Stunders 70% 1–3 [Stone stunder], Octonauts 70% 2–5 (packs ≤2) [50% Octonaut, 50% Coral octonaut], spiders 50% 10–14 (packs ≤4) [50% Spider, 25% Frost spider, 25% Redback] |
| 15 | 3 | Triangles 80% 1–2 [33% Triangle, 33% Emerald triangle, 33% Crimson triangle], Octonauts 80% 3–5 (packs ≤2) [67% Coral octonaut, 33% Bog octonaut], snakes 80% 8–12 (packs ≤4) [33% Sand viper, 67% Blood viper], Fire-cats 30% 1–2 |
| 16 | 4 | Triangles 80% 1–3 [33% Triangle, 33% Emerald triangle, 33% Crimson triangle], Octonauts 80% 3–6 (packs ≤2) [67% Coral octonaut, 33% Bog octonaut], snakes 60% 10–14 (packs ≤4) [33% Sand viper, 67% Blood viper], Fire-cats 50% 2–3 (packs ≤2), spiders 40% 10–16 (packs ≤5) [50% Redback, 50% Spider] |
| 17 | 3 | Fire-faces 1–2, Fire-cats 2–4 (packs ≤2), Stunders 60% 1–2 [Magma stunder], snakes 50% 10–14 (packs ≤4) [Blood viper] |
| 18 | 3 | Fire-faces 2–3, Fire-cats 3–6 (packs ≤3), Stunders 60% 2–3 [Magma stunder], spiders 30% 14–20 (packs ≤6) [Redback] |
| 19 | 3 | Fire-faces 2–3, Fire-cats 4–7 (packs ≤3), Triangles 60% 1–2 [67% Crimson triangle, 33% Triangle], Stunders 40% 1–2 [67% Magma stunder, 33% Stone stunder] |
| 20 | 4 | Fire-cats 5–9 (packs ≤3), Fire-faces 2–4, Triangles 80% 2–3 [67% Crimson triangle, 33% Triangle], Stunders 50% 2–3 [67% Magma stunder, 33% Stone stunder], spiders 30% 18–26 (packs ≤8) [67% Redback, 33% Spider] |

The design rules behind the table:

- **The surface ramps up slowly.** Depth 1 has only snakes and a rare Stunder. Depth 2 adds
  a few spiders. Depth 3 is the first spider-heavy depth, with more Stunders and a rare
  Triangle as a mini-boss. Depth 4 mixes snakes, spiders and Stunders.
- **Each theme has one or two signature species:** Octonauts in the frozen caves, snakes in
  the swamp, spiders in the nests, Triangles in the mines and ruins, Fire-faces and Fire-cats
  in the volcanic depths and the abyss.
- **Kinds follow the theme and get stronger with depth.** Frost spiders and Frost stunders
  live in the snow and ice, Bog spiders and Bog octonauts in the swamp, Stone stunders in
  the badlands, mines and ruins, Magma stunders in the volcanic depths. Within a species the
  stronger kinds take over deeper down. The snakes go from Grass snakes to Sand vipers
  (badlands) to Blood vipers (ruins and volcanic depths). Spiders go from plain spiders to
  Redbacks.
- **Rare guests preview the next theme.** A 10–20% roll lets a species show up a theme
  early: an Octonaut at 6, a Triangle at 8 and 12, a Fire-face at 10, Fire-cats at 15.
- **Ranged species stay few.** Fire-faces and Triangles never go above 4 per cube, because
  several shooters at once are hard to read and to dodge.
- **Melee species get more numerous.** Spiders go from 2–4 at depth 2 to 8–14 at 3, 20–28 in
  the nests, and up to 26 in the core. They spawn in packs, and the packs get bigger the
  deeper you go. Snakes grow the same way, but more slowly.

### Variety within a depth

Every cube rolls its own population with its own seeded stream (`population(map)`), so two
cubes at the same depth can feel quite different. Three controls decide how different:

1. **Chance**: each species rolls whether it is in the cube at all.
2. **Mix**: if more species roll present than `mix` allows, the extra ones are dropped.
   Always-present species are kept first. The rest are kept in a random order weighted by
   chance. A low mix means focused cubes (only spiders and a Stunder, say), and a high mix
   means mixed ones. Because of this cut, a rare species' real share can be lower than its
   chance. At depth 8, for example, the Triangle's 15% ends up at about 3%.
3. **Lead**: one present species (picked by chance) dominates the cube. It takes its count
   from the top half of its range, and every other species from the bottom half. This gives
   cubes like a spider den with a lone snake, or a snake pit with a few spiders, at the same
   depth.

Placement (`enemySpots` in `src/game/enemyspawn.js`) uses one seeded stream per species. The
first member of a pack keeps `profile.spacing` from every other enemy of its species. The
rest of the pack gathers within `1.5 + √size` cells of it, on the same level, at least 1.2
cells apart. Floors must have room for the biggest kind the entry can draw. If there is not
enough safe floor, fewer enemies spawn. In practice the target count is almost always met.
Each pack then draws its kind on a separate seeded stream, so kinds never move a spot.

With `?dev=1`, the depth line in the dev panel shows the cube's population. The lead species
is marked with `*`.

### Measured population

These numbers come from 4 seeds and 32 cubes per depth on real generated cubes
(`node tools/depth-population.mjs`). They are averages per cube, and "max" is the most
enemies in any one cube. The stronger kinds raise the XP per cube by 0–27% over the plain
species (the most at 15–16, where Blood vipers and Coral octonauts lead).

| Depth | Enemies | Max | XP | Depth | Enemies | Max | XP |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | 2.0 | 2 | 60 | 11 | 22.7 | 29 | 1314 |
| 1 | 3.6 | 5 | 119 | 12 | 25.1 | 29 | 1735 |
| 2 | 6.0 | 9 | 222 | 13 | 9.6 | 17 | 1222 |
| 3 | 12.7 | 16 | 431 | 14 | 10.6 | 19 | 1817 |
| 4 | 9.9 | 13 | 489 | 15 | 12.4 | 17 | 1884 |
| 5 | 12.1 | 15 | 505 | 16 | 17.7 | 32 | 2567 |
| 6 | 14.9 | 19 | 784 | 17 | 8.7 | 17 | 1800 |
| 7 | 10.7 | 16 | 668 | 18 | 10.0 | 26 | 2561 |
| 8 | 12.2 | 17 | 927 | 19 | 8.6 | 10 | 2549 |
| 9 | 14.1 | 21 | 1022 | 20 | 17.5 | 34 | 4623 |
| 10 | 19.1 | 25 | 1553 |  |  |  |  |

The enemy count drops at a theme change that brings in stronger species (13, 17, 19). The
XP per cube keeps rising.

## Enemy levels

- Base level: `1 + floor(depth / 2)`.
- Depths 0 and 1: always level 1.
- From depth 2: a seeded −1 / 0 / +1 roll, weighted 25% / 50% / 25%, clamped to at least 1.
  The roll is per cube, species and spawn floor, so it is stable when you come back.
- Levels never follow the player's level. Only HP, damage, XP and coins scale. Size, speed,
  timing and knockback stay the same. Kinds change those (`docs/enemy-kinds.md`).
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

These are the base kinds. The other kinds multiply them (`docs/enemy-kinds.md`). For example, a
level 5 Blood viper has `round(56 + 7(L−1))` = 84 HP. Per-level growth is not rounded on its
own, only the total.

For example, at depth 20 (base level 11): spider 70 HP / 35 damage, Stunder 260 HP /
60 damage, Triangle 310 HP / 68 damage.

## Proposal: levels and XP (not implemented)

The populations above are implemented. The level curve and XP are unchanged. A rough
simulation suggests they need rebalancing next. It assumes the player kills half the
enemies on the spine cubes (the cubes from the entry ring to the well, 3–16 per depth).

| Model | Depth 3 | Depth 8 | Depth 12 | Depth 20 |
|---|---|---|---|---|
| Now: `1 + floor(d/2)`, no falloff | player 14 / enemy 2 | 28 / 5 | 41 / 7 | 57 / 11 |
| `max(1, d)` levels, XP falloff 15% per level | 9 / 3 | 14 / 8 | 19 / 12 | 26 / 20 |
| `max(1, d)` levels, XP falloff 20% per level | 8 / 3 | 13 / 8 | 18 / 12 | 25 / 20 |

The old population already gave about this much XP, so the problem is not new. The player
outlevels everything quickly. They gain +2 damage and +10 HP per level, and by depth 8 they
kill every species in one or two swings.

Proposed changes:

1. **Faster enemy levels:** base level `max(1, depth)`, with the same ±1 roll from depth 2.
   That gives L20 at the core.
2. **XP falloff:** scale XP by `max(0.1, 1 − 0.15 × (playerLevel − enemyLevel))` when the
   player's level is higher. Players cannot farm shallow depths. From the middle depths on,
   the player stays about 6 levels above the depth's enemies, instead of 4–5 times their
   level. The first few levels still come quickly, as they should.
3. **Elite guests:** a rare species that shows up a theme early (the Triangle at 3) keeps the
   depth's level. The roster could get an optional level offset (`+1` for "elite") if it
   needs to be scarier.
4. **Possibly later: a threat budget.** Give each cube a budget that rises with depth and
   each species a cost (spider 1, snake 1.5, Octonaut 3, Stunder, Fire-face and Fire-cat 5,
   Triangle 6). Counts would fill the budget, so a cube with a Triangle would have fewer
   spiders. Today the lead and the bottom-half rule do a rough version of this.
