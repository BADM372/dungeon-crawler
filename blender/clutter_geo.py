"""Geometry helpers and palette shared by the clutter builders (see clutter.py).

Everything builds on props.Mesh: flat faceted shells, per-face colours and an
optional emissive flag per face. Coordinates are Blender Z-up, one unit = one cell.
"""
import math
from pathlib import Path
import sys

from mathutils import Euler, Vector
from mathutils.geometry import tessellate_polygon

sys.path.insert(0, str(Path(__file__).resolve().parent))
import props  # noqa: E402
from props import TAU, polar, BARK, BONE, IRON  # noqa: E402,F401

STONE_MID = "#7a7a7a"
STONE_LIGHT = "#b0b0b0"
DIRT = "#5e4c35"
DIRT_DARK = "#3a2e22"
GRASS = "#4c8a3c"
GRASS_LIGHT = "#76ad50"
GRASS_DARK = "#3b6532"
LEATHER = "#69442d"
CLOTH = "#8a7a5a"
RUST = "#8a5232"
STEEL = "#9aa4a8"
BRASS = "#a8884a"
CHAR = "#2a2422"
ASH = "#5a5450"
SAND = "#c9a46a"
MUD = "#a77d50"
STRAW = "#c8a860"
TERRA = "#a8643c"
SULFUR = "#d8c040"
HUSK = "#b0a088"
BURLAP = "#a08a62"
ICE_LIGHT = "#d8ecf2"
ICE_DEEP = "#82a6b8"
ABYSS_ACCENT = "#5a3a6a"


def lit(m, start):
    """Mark every face added since `start` (a face index) as emissive."""
    m.glows[start:] = [True] * (len(m.faces) - start)


def xform(m, start, rot=(0, 0, 0), offset=(0, 0, 0), pivot=(0, 0, 0), scale=1):
    """Rotate (XYZ Euler) / scale vertices from `start` about `pivot`, then move them."""
    mat = Euler(rot, "XYZ").to_matrix()
    s = Vector(scale if isinstance(scale, (tuple, list)) else (scale,) * 3)
    pivot, offset = Vector(pivot), Vector(offset)
    for i in range(start, len(m.vertices)):
        p = Vector(m.vertices[i]) - pivot
        p = Vector((p.x * s.x, p.y * s.y, p.z * s.z))
        m.vertices[i] = tuple(mat @ p + pivot + offset)


def flatten_back(m, start=0):
    """Wall props: squash everything behind the wall plane onto it (half-embedded look)."""
    m.vertices[start:] = [(x, max(0.0, y), z) for x, y, z in m.vertices[start:]]


def clamp_ground(m, start=0):
    """Half-buried look: squash geometry below the ground onto it."""
    m.vertices[start:] = [(x, y, max(0.0, z)) for x, y, z in m.vertices[start:]]


def clamp_lip(m, start=0):
    """Lip props: push anything inside the cliff body (y < 0, z < 0) to its nearest surface."""
    out = []
    for x, y, z in m.vertices[start:]:
        if y < 0 and z < 0:
            if -y < -z:
                y = 0.0
            else:
                z = 0.0
        out.append((x, y, z))
    m.vertices[start:] = out


def prism(m, outline, z0, z1, color, top=None):
    """Extrude an XY outline (may be concave) from z0 to z1; z1 may be per-vertex."""
    tops = z1 if isinstance(z1, (list, tuple)) else [z1] * len(outline)
    a = [m.vert((x, y, z0)) for x, y in outline]
    b = [m.vert((x, y, z)) for (x, y), z in zip(outline, tops)]
    for tri in tessellate_polygon([[Vector((x, y, 0)) for x, y in outline]]):
        m.face([a[tri[2]], a[tri[1]], a[tri[0]]], color)
        m.face([b[i] for i in tri], top or color)
    for i in range(len(outline)):
        j = (i + 1) % len(outline)
        m.face((a[i], a[j], b[j], b[i]), color, shade=0.9)


