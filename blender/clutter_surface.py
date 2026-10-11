"""Clutter builders: any, relics, meadow, peaks, badlands, roots (see clutter.py).

Every builder is build_<prop>(m, variant) on a props.Mesh in attachment space.
"""
import math
from pathlib import Path
import sys

from mathutils import Euler, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from props import (TAU, polar, STONE, STONE_DARK, BARK, WOOD, LEAF, LEAF_LIGHT, SNOW, ICE, ROOT,  # noqa: E402
                   MOSS, BONE, IRON)
from clutter_geo import *  # noqa: E402,F401,F403


# --- any (neutral greys, tinted in game) --------------------------------------
def build_gravel_patch(m, v):
    for i in range(8 + 2 * v):
        a, r = i * 2.4 + v, 0.04 + 0.22 * ((i * 0.618) % 1)
        s = 0.05 + 0.04 * m.rng.random()
        m.box(polar(r, a, s * 0.3), (s * 1.3, s, s * 0.6), (STONE, STONE_DARK, STONE_MID)[i % 3],
              tilt=m.rng.random() * TAU, jitter=s * 0.15)


def build_stone_chips(m, v):
    for i in range(2 + v):
        pebble(m, polar(0.15 * (i > 0), i * 2.6 + v), (0.11, 0.075, 0.06)[i],
               (STONE, STONE_MID, STONE_DARK)[i], n=6)


def build_rock_outcrop(m, v):
    w = 0.42 + 0.08 * v
    m.blob((0, 0, 0), (w, 0.26, 0.15), STONE, n=7, jitter=0.16)
    m.blob((0.14 - 0.28 * v, 0, -0.17), (w * 0.6, 0.17, 0.13), STONE_DARK, n=6, jitter=0.18)
    m.blob((-0.1 + 0.2 * v, 0, 0.14), (w * 0.45, 0.13, 0.08), STONE_MID, n=6, jitter=0.2)
    flatten_back(m)


def build_rock_slab(m, v):
    m.lathe((0, 0, 0), [(0, 0.34), (0.07, 0.39), (0.15 + 0.04 * v, 0.3)], STONE, n=7, jitter=0.24,
            colors=[STONE_MID, STONE])
    xform(m, 0, rot=(0.12, -0.08, 0))
    if v:
        s = len(m.vertices)
        m.lathe((0.08, -0.05, 0.16), [(0, 0.2), (0.05, 0.22), (0.1, 0.17)], STONE_DARK, n=5, jitter=0.2)
        xform(m, s, rot=(0, 0.15, 0.4), pivot=(0.08, -0.05, 0.16))


def build_cairn(m, v):
    z = 0
    sizes = [(0.22, 0.08), (0.17, 0.075), (0.135, 0.07), (0.1, 0.065), (0.07, 0.055)][:4 + v]
    for i, (r, h) in enumerate(sizes):
        m.blob((0.02 * math.sin(i * 2.1), 0.02 * math.cos(i * 1.7), z + h), (r, r * 0.85, h),
               (STONE, STONE_MID, STONE_DARK, STONE_LIGHT)[i % 4], n=6, jitter=0.12)
        z += h * 1.75


def build_shore_stones(m, v):
    for i in range(3 + v):
        r = 0.15 - 0.025 * i
        m.blob(polar(0.21 * (i > 0) + 0.02 * i, i * 2.3 + v, 0.0), (r, r * 0.75, 0.055 + 0.01 * i),
               (STONE, STONE_MID, STONE_DARK, STONE_LIGHT)[i % 4], n=6, jitter=0.12)
    clamp_ground(m)


# --- relics (story clutter for every cave theme; coloured) ---------------------
def build_adventurer_remains(m, v):
    skull_lite(m, (-0.34, 0.02, 0), scale=0.85, yaw=1.2 + 0.4 * v)
    m.tube([(-0.25, 0, 0.035), (-0.05, 0.01, 0.04), (0.1, 0, 0.035)], [0.018, 0.016, 0.015], BONE, n=4)
    for x in (-0.18, -0.09):
        for s in (-1, 1):
            m.tube([(x, 0, 0.04), (x + 0.02, s * 0.1, 0.1), (x + 0.03, s * 0.14, 0.025)],
                   [0.012, 0.011, 0.008], BONE, n=3)
    m.blob((0.12, 0, 0.035), (0.06, 0.09, 0.035), BONE, n=5)
    for s in (-1, 1):
        bone_lite(m, (0.15, s * 0.05, 0.025), (0.4, s * (0.09 + 0.05 * v), 0.022))
    bone_lite(m, (-0.17, 0.13, 0.025), (0.02, 0.22, 0.02), knobs=False)
    if v == 0:
        helmet(m, (-0.3, -0.25, 0.0), rot=(0.4, 0.3, 0.6))
        sword_lite(m, (0.0, -0.22, 0.02), rot=(math.pi / 2, 0, 1.75), length=0.46, blade_color=RUST)
    else:
        helmet(m, (-0.34, 0.02, 0.07), rot=(0.25, 0.1, 1.6))
        s = len(m.vertices)
        sword_lite(m, (0.1, -0.24, 0.37), rot=(math.pi + 0.18, 0.12, 0.3), length=0.46, blade_color=RUST)
        clamp_ground(m, s)


