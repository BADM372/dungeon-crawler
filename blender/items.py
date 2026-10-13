"""Cube Crawler loot / equipment library, built through Blender MCP.

Texture-free, flat-shaded, deterministic geometry; reuses props.Mesh and palette.
Weapons use character.py rig units and grip-centred pivots (runtime scale .55).
Loot/chests use game cells and ground pivots. All exported roots are at origin.
The treasure chest is the one animated asset: its lid is a child object on the
hinge with the Open and Close actions (glTF clips).

MCP: import items; items.main()
CLI: Blender -b --python blender/items.py -- [output-directory]

Default output: assets/items.glb + assets/items/ (glb, icons, manifest),
blender/items.blend, blender/previews/items-preview.png.
"""
import hashlib
import json
import math
from pathlib import Path
import random
import sys

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import props
import town

COLLECTION = 'CubeCrawlerItems'
WOOD = '#82603b'
BARK = '#6e4420'
CUT = '#bc9865'
LEATHER = '#69442d'
STEEL = '#bdc8ca'
EDGE = '#dce1d9'
IRON = '#484852'
GOLD = '#b69558'
SILVER = '#bbc4c6'
COPPER = '#b87950'
CREAM = '#e4dcc0'
GEMS = [('#b94e61', '#ef9b9f'), ('#b7d9df', '#edf3e8'),
        ('#4d9b76', '#a5d5ac'), ('#537fac', '#a2c3dc'), ('#916aaa', '#c7a3d3')]
PARCHMENT = '#e3cd9b'
PARCHMENT_EDGE = '#c3a571'
INK = '#6b4a33'
VIOLET = '#5d3f80'
LILAC = '#c4a2e6'
RIM = '#9a72c4'
PORTAL = '#2b1d42'
GLEAM = '#f0e6f5'
# Chest lid hinge (Blender, before the ground shift, which is 0 for the chest) and its clips:
# (frame, lid angle in degrees about +X, handle type); negative opens it backwards.
CHEST_HINGE = (0, .30, .445)
CHEST_FPS = 24
CHEST_CLIPS = {
    # unlatch with a little rattle, swing up past the rest angle, settle back onto it
    'Open': [(0, 0, 'AUTO_CLAMPED'), (3, -6, 'AUTO_CLAMPED'), (5, -2, 'AUTO_CLAMPED'),
             (15, -114, 'AUTO_CLAMPED'), (19, -103, 'AUTO_CLAMPED'), (23, -108, 'AUTO_CLAMPED')],
    # a small lift off the stop, an accelerating fall, a slam and a short bounce
    'Close': [(0, -108, 'AUTO_CLAMPED'), (4, -113, 'AUTO_CLAMPED'), (13, 0, 'VECTOR'),
              (15, -5, 'AUTO_CLAMPED'), (18, 0, 'AUTO_CLAMPED')],
}


class Mesh(props.Mesh):
    def __init__(self, seed):
        super().__init__(random.Random(seed))
        self.slots = []
        self.slot = 0
        # moving parts: [(name suffix, Mesh, pivot)], child objects pivoting at `pivot`
        self.parts = []

    def face(self, ids, color, glow=False, shade=1):
        super().face(ids, color, False, shade)
        self.slots.append(self.slot)


def surface(name, roughness, metallic):
    mat = props.material(name)
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    return mat


def remove_item(name):
    old = bpy.data.objects.get(name)
    if not old:
        return
    if not old.get('cube_crawler_item') and not old.get('cube_crawler_part'):
        raise ValueError(f'Refusing to replace unrelated object: {name}')
    for child in list(old.children):
        remove_item(child.name)
    data = old.data
    bpy.data.objects.remove(old, do_unlink=True)
    if data.users == 0:
        bpy.data.meshes.remove(data)


def make_mesh(m, name):
    triangles, colors, slots = [], [], []
    for face, color, slot in zip(m.faces, m.colors, m.slots):
        for i in range(1, len(face) - 1):
            tri = (face[0], face[i], face[i + 1])
            a, b, c = (Vector(m.vertices[j]) for j in tri)
            if (b - a).cross(c - a).length > 1e-10:
                triangles.append(tri)
                colors.append(color)
                slots.append(slot)
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(m.vertices, [], triangles)
    mesh.update()
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    for mat in (surface('Items_Clay', .88, 0), surface('Items_Metal', .56, .2),
                surface('Items_Facets', .38, .05)):
        mesh.materials.append(mat)
    attr = mesh.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='CORNER')
    mesh.color_attributes.active_color = attr
    for poly, color, slot in zip(mesh.polygons, colors, slots):
        poly.material_index = slot
        poly.use_smooth = False
        for loop in poly.loop_indices:
            attr.data[loop].color = color
    return mesh


