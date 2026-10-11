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

## Starting town (`world/town.js`, `gen/town.js`)

The spawn cube `(0,0,0)` is an authored clearing, rotated to match its **single
outgoing side portal**. It contains the four permanent `blender/town.glb`
buildings: inn, stable, pet shop and blacksmith. Their staggered positions and
individual oblique rotations form an asymmetric clearing, not a street grid.
They are non-interactive, with conservative axis-aligned envelopes of their
rotated footprints, including attached props. Spawn is in the central clearing;
branching curved paths connect the frontages and lead through the grove's opening.
Paths are rendered as continuous ribbons rather than whole-cell paving. No well,
voids or extra exits exist inside town.

All three merchant tents are in a separate **merchant camp one cube in front of
town**, along its outgoing road: `step(TOWN_KEY, seed % 4)`. They flank a winding
through-path at different offsets and angles. The camp has two side portals, one
back to town and one onward; it has no spawn portal, pond or permanent houses.
Authored prop placements are shared by worker metadata and rendering without
marking the camp as town. Both gates and every building/tent frontage are validated
by a body-radius-aware flood-fill before rendering.

Both clearing tiles are pinned to lowland sockets and one layer **before any WFC
collapse**. All dry ground is exactly level 4 (2 game units); the town's reserved
five-cell pond has a lower bed and water surface. Clearing face profiles and corner
levels are fixed, and neighbouring terrain's shared boundary corners are pinned
during smoothing, including the camp-to-countryside edge. Neither clearing depends
on generation retries, exploration order or the `?arche=` debug override. Buildings,
pond, spawn and paths are reserved before placing vegetation or validating
reachability.

Sixteen large oak/elm/birch trees from `blender/town_trees.glb` form an irregular
perimeter grove, with smaller shrubs and flowers in reserved pockets. The trees
are 6–7 units tall, higher than the inn; their crowns may overhang the clearing,
but only the trunks block movement. Tree species and scale/yaw vary deterministically.
The existing cutaway includes building and canopy occlusion volumes, independently
of body colliders, so foreground roofs/foliage reveal the player as the camera turns.

`enemyFree` is generation metadata, retained on cached maps and checked before any
species-specific spawn selection. The town and the one-cube-wide **surface** buffer
(`Y=0`, `max(abs(X), abs(Z)) <= 1`, including diagonals if they exist) have no enemies.
Along the current surface road: **town → safe merchant camp → enemies → well**.
This is not temporary spawn protection and does not make the underground safe.

The initial loading screen waits for both the ordinary prop library and the town
building/tree libraries. Static building/tent colliders are generated in the worker,
independent of download timing; rendering cannot accidentally remove them.

`npm test` in `mockup/` includes town checks across seeds and all four exit
orientations: flat dry ground, guaranteed town pond, four houses inside town and
three tents only in the adjacent road cube, non-overlapping assets, dry reachable
gates/frontages using actual movement probes, generation-order-independent
boundaries, curved path geometry, safe-buffer spawns/revisits, box/trunk collision,
canopy occlusion, and matching Blender exports. For real worker/asset/render checks,
run `await (await import('./tests/town-browser-checks.js')).runTownChecks()` from
`game.html`'s devtools.

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

## Falls into the cube below (`world/cascades.js`, `gen/cascades.js`)

- **The look:** a pool in one cube spills over the edge of its void and pours out through
  the bottom of the glass box. In the cube below, the stream comes in through the top of
  the box into a catch pool at the same spot. Falling through the void there lands you in
  that pool.
