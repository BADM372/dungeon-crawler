# Cube Crawler

A browser dungeon crawler made of 16x16-cell cubes stacked into themed depths.
Plain ES modules and a vendored three.js; no build step.

## Layout

- `index.html`, `style.css`, `src/`: the game.
  - `src/core/`: pure rules and data (constants, combat, items, inventory, ...);
    `src/core/gear/` is the weapon generator (rarities, affixes, names, drops; `docs/loot.md`).
  - `src/world/`: the world graph and everything shared between cubes (layout, WFC, faces,
    falls across faces, sites, town plan), plus the worker that owns it.
  - `src/cubegen/`: builds one cube's map from the spec `world/` hands it. Files named like
    a `world/` file (`cascades`, `spouts`, `sites`, `town`) carve that shared decision into the cube.
  - `src/themes/`: per-depth data: palettes, lighting, generator settings, structure materials.
  - `src/physics/`, `src/render/`, `src/game/`: movement, drawing and game state/flow.
- `assets/`: exported game data (GLB models, item icons, manifests). The game
  loads assets only from here (and music from `music/`). These files are generated; do not edit them by hand.
- `music/`: hand-written Scrimshaw scores the game plays (`docs/music.md`). Before writing
  or changing a song, read `music/README.md` for the style, the layers and the format.
- `blender/`: authoring sources: Blender scripts and `.blend` files that export
  into `assets/`, Blender test scripts in `blender/tests/`, renders in `blender/previews/`.
- `tests/`: `node --test` unit tests; `tests/browser/` holds integration checks
  that run from the game's devtools console.
- `tools/`: dev server, the prop metadata generator, the enemy kinds preview
  (`/tools/kinds.html`, see `docs/enemy-kinds.md`), the depth population measurement, the
  weapon drop tables (`node tools/loot-table.mjs`) and the balance simulation
  (`node tools/balance.mjs`, see `docs/balance.md`).
- `docs/`: design notes; `docs/assets/` documents the asset libraries.
- `kids-docs/`: an interactive guide for children (about 12), in English and German, from the
  big ideas down to the real code and prompting (`/kids-docs/` on the dev server). Code it
  explains carries a `// kids-docs: ...` marker. After changing such code, run
  `npm run kids-docs` (`npm test` runs it too): it names the slides to review; then
  `npm run kids-docs -- --stamp`, or `-- --defer` to note them as outdated. See `kids-docs/README.md`.
- `vendor/three/`: three.js and the addons in use; `vendor/scrimshaw/`: the music score parser and synth.

## Running

```sh
npm run serve            # uv run --no-project tools/serve.py [port]
# http://localhost:8000/?seed=123   (?dev=1 for dev tools)
npm test
```

In a git worktree the server and tests take `assets/` from the main checkout;
see `docs/combat.md`.

## Re-exporting assets

```sh
Blender -b --python blender/props.py          # likewise character, spider, stunder, snake, octonaut,
                                              # fireface, triangle, firecat, sword
Blender -b --python blender/clutter.py        # libraries: clutter, items, town, town_trees
Blender -b --python blender/tests/test_clutter.py
npm run prop-metadata                         # after props/clutter changes
```
