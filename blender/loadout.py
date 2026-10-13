"""
The player with each kind of weapon: a lineup of the attack clips' key frames, the weapon
mounted in the fist the way the game mounts it (items.MOUNTS, render/character.js).

Rows: sword (Slash), bow (Shoot), crossbow (HoldCrossbow, CrossbowShot), staff (HoldStaff,
Cast). Each figure is a copy of the rig playing its clip at one frame (an NLA strip offset).
Nothing is exported; this is for checking poses, grips and aim.

    Blender -b --python blender/loadout.py -- [directory] [--side | --top]

One image per weapon kind, <directory>/loadout-<kind>-<view>.png (default directory:
blender/previews/; view: front by default, --side from the right, --top from above like the
game camera).
"""
from pathlib import Path
import math
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bpy
from mathutils import Matrix, Vector

import character
import items

HERE = Path(__file__).resolve().parent
SCENE_FRAME = 200

# (weapon, [(clip, frame), ...]) per row
ROWS = [
    ('weapon_sword_medium', [('Slash', 0), ('Slash', 10), ('Slash', 15), ('Slash', 18), ('Slash', 24)]),
    ('weapon_bow_recurve', [('HoldBow', 0), ('Shoot', 7), ('Shoot', 13), ('Shoot', 18), ('Shoot', 21), ('Shoot', 26)]),
    ('weapon_crossbow_light', [('HoldCrossbow', 0), ('CrossbowShot', 6), ('CrossbowShot', 9), ('CrossbowShot', 12),
                               ('CrossbowShot', 19), ('CrossbowShot', 23), ('CrossbowShot', 27)]),
    ('weapon_staff_arcane', [('HoldStaff', 0), ('Cast', 7), ('Cast', 12), ('Cast', 16), ('Cast', 22)]),
]


def weapon_kind(name):
    return next(k for k in ('sword', 'bow', 'crossbow', 'staff') if name.startswith('weapon_' + k))


def mount(rig, weapon, kind):
    """A copy of `weapon` (and its parts) in the rig's socket for `kind`."""
    socket = items.MOUNTS[kind][0]
    obj = weapon.copy()
    bpy.context.scene.collection.objects.link(obj)
    obj.hide_render = False
    for child in weapon.children:
        c = child.copy()
        bpy.context.scene.collection.objects.link(c)
        c.parent = obj
        c.hide_render = False
    obj.parent = rig
    obj.parent_type = 'BONE'
    obj.parent_bone = socket
    obj.matrix_parent_inverse = Matrix.Identity(4)
    # Blender bone parenting is tail-relative; the game's socket is the bone's head
    obj.matrix_basis = Matrix.Translation((0, -rig.data.bones[socket].length, 0)) @ items.mount_matrix(kind)
    return obj


# where each kind's mount is solved: the clip and frame, and how the weapon should lie in the
# armature there (its glTF +Y and +Z axes): the bow upright, belly forward, at the loose; the
# crossbow level and pointing ahead at the shot; the staff upright in the hold
AIMS = {
    'bow': ('Shoot', 18, 'hand.L', (0, 0, 1), (-1, 0, 0)),
    'crossbow': ('CrossbowShot', 9, 'hand.R', (0, -1, 0), (0, 0, 1)),
    'staff': ('HoldStaff', 0, 'hand.R', (0, 0, 1), (0, -1, 0)),
}


def solve_mounts(rig):
    """Mount rotations (glTF x y z w) that put each weapon as AIMS says; for items.MOUNTS."""
    out = {}
    for kind, (clip, frame, bone, y, z) in AIMS.items():
        rig.animation_data.action = bpy.data.actions[clip]
        bpy.context.scene.frame_set(frame)
        bone_rot = rig.pose.bones[bone].matrix.to_3x3()
        y, z = Vector(y).normalized(), Vector(z).normalized()
        want = Matrix((y.cross(z), y, z)).transposed()   # columns: the weapon's glTF axes
        q = (bone_rot.transposed() @ want).to_quaternion()
        out[kind] = (round(q.x, 4), round(q.y, 4), round(q.z, 4), round(q.w, 4))
    return out


