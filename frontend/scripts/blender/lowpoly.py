"""Small helpers for building low-poly landmark models with bpy (1 unit = 1 metre, Z up).

Builders in scripts/blender/landmarks/<id>.py import this module, add shapes with flat pastel
materials, then call finish() to join, export a GLB (Y up) and render a Workbench preview.
"""

import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

_materials = {}


def args():
    """Script arguments after `--`: --out <glb> [--preview <png>]."""
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    opts = {"out": None, "preview": None}
    for i, a in enumerate(argv):
        if a in ("--out", "--preview"):
            opts[a[2:]] = argv[i + 1]
    return opts


def reset():
    bpy.ops.wm.read_homefile(use_empty=True)
    _materials.clear()


def _linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def mat(hex_color, roughness=0.8):
    """Flat, non-metal material from an sRGB hex colour (shared by colour)."""
    if hex_color in _materials:
        return _materials[hex_color]
    h = hex_color.lstrip("#")
    rgba = tuple(_linear(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4)) + (1.0,)
    m = bpy.data.materials.new(hex_color)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = roughness
    m.diffuse_color = rgba
    _materials[hex_color] = m
    return m


def _object(bm, material, name="part"):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def prism(sides, r1, r2, z0, z1, material, x=0.0, y=0.0, rot=0.0, smooth=False):
    """Frustum with `sides` sides: radius r1 at z0, r2 at z1 (r2 = 0 makes a cone)."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=sides,
                          radius1=r1, radius2=max(r2, 0.0001), depth=z1 - z0)
    # Flat side faces on the X/Y axes, then place.
    turn = math.pi / sides + rot
    bmesh.ops.transform(bm, verts=bm.verts, matrix=Matrix.Translation((x, y, (z0 + z1) / 2)) @ Matrix.Rotation(turn, 4, "Z"))
    obj = _object(bm, material)
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def lathe(profile, sides, material, x=0.0, y=0.0, rot=0.0):
    """Stack of frustums from a [(z, radius), …] profile, bottom to top. Two points at the same
    height make a step (the caps of the neighbouring frustums show it)."""
    return [prism(sides, r1, r2, z1, z2, material, x, y, rot)
            for (z1, r1), (z2, r2) in zip(profile, profile[1:]) if z2 > z1]


def box(cx, cy, z0, sx, sy, sz, material, rot=0.0):
    """Box centred on (cx, cy), from z0 up by sz, turned `rot` radians about Z."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    m = Matrix.Translation((cx, cy, z0 + sz / 2)) @ Matrix.Rotation(rot, 4, "Z") @ Matrix.Diagonal((sx, sy, sz, 1))
    bmesh.ops.transform(bm, verts=bm.verts, matrix=m)
    return _object(bm, material)


def hip_roof(cx, cy, z0, sx, sy, height, material, rot=0.0, overhang=0.6):
    """Hipped roof over an sx × sy rectangle (a frustum-like pyramid with a ridge)."""
    hx, hy = sx / 2 + overhang, sy / 2 + overhang
    ridge = max(hx - hy, 0.0)
    bm = bmesh.new()
    base = [bm.verts.new(v) for v in ((-hx, -hy, 0), (hx, -hy, 0), (hx, hy, 0), (-hx, hy, 0))]
    top = [bm.verts.new((-ridge, 0, height)), bm.verts.new((ridge, 0, height))]
    for f in ((base[0], base[1], top[1], top[0]), (base[2], base[3], top[0], top[1]),
              (base[1], base[2], top[1]), (base[3], base[0], top[0]), tuple(reversed(base))):
        bm.faces.new(f)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.001)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.transform(bm, verts=bm.verts, matrix=Matrix.Translation((cx, cy, z0)) @ Matrix.Rotation(rot, 4, "Z"))
    return _object(bm, material)


