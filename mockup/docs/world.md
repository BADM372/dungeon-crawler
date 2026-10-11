# World of cubes (spike)

The world is an unbounded grid of cubes `(X, Y, Z)`. `Y = 0` is the surface and deeper
strata go down to depth 20 (`MIN_Y = -20`). Cubes come into existence lazily, the first time you get
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

Which faces carry portals is decided by the depth's layout (see below), not per cube.

## Layout: the spiral down (`world/layout.js`)

Which cubes exist and how they connect depends only on the world seed:

- **Depth 0:** the town (0,0,0, the spawn) and a short road out to the first well.
- **Depths 1–19:** an arc of a two-cube-wide ring around the vertical axis under the town.
  You come up through the ring at one end; the well down is 150–240° further around. The
  next depth's arc starts right below that well.
- **Ring size:** the radius shrinks with depth (3 → 2 → 1), so the way down spirals
  inwards. That is about 35 / 25 / 15 cubes per depth, with a spine of about 14 / 10 / 5
  cubes from the ring to the well.
- **Depth 20:** the core, the 3×3 cubes around the axis.
- **Spine:** a spine of portals always connects the up ring to the well. Every other cube of
  the arc hangs off a neighbour closer to the spine, and about 12% extra portals make loops.

Layer counts are part of the WFC state. A collapsing cube's count is drawn towards its
neighbours' counts, so tall regions form. A face's portal sits on any layer both cubes
have, half the time the highest one. That gives L0 32%, L1 44%, L2 19%, L3 4%.

## Void and relief

- **Void:** a cube may have columns with no ground at all, open to the depth below. This is
  only allowed where the cube below exists in the next depth's layout (`world/voids.js`).
- **How much:** the amount comes from the theme. It is large for the sky islands (depths 1–3)
  and the abyss (19), small for crevasses and sinkholes in between.
- **Shape:** the void field is world-space noise, and face profiles carry `VOID` cells, so
  open areas line up across faces.
- **What stays solid:** portal pads, the ground around them and rivers. Upper slabs over
  void float without pillars.
- **Falling in:** you fall into the cube below (`game/fall.js`) with the vertical slide. You
  come out at the same spot, 5 units over the ground, so the hard landing costs about 20 HP.
  If it is void there too, you keep falling.
- **Relief:** themes also have a `relief` that stretches highland faces (up to level ~18 in
  the snowy peaks) and makes hills and plateaus taller.

## Cube archetypes (`gen/archetypes.js`)

Every cube gets a big shape on top of the blended ground. The shaping fades out towards the
faces, so the outer ring still matches the neighbours.

| Archetype | Shape |
|---|---|
| plain | nothing extra |
| chasm | a winding split across the cube with raised rims |
| spire | a tall needle on a raised base |
| sinkhole | a round pit with a raised rim |
| archipelago | islands |
| mesa | one big flat-topped block |
| crater | a ring wall around a lake of the depth's fluid |

Chasms, sinkholes and archipelagos open to the void where the world allows it. Elsewhere
they hold the depth's fluid instead: a river gorge, an acid canal or a lava sea.

The archetype is chosen by the theme's weights (`arche`), scaled by how the WFC kind leans:
highland towards mesa and spire, lake towards archipelago and crater, gorge towards chasm.
The town and its road stay plain. In dev mode, `?arche=<name>` forces one archetype
everywhere.

Structures: a stair never runs right beside a bridge at a similar height, and timber legs
under plank bridges never stand where another structure passes underneath.

## Caves (depth 5 and deeper)

- **Chamber walls:** cave cubes are enclosed by rock walls. A side face's `wall` (in
  `world/profile.js`) is shared by both cubes. Each cube raises its outer ring to the wall
  height (levels 17–23) and the ring inside it to a rough half-height foot.
- **Openings:** walls open around portals and river crossings. Corners come from the shared
  vertex point, so the four faces meeting there agree.
- **Pillars:** one to three rock columns rise to the top level in every cave cube.
- **Walls down:** the faces towards the camera are cut down to just over the character in the
  cutaway shader (`frontWall` in `render/section.js`). The cut rock shows as hatched
  cross-section, like a cutaway model.

## Themed structures (`world/builds.js`, `render/bridges2.js`)

- **Materials per theme:** each theme (by its prop set) names the stone, wood, rope and iron
  its structures are made of. Stairs, landings, bridges, fences and ladders use shades of
  those. Examples: grey stone and dark wood in the peaks, sandstone in the badlands and
  ruins, mossy wood in the swamp, basalt and iron in the volcanic depths.
- **Bridge styles:**
  - stone arches (only over ground close below);
  - plank bridges;
  - rope bridges: spaced slats, a post at each end, rope hand lines, deeper sag, no legs;
  - iron bridges: a flat girder deck with railings and bracing.