def build_old_campfire(m, v):
    k = 8 + v
    for i in range(k):
        a = TAU * i / k + m.rng.uniform(0, 0.2)
        m.lathe(polar(0.3, a), [(0, 0.075), (0.05, 0.08), (0.1, 0.045)],
                (STONE, STONE_MID, STONE_DARK)[i % 3], n=5, jitter=0.2, phase=a)
    m.lathe((0, 0, 0), [(0, 0.24), (0.015, 0.22), (0.03, 0)], ASH, n=8, jitter=0.15)
    for i in range(3):
        a = i * 2.1 + v
        m.tube([polar(0.17, a, 0.03), polar(0.13, a + math.pi + 0.4, 0.09)], [0.035, 0.03], CHAR, n=5)
    if v:
        for s in (-1, 1):
            m.tube([(s * 0.3, 0.0, 0), (s * 0.3, 0.0, 0.42)], 0.015, BARK, n=4)
            m.tube([(s * 0.3, 0, 0.32), (s * 0.34, 0.02, 0.46)], [0.012, 0.006], BARK, n=3)
        m.tube([(-0.36, 0, 0.42), (0.36, 0, 0.42)], 0.012, BARK, n=4)


def build_abandoned_pack(m, v):
    m.box((0, 0, 0.17), (0.28, 0.16, 0.34), LEATHER, jitter=0.01)
    m.box((0, -0.06, 0.29), (0.29, 0.07, 0.14), "#5a3a26")
    m.box((0, -0.092, 0.13), (0.18, 0.04, 0.12), "#7a5236")
    for x in (-0.08, 0.08):
        m.box((x, 0.085, 0.18), (0.035, 0.02, 0.3), "#4a3020")
    m.lathe((0, 0.03, 0.4), [(-0.17, 0.065), (0.17, 0.065)], CLOTH, n=7, axis=(1, 0, 0), jitter=0.05)
    for x in (-0.1, 0.1):
        m.ring((x, 0.03, 0.4), 0.068, 0.008, "#4a3020", n=7, vertical=True, yaw=math.pi / 2)
    if v:
        xform(m, 0, rot=(math.pi / 2 - 0.15, 0, 0.5))
        m.lathe((0.2, -0.28, 0), [(0, 0.035), (0.08, 0.04), (0.11, 0.015), (0.15, 0.012)], "#5a7a6a",
                n=6, axis=(1, -0.3, 0.05))
        m.box((-0.2, -0.3, 0.03), (0.12, 0.09, 0.05), "#c8a870", tilt=0.6)
        m.box((0.05, -0.38, 0.015), (0.1, 0.13, 0.03), "#7a3a30", tilt=-0.3)


def build_torch_sconce(m, v):
    m.box((0, 0.015, 0), (0.12, 0.03, 0.2), IRON)
    m.tube([(0, 0.02, -0.02), (0, 0.13, 0.0), (0, 0.16, 0.06)], [0.014, 0.012, 0.012], IRON, n=4)
    m.ring((0, 0.165, 0.06), 0.042, 0.009, IRON, n=8)
    a, b = Vector((0, 0.15, -0.12)), Vector((0, 0.18, 0.2))
    m.tube([a, b], [0.02, 0.028], WOOD, n=5)
    m.lathe(b, [(-0.01, 0.036), (0.04, 0.045), (0.07, 0.034)], "#3a2e26", n=6)
    start = len(m.faces)
    m.shard(tuple(b + Vector((0, 0, 0.06))), 0.045, 0.2 + 0.05 * v, "#ffb060", n=5)
    lit(m, start)
    flatten_back(m)