def ngon(m, center, radius, k, jitter=0.2, phase=0.0):
    return [(center[0] + radius * m.rng.uniform(1 - jitter, 1 + jitter) * math.cos(phase + TAU * i / k),
             center[1] + radius * m.rng.uniform(1 - jitter, 1 + jitter) * math.sin(phase + TAU * i / k))
            for i in range(k)]


def blade(m, base, tip, width, color, ref=None):
    """Chunky two-sided blade like props.Mesh.leaf, but valid in any direction.
    Its width lies across `ref` (default: horizontal, so lying leaves are flat)."""
    base, tip = Vector(base), Vector(tip)
    d = tip - base
    if ref is None:
        ref = Vector((0, 0, 1)) if abs(d.normalized().z) < 0.9 else Vector((1, 0, 0))
    side = d.cross(Vector(ref)).normalized() * width
    up = side.cross(d).normalized() * width * 0.35
    mid = base.lerp(tip, 0.45)
    ids = [m.vert(p) for p in (base, mid + side, tip, mid - side, mid + up, mid - up)]
    for i in range(4):
        m.face((ids[i], ids[(i + 1) % 4], ids[4]), color)
        m.face((ids[(i + 1) % 4], ids[i], ids[5]), color, shade=0.8)


def flat_leaf(m, center, length, width, angle, z, color, thickness=0.008):
    pts = [(0, 0), (length * 0.45, width), (length, 0), (length * 0.45, -width)]
    c, s = math.cos(angle), math.sin(angle)
    prism(m, [(center[0] + x * c - y * s, center[1] + x * s + y * c) for x, y in pts], z, z + thickness, color)


def pebble(m, center, r, color, n=5, h=None):
    h = h or r * 1.1
    m.lathe(center, [(0, r * 0.8), (h * 0.45, r), (h, r * 0.4)], color, n=n, jitter=0.22, phase=m.rng.random())


def skull_lite(m, center, scale=1.0, yaw=0.0, color=BONE, dark="#49443d"):
    """72-triangle skull facing -Y, base at z = 0."""
    s = len(m.vertices)
    m.blob((0, 0, 0.1), (0.1, 0.115, 0.1), color, n=6, jitter=0.06)
    m.box((0, -0.085, 0.035), (0.09, 0.07, 0.06), color)
    for side in (-1, 1):
        m.box((side * 0.042, -0.112, 0.11), (0.038, 0.035, 0.038), dark)
    xform(m, s, rot=(0, 0, yaw), offset=center, scale=scale)


def bone_lite(m, a, b, r=0.018, color=BONE, knobs=True):
    m.tube([a, b], [r, r * 0.85], color, n=4)
    if knobs:
        for p in (a, b):
            m.box(p, (r * 2.6, r * 2.4, r * 2.2), color, tilt=m.rng.random())


def sword_lite(m, base, rot, length=0.5, blade_color=STEEL, grip=LEATHER):
    """Guard at the origin, blade along +Z before `rot` is applied."""
    s = len(m.vertices)
    w = 0.026
    prism(m, [(-w, 0), (w, 0), (w, length - 0.06), (0, length), (-w, length - 0.06)], -0.006, 0.006, blade_color)
    xform(m, s, rot=(math.pi / 2, 0, 0))
    m.box((0, 0, 0.0), (0.15, 0.03, 0.025), IRON)
    m.tube([(0, 0, -0.12), (0, 0, 0)], 0.016, grip, n=4)
    m.box((0, 0, -0.13), (0.035, 0.035, 0.035), BRASS)
    xform(m, s, rot=rot, offset=base)


def helmet(m, center, rot=(0, 0, 0), color=RUST):
    s = len(m.vertices)
    m.lathe((0, 0, 0), [(0, 0.12), (0.05, 0.118), (0.1, 0.085), (0.13, 0.0)], color, n=8, jitter=0.03,
            colors=[IRON, color, IRON])
    m.box((0, -0.118, 0.035), (0.03, 0.03, 0.1), IRON)
    xform(m, s, rot=rot, offset=center)