def finish(m, name, info, collection):
    dz = 0
    if info['attach'] == 'ground':
        dz = -min(v[2] for part in [m] + [p[1] for p in m.parts] for v in part.vertices)
        m.vertices = [(x, y, z + dz) for x, y, z in m.vertices]
    remove_item(name)
    obj = bpy.data.objects.new(name, make_mesh(m, name))
    collection.objects.link(obj)
    obj['cube_crawler_item'] = True
    for key, value in info.items():
        obj[key] = value
    for suffix, part, pivot in m.parts:
        # vertices relative to the pivot, so the part rotates about it
        part.vertices = [(x - pivot[0], y - pivot[1], z - pivot[2]) for x, y, z in part.vertices]
        child = bpy.data.objects.new(f'{name}_{suffix}', make_mesh(part, f'{name}_{suffix}'))
        collection.objects.link(child)
        child['cube_crawler_part'] = True
        child.parent = obj
        child.location = (pivot[0], pivot[1], pivot[2] + dz)
    return obj


def part_vertices(obj):
    """The asset's vertices in root space at rest, moving parts included."""
    out = [v.co.copy() for v in obj.data.vertices]
    for child in obj.children:
        out += [child.location + v.co for v in child.data.vertices]
    return out


def lid_clips(lid):
    """The chest's Open and Close actions on the lid, owned by muted NLA tracks for export."""
    lid.animation_data_create()
    for track in list(lid.animation_data.nla_tracks):
        lid.animation_data.nla_tracks.remove(track)
    for name, keys in CHEST_CLIPS.items():
        old = bpy.data.actions.get(name)
        if old:
            bpy.data.actions.remove(old)
        act = bpy.data.actions.new(name)
        lid.animation_data.action = act
        for frame, angle, _ in keys:
            lid.rotation_euler = (math.radians(angle), 0, 0)
            lid.keyframe_insert('rotation_euler', frame=frame)
        for layer in act.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        for point, (_, _, handle) in zip(curve.keyframe_points, keys):
                            point.handle_left_type = point.handle_right_type = handle
                        curve.update()
        act.use_frame_range = True
        act.frame_start, act.frame_end = 0, keys[-1][0]
        act['fps'] = CHEST_FPS
        act['duration'] = keys[-1][0] / CHEST_FPS
        track = lid.animation_data.nla_tracks.new()
        track.name, track.mute = name, True
        strip = track.strips.new(name, 0, act)
        strip.action_slot = act.slots[0]
        strip.extrapolation = 'NOTHING'
    lid.animation_data.action = None
    lid.rotation_euler = (0, 0, 0)


def stick(m, v):
    paths = [[(-.25, 0, .047), (-.06, -.012, .055), (.13, .015, .06), (.29, .005, .078)],
             [(-.3, .035, .047), (-.07, 0, .06), (.14, -.02, .08), (.35, .02, .11)],
             [(-.38, -.015, .045), (-.11, .02, .055), (.15, .0, .075), (.41, .02, .12)]]
    points = paths[v]
    m.tube(points, [.035, .047, .037, .024], BARK, n=7)
    if v:
        fork = points[2]
        branch_length = .21 if v == 1 else .12
        m.tube([fork, (fork[0] + .015, branch_length * .57, .08),
                (fork[0] + .07, branch_length, .10)], [.025, .019, .008], BARK, n=6)
    for p, direction, radius in [(points[0], Vector(points[0]) - Vector(points[1]), .028),
                                  (points[-1], Vector(points[-1]) - Vector(points[-2]), .02)]:
        m.lathe(p, [(0, radius), (.003, radius)], CUT, n=7, jitter=0, axis=direction)
    # Bark ridges and a pale chipped patch, rather than texture detail.
    m.tube([(-.12, -.026, .084), (.015, -.022, .092), (.13, -.009, .10)], .007, WOOD, n=4)
    m.box((-.06, .009, .105), (.065, .02, .006), CUT, tilt=.12)


def coin(m, v, detail=True):
    color = [GOLD, SILVER, COPPER][v]
    dark = ['#8e703b', '#879598', '#875138'][v]
    m.slot = 1
    m.lathe((0, 0, 0), [(0, .119), (.009, .14), (.025, .14), (.034, .119)],
            color, n=12, jitter=0, colors=[color, dark, color])
    if detail:
        for z in (.033, .001):
            m.ring((0, 0, z), .106, .008, color, n=12, section=4)
    # Raised diamond mint stamp on BOTH faces, legible from above.
    for z in (.04, -.006):
        m.box((0, 0, z), (.09, .09, .012), color, tilt=math.pi / 4)
        m.box((0, 0, z + (.007 if z > 0 else -.007)), (.027, .027, .006), dark, tilt=math.pi / 4)
    if detail:
        for i in range(12):
            a = math.tau * i / 12
            m.box((.14 * math.cos(a), .14 * math.sin(a), .017), (.009, .018, .012), color, tilt=a)


