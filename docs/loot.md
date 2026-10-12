# Weapon loot

Weapons are generated: each one is an instance of a base sword with its own rarity, item level,
affixes and name. The generator lives in `src/core/gear/` and is pure and seeded; the floor,
pickup and inventory code in `src/game/loot.js`, `src/game/lootlabels.js`,
`src/game/inventory.js` and `src/render/loot.js`.

## Controls

- Weapons are **not** taken by walking over them, by the coin magnet or by **C**.
- **Click** a weapon (or its label) to walk there and pick it up. The enemy under the cursor
  still wins over an item; an item wins over the floor. A full bag says so and leaves it.
- **X** toggles name labels over every item on the floor but coins. Without it only the item
  under the cursor shows its name. Labels are in the rarity's colour and stack instead of
  overlapping; they are clickable.
- **V** opens the inventory (paused, like **I**) with a **Floor** column: every item but coins
  within C's reach (4 cells across, 1.5 up or down), best first, then nearest. Take moves a
  floor item into the bag, Drop puts a bag item down at your feet. Enter (or Space) on the
  selected item, or a double-click, moves it across; arrows move through both columns. V, I or
  Esc closes. Drop also works in the plain I inventory.
- You may drop every weapon, including the equipped one and the last one. Without a weapon you
  cannot attack ("No weapon equipped") until you pick one up and equip it.
- Items you put down are `kept`: a death leaves them on the floor, while weapons enemies dropped
  during that visit go with the rest of the visit (see `docs/progression.md`).

## Item data

A bag slot or pickup holding a weapon carries its own `gen`:

```js
{ itemId: 'weapon_sword_long', count: 1,
  gen: { v: 1, rarity: 'rare', ilvl: 7, affixes: [{ id: 'swift', tier: 2, value: 8 }, ...], name: 'Duskfang' } }
```

Items keep what they rolled (not a seed), so retuning the tables does not change weapons
already found; `v` is the generator version. `core/gear/stats.js` `itemStats` turns an item
into the stats combat reads; nothing else looks at base weapon stats. A weapon without `gen`
(dev grants, tests) counts as Common. The run starts with one Common **Old Sword**.

## Generation

`rollWeapon(rng, ilvl, opts)` in `core/gear/generate.js`: rarity, then base, then affixes,
then name, each from a table.

| Rarity | Weight | Min. item level | Affixes | Base damage | Floor glow |
|---|---:|---:|---:|---:|---|
| Junk | 30 | 1 | 0 | ×0.75 | none |
| Common | 40 | 1 | 0 | ×1.00 | none |
| Uncommon | 18 | 1 | 1 | ×1.03 | ring |
| Rare | 7 | 1 | 2 | ×1.06 | ring, pool of light |
| Epic | 2.5 | 3 | 3 | ×1.10 | + short beam |
| Legendary | 0.6 | 5 | 4 | ×1.15 | + tall beam, sparks |
| Mythic | 0.12 | 9 | 4 (+1 tier) | ×1.22 | + turning runes, a real light |
| Ancient | 0.03 | 14 | 5 (+2 tiers) | ×1.30 | + very tall shimmering beam (guardians only) |

Each rarity's weight is multiplied by `exp((0.045 × (ilvl − 1) + luck) × rank)`, so better
rarities grow more likely with item level. `node tools/loot-table.mjs [n]` prints the odds per
level and per guardian (and `n` sample weapons per rarity).

**Bases** (`core/gear/bases.js`): short and medium swords from item level 1, long from 2,
broadsword from 4, greatsword from 6. The Old Sword never drops.

**Affixes** (`core/gear/affixes.js`), each at most once per item, at most three prefixes and
three suffixes. The item level picks the tier (1: 1–3, 2: 4–7, 3: 8–12, 4: 13–18, 5: 19+);
Mythic and Ancient reach one or two tiers above (up to 7).

| Affix | Kind | Stat | Tier 1 | Tier 7 |
|---|---|---|---|---|
| Sharp | prefix | + damage | 2–4 | 29–38 |
| Brutal | prefix | + % damage | 5–10 | 50–62 |
| Swift | prefix | % faster attacks (all swing times) | 3–6 | 21–25 |
| Sweeping | prefix | + % swing arc | 8–15 | 55–65 |
| Vicious | prefix | + % critical chance | 3–5 | 18–22 |
| of Reach | suffix | + reach (cells) | 0.05–0.08 | 0.30–0.36 |
| of the Leech | suffix | + life on hit | 1–2 | 13–17 |
| of Force | suffix | + % knockback | 15–30 | 125–150 |
| of Precision | suffix | + % critical damage (base ×1.5) | 10–20 | 85–100 |

Damage is `(base × rarity + flat) × (1 + percent)`, rounded, plus the player's level bonus. A
critical hit multiplies it and shows a bigger golden number. Life on hit never heals past
the maximum.

**Names** (`core/gear/names.js`) are generated for every rarity: Junk and Common get a word
and the base ("Rusty Long Sword"), Uncommon two words ("Bright Fang"), Rare and Epic a
compound ("Grimfang"), Legendary and Mythic a compound and an epithet, Ancient an old root,
a compound and an epithet. The base type shows under the name where the name does not say it.

## Drops

`weaponDrops(enemy, worldSeed)` in `core/gear/drops.js`, seeded by the world seed and the
enemy id: the same enemy always drops the same thing (also after a death brings it back,
like its coins). The item level is the enemy's level.

- Ordinary enemies: `8% + 0.4% × (level − 1)`, at most 12% (level 11 and up).
- Side guardians: one weapon, two from level 15; at least Uncommon, Rare from level 18;
  luck 0.15.
- Descent guardians: two weapons, three from level 20; at least Rare, Epic from level 20;
  luck 0.3.
- Ancient drops only from guardians.

## Extending

- A new rarity: a row in `RARITIES` (weight, gate, affix count, tier bonus, damage factor,
  colour, glow). The tests check the ordering.
- A new affix: an entry in `AFFIXES` whose `stat` `itemStats` applies (add the stat there and
  in combat if it is new). Every tier is validated by `tests/gear.test.js`.
- A new dropping weapon: the item in `core/items.js` (model, icon, base stats), then a row in
  `BASES` with its item level and tags. Affixes roll on bases whose tags they list.
- Uniques or other item kinds can come in as further `rollWeapon` options or another
  generator writing the same `{ itemId, count, gen }` shape.

## Dev tools

With `?dev=1` the inventory's developer box rolls a weapon of any base, rarity and item level:
**Grant & equip** puts it in the bag and equips it, **Drop at feet** lays it on the floor.
`__game.devDropWeapon(itemId, rarity, ilvl)` does the same from the console.

## Tests

`tests/gear.test.js` covers rarity odds and gates, deterministic JSON items, affix validity
and tiers, names, stats, drop rates and guardian floors, item instances in the bag, crits and
life on hit. In the browser console:

```js
const checks = await import('./tests/browser/inventory.js');
await checks.runWeaponLootChecks();   // guardian drops, walk-over / C, labels, click pickup, V, drops, deaths
```