def chain(m, top, links, r=0.055, t=0.011, n=6, color=IRON, yaw=0.0):
    """Interlocking vertical links hanging down from `top`."""
    for i in range(links):
        m.ring((top[0], top[1], top[2] - r * 1.6 - i * r * 2.5), r, t, color, n=n, vertical=True,
               yaw=yaw + (i % 2) * math.pi / 2, ellipse=1.6)


def lantern_body(m, center, s=1.0, glow="#ffcf8a"):
    x, y, z = center
    start = len(m.faces)
    m.box((x, y, z), (0.1 * s, 0.1 * s, 0.15 * s), glow)
    lit(m, start)
    for dz in (-0.09 * s, 0.09 * s):
        m.box((x, y, z + dz), (0.15 * s, 0.15 * s, 0.035 * s), IRON)
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.box((x + sx * 0.06 * s, y + sy * 0.06 * s, z), (0.018 * s, 0.018 * s, 0.18 * s), IRON)
    m.lathe((x, y, z + 0.105 * s), [(0, 0.085 * s), (0.065 * s, 0)], IRON, n=4, jitter=0, phase=math.pi / 4)


def crystal_cluster(m, v, color, alt, base=None, glow=True, count=5):
    """Shards around a big central one; the `color` shards glow, the `alt` ones don't."""
    if base:
        m.blob((0, 0, 0.03), (0.26, 0.23, 0.06), base, n=6)
    for i in range(count):
        h = (0.7 + v * 0.2) if i == 0 else 0.25 + ((i * 3) % 4) * 0.1
        start = len(m.faces)
        m.shard(polar(0.19 if i else 0, i * 2.4 + v), 0.1 if i == 0 else 0.07, h,
                color if i % 2 == 0 else alt, n=6 if i == 0 else 5)
        if glow and i % 2 == 0:
            lit(m, start)


def drape_roots(m, v, color, dirt, count=4):
    """Soil clump on the lip with roots pouring over the edge."""
    m.blob((0, -0.07, 0.0), (0.32, 0.12, 0.055), dirt, n=6, jitter=0.15)
    for i in range(count + v):
        x = -0.3 + 0.6 * i / (count + v - 1) + m.rng.uniform(-0.04, 0.04)
        drop = 0.45 + m.rng.random() * 0.5
        pts = [(x, -0.12, 0.03), (x + 0.02, 0.035, 0.035), (x, 0.075, -0.08),
               (x + 0.05, 0.065, -drop * 0.5), (x - 0.03, 0.085, -drop)]
        m.tube(pts, [0.03, 0.03, 0.026, 0.016, 0.004], color, n=4)
        if i % 2:
            p = Vector(pts[3])
            m.tube([p, p + Vector((0.12, 0.03, -0.12))], [0.012, 0.003], color, n=3)
    clamp_lip(m)


def fern(m, v, colors, fronds=5, size=0.5):
    for i in range(fronds):
        a = i * TAU / fronds + v * 0.5 + m.rng.uniform(-0.2, 0.2)
        length = size * m.rng.uniform(0.85, 1.1)
        pts = [Vector((0, 0, 0.02)), Vector(polar(length * 0.38, a, length * 0.62)),
               Vector(polar(length * 0.9, a + 0.12, length * 0.35))]
        m.tube(pts, [0.014, 0.009, 0.003], colors[0], n=3)
        side = Vector(polar(1, a + math.pi / 2))
        for t, p, d in ((0.5, pts[0].lerp(pts[1], 0.7), pts[1] - pts[0]),
                        (0.8, pts[1].lerp(pts[2], 0.45), pts[2] - pts[1])):
            for s in (-1, 1):
                tip = p + side * s * 0.13 * (1.25 - t) + d.normalized() * 0.07 + Vector((0, 0, -0.02))
                blade(m, p, tip, 0.032, colors[1 + (s > 0)])


def lily_pad(m, center, r, color, notch=0.0, rim=None):
    pts = [(center[0], center[1])]
    for i in range(10):
        a = notch + 0.35 + (TAU - 0.7) * i / 9
        pts.append((center[0] + r * math.cos(a), center[1] + r * math.sin(a)))
    prism(m, pts, center[2] - 0.012, center[2] + 0.012, rim or color, top=color)
