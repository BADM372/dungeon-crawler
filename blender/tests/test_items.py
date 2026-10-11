"""Blender-native geometry, deterministic rebuild and real GLB contract checks.

Blender -b --python blender/tests/test_items.py
Tests only write to a temporary directory; run in a separate Blender process.
"""
import json
import math
from pathlib import Path
import struct
import sys
import tempfile

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import items


def fingerprint(objects):
    return [(o.name, [tuple(v.co) for v in o.data.vertices],
             [(tuple(p.vertices), p.material_index) for p in o.data.polygons],
             [tuple(c.color) for c in o.data.color_attributes['Color'].data]) for o in objects]


def read_glb(path):
    data = Path(path).read_bytes()
    magic, version, length = struct.unpack_from('<4sII', data)
    assert magic == b'glTF' and version == 2 and length == len(data), path
    size, kind = struct.unpack_from('<II', data, 12)
    assert kind == 0x4E4F534A
    gltf = json.loads(data[20:20 + size])
    offset = 20 + size
    bin_size, bin_kind = struct.unpack_from('<II', data, offset)
    assert bin_kind == 0x004E4942
    return gltf, data[offset + 8:offset + 8 + bin_size]


def accessor_values(gltf, binary, index):
    accessor = gltf['accessors'][index]
    view = gltf['bufferViews'][accessor['bufferView']]
    types = {5121: 'B', 5123: 'H', 5125: 'I', 5126: 'f'}
    widths = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4}
    fmt = '<' + types[accessor['componentType']] * widths[accessor['type']]
    offset = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
    stride = view.get('byteStride', struct.calcsize(fmt))
    return [struct.unpack_from(fmt, binary, offset + i * stride) for i in range(accessor['count'])]


def check_glb(path, reports):
    gltf, binary = read_glb(path)
    expected = {r['name']: r for r in reports}
    for field in ('images', 'textures', 'animations', 'skins', 'cameras'):
        assert not gltf.get(field), (path, field)
    assert not gltf.get('extensions', {}).get('KHR_lights_punctual')
    nodes = [gltf['nodes'][i] for i in gltf['scenes'][gltf.get('scene', 0)]['nodes']]
    assert {n['name'] for n in nodes} == set(expected)
    assert len(nodes) == len(gltf['nodes']) == len(reports)
    for node in nodes:
        assert node.get('translation', [0, 0, 0]) == [0, 0, 0]
        assert node.get('rotation', [0, 0, 0, 1]) == [0, 0, 0, 1]
        assert node.get('scale', [1, 1, 1]) == [1, 1, 1]
        extra, report = node['extras'], expected[node['name']]
        assert extra['cube_crawler_item'] is True
        for key in ('category', 'attach', 'units', 'game_scale'):
            assert extra[key] == report[key], (node['name'], key)
        assert extra['blocking'] == (report['category'] == 'container')
        if report['category'] == 'weapon':
            assert extra['socket'] in ('hand.L', 'hand.R')
            assert extra['axis_gltf'] == '+Y'
            if extra['weapon'] == 'sword':
                assert extra['attack_clip'] == 'Slash'
        triangles = 0
        low, high = [float('inf')] * 3, [-float('inf')] * 3
        for primitive in gltf['meshes'][node['mesh']]['primitives']:
            attrs = primitive['attributes']
            assert 'COLOR_0' in attrs and 'NORMAL' in attrs and 'TEXCOORD_0' not in attrs
            assert primitive.get('mode', 4) == 4
            positions = accessor_values(gltf, binary, attrs['POSITION'])
            normals = accessor_values(gltf, binary, attrs['NORMAL'])
            indices = [v[0] for v in accessor_values(gltf, binary, primitive['indices'])]
            assert len(indices) % 3 == 0
            triangles += len(indices) // 3
            for p in positions:
                assert all(math.isfinite(x) for x in p)
                for k in range(3):
                    low[k], high[k] = min(low[k], p[k]), max(high[k], p[k])
            # Actual exported normals must remain flat, with matching winding.
            for i in range(0, len(indices), 3):
                a, b, c = indices[i:i + 3]
                assert max(abs(normals[a][k] - normals[b][k]) for k in range(3)) < 1e-5
                assert max(abs(normals[a][k] - normals[c][k]) for k in range(3)) < 1e-5
                cross = (Vector(positions[b]) - Vector(positions[a])).cross(
                    Vector(positions[c]) - Vector(positions[a]))
                assert cross.dot(Vector(normals[a])) > 1e-10, node['name']
            mat = gltf['materials'][primitive['material']]
            assert mat.get('alphaMode', 'OPAQUE') == 'OPAQUE'
            assert not mat.get('pbrMetallicRoughness', {}).get('baseColorTexture')
        assert triangles == report['triangles'], node['name']
        lo, hi = report['bounds_blender']
        expected_low, expected_high = [lo[0], lo[2], -hi[1]], [hi[0], hi[2], -lo[1]]
        for k in range(3):
            assert abs(low[k] - expected_low[k]) < 1e-5, (node['name'], low, expected_low)
            assert abs(high[k] - expected_high[k]) < 1e-5


def main():
    scene = bpy.data.scenes.new('ItemsValidation')
    previous = bpy.context.window.scene if bpy.context.window else None
    if bpy.context.window:
        bpy.context.window.scene = scene
    try:
        objects = items.build(scene)
        first = fingerprint(objects)
        objects = items.build(scene)
        assert fingerprint(objects) == first, 'Rebuild must be deterministic'
        reports = items.validate(objects)
        for i, obj in enumerate(objects):
            obj.location = (i * 2, 3, .5)
        objects[0].hide_set(True)
        objects[1].hide_viewport = True
        objects[2].select_set(True)
        bpy.context.view_layer.objects.active = objects[2]
        states = [(tuple(o.location), o.hide_get(), o.hide_viewport, o.select_get()) for o in objects]
        with tempfile.TemporaryDirectory(prefix='cube-items-test-') as directory:
            items.export(objects, directory)
            check_glb(Path(directory) / 'items.glb', reports)
            for obj, report in zip(objects, reports):
                check_glb(Path(directory) / 'items' / (obj.name + '.glb'), [report])
            assert states == [(tuple(o.location), o.hide_get(), o.hide_viewport, o.select_get()) for o in objects]
            assert bpy.context.view_layer.objects.active == objects[2]
        print(f"PASS: {len(objects)} deterministic assets, {sum(r['triangles'] for r in reports)} triangles; "
              '25 GLBs validated for pivots, Y-up bounds, flat normals, colours, extras and export state restoration')
        return {'assets': len(objects), 'triangles': sum(r['triangles'] for r in reports), 'glbs_checked': 25}
    finally:
        if previous:
            bpy.context.window.scene = previous


if __name__ == '__main__':
    bpy.ops.wm.read_factory_settings(use_empty=True)
    main()