def gem(m, v, center=(0, 0, 0), scale=1):
    """Five silhouettes: ruby cabochon, diamond, emerald step cut, two prisms."""
    start = len(m.vertices)
    color, light = GEMS[v]
    m.slot = 2
    if v == 0:
        m.lathe((0, 0, 0), [(0, .065), (.05, .15), (.12, .145), (.21, .085), (.245, .045)],
                color, n=6, jitter=0, colors=[color, color, light, color], phase=math.pi / 6)
    elif v == 1:
        m.lathe((0, 0, 0), [(0, 0), (.135, .16), (.15, .16), (.235, .09)],
                color, n=8, jitter=0, colors=[color, light, color], phase=math.pi / 8)
    elif v == 2:
        ring_ids = []
        outline = [(-1, -.55), (-.7, -.85), (.7, -.85), (1, -.55),
                   (1, .55), (.7, .85), (-.7, .85), (-1, .55)]
        for z, r in [(0, .065), (.055, .125), (.135, .125), (.19, .087)]:
            ring_ids.append([m.vert((x * r, y * r * 1.4, z)) for x, y in outline])
        m.face(tuple(reversed(ring_ids[0])), color)
        for k, (a, b) in enumerate(zip(ring_ids, ring_ids[1:])):
            for i in range(8):
                j = (i + 1) % 8
                m.face((a[i], a[j], b[j], b[i]), light if i % 3 == 0 and k == 2 else color)
        m.face(ring_ids[-1], light)
    else:
        m.lathe((0, 0, 0), [(0, .085), (.07, .125), (.23 if v == 3 else .31, .105),
                              (.34 if v == 3 else .43, 0)], color, n=5 if v == 3 else 6,
                jitter=0, colors=[color, color, light], phase=.3)
    for i in range(start, len(m.vertices)):
        p = m.vertices[i]
        m.vertices[i] = tuple(center[k] + p[k] * scale for k in range(3))
    m.slot = 0


def grip(m, length=.28, radius=.04, color=LEATHER):
    m.slot = 0
    m.lathe((0, 0, 0), [(-length / 2, radius * .8), (-length / 2 + .025, radius),
                         (length / 2 - .025, radius), (length / 2, radius * .8)], color, n=8, jitter=0)
    for i in range(5):
        z = -length / 2 + .035 + i * (length - .07) / 4
        m.lathe((0, 0, 0), [(z, radius * 1.07), (z + .012, radius * 1.07)], '#80563b', n=8, jitter=0)


def sword(m, v):
    # Short, arming, longsword, broad cleaver, two-handed greatsword.
    tip, width, handle = [(.64, .068, .25), (.9, .085, .28), (1.2, .073, .34),
                          (.92, .145, .28), (1.47, .12, .45)][v]
    grip(m, handle)
    guard_z = handle / 2 + .035
    m.slot = 1
    m.lathe((0, 0, -handle / 2 - .03), [(-.03, .026), (-.012, .062), (.019, .055), (.033, .032)],
            GOLD if v != 4 else IRON, n=8, jitter=0)
    reach = [.15, .19, .22, .23, .29][v]
    if v == 3:
        # Small swept brass quillons and a heavy blade with clipped shoulders.
        m.tube([(-reach, 0, guard_z + .04), (-reach * .6, 0, guard_z),
                (reach * .6, 0, guard_z), (reach, 0, guard_z + .04)], .031, GOLD, n=6)
    else:
        m.tube([(-reach, 0, guard_z - .02), (-reach * .7, 0, guard_z + .006),
                (reach * .7, 0, guard_z + .006), (reach, 0, guard_z - .02)],
               [.022, .035, .035, .022], IRON if v == 4 else GOLD, n=6)
    rings = []
    sections = [(guard_z + .016, width * .72, .017), (guard_z + .1, width, .029),
                (tip - .23, width * (.92 if v == 3 else .76), .026),
                (tip - .10, width * (.8 if v == 3 else .44), .017)]
    for z, w, t in sections:
        rings.append([m.vert(p) for p in [(w, 0, z), (0, -t, z), (-w, 0, z), (0, t, z)]])
    m.face(tuple(reversed(rings[0])), STEEL)
    for a, b in zip(rings, rings[1:]):
        for i in range(4):
            j = (i + 1) % 4
            m.face((a[i], a[j], b[j], b[i]), STEEL if i % 2 else EDGE)
    tip_id = m.vert((width * .25 if v == 3 else 0, 0, tip))
    for i in range(4):
        m.face((rings[-1][i], rings[-1][(i + 1) % 4], tip_id), STEEL if i % 2 else EDGE)
    # Shallow, geometric fuller on the long and two-handed blades.
    if v in (2, 4):
        for y in (-.031, .031):
            m.box((0, y, (guard_z + .15 + tip - .24) / 2),
                  (.022, .004, tip - .24 - guard_z - .15), '#839699')
    m.slot = 0


def bow(m, v=0):
    # Recurve bow in XZ; +X is forward, grip remains exactly at origin.
    half = [(0, 0, 0), (.075, 0, .15), (.155, 0, .28), (.20, 0, .40),
            (.175, 0, .50), (.085, 0, .59), (-.015, 0, .64), (-.06, 0, .70)]
    points = [(x, y, -z) for x, y, z in reversed(half[1:])] + half
    radii = [.018, .019, .022, .026, .031, .034, .037, .04, .037, .034, .031, .026, .022, .019, .018]
    m.tube(points, radii, WOOD, n=6)
    m.tube([(x + .018, y, z) for x, y, z in points[1:-1]], .009, CUT, n=4)
    grip(m, .25, .045)
    m.tube([points[0], (-.072, 0, 0), points[-1]], .007, CREAM, n=4)
    m.slot = 1
    for z in (-.63, .63):
        m.lathe((.0, 0, z), [(-.012, .026), (.012, .026)], GOLD, n=6, jitter=0)
    m.slot = 0


