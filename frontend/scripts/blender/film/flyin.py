"""Landing section 3 fly-in: a camera move over our own 3D Yangon, rendered with EEVEE.

    blender --background --factory-startup --python scripts/blender/film/flyin.py -- \
        --out assets/work/flyin/ [--frames 120] [--only 1,60,120] [--size 1280x800]

The ground is our own pastel map seen from straight above (assets/raw/images/flyin/
ground-downtown-z15.png, captured from explore.html at zoom 15 with the 3D layer and labels
off — its lng/lat bounds are below). On it: the generated city tiles (assets/work/city, with their
facade textures) and the Blender landmarks (assets/work/landmarks) at their positions from
src/map/config.js. The shot starts as a flat map seen from high above, dives past the Shwedagon on
its hill and settles over downtown and Sule, tilted like the map card that follows it on the page.

Writes PNG frames 0001.png … to --out; scripts/build-flyin.mjs turns them into the WebP sequence
that src/lib/frame-scrub.js plays on scroll.
"""

import json
import math
import re
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def opt(name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default


OUT = Path(opt("--out", str(ROOT / "assets/work/flyin"))).resolve()
FRAMES = int(opt("--frames", "120"))
ONLY = [int(v) for v in opt("--only", "").split(",") if v]
W, H = (int(v) for v in opt("--size", "1280x800").split("x"))

# Ground image bounds (west, south, east, north) — from map.getBounds() when it was captured.
GROUND = ROOT / "assets/raw/images/flyin/ground-downtown-z15.png"
BOUNDS = (96.13402734375057, 16.766962653499547, 96.17797265624995, 16.809035016414683)
LNG0, LAT0 = 96.1560, 16.7880                      # scene origin = centre of the ground image
KX = 111320 * math.cos(math.radians(LAT0))
KY = 110574


def xy(lng, lat):
    return (lng - LNG0) * KX, (lat - LAT0) * KY


# ---- scene ----
bpy.ops.wm.read_homefile(use_empty=True)
scene = bpy.context.scene

# ground: the map image on a plane of the same lng/lat extent
x0, y0 = xy(BOUNDS[0], BOUNDS[1])
x1, y1 = xy(BOUNDS[2], BOUNDS[3])
bpy.ops.mesh.primitive_plane_add(size=1, location=((x0 + x1) / 2, (y0 + y1) / 2, 0))
ground = bpy.context.active_object
ground.scale = (x1 - x0, y1 - y0, 1)
mat = bpy.data.materials.new("ground")
mat.use_nodes = True
nt = mat.node_tree
bsdf = nt.nodes["Principled BSDF"]
tex = nt.nodes.new("ShaderNodeTexImage")
tex.image = bpy.data.images.load(str(GROUND))
tex.interpolation = "Cubic"
nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
bsdf.inputs["Roughness"].default_value = 1.0
ground.data.materials.append(mat)

# a wider plain land plane, so the edges of the image never show against the sky
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, -0.3))
land = bpy.context.active_object
land.scale = (20000, 20000, 1)
lm = bpy.data.materials.new("land")
lm.use_nodes = True
lm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.92, 0.87, 0.78, 1)
lm.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 1.0
land.data.materials.append(lm)


def import_glb(path, x, y, rot_deg=0.0):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    new = [o for o in bpy.data.objects if o not in before]
    roots = [o for o in new if o.parent is None]
    for o in roots:
        o.location.x += x
        o.location.y += y
        o.rotation_euler.z -= math.radians(rot_deg)       # config rotation is clockwise
    return new


# city tiles that touch the ground image (tile = 0.04°, origin at its centre)
STEP = 0.04
for f in sorted((ROOT / "assets/work/city").glob("*.glb")):
    if not re.fullmatch(r"\d+\.\d+_\d+\.\d+", f.stem):
        continue  # old pilot files (downtown.glb …)
    lat, lng = (float(v) for v in f.stem.split("_"))
    if lng + STEP < BOUNDS[0] or lng > BOUNDS[2] or lat + STEP < BOUNDS[1] or lat > BOUNDS[3]:
        continue
    import_glb(f, *xy(lng + STEP / 2, lat + STEP / 2))
    print("tile", f.stem)

