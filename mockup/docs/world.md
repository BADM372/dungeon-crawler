# World of cubes (spike)

The world is an unbounded grid of cubes `(X, Y, Z)`. `Y = 0` is the surface and deeper
strata go down to `MIN_Y = -3`. Cubes come into existence lazily, the first time you get
near them, and stay around after that.

## Layers

| Layer | Code | Contents |
|---|---|---|
| World | `src/world/` | WFC tiles, faces, specs, the cube cache |
| Generator | `src/gen/` | turns a spec into a map |
| Game | `src/game/flow.js`, `portals.js`, `minimap.js` | entering cubes, portal travel, the overview |
| Render | `src/render/markers.js`, `neighbors.js` | portal looks, low-detail neighbors |

## Wave function collapse (`world/tiles.js`, `world/wfc.js`)

Each cube collapses to a **tile** with four side sockets:

- `L`: lowland.
- `H`: highland, meaning the ground reaches the first layer.
- `W`: lowland with a river crossing the face.

Tile kinds are meadow (`LLLL`), highland (`HHHH`), slope (L and H mixed), river (two `W`),
lake (one or more `W`) and gorge (both `H` and `W`).

The tile set covers all 81 socket combinations, so collapsing a cube next to any set of
collapsed neighbors always succeeds. There is no backtracking and never a contradiction.
Uniform tiles weigh more, which grows regions; the mixed tiles appear where regions meet.

Collapsing works on the set {cube + its 6 neighbors}, lowest entropy first. Each cube draws
from its own random stream (world seed plus cube key). Because the collapse is lazy, the
world depends on the seed **and the order of exploration**. Two players with the same seed
who explore differently get different worlds.

## Faces (`world/faces.js`)

A face is decided once, by whichever of its two cubes is prepared first, and stored under
the cube on its low side. Its layout comes from the face's own random stream.

**Side faces** carry:
- **Ground profile:** 16 levels sampled from world-space noise (`core/wnoise.js`) in the
  socket's height band. Both cubes pin their edge cells to the profile and blend inwards.
- **Corner vertices:** where four faces meet, the vertex gets one height from the four
  sockets there, so corner cells match too.
- **River crossing** (on `W`): all rivers flow at one world level (`RIVER_SURF`), and the
  fluid is fixed per stratum.
- **Portal:** position along the face, layer and level. Layers sit at world-fixed levels
  (`LAYER_BASE = [0, 10, 16, 22]`), so a layer-2 gate lines up on both sides.

**Vertical faces** carry a down/up portal: a well in the upper cube, a ring on the top layer
of the lower cube.

Each cube aims for 2–4 portals; the start cube has 2–3 plus a spawn pad and no entrance.
Faces already decided by a neighbor count towards that target.

## Generator changes

- Input is a spec (`world.spec(k)`) instead of a seed. Retries vary the seed but never the spec.
- Ground blends from the four face profiles into local detail, hills and plateaus.
- Upper-layer slabs are kept off the outer ring except at portal pads.
- Ramps and pools never modify the outer ring.
- Rivers start at their face crossings and meet at a junction. A lone river ends in a pool;
  lake cubes get a lake.
- Routing does A* from the first portal to each other portal. Moves already used are cheap,
  so routes share paths. Each route is kept for test bots.
- Drops are capped at 8 levels (deeper ones ragdoll you) and need an extra level of headroom.
- Lake cubes and half of the underground cubes get floating islands (no pillars).

## Travel and what you see (`game/travel.js`)

Walking into a portal does not cut to black. The next cube is built beside the current one
(or `CUBE_H + BASE` below or above it). Both slide past the fixed camera while the
character walks through the gate, falls down the well or rises up the ring.

The new cube is active from the first frame. The player moves in its coordinates plus the
slide offset, so when the slide ends the offset is zero and nothing jumps. The section cut
is off during the slide.

While sliding, the old cube dissolves out and the new one dissolves in (`render/fade.js`).
The dissolve is an ordered-dither discard per cube, so depth and sorting stay intact.

The cube you leave cross-fades into its low-detail proxy, and the cube you enter out of
its proxy (if you had been there). The two use complementary dither patterns, so one draws
exactly the pixels the other drops. Every cube, full or proxy, sits in its own glass box
(`render/glass.js`) that moves and fades with it (`game/travelfx.js`).

The minimap and the low-detail neighbours only show cubes you have visited.

## Off the main thread (`world/worker.js`, `world/client.js`)

The world lives in a module worker. That covers WFC, faces, map generation and the cube
geometry (`render/cubegeo.js`, which builds typed arrays per layer). The main thread
receives each map by structured clone (the object graph survives) and the geometry as
transferred buffers, and only wraps them into meshes. The neighbour view reuses those
buffers.

After entering a cube, the cubes behind its portals are prefetched, so travel usually
starts at once. If a cube is not ready, the player waits in the portal and a
"generating" spinner shows.

Point lights come from a fixed pool (`render/lightpool.js`). A changing light count made
three.js recompile every lit shader on each cube change, which was the biggest stutter.

## Results

- **Edge continuity:** over 400 face pairs, ground height and fluid match on every edge cell,
  corners included. Slab presence and portal positions match too.
- **Generation:** about 3 ms per cube. Over 1000 cubes, most succeed on the first attempt
  and the worst took 5.
- **Routes:** a bot walks the route from the first portal to every other portal. 2012 of
  2014 routes pass (1000 cubes, 200 worlds).
- **Rendering:** active cube plus four low-detail neighbors at 60 fps, 57 draw calls.

## Known issues / open questions

- **Stuck route:** 1 cube in 1000 has a route the character cannot walk. Corner smoothing
  pulls a slab corner below its own underside. This is an old smoothing quirk that the
  world-fixed layer levels make a bit more likely.
- **Exploration order:** the world depends on the order you explore in (see above).
- **Corner vertices:** the height rule ("H if more than two of the four sockets are H") is
  arbitrary. Highland corners can show small dips.
- **Vertical portals:** they only need to line up loosely; a pad that would overlap another
  portal moves to a free spot in that cube.
- **Not persisted:** spiders respawn when you re-enter a cube. Nothing is saved to disk.
- **Not visible yet:** depth has no look of its own (fog, darkness, palette); only the
  river fluid changes.