def arrow(m, v=0):
    # Nock pivot; +Z runs towards arrowhead. Not a hand-grip pivot.
    m.lathe((0, 0, 0), [(0, .012), (.70, .012)], CUT, n=6, jitter=0)
    m.slot = 1
    m.lathe((0, 0, 0), [(.67, .021), (.72, .021)], IRON, n=6, jitter=0)
    m.leaf((0, 0, .70), (0, 0, .86), .048, STEEL)
    m.slot = 0
    for angle in (0, math.tau / 3, 2 * math.tau / 3):
        start = len(m.vertices)
        m.leaf((.013, 0, .045), (.022, 0, .22), .038, CREAM)
        for i in range(start, len(m.vertices)):
            x, y, z = m.vertices[i]
            m.vertices[i] = (x * math.cos(angle) - y * math.sin(angle),
                             x * math.sin(angle) + y * math.cos(angle), z)
    m.tube([(-.014, 0, 0), (-.014, 0, .026)], .009, LEATHER, n=4)
    m.tube([(.014, 0, 0), (.014, 0, .026)], .009, LEATHER, n=4)


def staff(m, v=0):
    m.tube([(0, 0, -.78), (-.023, 0, -.35), (0, 0, 0), (.025, 0, .55), (.02, 0, 1.08)],
           [.043, .039, .042, .045, .06], BARK, n=8)
    grip(m, .38, .05)
    m.slot = 1
    for z in (-.74, -.24, .24, .94):
        m.lathe((0, 0, z), [(0, .055), (.045, .055)], GOLD, n=8, jitter=0)
    m.slot = 0
    for side in (-1, 1):
        m.tube([(.02, 0, 1.0), (side * .14, 0, 1.12), (side * .17, 0, 1.33),
                (side * .12, 0, 1.50)], [.059, .047, .035, .013], WOOD, n=6)
    gem(m, 4, (.012, 0, 1.08), .86)
    m.slot = 1
    m.ring((.01, 0, 1.12), .10, .015, GOLD, n=8, section=4)
    m.slot = 0
    m.tube([(-.02, .04, .91), (-.18, .025, .78), (-.20, .02, .63)], .012, LEATHER, n=5)
    gem(m, 3, (-.20, .02, .56), .22)


def potion(m, v):
    color = ['#bb5d60', '#5b89b4', '#6b9c68'][v]
    tint = ['#dcc4bb', '#bfd0d2', '#cbd3b3'][v]
    profiles = [[(0, .065), (.04, .125), (.14, .15), (.23, .115), (.275, .049)],
                [(0, .068), (.025, .09), (.235, .09), (.28, .043)],
                [(0, .095), (.025, .13), (.14, .13), (.24, .055)]]
    n = [8, 6, 4][v]
    neck = profiles[v][-1][0]
    m.slot = 2
    m.lathe((0, 0, 0), profiles[v], color, n=n, jitter=0, phase=math.pi / 4 if v == 2 else 0,
            colors=[color, color, color, tint])
    m.lathe((0, 0, 0), [(neck - .009, .054), (neck + .064, .054),
                         (neck + .067, .067), (neck + .088, .067)], tint, n=8, jitter=0)
    m.slot = 0
    m.lathe((0, 0, 0), [(neck + .082, .048), (neck + .12, .052), (neck + .127, .038)],
            CUT, n=7, jitter=0)
    m.slot = 1
    m.lathe((0, 0, 0), [(neck + .01, .058), (neck + .032, .058)], GOLD, n=8, jitter=0)
    m.slot = 0
    # Cream paper medallion with raised icon; opaque stylised glass, no sorting.
    y = [-.145, -.092, -.096][v]
    z = [.14, .14, .12][v]
    m.box((0, y, z), (.085, .013, .077), CREAM)
    if v == 0:
        # Heart silhouette, two lobes plus a pointed lower half.
        m.blob((-.015, y - .012, z + .012), (.017, .006, .017), color, n=5, jitter=0)
        m.blob((.015, y - .012, z + .012), (.017, .006, .017), color, n=5, jitter=0)
        m.leaf((0, y - .015, z - .028), (0, y - .015, z + .015), .027, color)
    elif v == 1:
        m.box((-.012, y - .012, z + .015), (.025, .007, .025), color, tilt=0)
        m.box((.007, y - .012, z - .014), (.025, .007, .035), color)
    else:
        m.leaf((-.018, y - .015, z - .025), (.018, y - .015, z + .025), .015, color)
    # Small chunky highlight strip, not a realistic transparent bottle.
    m.tube([(-.045, y + .015, z + .045), (-.045, y + .023, z + .085)], .006, tint, n=4)


