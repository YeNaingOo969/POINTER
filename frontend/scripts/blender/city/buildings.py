"""Ordinary Yangon buildings from OpenStreetMap footprints, one model per area.

    blender --background --factory-startup --python scripts/blender/city/buildings.py -- \
        --data assets/raw/osm/city/downtown-buildings.json --kind downtown --origin 96.1575,16.776 \
        --out assets/work/city/downtown.glb --preview assets/work/city/downtown.png

Every footprint becomes a building on its real outline (1 unit = 1 metre, origin = --origin at street
level, +Y north). Height: OSM height or building:levels when tagged, otherwise a storey count picked
per area kind (seeded by the OSM id, so it never changes between runs). Walls get repeating facade
textures (public/models/city/tex, scripts/city-textures.py) — one bay wide, one storey high — and each
building a colour from the area's palette as a vertex colour, so thousands of buildings stay a few
draw calls and a few triangles each. Footprints under our hand-made landmarks are skipped.

Kinds: downtown (shop ground floor + walk-up apartments above, flat roofs), residential (houses and
low apartments, zinc roofs on small ones), industrial (steel sheds, zinc roofs).
"""

import argparse
import json
import math
import re
import sys
from pathlib import Path

import bmesh
import bpy

ROOT = Path(__file__).resolve().parents[3]
TEX = ROOT / "public" / "models" / "city" / "tex"

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--data", required=True)
ap.add_argument("--kind", default="auto", choices=["auto", "downtown", "residential", "industrial"])
ap.add_argument("--industrial", help="Overpass JSON of landuse=industrial areas (for --kind auto)")
ap.add_argument("--origin", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--preview")
args = ap.parse_args(argv)
LNG0, LAT0 = (float(v) for v in args.origin.split(","))
KX = 111320 * math.cos(math.radians(LAT0))
KY = 110574

# Wall colours seen on Yangon streets: cream, butter yellow, pale pink, mint, sky blue, white, grey.
PALETTES = {
    "downtown": [(0.98, 0.93, 0.80), (0.98, 0.88, 0.62), (0.97, 0.82, 0.80), (0.80, 0.92, 0.84),
                 (0.78, 0.86, 0.95), (0.96, 0.96, 0.95), (0.86, 0.85, 0.82), (0.95, 0.78, 0.62)],
    "residential": [(0.98, 0.94, 0.84), (0.96, 0.88, 0.70), (0.90, 0.95, 0.88), (0.86, 0.90, 0.97), (0.97, 0.97, 0.96)],
    "industrial": [(0.90, 0.92, 0.94), (0.78, 0.84, 0.92), (0.92, 0.90, 0.86), (0.70, 0.78, 0.86)],
}
BAY = 3.6
STOREY = 3.2
SHOP = 3.8


def hash01(n, salt=0):
    """Deterministic 0..1 from an OSM id."""
    x = (n * 2654435761 + salt * 97531) & 0xFFFFFFFF
    x ^= x >> 13
    x = (x * 1274126177) & 0xFFFFFFFF
    return (x & 0xFFFF) / 0xFFFF


def landmark_spots():
    """Hand-made landmarks (src/map/config.js): skip OSM buildings within their `clear` radius."""
    text = (ROOT / "src" / "map" / "config.js").read_text(encoding="utf8")
    spots = []
    for m in re.finditer(r"lng: ([\d.]+), lat: ([\d.]+), rotation: [\d.-]+, clear: ([\d.]+)", text):
        lng, lat, clear = map(float, m.groups())
        spots.append(((lng - LNG0) * KX, (lat - LAT0) * KY, clear))
    return spots


def area(pts):
    return 0.5 * sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]))


def height_of(tags, osm_id, a, akind):
    if "height" in tags:
        try:
            return float(re.sub(r"[^\d.]", "", tags["height"]))
        except ValueError:
            pass
    if "building:levels" in tags:
        try:
            levels = float(tags["building:levels"])
            return SHOP + (levels - 1) * STOREY if akind == "downtown" else levels * STOREY
        except ValueError:
            pass
    r = hash01(osm_id)
    btype = tags.get("building", "yes")
    if akind == "industrial" or btype in ("industrial", "warehouse", "factory"):
        return 4.5 if a < 120 else 8 + r * 4
    if btype in ("house", "detached", "hut"):
        return STOREY * (1 + (r > 0.6))
    if akind == "downtown":
        floors = 3 + int(r * 4) + (2 if a > 900 else 0)          # mostly 3–6 storeys, bigger blocks 5–8
        return SHOP + (floors - 1) * STOREY
    if btype in ("apartments", "residential") or a > 350:
        return STOREY * (4 + int(r * 4))                         # walk-up blocks / housing estates: 4–7
    if btype in ("commercial", "retail", "office", "hotel"):
        return STOREY * (3 + int(r * 5))
    if btype in ("school", "university", "hospital", "public", "government"):
        return STOREY * (2 + int(r * 3))
    return STOREY * (1 + (r > 0.55))                             # houses: 1–2 storeys


def wall_kind(tags, a, akind):
    btype = tags.get("building", "yes")
    if akind == "industrial" or btype in ("industrial", "warehouse", "factory"):
        return "factory"
    if btype in ("house", "detached", "hut") or (akind == "residential" and a < 160 and btype not in ("apartments", "commercial", "retail")):
        return "house"
    return "apartment"


# ---- build: one bmesh per material, faces added straight in (fast for thousands of buildings) ----

bpy.ops.wm.read_homefile(use_empty=True)
meshes = {}


