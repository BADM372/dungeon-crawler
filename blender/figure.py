"""
Build a small clay-style figure ("strongman" pose: arms out, forearms up).

The figure is modelled like rolled clay: every limb is a tube of the same
width that follows a bent path, the torso is a rounded slab, and limbs and
head are pressed onto the torso with soft fillets.  This is done with a
signed distance field (SDF) sampled into an OpenVDB grid and meshed with
``convertToQuads`` -- no metaball bulges at the joints.

Inside a running Blender (e.g. via MCP):
    exec(open(".../figure.py").read(), {"__name__": "figure"}); build()

Headless:
    Blender -b --python blender/figure.py -- [out.blend] [preview.png]
"""
import math
import sys

import bpy
import numpy as np
import openvdb
from mathutils import Vector

FIGURE_NAME = "Figure"

# --- shape parameters (units: figure is ~2 tall) ----------------------------
LIMB_R = 0.125            # radius of every arm and leg "clay snake"
LIMB_FILLET = 0.07        # how softly limbs are pressed onto the torso
HEAD_R = 0.26
HEAD_Z = 1.70
NECK_FILLET = 0.08        # soft crease between head and shoulders
TORSO_CENTER = (0.0, 0.0, 1.04)
TORSO_HALF = (0.29, 0.155, 0.40)   # half extents of the torso slab
TORSO_ROUND = 0.14                 # corner rounding of the torso
SOLE_ROUND = 0.03                  # soft edge where the feet were pressed flat
VOXEL = 0.008

LEG_X = 0.16
LEGS = [[(s * LEG_X, 0.0, -0.2), (s * LEG_X, 0.0, 0.85)] for s in (-1, 1)]

# arms: a short stub out of the torso to the shoulder joint, then upper arm
# and forearm.  The shoulder joint sits outside the torso so that hanging
# arms clear the body.
ARM_ROOT_X = 0.20
SHOULDER_X = 0.40
SHOULDER_Z = 1.30
UPPER_ARM_LEN = 0.36
FOREARM_LEN = 0.32
A_POSE_DEG = 30.0


def arm_paths(pose="flex"):
    """Arm polylines [root, shoulder, elbow, fist] for both sides.

    pose: "flex" (strongman: upper arm out, forearm up) or "apose"
    (straight arms, A_POSE_DEG down -- the rest pose of the game rig).
    """
    paths = []
    for s in (-1, 1):
        root = Vector((s * ARM_ROOT_X, 0.0, SHOULDER_Z))
        sh = Vector((s * SHOULDER_X, 0.0, SHOULDER_Z))
        if pose == "flex":
            el = sh + Vector((s * UPPER_ARM_LEN, 0.0, 0.0))
            fist = el + Vector((0.0, 0.0, FOREARM_LEN))
        elif pose == "apose":
            a = math.radians(A_POSE_DEG)
            d = Vector((s * math.cos(a), 0.0, -math.sin(a)))
            el = sh + d * UPPER_ARM_LEN
            fist = el + d * FOREARM_LEN
        else:
            raise ValueError(pose)
        paths.append([tuple(root), tuple(sh), tuple(el), tuple(fist)])
    return paths


ARMS = arm_paths("flex")


# --- SDF helpers -------------------------------------------------------------
def _sd_polyline(P, pts, r):
    """Tube of constant radius r along a polyline (exact union of capsules)."""
    d = None
    for a, b in zip(pts, pts[1:]):
        a = np.asarray(a, dtype=np.float32)
        b = np.asarray(b, dtype=np.float32)
        ba = b - a
        pa = P - a
        h = np.clip((pa @ ba) / float(ba @ ba), 0.0, 1.0)
        seg = np.linalg.norm(pa - h[..., None] * ba, axis=-1) - r
        d = seg if d is None else np.minimum(d, seg)
    return d


def _sd_round_box(P, center, half, rnd):
    q = np.abs(P - np.asarray(center, dtype=np.float32)) - (np.asarray(half, dtype=np.float32) - rnd)
    outside = np.linalg.norm(np.maximum(q, 0.0), axis=-1)
    inside = np.minimum(np.max(q, axis=-1), 0.0)
    return outside + inside - rnd


def _sd_sphere(P, center, r):
    return np.linalg.norm(P - np.asarray(center, dtype=np.float32), axis=-1) - r


def _smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0.0, 1.0)
    return b * (1 - h) + a * h - k * h * (1 - h)


def _smax(a, b, k):
    return -_smin(-a, -b, k)


def figure_sdf(P, arms=None, arm_fillet=None):
    arms = ARMS if arms is None else arms
    arm_fillet = LIMB_FILLET if arm_fillet is None else arm_fillet
    torso = _sd_round_box(P, TORSO_CENTER, TORSO_HALF, TORSO_ROUND)

    def tubes(paths):
        # hard union, so the width of every limb stays constant
        d = None
        for path in paths:
            t = _sd_polyline(P, path, LIMB_R)
            d = t if d is None else np.minimum(d, t)
        return d

    body = _smin(torso, tubes(LEGS), LIMB_FILLET)
    body = _smin(body, tubes(arms), arm_fillet)
    head = _sd_sphere(P, (0.0, 0.0, HEAD_Z), HEAD_R)
    body = _smin(body, head, NECK_FILLET)
    # feet pressed flat onto the table at z=0
    return _smax(body, -P[..., 2], SOLE_ROUND)