def gable(cx, cy, z0, width, depth, height, material, rot=0.0):
    """Triangular pediment / gable: a prism with its triangle facing ±Y (before `rot`)."""
    w, d = width / 2, depth / 2
    bm = bmesh.new()
    front = [bm.verts.new(v) for v in ((-w, -d, 0), (w, -d, 0), (0, -d, height))]
    back = [bm.verts.new(v) for v in ((-w, d, 0), (w, d, 0), (0, d, height))]
    bm.faces.new(front)
    bm.faces.new(tuple(reversed(back)))
    for a, b in ((0, 1), (1, 2), (2, 0)):
        bm.faces.new((front[a], back[a], back[b], front[b]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.transform(bm, verts=bm.verts, matrix=Matrix.Translation((cx, cy, z0)) @ Matrix.Rotation(rot, 4, "Z"))
    return _object(bm, material)


def dome(cx, cy, z0, radius, material, sides=12, rings=4):
    """Low-poly dome (half sphere made of stacked frustums)."""
    profile = [(z0 + radius * math.sin(math.pi / 2 * i / rings), radius * math.cos(math.pi / 2 * i / rings))
               for i in range(rings + 1)]
    return lathe(profile, sides, material, cx, cy)


def pyatthat(cx, cy, z0, width, tiers, roof_mat, wall_mat, spire_mat, rot=0.0, tier_h=None):
    """Burmese tiered roof: shrinking square roofs stacked with short walls, ending in a spire."""
    tier_h = tier_h or width * 0.32
    z, w = z0, width
    for _ in range(tiers):
        box(cx, cy, z, w * 0.62, w * 0.62, tier_h * 0.35, wall_mat, rot)
        z += tier_h * 0.35
        hip_roof(cx, cy, z, w * 0.62, w * 0.62, tier_h * 0.65, roof_mat, rot, overhang=w * 0.19)
        z += tier_h * 0.45
        w *= 0.76
    prism(8, w * 0.35, 0, z, z + width * 0.9, spire_mat, cx, cy)
    return z + width * 0.9


def ribbon(path, width, thickness, material):
    """Box-section strip (a bridge deck, a ramp) along a 3D path [(x, y, z_top), …]."""
    bm = bmesh.new()
    sections = []
    for i, p in enumerate(path):
        a = Vector(path[max(i - 1, 0)][:2])
        b = Vector(path[min(i + 1, len(path) - 1)][:2])
        t = (b - a).normalized()
        n = Vector((-t.y, t.x)) * (width / 2)
        x, y, z = p
        sections.append([bm.verts.new(v) for v in (
            (x + n.x, y + n.y, z), (x - n.x, y - n.y, z),
            (x - n.x, y - n.y, z - thickness), (x + n.x, y + n.y, z - thickness))])
    for s0, s1 in zip(sections, sections[1:]):
        for k in range(4):
            bm.faces.new((s0[k], s0[(k + 1) % 4], s1[(k + 1) % 4], s1[k]))
    bm.faces.new(tuple(reversed(sections[0])))
    bm.faces.new(tuple(sections[-1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _object(bm, material)


def beam(p0, p1, size, material):
    """Thin square bar from p0 to p1 (cables, rods)."""
    a, b = Vector(p0), Vector(p1)
    d = b - a
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    rot = d.to_track_quat("Z", "Y").to_matrix().to_4x4()
    m = Matrix.Translation((a + b) / 2) @ rot @ Matrix.Diagonal((size, size, d.length, 1))
    bmesh.ops.transform(bm, verts=bm.verts, matrix=m)
    return _object(bm, material)


def footprint_prism(points, z0, z1, material):
    """Extrude a footprint [(x, y), …] in metres from z0 to z1."""
    bm = bmesh.new()
    verts = [bm.verts.new((x, y, z0)) for x, y in points]
    face = bm.faces.new(verts)
    bmesh.ops.recalc_face_normals(bm, faces=[face])
    if face.normal.z > 0:
        face.normal_flip()
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    top = [v for v in ext["geom"] if isinstance(v, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=top, vec=(0, 0, z1 - z0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _object(bm, material)


def finish(opts, camera_height_ratio=0.75, view_span=None):
    """Join everything, export the GLB and render the preview (framing `view_span` metres
    around the origin when given, else the whole model)."""
    objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    bpy.ops.object.shade_flat()
    tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    corners = [Vector(c) for c in obj.bound_box]
    size = [max(c[i] for c in corners) - min(c[i] for c in corners) for i in range(3)]
    print(f"triangles: {tris:,}  size (m): {size[0]:.1f} x {size[1]:.1f} x {size[2]:.1f}")

    out = Path(opts["out"]).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(out), export_format="GLB", export_texcoords=False,
                              export_normals=True, export_materials="EXPORT", export_yup=True)
    print(f"OK {out}")
    if opts.get("preview"):
        render_preview(Path(opts["preview"]).resolve(), size, camera_height_ratio, view_span)


def render_preview(path, size, height_ratio=0.75, view_span=None):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "MATERIAL"
    scene.display.shading.show_shadows = True
    scene.render.resolution_x = 900
    scene.render.resolution_y = 900
    world = bpy.data.worlds.new("Preview")
    scene.world = world
    world.color = (0.95, 0.93, 0.88)

    cam_data = bpy.data.cameras.new("Cam")
    cam = bpy.data.objects.new("Cam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    span = view_span or max(size[0], size[1], size[2])
    dist = span * 1.8
    cam.location = (dist * 0.75, -dist * 0.75, dist * height_ratio)
    target = Vector((0, 0, size[2] * 0.35))
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam_data.lens = 50
    cam_data.clip_end = dist * 6

    path.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    print(f"preview {path}")