def build_broken_shield(m, v):
    r, k = 0.3, 10
    cut = TAU * (0.66 + 0.08 * v)
    outline = [(r * math.cos(cut * i / k), r * math.sin(cut * i / k)) for i in range(k + 1)]
    outline += [(r * 0.4 * math.cos(cut - 0.25), r * 0.4 * math.sin(cut - 0.25)), (0.03, -0.04),
                (r * 0.45 * math.cos(0.3), r * 0.45 * math.sin(0.3))]
    color = ("#7a3a30", "#3a5a7a")[v]
    prism(m, outline, 0, 0.035, WOOD, top=color)
    m.tube([(r * math.cos(cut * i / k), r * math.sin(cut * i / k), 0.03) for i in range(k + 1)],
           0.014, IRON, n=3)
    m.lathe(polar(0.08, cut / 2, 0.03), [(0, 0.06), (0.03, 0.05), (0.05, 0)], IRON, n=6)
    xform(m, 0, rot=(0.12, 0, 0))
    prism(m, [(-0.33, 0.12), (-0.2, 0.2), (-0.22, 0.32)], 0, 0.03, WOOD, top=color)


def build_signpost(m, v):
    h = 1.1 + 0.1 * v
    m.tube([(0, 0, 0), (0.02, 0, h * 0.5), (0.04 * v, 0.01, h)], [0.04, 0.035, 0.03], WOOD, n=5)
    for i, (z, yaw, length) in enumerate(((h - 0.12, 0.3, 0.42), (h - 0.32, -0.5 - 0.3 * v, 0.36))):
        s = len(m.vertices)
        prism(m, [(-0.04, -0.06), (length - 0.06, -0.06), (length, 0.0), (length - 0.06, 0.06), (-0.04, 0.06)],
              -0.015, 0.015, ("#9a7448", "#8a6440")[i])
        xform(m, s, rot=(math.pi / 2, (-1) ** i * 0.08, yaw), offset=(0, 0, z))
    for i in range(3):
        pebble(m, polar(0.1, i * 2.2 + v), 0.05, (STONE, STONE_MID, STONE_DARK)[i])


def build_sword_in_ground(m, v):
    m.lathe((0, 0, 0), [(0, 0.2), (0.035, 0.15), (0.06, 0.0)], DIRT, n=7, jitter=0.2)
    length = 0.5 + 0.1 * v
    s = len(m.vertices)
    sword_lite(m, (0.02, 0, length - 0.12), rot=(math.pi + 0.22 + 0.1 * v, -0.12, 0.3), length=length,
               blade_color=RUST if v else STEEL)
    clamp_ground(m, s)
    if v:
        s = len(m.vertices)
        prism(m, [(0, 0.02), (0.05, 0.02), (0.07, -0.18), (0.03, -0.12), (0.0, -0.2)], -0.005, 0.005, "#8a3a2e")
        xform(m, s, rot=(math.pi / 2, 0, 0.3), offset=(0.0, 0.0, length - 0.15))
    pebble(m, polar(0.15, 2.0), 0.05, STONE_MID)


# --- meadow -------------------------------------------------------------------
def build_clover_patch(m, v):
    for i in range(4 + v):
        c = Vector(polar(0.2 * ((i * 0.618) % 1) + 0.04 * (i > 0), i * 2.4 + v, 0))
        z = 0.02 + 0.025 * m.rng.random()
        for k in range(3):
            a = k * TAU / 3 + i
            outline = [tuple((c + Vector(polar(r, a + da)))[:2])
                       for r, da in ((0.0, 0), (0.05, -0.45), (0.068, 0.0), (0.05, 0.45))]
            prism(m, outline, z, z + 0.008, GRASS if (k + i) % 2 else GRASS_LIGHT)
    blade(m, (0.05, 0.02, 0), (0.07, 0.03, 0.09), 0.015, GRASS_DARK)
    blade(m, (-0.06, -0.03, 0), (-0.09, -0.02, 0.08), 0.015, GRASS)


def build_daisies(m, v):
    for i in range(3 + v):
        x, y, _ = polar(0.15 * (i > 0) + 0.03 * i, i * 2.4 + v)
        h = 0.1 + 0.05 * m.rng.random()
        m.tube([(x, y, 0), (x + 0.015, y, h)], [0.007, 0.005], GRASS, n=3)
        m.lathe((x + 0.015, y, h), [(0, 0.045), (0.008, 0.042), (0.012, 0)],
                ("#f5efd9", "#f2ce58", "#f5efd9", "#df8dac")[i], n=6, jitter=0.15)
        m.box((x + 0.015, y, h + 0.012), (0.02, 0.02, 0.014), "#e9b644")