def scroll(m, v=0):
    """Town portal scroll: a parchment sheet between two rollers, sloping down towards the
    viewer from the fat back roll, with a violet portal sigil and a dangling wax seal."""
    back, front = (.09, .08), (-.25, .036)        # roll centres (y, z); radii are the z
    # Rolls of parchment on wooden rods with brass knobs; the back one holds most of the sheet.
    for (y, r), half, rod in ((back, .21, .017), (front, .2, .013)):
        m.lathe((-half, y, r), [(0, r * .9), (.008, r), (2 * half - .008, r), (2 * half, r * .9)],
                PARCHMENT, n=10, jitter=0, axis=(1, 0, 0), colors=[PARCHMENT_EDGE, PARCHMENT, PARCHMENT_EDGE])
        for side in (-1, 1):
            # rolled-up layers showing on the ends
            m.lathe((side * half, y, r), [(0, r * .66), (.004, r * .66)], PARCHMENT_EDGE,
                    n=10, jitter=0, axis=(side, 0, 0))
            m.lathe((side * half, y, r), [(0, r * .3), (.007, r * .3)], '#a88c62',
                    n=8, jitter=0, axis=(side, 0, 0))
            m.lathe((side * half, y, r), [(0, rod), (.035, rod)], WOOD, n=6, jitter=0, axis=(side, 0, 0))
            m.slot = 1
            m.lathe((side * (half + .035), y, r), [(0, rod * 1.2), (.008, rod * 1.9), (.026, rod * 1.9),
                    (.036, rod * .9)], GOLD, n=8, jitter=0, axis=(side, 0, 0))
            m.slot = 0
    # The sheet leaves the top of the back roll and runs down onto the front one.
    p0, p1 = Vector((0, back[0], back[1] + back[1] - .006)), Vector((0, front[0] + .012, front[1] * 2 - .004))
    along = (p1 - p0).normalized()
    normal = Vector((0, -along.z, along.y))
    if normal.z < 0:
        normal = -normal
    t, half = .009, .2
    ids = [m.vert(p + Vector((x, 0, 0)) + normal * dz) for p in (p0, p1)
           for x in (-half, half) for dz in (-t / 2, t / 2)]
    # ids: p0(-x lo, -x hi, +x lo, +x hi), p1(...)
    for f, color in [((1, 3, 7, 5), PARCHMENT), ((0, 4, 6, 2), PARCHMENT_EDGE),
                     ((0, 1, 5, 4), PARCHMENT_EDGE), ((2, 6, 7, 3), PARCHMENT_EDGE),
                     ((0, 2, 3, 1), PARCHMENT_EDGE), ((4, 5, 7, 6), PARCHMENT_EDGE)]:
        m.face([ids[i] for i in f], color)
    length = (p1 - p0).length
    centre = p0.lerp(p1, .5)

    def on_sheet(start, lift=0):
        # local (x, y, z) -> the sheet: x across, y down the slope, z out of the paper
        for i in range(start, len(m.vertices)):
            x, y, z = m.vertices[i]
            m.vertices[i] = tuple(centre + Vector((x, 0, 0)) + along * y + normal * (z + t / 2 + lift))

    # Portal sigil: a dark violet pool in a lilac ring, a two-armed swirl and a pale heart.
    start = len(m.vertices)
    m.lathe((0, 0, 0), [(0, .08), (.004, .08)], PORTAL, n=14, jitter=0)   # matte: stays deep
    m.slot = 2
    m.ring((0, 0, .004), .086, .008, RIM, n=14, section=4)
    for arm in (0, math.pi):
        points = [(r * math.cos(arm + a), r * math.sin(arm + a), .006)
                  for r, a in [(.013, 0), (.028, .9), (.045, 1.8), (.06, 2.7), (.069, 3.4)]]
        m.tube(points, [.007, .0075, .007, .006, .0045], LILAC, n=4)
    m.lathe((0, 0, 0), [(0, .016), (.009, .013), (.012, 0)], GLEAM, n=6, jitter=0)
    m.slot = 0
    # inked runes around the sigil, and lines of script above and below it
    for i in range(4):
        a = math.pi / 4 + i * math.pi / 2
        m.box((.114 * math.cos(a), .114 * math.sin(a) * .95, .002), (.016, .016, .004), INK, tilt=a)
    for y, w in [(-length * .375, .2), (-length * .445, .13), (length * .375, .22), (length * .445, .15)]:
        m.box((-.01 if w < .2 else 0, y, .002), (w, .007, .004), INK)
    on_sheet(start)
    # Wax seal on violet ribbon tails, hanging off the front roll onto the ground.
    seal = (.1, front[0] - .12, 0)
    for dx in (-.016, .016):
        tail = [(seal[0] + dx * .5, front[0] - .022, front[1] * .9), (seal[0] + dx, front[0] - .06, .008),
                (seal[0] + dx * 1.3, seal[1] + .025, .006)]
        m.tube(tail, [.006, .006, .005], VIOLET, n=4)
    m.slot = 2
    m.lathe(seal, [(0, .036), (.012, .04), (.02, .034)], VIOLET, n=9, jitter=.06)
    m.ring((seal[0], seal[1], .02), .021, .004, LILAC, n=9, section=3)
    m.lathe((seal[0], seal[1], .018), [(0, .009), (.006, .006)], GLEAM, n=6, jitter=0)
    m.slot = 0