# landmarks from src/map/config.js
cfg = (ROOT / "src/map/config.js").read_text(encoding="utf-8")
for m in re.finditer(r"id: '([a-z0-9_]+)', file: '[^']+', lng: ([\d.]+), lat: ([\d.]+), rotation: ([\d.-]+)", cfg):
    lid, lng, lat, rot = m.group(1), float(m.group(2)), float(m.group(3)), float(m.group(4))
    glb = ROOT / f"assets/work/landmarks/{lid}.glb"
    if lid in ("flyovers",) or not glb.exists():
        continue
    if not (BOUNDS[0] - 0.01 < lng < BOUNDS[2] + 0.01 and BOUNDS[1] - 0.01 < lat < BOUNDS[3] + 0.01):
        continue
    import_glb(glb, *xy(lng, lat), rot)
    print("landmark", lid)

# ---- look: golden-hour sun, soft sky, slight haze in the distance ----
try:
    scene.render.engine = "BLENDER_EEVEE_NEXT"
except TypeError:
    scene.render.engine = "BLENDER_EEVEE"
scene.eevee.taa_render_samples = 24
scene.render.resolution_x, scene.render.resolution_y = W, H
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = "Standard"   # keeps the map's pastel colours as on the web
scene.view_settings.look = "Medium High Contrast"
world = bpy.data.worlds.new("Sky")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs["Color"].default_value = (0.96, 0.82, 0.66, 1)   # warm sky, matches the landing's dusk
bg.inputs["Strength"].default_value = 0.45
sun_data = bpy.data.lights.new("Sun", "SUN")
sun_data.energy = 4.2
sun_data.color = (1.0, 0.86, 0.68)
sun_data.angle = math.radians(4)
sun = bpy.data.objects.new("Sun", sun_data)
scene.collection.objects.link(sun)
sun.rotation_euler = (math.radians(55), 0, math.radians(-120))  # low sun from the west: long shadows
try:
    scene.eevee.use_shadows = True
except AttributeError:
    pass

# ---- camera: target + distance + pitch (from straight down) + bearing (clockwise from north) ----
cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
scene.collection.objects.link(cam)
scene.camera = cam
cam.data.lens = 32
cam.data.clip_start = 5
cam.data.clip_end = 20000

shwe = xy(96.14959, 16.79834)
sule = xy(96.158764, 16.774401)
bogyoke = xy(96.155589, 16.780340)
KEYS = [  # (frame share 0–1, target (x, y), distance m, pitch °, bearing °)
    (0.00, (shwe[0] * 0.4, shwe[1] * 0.4), 3600, 0, 0),            # flat map from high above
    (0.30, (shwe[0] * 0.8, shwe[1] * 0.8), 2000, 25, -12),
    (0.55, (shwe[0], shwe[1] - 60), 650, 58, -38),                  # close past the Shwedagon
    (0.80, (bogyoke[0], bogyoke[1] + 150), 1100, 54, -24),          # over Bogyoke Market
    (1.00, (sule[0] - 120, sule[1] + 380), 1500, 52, -17),          # downtown, tilted like the map card
]


def smooth(t):
    return t * t * (3 - 2 * t)


def pose(u):
    """Camera location and look-at point at progress u (0–1), eased between the keys."""
    for (u0, *a), (u1, *b) in zip(KEYS, KEYS[1:]):
        if u <= u1:
            t = smooth((u - u0) / (u1 - u0))
            break
    lerp = lambda p, q: p + (q - p) * t
    tx, ty = lerp(a[0][0], b[0][0]), lerp(a[0][1], b[0][1])
    dist = math.exp(lerp(math.log(a[1]), math.log(b[1])))            # zoom feels even in log space
    pitch, bearing = math.radians(lerp(a[2], b[2])), math.radians(lerp(a[3], b[3]))
    back = dist * math.sin(pitch)
    cx = tx - back * math.sin(bearing)
    cy = ty - back * math.cos(bearing)
    cz = dist * math.cos(pitch)
    target = Vector((tx, ty, 0))
    loc = Vector((cx, cy, cz))
    if pitch < 1e-3:                                                  # straight down: keep north up
        loc.y -= 0.01
    return loc, target, bearing


OUT.mkdir(parents=True, exist_ok=True)
frames = ONLY or list(range(1, FRAMES + 1))
for f in frames:
    u = (f - 1) / (FRAMES - 1)
    loc, target, bearing = pose(u)
    cam.location = loc
    q = (target - loc).to_track_quat("-Z", "Y")
    cam.rotation_euler = q.to_euler()
    if (target - loc).normalized().z < -0.999:                       # top-down: turn to the bearing
        cam.rotation_euler = (0, 0, -bearing)
    scene.render.filepath = str(OUT / f"{f:04d}.png")
    bpy.ops.render.render(write_still=True)
    print(f"frame {f}/{FRAMES}", flush=True)
print("OK", OUT)