def build_island_roots(m, v):
    m.blob((0, 0, -0.04), (0.3, 0.26, 0.07), DIRT, n=7, jitter=0.2)
    for i in range(4 + v):
        x, y, _ = polar(0.17, i * 2.4 + v)
        length = 0.5 + m.rng.random() * 0.7
        pts = [(x, y, -0.02), (x + 0.06, y - 0.03, -length * 0.35), (x - 0.05, y + 0.04, -length * 0.7),
               (x + 0.03, y, -length)]
        m.tube(pts, [0.03, 0.022, 0.012, 0.004], (BARK, ROOT)[i % 2], n=4)
        if i % 2 == 0:
            m.blob(pts[1 + (i // 2) % 2], (0.06, 0.055, 0.07), DIRT_DARK if i else DIRT, n=5)


def build_grass_drape(m, v):
    w = 0.42 + 0.04 * v
    front = [(x, 0.03 + 0.02 * math.sin(x * 9 + v)) for x in [w - 2 * w * i / 6 for i in range(7)]]
    prism(m, [(-w, -0.2), (w, -0.2)] + front, 0.0, 0.05, DIRT, top=GRASS)
    count = 9 + 2 * v
    for i in range(count):
        x = -w + 2 * w * (i + 0.5) / count + m.rng.uniform(-0.03, 0.03)
        drop = 0.25 + m.rng.random() * (0.35 + 0.15 * v)
        tip = (x + m.rng.uniform(-0.06, 0.06), 0.09 + m.rng.random() * 0.05, -drop)
        blade(m, (x, 0.05, 0.02), tip, 0.03, (GRASS, GRASS_LIGHT, GRASS_DARK)[i % 3], ref=(0, 1, 0))
    for x in (-0.2, 0.25):
        m.tube([(x, -0.05, 0.03), (x, 0.06, 0.0), (x + 0.03, 0.07, -0.3), (x - 0.02, 0.06, -0.55 - 0.15 * v)],
               [0.02, 0.018, 0.01, 0.003], ROOT, n=4)
    clamp_lip(m)


def build_lily_pads(m, v):
    for i in range(3 + v):
        lily_pad(m, polar(0.2 * (i > 0) + 0.03 * i, i * 2.3 + v, 0.0), 0.15 - 0.02 * i,
                 ("#4f8a3c", "#5f9a46", "#3f7a34", "#6aa04a")[i], notch=m.rng.random() * TAU, rim="#3a6a2e")
    if v == 0:
        m.lathe((0.02, 0.02, 0.01), [(0, 0.03), (0.035, 0.06), (0.065, 0.045), (0.075, 0)], "#f8d0dc", n=6,
                colors=["#e8a0b8", "#f8d0dc", "#fbe4ea"])
        m.box((0.02, 0.02, 0.07), (0.03, 0.03, 0.02), "#f2ce58")
    else:
        m.blob((0.0, 0.0, 0.06), (0.035, 0.035, 0.06), "#e8a0b8", n=5)


def build_cattails(m, v):
    for i in range(4 + v):
        x, y, _ = polar(0.16 * (i > 0) + 0.02 * i, i * 2.4 + v)
        h = 0.8 + m.rng.random() * 0.35
        lean = (0.05 * math.cos(i * 1.7), 0.05 * math.sin(i * 1.3))
        m.tube([(x, y, 0), (x + lean[0], y + lean[1], h)], [0.012, 0.008], "#6a8a3c", n=4)
        m.lathe((x + lean[0] * 0.72, y + lean[1] * 0.72, h * 0.72),
                [(0, 0.012), (0.03, 0.032), (0.16, 0.03), (0.19, 0.012)], "#5a3a22", n=5,
                axis=(lean[0], lean[1], h))
        blade(m, (x, y, 0.02), (x + 0.18 * math.cos(i * 2.2), y + 0.18 * math.sin(i * 2.2), h * 0.65), 0.025,
              ("#5a8a3c", "#76a050")[i % 2])


def build_fern(m, v):
    fern(m, v, ("#3f6a2e", "#4f8a3a", "#6aa04a"), fronds=5 + v, size=0.5)


def build_berry_bush(m, v):
    m.tube([(0, 0, 0), (0, 0, 0.15)], [0.04, 0.03], BARK, n=5)
    centres = []
    for i in range(3):
        c = Vector(polar(0.14 * (i > 0), i * 2.3 + v, 0.2 + 0.04 * (i % 2)))
        centres.append(c)
        m.blob(c, (0.2, 0.18, 0.2), ("#3f7a3a", "#4c8a3c", "#356a32")[i], n=7, jitter=0.12)
    berry = ("#b8323a", "#4a4aa8")[v]
    for i in range(9):
        a, e = i * 2.4, 0.2 + 0.9 * ((i * 0.37) % 1)
        d = Vector((math.cos(a) * math.cos(e), math.sin(a) * math.cos(e), math.sin(e)))
        m.box(centres[i % 3] + Vector((d.x * 0.2, d.y * 0.18, d.z * 0.2)), (0.04, 0.04, 0.04), berry, tilt=a)


def build_fairy_ring(m, v):
    k = 7 + v
    for i in range(k):
        a = TAU * i / k + m.rng.uniform(-0.15, 0.15)
        x, y, _ = polar(0.33 + m.rng.uniform(-0.04, 0.04), a)
        h, r = 0.07 + 0.05 * m.rng.random(), 0.035 + 0.015 * m.rng.random()
        m.tube([(x, y, 0), (x, y, h)], [r * 0.35, r * 0.3], "#e8e0c8", n=4)
        m.lathe((x, y, h * 0.85), [(0, r), (h * 0.25, r * 0.85), (h * 0.45, 0)], ("#d8c8a8", "#bd4940")[v],
                n=5, jitter=0.1)


def build_sapling(m, v):
    h = 0.85 + 0.15 * v
    m.tube([(0, 0, 0), (0.03, 0, h * 0.5), (-0.02, 0.02, h)], [0.025, 0.018, 0.008], BARK, n=4)
    m.tube([(0.02, 0, h * 0.45), (0.15, 0.04, h * 0.7)], [0.012, 0.004], BARK, n=3)
    m.tube([(0.0, 0.01, h * 0.6), (-0.12, -0.05, h * 0.8)], [0.01, 0.003], BARK, n=3)
    for i, (c, s) in enumerate((((0.15, 0.04, h * 0.72), 0.1), ((-0.12, -0.05, h * 0.82), 0.09),
                                ((-0.02, 0.02, h * 0.97), 0.12))):
        m.blob(c, (s, s * 0.9, s * 0.85), (LEAF, LEAF_LIGHT, GRASS)[i], n=6)


# --- peaks --------------------------------------------------------------------
def build_snow_patch(m, v):
    m.lathe((0, 0, 0), [(0, 0.26), (0.025, 0.22), (0.05, 0.12), (0.06, 0)], SNOW, n=9, jitter=0.22,
            colors=["#d6e2e6", SNOW, "#ffffff"])
    m.lathe(polar(0.18, 1.0 + v), [(0, 0.12), (0.02, 0.09), (0.035, 0)], SNOW, n=7, jitter=0.25)
    if v:
        m.lathe(polar(0.2, 3.5), [(0, 0.1), (0.015, 0.08), (0.03, 0)], "#d6e2e6", n=6, jitter=0.25)


def build_frost_grass(m, v):
    m.lathe((0, 0, 0), [(0, 0.13), (0.03, 0.1), (0.05, 0)], SNOW, n=7, jitter=0.2)
    for i in range(5 + v):
        a = i * 2.4 + v
        tip = polar(0.08 + 0.06 * m.rng.random(), a, 0.13 + 0.09 * m.rng.random())
        blade(m, polar(0.04, a, 0.02), tip, 0.02, ("#b8b48a", "#9aa08a", "#c8c4a0")[i % 3])


def build_snow_cornice(m, v):
    w = 0.45
    front = [(x, 0.1 + 0.03 * math.sin(x * 7 + v)) for x in [w - 2 * w * i / 6 for i in range(7)]]
    prism(m, [(-w, -0.22), (w, -0.22)] + front, 0.0, 0.07 + 0.02 * v, "#d6e2e6", top=SNOW)
    for i in range(3 + v):
        x = -w + 2 * w * (i + 0.5) / (3 + v)
        m.blob((x, 0.08, 0.0), (0.16, 0.07, 0.06), SNOW, n=6, jitter=0.12)
    for i in range(4 + v):
        x = -0.35 + 0.7 * i / (3 + v) + m.rng.uniform(-0.04, 0.04)
        length = 0.15 + m.rng.random() * 0.3
        m.lathe((x, 0.08, -0.03), [(0, 0.03), (-length * 0.3, 0.02), (-length, 0)], (ICE, ICE_LIGHT)[i % 2],
                n=5, jitter=0.1)
    clamp_lip(m)


def build_alpine_flowers(m, v):
    for i in range(5):
        blade(m, (0, 0, 0.01), polar(0.12, i * TAU / 5 + v, 0.03), 0.03, ("#4a6a3a", "#5a7a48")[i % 2])
    colors = ("#5a7ad8", "#f0f0ff", "#c8a0e0", "#5a7ad8")
    for i in range(3 + v):
        x, y, _ = polar(0.13 * (i > 0) + 0.02 * i, i * 2.4 + v)
        h = 0.12 + 0.08 * m.rng.random()
        m.tube([(x, y, 0), (x, y + 0.01, h)], [0.007, 0.005], "#4a6a3a", n=3)
        m.lathe((x, y + 0.01, h), [(0, 0.04), (0.008, 0.038), (0.012, 0)], colors[(i + v) % 4], n=5, jitter=0.2)
        m.box((x, y + 0.01, h + 0.012), (0.018, 0.018, 0.012), "#f2ce58")


def build_expedition_flag(m, v):
    h = 1.45 + 0.15 * v
    m.tube([(0, 0, 0), (0.01, 0, h)], [0.022, 0.016], WOOD, n=5)
    m.box((0.01, 0, h + 0.02), (0.04, 0.04, 0.04), IRON)
    s = len(m.vertices)
    length, height = 0.4, 0.26
    prism(m, [(0, 0), (length, 0.02), (length * 0.85, -height * 0.3), (length, -height * 0.55),
              (length * 0.7, -height * 0.7), (length * 0.75, -height), (0.0, -height)],
          -0.008, 0.008, ("#b83a2e", "#3a5aa8")[v])
    xform(m, s, rot=(math.pi / 2, 0, 0), offset=(0.02, 0, h - 0.02))
    m.vertices[s:] = [(x, y + 0.035 * math.sin(x * 14), z) for x, y, z in m.vertices[s:]]
    s = len(m.vertices)
    m.blob((0, 0, 0.0), (0.22, 0.2, 0.12), SNOW, n=7)
    clamp_ground(m, s)
    for i in range(2):
        pebble(m, polar(0.2, i * 2.6 + v), 0.06, "#737e87")


def build_dead_pine_snag(m, v):
    h = 1.7 + 0.25 * v
    wood = "#8a8078"
    m.tube([(0, 0, 0), (0.03, 0, h * 0.4), (-0.02, 0.02, h * 0.8), (0.0, 0.0, h)],
           [0.1, 0.08, 0.06, 0.045], wood, n=6)
    m.shard((0, 0, h - 0.02), 0.045, 0.15, "#a09890", n=5)
    for i in range(6):
        a, z = i * 2.4 + v, h * (0.3 + 0.1 * i)
        length = 0.3 - 0.03 * i
        m.tube([(0, 0, z), polar(length, a, z - 0.06)], [0.03, 0.008], wood, n=4)
        if i % 2 == v % 2:
            m.box(polar(length * 0.5, a, z), (0.12, 0.06, 0.03), SNOW, tilt=a)
    for i in range(3):
        m.tube([polar(0.22, i * 2.1, 0.0), (0, 0, 0.2)], [0.03, 0.07], wood, n=4)
    m.lathe((0, 0, 0), [(0, 0.3), (0.04, 0.22), (0.08, 0.09)], SNOW, n=8, jitter=0.2)


# --- badlands -----------------------------------------------------------------
def build_cracked_mud(m, v):
    for i in range(6 + v):
        c = polar(0.2 * ((i * 0.618) % 1) + 0.06 * (i > 0), i * 2.4 + v)
        outline = ngon(m, c, 0.08 + 0.02 * m.rng.random(), 5 + i % 2, jitter=0.18, phase=i)
        tops = [0.025 + 0.015 * m.rng.random() for _ in outline]
        prism(m, outline, 0.0, tops, MUD, top=("#b58a5a", "#a77d50")[i % 2])


def build_dry_grass(m, v):
    for i in range(7 + v):
        a = i * 2.4 + v
        tip = polar(0.08 + 0.1 * m.rng.random(), a, 0.14 + 0.11 * m.rng.random())
        blade(m, polar(0.03, a), tip, 0.022, (STRAW, "#a88a50", "#d8c080")[i % 3])


def build_prickly_pear(m, v):
    color, fruit = ("#6a8a4a", "#7a9455")[v], "#c84a6a"
    tops = []
    for base, rot, s in (((-0.06, 0, 0), (0, -0.3, 0.2), 0.12), ((0.07, 0.02, 0), (0, 0.35, 1.6), 0.11)):
        st = len(m.vertices)
        m.blob((0, 0, s * 1.1), (s, s * 0.3, s * 1.15), color, n=6, jitter=0.08)
        xform(m, st, rot=rot, offset=base)
        tops.append((Vector(base) + Euler(rot, "XYZ").to_matrix() @ Vector((0, 0, s * 2.0)), rot, s))
    for i, (top, rot, s) in enumerate(tops):
        for k in range(1 + (i + v) % 2):
            r2 = (rot[0], rot[1] + (-0.5 + k) * 0.8, rot[2] + 0.4 * k)
            s2 = s * 0.8
            st = len(m.vertices)
            m.blob((0, 0, s2 * 1.1), (s2, s2 * 0.3, s2 * 1.15), color, n=6, jitter=0.08)
            xform(m, st, rot=r2, offset=top - Vector((0, 0, 0.03)))
            tip = top + Euler(r2, "XYZ").to_matrix() @ Vector((0, 0, s2 * 2.2))
            m.box(tip, (0.04, 0.035, 0.05), fruit, tilt=k)


def build_agave(m, v):
    m.blob((0, 0, 0.04), (0.12, 0.12, 0.06), "#5a7a68", n=6)
    count = 11 + v
    for i in range(count):
        a, ring = i * 2.4, i / count
        length, e = 0.42 - 0.16 * ring, 0.35 + 0.85 * ring
        tip = polar(length * math.cos(e), a, 0.06 + length * math.sin(e))
        blade(m, (0, 0, 0.05), tip, 0.065 - 0.025 * ring, ("#6f8f7a", "#86a090", "#5f7f6a")[i % 3])
    if v:
        m.tube([(0, 0, 0.1), (0.03, 0, 0.9), (0.05, 0.02, 1.25)], [0.02, 0.015, 0.008], "#8a7a4a", n=4)
        for i in range(3):
            m.blob((0.05 + 0.06 * math.cos(i * 2.1), 0.02 + 0.06 * math.sin(i * 2.1), 1.05 + i * 0.07),
                   (0.05, 0.05, 0.035), "#d8b84a", n=5)


def build_rib_cage(m, v):
    ht = 0.5 - 0.06 * v
    m.tube([(-0.44, 0, 0.04), (-0.3, 0, ht), (0.28, 0.01, ht * 0.95), (0.42, 0, 0.08)],
           [0.035, 0.04, 0.035, 0.03], BONE, n=5)
    for i in range(4):
        m.box((-0.24 + i * 0.16, 0, ht * 0.97 + 0.03), (0.05, 0.05, 0.06), BONE, tilt=0.2 * i)
    for i in range(5):
        x = -0.24 + i * 0.12
        for s in (-1, 1):
            if v and i == 3 and s > 0:
                m.tube([(x, 0, ht), (x + 0.02, s * 0.2, ht * 0.8)], [0.022, 0.012], BONE, n=4)
                continue
            m.tube([(x, 0, ht), (x + 0.02, s * 0.2, ht * 0.85), (x + 0.03, s * 0.3, ht * 0.4),
                    (x + 0.04, s * 0.3, 0.0)], [0.022, 0.02, 0.017, 0.012], BONE, n=4)


def build_broken_wagon_wheel(m, v):
    rim = 0.32
    m.ring((0, 0, 0), rim, 0.03, WOOD, n=12, section=4)
    m.lathe((0, 0, -0.05), [(0, 0.06), (0.1, 0.06)], BARK, n=6)
    for i in range(8):
        if v and i in (2, 3):
            continue
        a = TAU * i / 8
        m.tube([polar(0.05, a), polar(rim - 0.02, a)], 0.018, BARK, n=4)
    xform(m, 0, rot=(1.2, 0, 0.3), offset=(0, 0, 0.12))
    clamp_ground(m)
    m.lathe((0, 0, 0), [(0, 0.34), (0.04, 0.25), (0.07, 0.0)], SAND, n=8, jitter=0.25)


def build_termite_mound(m, v):
    h = 1.2 + 0.3 * v
    m.lathe((0, 0, 0), [(0, 0.36), (h * 0.15, 0.3), (h * 0.35, 0.2), (h * 0.55, 0.16), (h * 0.75, 0.1),
                        (h * 0.92, 0.06), (h, 0)], "#a0603a", n=8, jitter=0.18,
            colors=["#8a5232", "#a0603a", "#b07048", "#a0603a", "#c08058", "#b07048"])
    for i in range(2):
        m.lathe(polar(0.22, i * 2.6 + v), [(0, 0.12), (h * 0.25, 0.08), (h * 0.45, 0)], "#a0603a", n=6,
                jitter=0.2, colors=["#8a5232", "#b07048"])


def build_dry_root_drape(m, v):
    drape_roots(m, v, "#9a8060", "#a0603a")


def build_oasis_reeds(m, v):
    for i in range(9 + v):
        a = i * 2.4 + v
        h = 0.5 + 0.4 * m.rng.random()
        blade(m, polar(0.06 + 0.08 * ((i * 0.618) % 1), a), polar(0.25 + 0.12 * m.rng.random(), a + 0.2, h), 0.035,
              ("#5a9a4a", "#6aa858", "#4a8a3e")[i % 3])
    for i in range(2):
        top = polar(0.08, i * 3.1 + v, 0.95 + 0.1 * i)
        m.tube([polar(0.05, i * 3.1 + v), top], [0.012, 0.007], "#6a8a3c", n=4)
        m.blob(top, (0.05, 0.05, 0.08), "#c8b080", n=5)


# --- roots --------------------------------------------------------------------
def build_leaf_litter(m, v):
    for i in range(9 + v):
        c = polar(0.25 * ((i * 0.618) % 1) + 0.03, i * 2.4 + v)
        flat_leaf(m, c, 0.11 + 0.03 * m.rng.random(), 0.035, m.rng.random() * TAU, 0.006 * (i % 3),
                  ("#8a5a2a", "#a8743a", "#6a4a2a", "#7a6a32")[i % 4])


def build_moss_patch(m, v):
    for i in range(3 + v):
        r = 0.16 - 0.025 * i
        m.blob(polar(0.15 * (i > 0), i * 2.3 + v, 0.0), (r, r * 0.85, 0.05 - 0.005 * i),
               (MOSS, "#5c6e34", "#3e4e24", "#6a7a3a")[i % 4], n=6, jitter=0.2)
    clamp_ground(m)


def build_root_web(m, v):
    for i in range(3):
        x0 = (-0.25, 0.05, 0.3)[i] + 0.05 * v
        pts = [(x0 + 0.1 * math.sin(k * 1.4 + i + v), 0.04 + 0.015 * math.sin(k * 2 + i), 0.45 - 0.9 * k / 5)
               for k in range(6)]
        m.tube(pts, [0.04, 0.038, 0.032, 0.026, 0.018, 0.006], (ROOT, BARK, "#4a3a28")[i], n=4)
        if i < 2:
            p = Vector(pts[2])
            m.tube([p, p + Vector((0.22 * (1 - 2 * (i % 2)), 0.02, -0.18))], [0.02, 0.004], ROOT, n=4)
    m.tube([(-0.4, 0.035, 0.15), (-0.1, 0.05, 0.05), (0.2, 0.04, 0.12), (0.42, 0.03, 0.0)],
           [0.02, 0.025, 0.02, 0.006], BARK, n=4)
    flatten_back(m)


def build_glowworm_threads(m, v):
    m.blob((0, 0, 0), (0.2, 0.18, 0.03), "#3a2e24", n=6)
    for i in range(7 + v):
        x, y, _ = polar(0.18 * ((i * 0.618) % 1) + 0.03, i * 2.4 + v)
        length = 0.3 + m.rng.random() * 0.55
        m.tube([(x, y, 0), (x + 0.01, y, -length * 0.5), (x, y + 0.01, -length)], [0.004, 0.003, 0.002],
               "#cfd8dc", n=3)
        for t in ((0.5, 1.0) if i % 2 else (1.0,)):
            start = len(m.faces)
            m.box((x, y, -length * t), (0.018, 0.018, 0.024), "#9fe8ff")
            lit(m, start)


def build_burrow_mound(m, v):
    m.lathe((0, 0, 0), [(0, 0.42), (0.1, 0.32), (0.2, 0.17), (0.24, 0)], DIRT, n=9, jitter=0.12,
            colors=["#4e3e2a", DIRT, "#6e5a40"])
    m.blob((0.27, 0, 0.08), (0.04, 0.12, 0.09), DIRT_DARK, n=6)
    for i in range(4 + v):
        m.box(polar(0.38, 0.6 * i - 0.9, 0.02), (0.06, 0.05, 0.04), DIRT, tilt=i, jitter=0.01)


def build_cave_fern(m, v):
    fern(m, v, ("#7a8070", "#9aa88a", "#b8c0a0"), fronds=5 + v, size=0.45)


def build_root_drape(m, v):
    drape_roots(m, v, ROOT, DIRT)