def chest(m, v=0):
    # Hollow, empty planked box with a barrel lid on a hinge at the back (its own part,
    # animated by lid_clips). Things can be put on its floor later (`contents` extra).
    m.box((0, 0, .055), (.94, .60, .11), BARK)
    m.box((0, 0, .114), (.84, .49, .008), '#5d4128')
    for y in (-.276, .276):
        for i in range(6):
            m.box((-.39 + i * .156, y, .275), (.15, .055, .34), WOOD if i % 2 else '#967049')
    for x in (-.45, .45):
        for i in range(4):
            m.box((x, -.216 + i * .144, .275), (.055, .138, .34), WOOD if i % 2 else '#967049')
    m.slot = 1
    for x in (-.33, .33):
        for y in (-.31, .31):
            m.box((x, y, .26), (.066, .018, .385), GOLD)
        m.box((x, 0, .012), (.066, .62, .02), GOLD)
    for x in (-.485, .485):
        m.ring((x, 0, .25), .087, .014, IRON, n=8, section=4, vertical=True, yaw=math.pi / 2)
    m.box((0, -.319, .367), (.105, .028, .136), GOLD)
    m.box((0, -.337, .375), (.018, .009, .032), IRON)
    m.lathe((0, -.343, .394), [(0, .014), (.006, .014)], IRON, n=8, jitter=0, axis=(0, -1, 0))
    for x in (-.33, .33):
        for z in (.11, .37):
            m.lathe((x, -.325, z), [(0, .014), (.009, .01)], SILVER, n=6, jitter=0, axis=(0, -1, 0))
    # hinge knuckles on the back edge
    for x in (-.2, .2):
        m.lathe((x - .04, .305, .445), [(0, .018), (.08, .018)], IRON, n=6, jitter=0, axis=(1, 0, 0))
    m.slot = 0
    lid = Mesh(m.rng.randrange(1 << 30))
    m.parts.append(('lid', lid, CHEST_HINGE))
    # Lid cross section: lower edge then nine semicircular points, a convex prism.
    section = [(-.30, .445), (.30, .445)] + [(.30 * math.cos(a), .465 + .19 * math.sin(a))
               for a in [i * math.pi / 8 for i in range(9)]]
    def prism(x0, x1, profile, color):
        a = [lid.vert((x0, y, z)) for y, z in profile]
        b = [lid.vert((x1, y, z)) for y, z in profile]
        lid.face(tuple(reversed(a)), color)
        lid.face(b, color)
        for i in range(len(a)):
            j = (i + 1) % len(a)
            lid.face((a[i], a[j], b[j], b[i]), color)
    for i in range(6):
        prism(-.468 + i * .156, -.468 + i * .156 + .152, section,
              WOOD if i % 2 else '#967049')
    # the dark underside shows once it is open; it sits a little below the planks' flat
    # bottom (z .445) rather than flush with it, which would z-fight
    lid.box((0, 0, .443), (.86, .52, .006), '#5d4128')
    lid.slot = 1
    for x in (-.33, .33):
        for i in range(8):
            a, b = i * math.pi / 8, (i + 1) * math.pi / 8
            profile = [(.301 * math.cos(a), .465 + .191 * math.sin(a)),
                       (.301 * math.cos(b), .465 + .191 * math.sin(b)),
                       (.316 * math.cos(b), .465 + .204 * math.sin(b)),
                       (.316 * math.cos(a), .465 + .204 * math.sin(a))]
            prism(x - .033, x + .033, profile, GOLD)
    lid.box((0, -.316, .474), (.075, .025, .083), GOLD)
    lid.slot = 0


# (name, builder, variant, category, attachment)
SPECS = [(f'item_stick_{s}', stick, i, 'resource', 'ground')
         for i, s in enumerate(('short', 'forked', 'long'))] + [
    (f'item_coin_{s}', coin, i, 'currency', 'ground') for i, s in enumerate(('gold', 'silver', 'copper'))] + [
    (f'item_crystal_{s}', gem, i, 'gem', 'ground')
    for i, s in enumerate(('ruby', 'diamond', 'emerald', 'sapphire', 'amethyst'))] + [
    (f'weapon_sword_{s}', sword, i, 'weapon', 'hand')
    for i, s in enumerate(('short', 'medium', 'long', 'broad', 'greatsword'))] + [
    ('weapon_bow', bow, 0, 'weapon', 'hand'),
    ('weapon_arrow', arrow, 0, 'ammunition', 'nock'),
    ('weapon_staff', staff, 0, 'weapon', 'hand'),
    ('item_potion_health', potion, 0, 'consumable', 'ground'),
    ('item_potion_mana', potion, 1, 'consumable', 'ground'),
    ('item_potion_stamina', potion, 2, 'consumable', 'ground'),
    ('treasure_chest', chest, 0, 'container', 'ground'),
    ('item_town_portal', scroll, 0, 'tool', 'ground')]


