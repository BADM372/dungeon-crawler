"""Large, flat-shaded grove trees for the starting town, in game-cell units.

Blender -b --python blender/town_trees.py

Writes assets/town_trees.glb, blender/town_trees.blend and
blender/previews/town_trees-preview.png.
MCP: import town_trees; town_trees.main()

Separate from the one-cell scatter library. Wide crowns, substantial roots and
branches; trunk_radius / trunk_height distinguish collision from foliage.
No textures. Uses the same vertex-colour material and palette as props.py.
"""
import math
from pathlib import Path
import random
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import props
import town

SPECS = [('town_tree_oak_a', 6.8, 1.30, .23, '#659449'),
         ('town_tree_elm_a', 7.1, 1.05, .19, '#789453'),
         ('town_tree_birch_a', 6.1, .85, .15, '#91a76a')]


def tree(m, variant, height, radius, trunk, color):
    bark = '#b5b097' if variant == 2 else props.BARK
    m.tube([(0, 0, 0), (.07, -.04, height * .35), (-.03, .06, height * .65),
            (.03, 0, height * .87)], [trunk * 1.45, trunk, trunk * .7, trunk * .3], bark, n=8)
    for i in range(5):
        a = i * math.tau / 5
        m.tube([props.polar(trunk * 2.5, a, .02), (0, 0, .42)], [trunk * .3, trunk * .65], bark, n=5)
    # Canopies begin above most roofs; broad separated crowns retain visible facets.
    for i in range(4):
        angle = i * 2.4 + variant * .5
        z = height * (.76 + .04 * (i % 2))
        c = Vector(props.polar(radius * .35, angle, z))
        m.tube([(0, 0, height * .52), c], [trunk * .65, trunk * .23], bark, n=6)
        width = radius * (.70 if variant != 1 else .62)
        m.blob(c, (width, width * .87, height * .16), color if i % 2 else '#a3b26a', n=9, jitter=.10)
    m.blob((.02, .02, height * .89), (radius * .64, radius * .59, height * .11), color, n=9, jitter=.09)
    if variant == 2:
        for z in (.72, 1.45, 2.1, 2.95):
            m.box((.025, -.14, z), (.15, .035, .055), '#655c48')


def build(scene=None):
    scene = scene or bpy.context.scene
    collection = bpy.data.collections.get('TownGroveTrees') or bpy.data.collections.new('TownGroveTrees')
    if collection.name not in scene.collection.children:
        scene.collection.children.link(collection)
    objects = []
    for i, (name, height, radius, trunk, color) in enumerate(SPECS):
        m = props.Mesh(random.Random(9100 + i))
        tree(m, i, height, radius, trunk, color)
        obj = props.finish(m, name, 'ground', {'max_radius': None, 'blocking': True}, collection)
        obj['trunk_radius'], obj['trunk_height'] = trunk * 1.45, height * .62
        obj['canopy_bottom'], obj['height'] = height * .59, height
        obj['cube_crawler_town_tree'] = True
        objects.append(obj)
    return objects


def main():
    scene = bpy.data.scenes.new('TownGrovePreview')
    bpy.context.window.scene = scene
    objects = build(scene)
    props.export_gltf(objects, props.ASSETS / 'town_trees.glb')
    for i, obj in enumerate(objects):
        obj.location = (i * 4, 0, 0)
    # Reuse presentation materials and light direction, not the town showroom.
    bpy.ops.mesh.primitive_plane_add(size=200, location=(4, 0, -.04))
    floor = bpy.context.object
    floor.name = 'TreePreviewFloor_NOT_EXPORTED'
    floor.data.materials.append(town.plain_material('TreePreviewGround', '#c3c4b0'))
    camera = bpy.data.objects.new('GroveCamera', bpy.data.cameras.new('GroveCamera'))
    scene.collection.objects.link(camera)
    camera.location = (14, -18, 13)
    town.aim(camera, (4, 0, 3.2))
    camera.data.type, camera.data.ortho_scale = 'ORTHO', 15
    scene.camera = camera
    for name, position, energy in [('GroveKey', (-2, -8, 14), 1800), ('GroveFill', (10, 6, 12), 1400)]:
        light = bpy.data.objects.new(name, bpy.data.lights.new(name, 'AREA'))
        scene.collection.objects.link(light)
        light.location, light.data.energy, light.data.size = position, energy, 8
        town.aim(light, (4, 0, 3))
    world = bpy.data.worlds.new('GroveWorld')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = .6
    scene.world = world
    scene.render.engine, scene.cycles.samples = 'CYCLES', 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 1200, 850, 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = str(props.PREVIEWS / 'town_trees-preview.png')
    # In MCP, write only this new scene's dependencies, leaving the user's file
    # untouched. A headless build starts empty and can save a regular main file.
    if bpy.app.background:
        for other in list(bpy.data.scenes):
            if other != scene and not other.objects:
                bpy.data.scenes.remove(other)
        bpy.ops.wm.save_as_mainfile(filepath=str(props.HERE / 'town_trees.blend'))
    else:
        bpy.data.libraries.write(str(props.HERE / 'town_trees.blend'), {scene}, fake_user=True)
    return [{'name': o.name, 'triangles': len(o.data.polygons), 'height': o['height']} for o in objects]


if __name__ == '__main__':
    bpy.ops.wm.read_homefile(use_empty=True, use_factory_startup=True)
    main()
    bpy.ops.render.render(write_still=True)
