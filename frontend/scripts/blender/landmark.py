"""Turn a detailed landmark model into a light map model.

Run by scripts/build-landmarks.mjs (Blender in background mode, script arguments after `--`):

    blender --background --factory-startup --python scripts/blender/landmark.py -- \
        <input.glb> --out <out.glb> --preview <out.png> --target 40000 --height 99 [--drop material_0]

Steps: drop stray parts (--drop <material>), join all meshes, weld split seams, decimate to
about --target triangles, swap the textured materials for flat colours (gold for anything named
*gold*, the original base colour otherwise), smooth by angle, put the origin at the base centre, scale to --height metres
(1 unit = 1 metre), export a GLB without textures, and render a Workbench preview to check by eye.
The source file is never modified.
"""

import argparse
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

GOLD = (0.80, 0.55, 0.16, 1.0)  # linear; close to brand gold #E8B04A once shaded
MIN_PART_TRIS = 150  # even the smallest ornament keeps a recognisable shape


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(prog="landmark.py")
    parser.add_argument("input")
    parser.add_argument("--out", required=True)
    parser.add_argument("--preview")
    parser.add_argument("--target", type=int, default=40000, help="triangle target")
    parser.add_argument("--height", type=float, required=True, help="real height in metres")
    parser.add_argument("--drop", action="append", default=[], help="drop parts that only use this material")
    return parser.parse_args(argv)


def triangle_count(obj):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    mesh = obj.evaluated_get(depsgraph).to_mesh()
    total = sum(len(p.vertices) - 2 for p in mesh.polygons)
    obj.evaluated_get(depsgraph).to_mesh_clear()
    return total


def flat_material(name, color, roughness):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Metallic"].default_value = 0.0  # no environment map on the map, metal would look black
    bsdf.inputs["Roughness"].default_value = roughness
    mat.diffuse_color = color  # Workbench preview colour
    return mat


def base_color(mat):
    if mat and mat.use_nodes:
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            return tuple(bsdf.inputs["Base Color"].default_value)
    return (0.9, 0.88, 0.82, 1.0)


def apply_decimate(obj, **settings):
    mod = obj.modifiers.new("Decimate", "DECIMATE")
    for key, value in settings.items():
        setattr(mod, key, value)
    with bpy.context.temp_override(object=obj, active_object=obj):
        bpy.ops.object.modifier_apply(modifier=mod.name)


def simplify(obj, budget):
    """Weld seams, merge flat areas (terraces, steps), then collapse down to `budget` triangles."""
    mesh = obj.data
    while mesh.uv_layers:  # no textures in the output
        mesh.uv_layers.remove(mesh.uv_layers[0])
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
    bm.to_mesh(mesh)
    bm.free()
    apply_decimate(obj, decimate_type="DISSOLVE", angle_limit=math.radians(1))
    tris = triangle_count(obj)
    if tris > budget:
        apply_decimate(obj, decimate_type="COLLAPSE", ratio=budget / tris, use_collapse_triangulate=True)
    print(f"  {obj.name}: {tris:,} -> {triangle_count(obj):,} (budget {budget:,})")


def main():
    args = parse_args()
    bpy.ops.wm.read_homefile(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(Path(args.input).resolve()))

    for mat in bpy.data.materials:
        print(f"material {mat.name}: base {tuple(round(c, 3) for c in base_color(mat))}")
    # Stray parts (props, helper planes) that aren't part of the landmark.
    for o in [o for o in bpy.context.scene.objects if o.type == "MESH"]:
        names = {s.material.name for s in o.material_slots if s.material}
        if names and names <= set(args.drop):
            print(f"drop {o.name} ({', '.join(sorted(names))})")
            bpy.data.objects.remove(o)
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    before = sum(triangle_count(o) for o in meshes)

    # Share the triangle budget by part size, not by part detail: downloads often spend most
    # triangles on tiny ornaments (Shwedagon: ~1.5M in the spire tip), which are a few pixels on
    # the map, while the big body needs the triangles to keep its shape.
    sizes = {o.name: max(o.dimensions) * max(o.scale) for o in meshes}
    total_size = sum(sizes.values())
    for o in meshes:
        simplify(o, max(MIN_PART_TRIS, int(args.target * sizes[o.name] / total_size)))

    # Join into one object (applies each part's transform).
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    print(f"triangles: {before:,} -> {triangle_count(obj):,}")

    # Flat colours instead of textures.
    gold = flat_material("Gold", GOLD, 0.45)
    for i, slot in enumerate(obj.material_slots):
        if slot.material and "gold" in slot.material.name.lower():
            obj.material_slots[i].material = gold
        else:
            obj.material_slots[i].material = flat_material(f"Base{i}", base_color(slot.material), 0.8)
    bpy.ops.object.material_slot_remove_unused()

    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))

    # Origin at the base centre, scaled to the real height (Blender Z up -> glTF Y up on export).
    corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    lo = Vector((min(c.x for c in corners), min(c.y for c in corners), min(c.z for c in corners)))
    hi = Vector((max(c.x for c in corners), max(c.y for c in corners), max(c.z for c in corners)))
    scale = args.height / (hi.z - lo.z)
    obj.location = (-(lo.x + hi.x) / 2 * scale, -(lo.y + hi.y) / 2 * scale, -lo.z * scale)
    obj.scale = (scale, scale, scale)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    size = [(hi[i] - lo[i]) * scale for i in range(3)]
    print(f"size (m): {size[0]:.1f} x {size[1]:.1f} x {size[2]:.1f}")

    out = Path(args.out).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(out), export_format="GLB", use_selection=False,
        export_texcoords=False, export_tangents=False, export_normals=True,
        export_materials="EXPORT", export_yup=True,
    )
    print(f"OK {out}")

    if args.preview:
        render_preview(Path(args.preview).resolve(), size)


def render_preview(path, size):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "MATERIAL"
    scene.display.shading.show_shadows = True
    scene.render.resolution_x = 720
    scene.render.resolution_y = 900
    scene.render.film_transparent = False
    world = bpy.data.worlds.new("Preview")
    scene.world = world
    world.color = (0.95, 0.93, 0.88)

    cam_data = bpy.data.cameras.new("Cam")
    cam = bpy.data.objects.new("Cam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    h = size[2]
    dist = h * 1.9
    cam.location = (dist * 0.7, -dist * 0.7, h * 0.75)
    target = Vector((0, 0, h * 0.42))
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam_data.lens = 50
    cam_data.clip_end = dist * 4

    path.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    print(f"preview {path}")


main()