def build(scene=None):
    scene = scene or bpy.context.scene
    collection = bpy.data.collections.get(COLLECTION) or bpy.data.collections.new(COLLECTION)
    if collection.name not in scene.collection.children:
        scene.collection.children.link(collection)
    objects = []
    for name, builder, v, category, attach in SPECS:
        seed = 4721 + int.from_bytes(hashlib.sha256(name.encode()).digest()[:8], 'big')
        m = Mesh(seed)
        builder(m, v)
        info = {'category': category, 'attach': attach, 'blocking': category == 'container',
                'units': 'character_rig' if attach != 'ground' else 'cells',
                'game_scale': .55 if attach != 'ground' else 1.0, 'front': '+Z'}
        if category == 'weapon':
            kind = 'sword' if builder == sword else 'bow' if builder == bow else 'staff'
            info.update(weapon=kind, socket='hand.L' if builder == bow else 'hand.R',
                        grip_angle_blender=-math.pi / 6 if builder == sword else 0,
                        axis_gltf='+Y', axis_blender='+Z')
            if builder == sword:
                info.update(attack_clip='Slash', blade_tip=[.64, .9, 1.2, .92, 1.47][v])
            if builder == bow:
                info.update(forward_gltf='+X', nock_gltf=[-.072, 0, 0])
        if builder == arrow:
            info.update(axis_gltf='+Y', axis_blender='+Z')
        if builder == potion:
            info['potion_type'] = ['health', 'mana', 'stamina'][v]
        if builder == chest:
            # glTF (Y up): the lid's clips, its hinge, and the floor where contents go
            hinge = [CHEST_HINGE[0], CHEST_HINGE[2], -CHEST_HINGE[1]]
            info.update(clips='Open,Close', lid=name + '_lid', hinge_gltf=hinge,
                        contents_gltf=[0, .118, 0], contents_size_gltf=[.84, .49])
        obj = finish(m, name, info, collection)
        if builder == chest:
            lid_clips(obj.children[0])
        objects.append(obj)
    return objects


def validate(objects):
    assert len(objects) == len(SPECS) == 24
    assert {o.name for o in objects} == {s[0] for s in SPECS}
    report = []
    for obj in objects:
        assert obj.parent is None
        triangles = 0
        for part in [obj] + list(obj.children):
            mesh = part.data
            mesh.calc_loop_triangles()
            triangles += len(mesh.loop_triangles)
            assert not part.modifiers and not part.constraints and (part == obj or not part.children)
            assert tuple(part.scale) == (1, 1, 1) and tuple(part.rotation_euler) == (0, 0, 0)
            assert part == obj or part.get('cube_crawler_part')
            assert not mesh.uv_layers and 'Color' in mesh.color_attributes
            assert not any(p.use_smooth for p in mesh.polygons)
            assert all(math.isfinite(c) for v in mesh.vertices for c in v.co)
            for tri in mesh.loop_triangles:
                a, b, c = (mesh.vertices[i].co for i in tri.vertices)
                assert (b - a).cross(c - a).length > 1e-10, part.name
        assert 20 <= triangles <= 5000, (obj.name, triangles)
        vertices = part_vertices(obj)
        lo = [min(v[i] for v in vertices) for i in range(3)]
        hi = [max(v[i] for v in vertices) for i in range(3)]
        if obj['attach'] in ('ground', 'nock'):
            assert abs(lo[2]) < 1e-6, (obj.name, lo)
        else:
            assert lo[2] < 0 < hi[2], obj.name
        obj['radius'] = round(max(math.hypot(v.x, v.y) for v in vertices), 4)
        report.append({'name': obj.name, 'triangles': triangles,
                       'size': [round(b - a, 4) for a, b in zip(lo, hi)],
                       'bounds_blender': [lo, hi], 'attach': obj['attach'],
                       'category': obj['category'], 'units': obj['units'], 'game_scale': obj['game_scale'],
                       'glb': f'items/{obj.name}.glb'})
    return report


def export(objects, directory):
    directory = Path(directory).resolve()
    (directory / 'items').mkdir(parents=True, exist_ok=True)
    report = validate(objects)
    props.export_gltf(objects, directory / 'items.glb', animations=True)
    for obj in objects:
        props.export_gltf([obj], directory / 'items' / (obj.name + '.glb'), animations=True)
    (directory / 'items' / 'manifest.json').write_text(json.dumps(
        {'up': 'Y', 'weapon_scale': .55, 'assets': report}, indent=2) + '\n')
    return report