def _clay_material():
    mat = bpy.data.materials.get("Clay") or bpy.data.materials.new("Clay")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.93, 0.93, 0.92, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.6
    bsdf.inputs["Subsurface Weight"].default_value = 0.1
    bsdf.inputs["Subsurface Radius"].default_value = (0.05, 0.05, 0.05)
    return mat


def _sdf_to_mesh(name, sdf, lo, hi, voxel):
    lo = np.floor(np.asarray(lo) / voxel).astype(int)
    hi = np.ceil(np.asarray(hi) / voxel).astype(int)
    axes = [np.arange(l, h + 1, dtype=np.float32) * voxel for l, h in zip(lo, hi)]
    P = np.stack(np.meshgrid(*axes, indexing="ij"), axis=-1)
    field = sdf(P).astype(np.float32)

    grid = openvdb.FloatGrid(float(4 * voxel))
    grid.copyFromArray(field, ijk=tuple(int(v) for v in lo), tolerance=0.0)
    grid.transform = openvdb.createLinearTransform(voxelSize=voxel)
    grid.gridClass = openvdb.GridClass.LEVEL_SET
    points, quads = grid.convertToQuads(isovalue=0.0)

    me = bpy.data.meshes.new(name)
    me.vertices.add(len(points))
    me.vertices.foreach_set("co", np.ascontiguousarray(points, dtype=np.float32).ravel())
    me.loops.add(len(quads) * 4)
    me.loops.foreach_set("vertex_index", np.ascontiguousarray(quads, dtype=np.int32).ravel())
    me.polygons.add(len(quads))
    me.polygons.foreach_set("loop_start", np.arange(0, len(quads) * 4, 4, dtype=np.int32))
    me.update()
    me.validate()
    # make sure normals point outwards: the top of the head must face +Z
    top = max(range(len(me.vertices)), key=lambda i: me.vertices[i].co.z)
    if me.vertices[top].normal.z < 0:
        me.flip_normals()
    return me


def build(scene=None, location=(0.0, 0.0, 0.0), pose="flex", voxel=VOXEL, name=FIGURE_NAME,
          arm_fillet=None):
    scene = scene or bpy.context.scene
    arms = arm_paths(pose)

    # remove a previous build
    for name_ in (name, "FigureBody", "FigureHead"):
        old = bpy.data.objects.get(name_)
        if old is not None:
            data = old.data
            bpy.data.objects.remove(old)
            if isinstance(data, bpy.types.Mesh) and data.users == 0:
                bpy.data.meshes.remove(data)

    pad = 0.06
    pts = [p for path in arms + LEGS for p in path]
    reach_x = max(abs(p[0]) for p in pts) + LIMB_R + pad
    reach_y = max(TORSO_HALF[1], HEAD_R, LIMB_R) + pad
    top = max(HEAD_Z + HEAD_R, max(p[2] for p in pts) + LIMB_R)
    lo = (-reach_x, -reach_y, -pad)
    hi = (reach_x, reach_y, top + pad)
    me = _sdf_to_mesh(name, lambda P: figure_sdf(P, arms, arm_fillet), lo, hi, voxel)
    me.shade_smooth()
    me.materials.append(_clay_material())

    ob = bpy.data.objects.new(name, me)
    ob.location = location
    scene.collection.objects.link(ob)
    return ob


def setup_stage(scene=None):
    """Ground, light, camera and render settings for a product-shot look."""
    scene = scene or bpy.context.scene

    if "Ground" not in bpy.data.objects:
        me = bpy.data.meshes.new("Ground")
        s = 10
        me.from_pydata([(-s, -s, 0), (s, -s, 0), (s, s, 0), (-s, s, 0)], [], [(0, 1, 2, 3)])
        ground = bpy.data.objects.new("Ground", me)
        scene.collection.objects.link(ground)
        gmat = bpy.data.materials.new("Ground")
        gmat.use_nodes = True
        gmat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (1, 1, 1, 1)
        me.materials.append(gmat)

    if scene.world is None:
        scene.world = bpy.data.worlds.new("World")
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (1, 1, 1, 1)
    bg.inputs["Strength"].default_value = 0.8

    key_o = bpy.data.objects.get("Key")
    if key_o is None:
        key = bpy.data.lights.new("Key", "AREA")
        key_o = bpy.data.objects.new("Key", key)
        scene.collection.objects.link(key_o)
    key_o.data.energy = 250
    key_o.data.size = 5
    key_o.location = (-3, -4, 5)
    key_o.rotation_euler = (math.radians(45), 0, math.radians(-35))

    cam_o = bpy.data.objects.get("Camera")
    if cam_o is None:
        cam_o = bpy.data.objects.new("Camera", bpy.data.cameras.new("Camera"))
        scene.collection.objects.link(cam_o)
    cam_o.data.lens = 90
    cam_o.location = (0.9, -7.5, 1.4)
    target = Vector((0, 0, 0.95))
    cam_o.rotation_euler = (target - cam_o.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam_o

    scene.render.engine = "CYCLES"
    scene.cycles.samples = 64
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 700
    scene.render.resolution_y = 800
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.exposure = -0.6


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    bpy.ops.wm.read_factory_settings(use_empty=True)
    build()
    setup_stage()
    if len(argv) > 0:
        bpy.ops.wm.save_as_mainfile(filepath=argv[0])
    if len(argv) > 1:
        bpy.context.scene.render.filepath = argv[1]
        bpy.ops.render.render(write_still=True)