- **Decision:** the shared vertical face decides it from world data only (void field,
  layout, the face's own random stream), so either cube may be generated first. A fall
  needs:
  - void allowed in the upper cube;
  - a void cell inside the inner 8×8 with solid ground on the side it flows from;
  - a cell at least 5 away from the wells and rings of both cubes and from the upper
    cube's own catch pool.

  Chance 45%. The fluid is the depth's river fluid 60% of the time, otherwise its fluid mix.
- **Upper cube:** forces the void cell open and floods a small pool beside it. Neither gets
  slabs above it.
- **Lower cube:** clears the void around the spot, floods the catch pool and keeps slabs
  off it. The sheet's column is claimed, so no structure crosses it.
- **Open shaft:** the 3×3 around the fall cell (and for inflows around the cell upstream)
  stays free of slabs on every layer, so the water never seems to pass through a floor.
- **Results:** about 7% of cubes, mostly in the sky islands and the abyss. Over 8 worlds,
  all 270 falls have a matching end in the cube below.

## Falls across a side face (`world/spouts.js`, `gen/spouts.js`)

- **The look:** a stream on an upper layer of one cube runs to a side face and over it onto
  a short lip in the neighbour. From the lip's inner edge it falls into a pool on the
  ground there.
- **Face record:** the side face holds the spout: `{ pos, layer, from, type }`.
  - Both cubes must exist and have the layer.
  - The spot keeps 5 cells from the face's portal and clear of its river crossing.
  - The ground under the lip lies at least 7 levels below the layer.
  - Falls through the void in either cube keep their shafts.
  - Cave walls open around it.
  - Chance 30%. It has its own random stream, so the other face decisions do not change.
- **Source cube:** a strip of the layer 3 wide and 5 deep from the face, with a channel down
  its middle. The surface is a level under the banks, with a bank at the back.
- **Receiving cube:** a 3×1 lip on its outer ring at the same level, the catch pool just
  inside, and open air between them.
- **Matching edges:** spout slabs are pad-like (`prot` 99: flat, kept, no structures
  through them), so the layer lines up across the face just as at upper-layer portal pads.
  Over 3 worlds, no upper-layer edge cell differs on any of 1943 faces.
- **How many:** about one cube in ten gets one.

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
  cutaway shader (`frontWall` in `render/cutshader.js`). The cut rock shows as a flat
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

## Cutaway (`game/cut.js`, `render/section.js`, `render/cutshader.js`, `render/ghosts.js`)

- **When and how deep:** rays from the character to the camera find what hides it, and the
  cut height drops just below that (`game/cut.js`).
- **The shape:** a nine-cornered polygon on a circle 2.8 units around the character on
  screen. The corners sit at irregular angles and the shape turns slowly (0.18 rad/s). The
  edge is hard; there is no dither.
- **What gets cut:** everything above the cut height, closer to the camera than the
  character and inside the shape, is discarded.
- **What you see instead:**
  - The back faces of cut solids show as a flat section cap, one colour per kind of solid:
    the rock strata at the cut height, the structure stone or the wood, a little darker than
    a lit floor. One colour keeps the inner faces from reading as a see-through hollow.
  - Fluids get flat caps.
  - What was removed (terrain, structures, props) is drawn again as very faint glass: a
    twin of every cut solid that shares its geometry, draws only inside the cutaway, writes
    no depth and grows a little more opaque at grazing angles, so the shapes read. There is
    one glass material per cube, because fading patches materials per cube.

## Travel and what you see (`game/travel.js`)

Walking into a portal does not cut to black. The next cube is built beside the current one
(or `CUBE_H + BASE` below or above it). Both slide past the fixed camera while the
character walks through the gate, falls down the well or rises up the ring.

The new cube is active from the first frame. The player moves in its coordinates plus the
slide offset, so when the slide ends the offset is zero and nothing jumps. The section cut
is off during the slide.

### Opened side connections

The first successful crossing of a side portal opens its shared face for the current
world. Opening is tracked explicitly by `faceKey`, not inferred from visits: visiting
both cubes via another route does not open the connection. Both gates and both copies
of the dividing glass pane disappear; cube outlines remain. Re-entry, mesh rebuilds
and low-detail proxies use the same opened-face state.

An opened side face triggers the same cube slide wherever the player approaches it,
regardless of the original portal's position or layer. The arrival preserves the
position along the face, height and motion, with the body placed a little inside the
next cube. Destination solids still block passage. A boundary lock prevents immediate
bounce-back. The minimap marks opened connections as green lines along their faces;
unopened portals retain their gold/cyan markers.

Cubes remain separate simulation spaces: player collision is cube-local, and enemies
cannot cross their boundaries. Generation, portal metadata, routing and arrival-safety
logic are unchanged; opened connections simply add paths. Down/up travel always uses
portals, except falling through voids, and never opens a side connection. Starting a
new world clears all opened faces.

Checks: `npm test` includes shared-face identity, full-face triggering, arrival
coordinates and enemy containment. From the browser's devtools, run
`await (await import('./tests/boundary-browser-checks.js')).runBoundaryChecks()` for
all four side orientations, rendering/revisits, airborne travel, blocked destinations,
generation failure, reset and unchanged vertical travel. `runRunKeyChecks()` in that
module checks left/right Shift running alongside double-tap running and input clearing.

While sliding, the old cube dissolves out and the new one dissolves in (`render/fade.js`).
The dissolve is an ordered-dither discard per cube, so depth and sorting stay intact.

The cube you leave cross-fades into its low-detail proxy, and the cube you enter out of
its proxy (if you had been there). The two use complementary dither patterns, so one draws
exactly the pixels the other drops. Every cube, full or proxy, sits in its own glass box
(`render/glass.js`) that moves and fades with it (`game/travelfx.js`), with panes omitted
on opened side connections.

The minimap and the low-detail surroundings only show cubes you have visited; prefetching
never discovers a cube. Surroundings include diagonals and distant cubes on the active
stratum, within 48 world units (three cube widths) of the player's horizontal position.
Distance is measured to cube bounds, with an eight-unit dither fade at the outer edge.
`core/viewdistance.js` holds the radius and discovery selection.

`render/neighbors.js` merges terrain/wood and fluids into render-only proxies, without
props, enemies, lights or shadows. Whole-cube bounds are frustum-culled after the camera
updates, including both sets during travel; fully fogged cubes are skipped too. A separate
culling parent preserves travel's fade visibility. Foreground proxy solids/fluids use the
screen-space cutaway region to reveal the player, independent of the active cube's cut
height; this reveal is disabled during travel.

Merged proxy geometry uses an LRU cache keyed by worker geometry identity, with a
64-entry / 32 MiB budget. Live proxies pin their geometry (so the live set can exceed the
budget); unused entries are evicted and world resets clear the cache. Each proxy retains
independent materials for fades. Refreshes and travel reuse overlapping proxies rather
than merging/drawing duplicate geometry or fading the surroundings out and back in.

Checks: `npm test` covers discovery, stratum filtering, conservative selection and distance
fades. Run `await (await import('./tests/neighbor-browser-checks.js')).runNeighborChecks()`
for geometry/material ownership, refresh/revisit reuse, opened panes, frustum rotation,
distance culling, fade isolation, shader compilation, travel rebasing and cache eviction.
`runExpandedTravelChecks()` in the same module verifies continuous proxy reuse and cleanup
during real travel through a fully explored stratum.

## Off the main thread (`world/worker.js`, `world/client.js`)

The world lives in a module worker. That covers WFC, faces, map generation and the cube
geometry (`render/cubegeo.js`, which builds typed arrays per layer). The main thread
receives each map by structured clone (the object graph survives) and the geometry as
transferred buffers, and only wraps them into meshes. The surroundings view merges those
buffers once per cached cube; the merged arrays are additional memory.

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
- **Rendering (original four-neighbor baseline):** active cube plus four low-detail
  neighbors at 60 fps, 57 draw calls. Expanded surroundings are distance/frustum/fog culled;
  draw count now depends on exploration, camera orientation and zoom.

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