def figure_at(rig, mesh, clip, frame, location):
    r, m = rig.copy(), mesh.copy()
    for o in (r, m):
        bpy.context.scene.collection.objects.link(o)
        o.hide_render = False
    m.parent = r
    m.modifiers['Armature'].object = r
    r.location = location
    r.animation_data_clear()
    r.animation_data_create()
    track = r.animation_data.nla_tracks.new()
    act = bpy.data.actions[clip]
    strip = track.strips.new(clip, SCENE_FRAME - frame, act)   # plays `frame` at the scene frame
    if act.slots:
        strip.action_slot = act.slots[0]
    strip.extrapolation = 'HOLD'
    return r


def stage(scene):
    world = bpy.data.worlds.new('LoadoutWorld')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (.62, .68, .74, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = .7
    scene.world = world
    floor = bpy.data.meshes.new('LoadoutFloor')
    floor.from_pydata([(-50, -50, 0), (50, -50, 0), (50, 50, 0), (-50, 50, 0)], [], [(0, 1, 2, 3)])
    mat = bpy.data.materials.new('LoadoutFloor')
    mat.use_nodes = True
    mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.55, .56, .5, 1)
    floor.materials.append(mat)
    scene.collection.objects.link(bpy.data.objects.new('LoadoutFloor', floor))
    body = bpy.data.materials.new('LoadoutBody')
    body.use_nodes = True
    body.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.75, .62, .5, 1)
    sun = bpy.data.objects.new('LoadoutSun', bpy.data.lights.new('LoadoutSun', 'SUN'))
    sun.data.energy = 3.2
    sun.rotation_euler = (math.radians(40), math.radians(-20), math.radians(-30))
    scene.collection.objects.link(sun)
    cam = bpy.data.objects.new('LoadoutCamera', bpy.data.cameras.new('LoadoutCamera'))
    scene.collection.objects.link(cam)
    cam.data.type = 'ORTHO'
    scene.camera = cam
    scene.render.engine = 'BLENDER_EEVEE'
    scene.view_settings.view_transform = 'AgX'
    return cam, body


VIEWS = {   # camera offset from the row's middle, per view
    'front': Vector((-4, -14, 4)),   # from the front and the characters' right
    'side': Vector((-14, -2, 2.5)),  # from their right
    'top': Vector((0, -9, 14)),      # high, like the game camera
}


def main(out=None, view='front'):
    """One image per row: <out>/loadout-<kind>-<view>.png (default blender/previews/)."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    rig, mesh = character.main(scene)
    weapons = {o.name: o for o in items.build(scene)}
    for o in weapons.values():
        for part in [o, *o.children]:
            part.hide_render = True
    rig.hide_render = mesh.hide_render = True
    cam, body = stage(scene)
    mesh.data.materials.clear()
    mesh.data.materials.append(body)
    rows = []
    for row, (weapon, shots) in enumerate(ROWS):
        group = []
        for i, (clip, frame) in enumerate(shots):
            r = figure_at(rig, mesh, clip, frame, (i * 1.8, row * 40, 0))
            group += [r, *r.children]
            w = mount(r, weapons[weapon], weapon_kind(weapon))
            group += [w, *w.children]
        rows.append((weapon_kind(weapon), len(shots), group))
    scene.frame_set(SCENE_FRAME)
    directory = Path(out).resolve() if out else HERE / 'previews'
    directory.mkdir(parents=True, exist_ok=True)
    for row, (kind, n, group) in enumerate(rows):
        for _, _, other in rows:
            for o in other:
                o.hide_render = o not in group or (o.type == 'ARMATURE')
        centre = Vector(((n - 1) * 0.9, row * 40, 1.0))
        cam.location = centre + VIEWS[view]
        cam.rotation_euler = (centre - cam.location).to_track_quat('-Z', 'Y').to_euler()
        cam.data.ortho_scale = max(4.2, n * 1.85)
        scene.render.resolution_x = 1600
        scene.render.resolution_y = int(1600 * 3.2 / cam.data.ortho_scale)
        scene.render.filepath = str(directory / f'loadout-{kind}-{view}.png')
        bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if '--mounts' in args:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        for kind, q in solve_mounts(character.main(bpy.context.scene)[0]).items():
            print('MOUNT', kind, q)
        sys.exit(0)
    view = 'side' if '--side' in args else 'top' if '--top' in args else 'front'
    paths = [a for a in args if not a.startswith('--')]
    main(paths[0] if paths else None, view)