- **Style mix:** each theme weights the styles. Rope bridges are common in the sky islands
  and spider nests, iron in the mines, volcanic depths and abyss, stone in the ruins.

## Ladders and jumps (`gen/climbs.js`, `physics/climb.js`)

Routes can now also use these moves:

- **Ladder:** up or down a cliff face of 3–14 levels between neighbouring columns. The
  ladder stands in the lower cell against the higher column's wall.
  - Both floor edges are pinned flat, so the ladder meets them exactly, and fences stay off
    them.
  - The ladder claims the space in front of the wall.
  - You get on by pushing into the wall at its foot, or by walking over the edge above it.
  - Pushing towards the wall climbs, pulling away climbs down, and Space lets go.
  - At the top you step onto the upper floor.
  - There is no climb animation yet: the walk cycle stands in.
- **Jump:** over one or two cells of open drop (or void).
  - The target is at most 1 level higher and at most 2 lower. Over two cells it must be
    exactly 2 lower, for the time in the air.
  - There must be level run-up ground behind the take-off.
  - The air over the gap is claimed, so no structure crosses it.
  - Jumping while moving is a leap of at least 3.4 units/s.
  - Routes keep a take-off waypoint for the test bots.

## Props (`render/props.js`, `render/propplace.js`)

Decoration comes from `blender/props.glb` (built by `blender/props.py` from
`blender/wants.txt`). Each theme names its prop set (`props`); neutral `any_*` rocks are
tinted with the theme's rock colour. Placement runs on the main thread when a cube's meshes
are built, seeded by the cube.

- **Ground props:** on dry floors without structures, only where they fit under the floor
  above.
- **Blocking props** (trees, boulders, columns): never in or next to route columns or near
  portals. They get round colliders (`map.blockers`) that the player and the spiders respect.
- **Ceiling props:** hang under floating slabs.
- **Wall props:** sit on cliff faces at least 1.5 high.

They are drawn as one instanced mesh per prop (and per material part), with per-cube
material clones so they fade and get cut with their cube. Props with `sway` bend in the
wind in the vertex shader. Up to six glowing props per cube add light sources for the pool.

## Generator changes

- Input is a spec (`world.spec(k)`) instead of a seed. Retries vary the seed but never the spec.
- Ground blends from the four face profiles into local detail, hills and plateaus.
- Upper-layer slabs are kept off the outer ring except at portal pads.
- Ramps and pools never modify the outer ring.
- Rivers start at their face crossings and meet at a junction. A lone river ends in a pool;
  lake cubes get a lake.
- Routing is described in "The way down" below. Moves already used are cheap, so routes
  share paths. Each route is kept for test bots and the path overlay (P).
- Drops are capped at 8 levels (deeper ones ragdoll you) and need an extra level of headroom.
- Lake cubes and half of the underground cubes get floating islands (no pillars).

## The way down (`gen/route.js`, `gen/reach.js`, `gen/escape.js`)

The world guarantees that from anywhere you can arrive, you can get to depth 20.

- **Exits:** the layout gives every cube an exit, the portal one step closer to the well
  down along the depth's portal links (`layout.exit`). The well cube's exit is the well, the
  town's is its road, and the core leads to its centre. Exits depend only on the seed.
- **Routes:** a required route from every other portal (the spawn and the up ring included)
  to the exit, then a best-effort route from the exit back to each portal. Drops and
  downhill jumps are one-way, so a portal may only be reachable from one side.
- **Optional structures:** structures needed only by the ways back or escapes are left out
  when they do not fit, together with the routes that needed them.
- **Final check:** after smoothing and fences, `reachTo` rebuilds what the character can
  physically do:
  - walk level ground and slopes, jump up one level, drop down any cliff without a fence;
  - swim, and climb out of water up to two levels;
  - use the built structures both ways.

  Every portal must reach the exit, and no route may pass a floor whose smoothed corner
  leaves less than the character's height under the slab above. Otherwise the attempt is
  retried.
- **No jump after a drop:** a route never jumps right after dropping the same way, because
  the fall carries you into the gap.
- **Fall landings:** `fallMask` marks where you can fall in from the cube above (its void
  field, a cell wider). Up to six landings there that do not lead to the exit get an escape
  route (stairs, ladders, bridges). The map's `safe` flags mark floors that lead on.
  `fallPoint` moves any landing that still does not (sealed pits, lava, acid) to the
  nearest one that does.
- **Before:** routes ran from the first portal to the others, so drops made them one-way
  in the wrong direction. 7.7% of portals could not reach the way on, and none of 12 test
  worlds could be finished; four of them trapped you in the town. Now 64 of 64 test worlds
  reach depth 20 from the town (Node check over all 21 depths, about 3 ms per cube, 1.07
  attempts per cube on average).

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
- **Routes:** a bot walks every route (portal to exit, the ways back, escapes). 1487 of
  1488 routes pass (780 cubes, 40 worlds).
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
