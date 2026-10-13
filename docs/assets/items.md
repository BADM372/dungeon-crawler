# Loot and player equipment

![24-asset overview](../../blender/previews/items-preview.png)

Built and inspected through Blender MCP. Matches the existing flat-faceted,
texture-free clay style: warm timber, leather wraps, muted brass and steel,
soft gemstone colours and opaque stylised potion glass. The treasure chest is the
one animated asset.

## Assets

| Group | Named variants |
|---|---|
| Wooden sticks | `item_stick_short`, `item_stick_forked`, `item_stick_long` |
| Coins | `item_coin_gold`, `item_coin_silver`, `item_coin_copper` |
| Crystals | `item_crystal_ruby`, `item_crystal_diamond`, `item_crystal_emerald`, `item_crystal_sapphire`, `item_crystal_amethyst` |
| Swords | `weapon_sword_short`, `weapon_sword_medium`, `weapon_sword_long`, `weapon_sword_broad`, `weapon_sword_greatsword` |
| Ranged equipment | `weapon_bow`, `weapon_arrow` |
| Staff | `weapon_staff` (forked wood, brass collars, amethyst head) |
| Potions | `item_potion_health` (red, round), `item_potion_mana` (blue, tall), `item_potion_stamina` (green, square) |
| Treasure chest | `treasure_chest` (empty, lid on a hinge, `Open` / `Close` clips) |
| Tools | `item_town_portal` (parchment scroll on two rollers, violet portal sigil, wax seal) |

**24 assets / 8,138 triangles total.** Sticks vary in length and branching; gemstones have
distinct cuts; swords vary in blade length, width, guard and grip, not just scale.

## Treasure chest

`treasure_chest` is an empty, hollow chest: the root mesh is the body, its one child
`treasure_chest_lid` sits on the hinge (`hinge_gltf`, glTF `[0, .445, -.3]`) with its
vertices relative to it, so rotating it about its local X opens it. Two clips animate only
the lid's rotation (24 fps, sampled):

- `Open` (~1 s): a small unlatching rattle, a swing back past the stop to -114°, settling at -108°.
- `Close` (~0.75 s): a lift off the stop, an accelerating fall, a slam and a short bounce.

At rest (no clip) the lid is closed. Its floor is at `contents_gltf` (`[0, .118, 0]`),
`contents_size_gltf` (`[.84, .49]`, x by z) across, for putting things inside later. The
game builds each chest as its own object, not an instance, and plays the clips with an
`AnimationMixer` (`src/render/chests.js`); collision uses the closed bounds.

The town portal scroll only renders its icon; the game never puts tools on the floor.

## Files

- `blender/items.py`: deterministic source; uses sibling `props.py` and `town.py` helpers.
- `blender/items.blend`: editable, labelled showroom with camera and lighting.
- `assets/items.glb`: complete library, all 24 named roots at the origin.
- `assets/items/<name>.glb` and `<name>.png`: standalone exports and individual previews
  (the PNGs double as inventory icons).
- `assets/items/manifest.json`: names, triangles, authoring bounds, sizes and unit/scale contract.
- `blender/previews/items-preview.png`: overview render.
- `blender/tests/test_items.py`: geometry, repeatability and actual binary GLB validation.

Every asset is one flat-shaded Blender mesh (the chest: two, body and lid), with vertex
colours, baked geometry, and no textures, UVs, rigs, modifiers or external dependencies.
Only the chest lid is animated.
There are up to three material primitives (clay, metal, gemstone/glass); a glTF
loader may expose a root group with multiple mesh children. Keep that root when
instancing or attaching equipment. Preview plinths, labels, lights and floor
are excluded from all GLBs.

## Units and pivots — important

Export is **Y up**, with Blender `(x, y, z)` mapped to glTF `(x, z, -y)`.

- **Loot and chests:** one unit = one game cell; `game_scale=1`. Origins are
  ground-centred, with exported ground at Y=0. Front is glTF +Z.
- **Weapons and arrow:** use the same unscaled rig units as `character.py` /
  `sword.py`. `game_scale=.55` when placed directly in the game world. When
  attached under the already-scaled character, keep local scale **1**, not .55.
- **Swords/staff/bow:** origins are grip centres. Sword blade / staff length
  runs along glTF +Y (Blender +Z). Swords match the existing `hand.R` / `Slash`
  attachment convention, including the -π/6 grip rotation about X.
- **Bow:** `hand.L` grip socket; lies in XY after export, with +X forward.
  Its string-centre nock point is `[-.072, 0, 0]` in exported local space.
  Aim orientation needs to be set by the game, not inferred from global +Z.
- **Arrow:** origin is the nock, not a grip; glTF +Y points towards its head.
  Rotate to match the shot direction when placing on the bow or firing.
- Blender bone parenting is bone-tail-relative: when attaching directly to the
  rig in Blender, apply the same tail compensation as `sword.attach()`.

GLB extras include `cube_crawler_item`, `category`, `attach`, `units`,
`game_scale`, `blocking`, `radius`; equipment adds `weapon`, `socket`, axis
and grip hints. Potions add `potion_type`; the chest adds `clips`, `lid`, `hinge_gltf`,
`contents_gltf` and `contents_size_gltf`. These are metadata,
not implemented inventory effects, collision or combat rules.

All five swords are base types for generated weapons, alongside the Old Sword the run starts
with (`assets/sword.glb`). The game mounts them on `hand.R` and switches combat stats with
equipment; on the floor they lie flat, glowing by rarity (see `docs/loot.md`).
With `?dev=1`, open inventory (`I`) to roll and equip any sword. Coin types and
stackable potions/sticks/crystals have inventory definitions and preview icons;
coins normalize automatically. Potions/materials have no use actions yet. Bows,
staffs and arrows remain visual assets without gameplay behavior; reward sites place the
chest (`docs/loot.md`).
See `docs/progression.md` for inventory and balance rules.

## Rebuild / validate

```sh
Blender --background --python blender/items.py
Blender --background --python blender/tests/test_items.py
```

Via the interactive Blender MCP execute tool:

```python
import sys, importlib
sys.path.insert(0, '/absolute/path/to/dungeon-crawler/blender')
import items
importlib.reload(items)
items.main(render=False)  # saves .blend and combined + individual GLBs
```

Default `main()` also renders the overview and 24 individual previews. Tests
run in an isolated Blender process and export only into a temporary directory.
They check deterministic geometry/colours, triangle budgets, flat normals,
nondegenerate triangles, ground/grip/nock pivots, Y-up bounds, named roots,
extras, the chest's lid hinge and clip end poses, no preview objects/textures/UVs, and selection/visibility/layout
restoration after exporting.