def setup_preview(scene, objects):
    preview = bpy.data.collections.new('ItemsPreview_NOT_EXPORTED')
    scene.collection.children.link(preview)

    def link(name, data):
        obj = bpy.data.objects.new(name, data)
        preview.objects.link(obj)
        return obj

    # Each item has its own plinth; all meshes retain their authoring scale.
    groups = [objects[11:19], objects[:3] + objects[19:22] + objects[22:], objects[3:11]]
    labels = {'weapon_sword_greatsword': 'GREATSWORD', 'treasure_chest': 'CHEST',
              'item_town_portal': 'TOWN PORTAL'}
    for row, group in enumerate(groups):
        for i, obj in enumerate(group):
            x, y = (i - 3.5) * 1.6, (1 - row) * 2.4
            low = min(v.co.z for v in obj.data.vertices)
            obj.location = (x, y, .085 - low)
            platform = bpy.data.meshes.new('ItemPlinth')
            pm = props.Mesh(random.Random(1))
            pm.box((x, y, .02), (1.4, 1.62, .10), '#c3c4b0')
            platform.from_pydata(pm.vertices, [], pm.faces)
            platform.materials.append(town.plain_material('ItemsPreviewPlinth', '#c3c4b0'))
            link('Plinth_' + obj.name, platform)
            label = labels.get(obj.name, obj.name.replace('weapon_', '').replace('item_', '').replace('_', ' ').upper())
            data = bpy.data.curves.new('Label_' + obj.name, 'FONT')
            data.body, data.align_x, data.size = label, 'CENTER', .105
            data.materials.append(town.plain_material('ItemsPreviewInk', '#4f554e'))
            text = link('Label_' + obj.name, data)
            text.location = (x, y - .67, .079)
    mesh = bpy.data.meshes.new('ItemsPreviewFloor')
    mesh.from_pydata([(-200, -200, -.04), (200, -200, -.04), (200, 200, -.04), (-200, 200, -.04)], [], [(0, 1, 2, 3)])
    mesh.materials.append(town.plain_material('ItemsPreviewFloor', '#abafa0'))
    link('ItemsFloor_NOT_EXPORTED', mesh)
    cam = link('ItemsCamera', bpy.data.cameras.new('ItemsCamera'))
    cam.location = (3, -12, 14)
    town.aim(cam, (0, 0, .35))
    cam.data.type, cam.data.ortho_scale = 'ORTHO', 15.4
    scene.camera = cam
    for name, pos, power, size in [('ItemsKey', (-3, -5, 10), 1500, 7),
                                  ('ItemsFill', (7, -1, 8), 900, 6), ('ItemsRim', (0, 6, 9), 1100, 5)]:
        obj = link(name, bpy.data.lights.new(name, 'AREA'))
        obj.location, obj.data.energy, obj.data.size = pos, power, size
        town.aim(obj, (0, 0, 0))
    world = bpy.data.worlds.new('ItemsWorld')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (.65, .72, .80, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = .55
    scene.world = world
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 1920, 1200, 100
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'AgX'
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                area.spaces.active.region_3d.view_perspective = 'CAMERA'
                area.spaces.active.region_3d.view_camera_zoom = 20
                area.spaces.active.shading.type = 'MATERIAL'
                area.spaces.active.shading.use_scene_world = True
                area.spaces.active.shading.use_scene_lights = True
                area.spaces.active.overlay.show_overlays = False
    return preview


def render_previews(scene, objects, preview, directory, overview=True, previews=None):
    """Overview into previews (default: directory); icons into directory/items."""
    directory = Path(directory)
    overview_path = Path(previews or directory) / 'items-preview.png'
    cam = scene.camera
    saved = (cam.location.copy(), cam.rotation_euler.copy(), cam.data.ortho_scale)
    if overview:
        overview_path.parent.mkdir(parents=True, exist_ok=True)
        scene.render.filepath = str(overview_path)
        # the overview shows the chest open (and empty); the icons show it closed
        lids = [c for o in objects for c in o.children if c.animation_data]
        for lid in lids:
            lid.rotation_euler.x = math.radians(CHEST_CLIPS['Open'][-1][1])
        try:
            bpy.ops.render.render(write_still=True)
        finally:
            for lid in lids:
                lid.rotation_euler.x = 0
    decorations = [o for o in preview.objects if o.type == 'FONT' or o.name.startswith('Plinth_')]
    floor = next(o for o in preview.objects if o.name == 'ItemsFloor_NOT_EXPORTED')
    floor_location = floor.location.copy()
    report = validate(objects)
    try:
        # Replace the hidden plinths with a contact plane for individual renders.
        floor.location.z = .125
        for obj in decorations:
            obj.hide_render = True
        scene.render.resolution_x = scene.render.resolution_y = 640
        for obj, item in zip(objects, report):
            for other in objects:
                for part in [other] + list(other.children):
                    part.hide_render = other != obj
            lo, hi = [Vector(v) for v in item['bounds_blender']]
            target = obj.location + (lo + hi) * .5
            cam.location = target + Vector((2.0, -5, 3.0))
            town.aim(cam, target)
            cam.data.ortho_scale = max(item['size']) * 1.6
            scene.render.filepath = str(directory / 'items' / (obj.name + '.png'))
            bpy.ops.render.render(write_still=True)
    finally:
        for obj in objects + decorations + [c for o in objects for c in o.children]:
            obj.hide_render = False
        floor.location = floor_location
        cam.location, cam.rotation_euler, cam.data.ortho_scale = saved
        scene.render.resolution_x, scene.render.resolution_y = 1920, 1200
        scene.render.filepath = str(overview_path)


def main(directory=None, render=True):
    directory, blends, previews = props.output_dirs(directory)
    scene = bpy.data.scenes.new('ItemsShowroom')
    if bpy.context.window:
        bpy.context.window.scene = scene
    objects = build(scene)
    report = export(objects, directory)
    preview = setup_preview(scene, objects)
    bpy.ops.object.select_all(action='DESELECT')
    objects[12].select_set(True)
    bpy.context.view_layer.objects.active = objects[12]
    bpy.ops.wm.save_as_mainfile(filepath=str(blends / 'items.blend'))
    if render:
        render_previews(scene, objects, preview, directory, previews=previews)
    return report


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if len(args) > 1:
        raise SystemExit('Usage: Blender -b --python blender/items.py -- [output-directory]')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    print(json.dumps(main(args[0] if args else None), indent=2))