def bm_for(name):
    if name not in meshes:
        bm = bmesh.new()
        meshes[name] = (bm, bm.loops.layers.uv.new("UVMap"), bm.loops.layers.color.new("Color"))
    return meshes[name]


def quad(name, corners, uvs, color):
    bm, uv, col = bm_for(name)
    face = bm.faces.new([bm.verts.new(c) for c in corners])
    for loop, t in zip(face.loops, uvs):
        loop[uv].uv = t
        loop[col] = (*color, 1.0)


def polygon(name, pts, z, color, tile):
    bm, uv, col = bm_for(name)
    try:
        face = bm.faces.new([bm.verts.new((x, y, z)) for x, y in pts])
    except ValueError:
        return
    for loop in face.loops:
        loop[uv].uv = (loop.vert.co.x / tile, loop.vert.co.y / tile)
        loop[col] = (*color, 1.0)


def walls(name, pts, z0, z1, color, storey):
    d = 0.0
    for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]):
        length = math.hypot(x2 - x1, y2 - y1)
        if length < 0.3:
            continue
        u0, u1 = d / BAY, (d + length) / BAY
        v0, v1 = 0.0, (z1 - z0) / storey
        quad(name, [(x1, y1, z0), (x2, y2, z0), (x2, y2, z1), (x1, y1, z1)],
             [(u0, v0), (u1, v0), (u1, v1), (u0, v1)], color)
        d += length


spots = landmark_spots()
data = json.loads(Path(args.data).read_text(encoding="utf8"))
DOWNTOWN = (96.138, 16.763, 96.185, 16.792)   # Lanmadaw–Pazundaung, Strand Road to Anawrahta + a bit


def load_industrial():
    if not args.industrial:
        return []
    polys = []
    for w in json.loads(Path(args.industrial).read_text(encoding="utf8"))["elements"]:
        if "geometry" in w:
            polys.append([((p["lon"] - LNG0) * KX, (p["lat"] - LAT0) * KY) for p in w["geometry"]])
    return polys


def inside(x, y, poly):
    hit = False
    for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            hit = not hit
    return hit


industrial = load_industrial()


def area_kind(cx, cy):
    if args.kind != "auto":
        return args.kind
    if any(inside(cx, cy, poly) for poly in industrial):
        return "industrial"
    lng, lat = LNG0 + cx / KX, LAT0 + cy / KY
    if DOWNTOWN[0] <= lng <= DOWNTOWN[2] and DOWNTOWN[1] <= lat <= DOWNTOWN[3]:
        return "downtown"
    return "residential"

count = 0
for w in data["elements"]:
    if w.get("type") != "way" or "geometry" not in w:
        continue
    pts = [((p["lon"] - LNG0) * KX, (p["lat"] - LAT0) * KY) for p in w["geometry"]]
    if len(pts) > 1 and pts[0] == pts[-1]:
        pts = pts[:-1]
    if len(pts) < 3:
        continue
    a = area(pts)
    if a < 0:
        pts.reverse()            # counter-clockwise so wall normals face out
        a = -a
    if a < 12:
        continue
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    if any(math.hypot(cx - sx, cy - sy) < r for sx, sy, r in spots):
        continue
    tags = w.get("tags", {})
    akind = area_kind(cx, cy)
    h = height_of(tags, w["id"], a, akind)
    palette = PALETTES[akind]
    color = palette[int(hash01(w["id"], 1) * len(palette)) % len(palette)]
    kind = wall_kind(tags, a, akind)
    shop_floor = akind == "downtown" or tags.get("building") in ("commercial", "retail")
    if kind == "apartment" and shop_floor and h > SHOP + 1:
        walls("shop", pts, 0, SHOP, color, SHOP)
        walls("apartment", pts, SHOP, h, color, STOREY)
    else:
        walls(kind, pts, 0, h, color, STOREY if kind != "factory" else h)
    roof = "roof_zinc" if kind in ("factory", "house") else "roof_flat"
    polygon(roof, pts, h, (0.95, 0.95, 0.95) if roof == "roof_flat" else color, 24.0)
    count += 1

# ---- materials: texture × vertex colour, then objects ----


def material(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    img = nt.nodes.new("ShaderNodeTexImage")
    img.image = bpy.data.images.load(str(TEX / f"{name}.jpg"))
    vc = nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "Color"
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs[0].default_value = 1.0
    nt.links.new(img.outputs["Color"], mix.inputs[6])
    nt.links.new(vc.outputs["Color"], mix.inputs[7])
    nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.9
    return m


tris = 0
for name, (bm, _, _) in meshes.items():
    bmesh.ops.recalc_face_normals(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    bmesh.ops.triangulate(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    # The exporter writes the *active* colour attribute as COLOR_0 — make it ours.
    attr = mesh.color_attributes.get("Color")
    if attr:
        mesh.color_attributes.active_color = attr
        mesh.color_attributes.render_color_index = mesh.color_attributes.find("Color")
    tris += len(mesh.polygons)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(material(name))
print(f"buildings: {count:,}  triangles: {tris:,}  materials: {len(meshes)}")

out = Path(args.out).resolve()
out.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(out), export_format="GLB", export_yup=True, export_texcoords=True,
                          export_normals=True, export_vertex_color="ACTIVE", export_image_format="AUTO")
print("OK", out)

if args.preview:
    sys.path.insert(0, str(ROOT / "scripts" / "blender"))
    import lowpoly as lp  # noqa: E402
    scene = bpy.context.scene
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    scene.collection.objects.link(cam)
    scene.camera = cam
    lp.render_view(Path(args.preview).resolve(), (-260, -420, 260), (0, 0, 0), 30)
