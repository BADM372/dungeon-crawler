"""
Chunky clay-world sword, carried on the player's hand.R bone socket.

Plain steel / brass / leather materials, flat faceted blade, rounded grip.
Origin = centre of the grip, +Z runs towards the blade tip; units are the
same ~2-metre rig units as character.py (game scales everything by 0.55).
The runtime angles the grip 60 degrees from the forearm to keep the idle
blade off the ground. This is a separate prop, never embedded in character.glb.

Standalone export:
    Blender -b --python blender/sword.py -- [assets/sword.glb]
Inside Blender:
    import sword; sword.build()
    sword.attach(rig)  # build and attach a copy at hand.R, including bone-tail compensation
"""
import math
from pathlib import Path
import sys

import bpy
from mathutils import Matrix, Vector

NAME = "Sword"
TIP_Z = 0.9
GRIP_ANGLE = -math.pi / 6


def material(name, hex_color, metallic=0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    rgb = [int(hex_color[1 + i:3 + i], 16) / 255 for i in (0, 2, 4)]
    color = tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in rgb) + (1,)
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = 0.56
    bsdf.inputs["Metallic"].default_value = metallic
    mat.diffuse_color = color
    return mat


def build(scene=None, name=NAME):
    scene = scene or bpy.context.scene
    old = bpy.data.objects.get(name)
    if old:
        data = old.data
        bpy.data.objects.remove(old, do_unlink=True)
        if data.users == 0:
            bpy.data.meshes.remove(data)
    vertices, faces, slots = [], [], []

    def vert(p):
        vertices.append(tuple(p))
        return len(vertices) - 1

    def face(ids, material_index):
        faces.append(tuple(ids))
        slots.append(material_index)

    def tube(profile, center, slot, n=8, axis=(0, 0, 1)):
        rotation = Vector((0, 0, 1)).rotation_difference(Vector(axis))
        rings = []
        for z, radius in profile:
            rings.append([vert(Vector(center) + rotation @ Vector((radius * math.cos(math.tau * i / n),
                            radius * math.sin(math.tau * i / n), z))) for i in range(n)])
        face(tuple(reversed(rings[0])), slot)
        for a, b in zip(rings, rings[1:]):
            for i in range(n):
                j = (i + 1) % n
                face((a[i], a[j], b[j], b[i]), slot)
        face(rings[-1], slot)

    # Diamond section: a ridge down each face and distinct blunt clay bevels.
    rings = []
    for z, width, thick in ((0.155, 0.074, 0.018), (0.22, 0.085, 0.025),
                             (0.70, 0.068, 0.02), (0.80, 0.043, 0.014)):
        rings.append([vert((x, y, z)) for x, y in ((width, 0), (0, thick), (-width, 0), (0, -thick))])
    face(tuple(reversed(rings[0])), 0)
    for a, b in zip(rings, rings[1:]):
        for i in range(4):
            j = (i + 1) % 4
            face((a[i], a[j], b[j], b[i]), 0)
    tip = vert((0, 0, TIP_Z))
    for i in range(4):
        face((rings[-1][i], rings[-1][(i + 1) % 4], tip), 0)
    tube([(-0.17, 0.026), (-0.15, 0.04), (0.105, 0.04), (0.12, 0.032)], (0, 0, 0), 2)
    tube([(-0.195, 0.026), (-0.18, 0.061), (-0.15, 0.055), (-0.135, 0.026)], (0, 0, 0), 1)
    tube([(-0.19, 0.023), (-0.15, 0.042), (0.15, 0.042), (0.19, 0.023)], (0, 0, 0.13), 1, axis=(1, 0, 0))
    # Raised wraps read without textures.
    for z in (-0.10, -0.045, 0.01, 0.065):
        tube([(z, 0.042), (z + 0.01, 0.042)], (0, 0, 0), 2)

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    for mat in (material("SwordBlade", "#bdc8ca", 0.2), material("SwordGuard", "#b69558", 0.15),
                material("SwordGrip", "#69442d")):
        mesh.materials.append(mat)
    for poly, slot in zip(mesh.polygons, slots):
        poly.material_index = slot
        poly.use_smooth = slot == 2
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    obj["weapon"] = "sword"
    obj["socket"] = "hand.R"
    obj["attack_clip"] = "Slash"
    obj["blade_tip"] = TIP_Z
    return obj


def attach(rig, scene=None):
    obj = build(scene)
    obj.parent = rig
    obj.parent_type = "BONE"
    obj.parent_bone = "hand.R"
    obj.matrix_parent_inverse = Matrix.Identity(4)
    # Blender bone parenting is tail-relative; the fist socket is at its head.
    obj.location = (0, -rig.data.bones["hand.R"].length, 0)
    obj.rotation_euler = (GRIP_ANGLE, 0, 0)
    return obj


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    bpy.ops.wm.read_factory_settings(use_empty=True)
    obj = build()
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(filepath=str(Path(args[0]).resolve() if args else Path(__file__).resolve().parent.parent / 'assets' / 'sword.glb'),
                              export_format="GLB", use_selection=True, export_yup=True,
                              export_extras=True, export_animations=False, export_texcoords=False)
