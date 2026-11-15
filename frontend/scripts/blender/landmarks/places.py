"""Famous Yangon places, low-poly, on their real OpenStreetMap footprints, from one spec table.

    blender ... --python places.py -- --id thuwunna_stadium --out <glb> --preview <png>

Footprints: assets/raw/osm/landmarks-places.json (node scripts/extract-places.mjs). Storeys come
from OSM building:levels where mapped, else published figures, noted per entry. Each place is
built from one or more parts; a part is a footprint plus a style:

- mall        podium with a glass row per floor, a coloured sign band and an entrance canopy
- mall_tower  mall podium (4 floors) with the upper floors as a set-back tower
- tower       office / residential tower, glass bands on every other floor
- hotel       warm slab tower with glass bands
- slab        1960s white slab with balcony bands
- colonial    red-brick, white-banded block with a central tower and dome
- station     cream two-storey hall with Burmese tiered (pyatthat) roofs along it
- teak        teak hotel with a dark roof and a tall tiered roof
- stadium     sloping stands around a track and pitch, a roof over the main stand, floodlights

Car parks are not modelled here: the city generator draws every OSM car park (with cars) around
them. The script prints the origin: that is the place's lng/lat in src/map/config.js.
"""

import json
import math
import sys
from pathlib import Path

import bmesh
import bpy

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lowpoly as lp  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
WAYS = json.loads((ROOT / "assets/raw/osm/landmarks-places.json").read_text(encoding="utf-8"))

PODIUM = "#E6DED0"
ROOFTOP = "#D6D0C4"
GLASS = "#8FB3C9"
GLASS_DARK = "#5F86A4"
SLAB = "#F1EDE4"
WARM = "#E9D3AE"

# id: parts [(way id, style, floors, options)]; floors None = OSM building:levels.
SPECS = {
    # Ocean Supercenter Hlaing Tharyar: three-storey mall, blue Ocean sign.
    "ocean_hlaingtharyar": [(596747619, "mall", 3, dict(sign="#1D4FA0"))],
    # Sedona Hotel Yangon: 11 storeys (OSM), warm stone and glass.
    "sedona": [(374512164, "hotel", None, {})],
    # Times City: Office Tower I (25 floors, 105 m) and residence towers (27 floors, ~92 m, CTBUH)
    # in blue glass on the Times City mall podium.
    "times_city": [(922255284, "mall", 5, dict(sign="#2B4C7E")),
                   (793349746, "tower", 27, dict(glass=GLASS_DARK)),
                   (793349747, "tower", 25, dict(glass=GLASS_DARK, floor=4.2)),
                   (793349748, "tower", 27, dict(glass=GLASS_DARK))],
    # Thuwunna Stadium (1985, renovated 2011, 32,000–50,000 seats): covered west grandstand,
    # IAAF eight-lane track (Wikipedia, StadiumDB).
    "thuwunna_stadium": [(15059554, "stadium", None, dict(seats="#C54A3F", main="west", height=16))],
    # Junction 8 (Mayangone): mall of 3 floors with the orange Junction sign.
    "junction_8": [(1355408858, "mall", 3, dict(sign="#E07A2E"))],
    # Dagon Center I (10 storeys) and II (16 storeys), OSM levels: mall podium + tower.
    "dagon_center": [(374912639, "mall_tower", None, dict(sign="#2F7D4F")),
                     (235380314, "mall_tower", None, dict(sign="#2F7D4F"))],
    # Hledan Center: 9 storeys (OSM).
    "hledan_center": [(1514269235, "mall_tower", None, dict(sign="#B23A3A"))],
    # Taw Win Centre (Dagon): 10 storeys (OSM).
    "taw_win_centre": [(222162072, "mall_tower", None, dict(sign="#8C5BA6"))],
    # Junction Centre Maw Tin (Anawrahta Rd × Lan Thit Rd): mall with a two-screen cinema and an
    # office tower, 16 storeys (OSM).
    "junction_mawtin": [(260947691, "mall_tower", None, dict(sign="#E07A2E"))],
    # Kandawgyi Palace Hotel: teak hotel on the lake (the old Rowing Club), Burmese tiered roof.
    "kandawgyi_palace": [(132021404, "teak", 4, dict(spire=True)), (132003321, "teak", 3, {}),
                         (1557971575, "teak", 3, {})],
    # Yangon Central Railway Station (1954): two-storey hall under Burmese tiered roofs.
    "yangon_central_station": [(102685394, "station", 2, {})],
    # Inya Lake Hotel (1962): long modernist slab by the lake.
    "inya_lake_hotel": [(216882182, "slab", 6, {})],
    # Yangon General Hospital (1911): red-brick Victorian block, three storeys (OSM), central tower.
    "yangon_general_hospital": [(482554981, "colonial", None, {})],
    # Bogyoke Aung San Stadium (1909, ~40,000): stands around the pitch and track, covered main stand.
    "aung_san_stadium": [(613396987, "stadium", None, dict(seats="#3F6FB0", main="west", height=14))],
    # Capital Hypermarket (Dawbon): two-floor hypermarket box with the red Capital sign.
    "capital_hypermarket": [(400578781, "mall", 2, dict(sign="#D2312B"))],
}


def opt_id():
    argv = sys.argv[sys.argv.index("--") + 1:]
    return argv[argv.index("--id") + 1]


# ---- geometry helpers ----

def centroid(pts):
    a = cx = cy = 0.0
    for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]):
        f = x0 * y1 - x1 * y0
        a, cx, cy = a + f, cx + (x0 + x1) * f, cy + (y0 + y1) * f
    return (cx / (3 * a), cy / (3 * a)) if abs(a) > 1e-9 else (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))


def shrink(pts, k):
    cx, cy = centroid(pts)
    return [(cx + (x - cx) * k, cy + (y - cy) * k) for x, y in pts]


def longest_edge(pts):
    return max(zip(pts, pts[1:] + pts[:1]), key=lambda e: (e[1][0] - e[0][0]) ** 2 + (e[1][1] - e[0][1]) ** 2)


def frame(pts):
    """Angle of the longest edge and the footprint's half-length / half-width along it."""
    (x0, y0), (x1, y1) = longest_edge(pts)
    ang = math.atan2(y1 - y0, x1 - x0)
    cx, cy = centroid(pts)
    c, s = math.cos(-ang), math.sin(-ang)
    us = [(x - cx) * c - (y - cy) * s for x, y in pts]
    vs = [(x - cx) * s + (y - cy) * c for x, y in pts]
    return ang, (max(us) - min(us)) / 2, (max(vs) - min(vs)) / 2


def bands(pts, z0, z1, glass, floor, every=1, k=1.006, h=None):
    """Glass rows on a footprint: one per `every` floors."""
    z = z0 + floor * 0.35
    while z + floor * 0.5 < z1:
        lp.footprint_prism(shrink(pts, k), z, z + (h or floor * 0.55), lp.mat(glass))
        z += floor * every


def canopy(pts, z, glass):
    """Entrance canopy in the middle of the longest edge, sticking out 4 m."""
    (x0, y0), (x1, y1) = longest_edge(pts)
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    cx, cy = centroid(pts)
    nx, ny = mx - cx, my - cy
    d = math.hypot(nx, ny) or 1
    ang = math.atan2(y1 - y0, x1 - x0)
    lp.box(mx + nx / d * 3, my + ny / d * 3, z, 16, 7, 0.5, lp.mat(glass), ang)


def ring_faces(mat, a, b):
    """Quads joining two rings of 3D points (same length)."""
    bm = bmesh.new()
    va = [bm.verts.new(p) for p in a]
    vb = [bm.verts.new(p) for p in b]
    n = len(a)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((va[i], va[j], vb[j], vb[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new("ring")
    bm.to_mesh(mesh)
    bm.free()
    for p in mesh.polygons:
        p.use_smooth = False
    obj = bpy.data.objects.new("ring", mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(lp.mat(mat))
    # stands are seen from both sides: add the reversed faces too
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.reverse_faces(bm, faces=bm.faces)
    mesh2 = bpy.data.meshes.new("ring_back")
    bm.to_mesh(mesh2)
    bm.free()
    obj2 = bpy.data.objects.new("ring_back", mesh2)
    bpy.context.scene.collection.objects.link(obj2)
    obj2.data.materials.append(lp.mat(mat))


# ---- styles ----

def mall(pts, floors, o, podium_floors=None):
    fl = 5.0
    pf = podium_floors or floors
    h = pf * fl
    lp.footprint_prism(pts, 0, h, lp.mat(PODIUM))
    bands(pts, 0, h - 2.5, o.get("glass", GLASS), fl)
    lp.footprint_prism(shrink(pts, 1.01), h - 3.2, h - 1.0, lp.mat(o.get("sign", "#C9A35A")))   # sign band
    lp.footprint_prism(shrink(pts, 0.99), h, h + 1.0, lp.mat(ROOFTOP))
    canopy(pts, 4.5, o.get("glass", GLASS))
    return h + 1.0


def tower(pts, floors, o, z0=0.0, slab=SLAB):
    fl = o.get("floor", 3.6)
    h = z0 + floors * fl
    lp.footprint_prism(pts, z0, h, lp.mat(slab))
    bands(pts, z0, h, o.get("glass", GLASS), fl * 2, k=1.008, h=fl * 1.25)
    lp.footprint_prism(shrink(pts, 0.94), h, h + 1.2, lp.mat(ROOFTOP))
    lp.footprint_prism(shrink(pts, 0.5), h + 1.2, h + 5.0, lp.mat(slab))                         # plant room
    return h + 5.0


def mall_tower(pts, floors, o):
    top = mall(pts, 4, o)
    if floors > 4:
        tower(shrink(pts, 0.62), floors - 4, dict(o, glass=o.get("glass", GLASS)), z0=top)


def slab(pts, floors, o):
    fl = 3.3
    h = floors * fl
    lp.footprint_prism(pts, 0, h, lp.mat("#F4F1EA"))
    bands(pts, 0, h, "#9EB8C4", fl, k=1.012, h=1.2)            # balcony rails
    lp.footprint_prism(shrink(pts, 1.03), h, h + 0.7, lp.mat("#E2DED6"))                         # thin roof edge


def colonial(pts, floors, o):
    fl = 5.0
    h = floors * fl
    brick, white = "#B4543E", "#F1E9DC"
    lp.footprint_prism(pts, 0, h, lp.mat(brick))
    for z in [fl * i for i in range(1, floors)] + [h - 0.6]:
        lp.footprint_prism(shrink(pts, 1.008), z - 0.35, z + 0.35, lp.mat(white))                # string courses
    bands(pts, 0, h - 1, "#5E5048", fl, k=1.004, h=fl * 0.45)                                    # window rows
    lp.footprint_prism(shrink(pts, 1.02), h, h + 0.8, lp.mat("#8C3E2E"))                          # parapet / roof
    (x0, y0), (x1, y1) = longest_edge(pts)
    ang = math.atan2(y1 - y0, x1 - x0)
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    lp.box(mx, my, 0, 12, 12, h + 9, lp.mat(brick), ang)                                         # central tower
    lp.box(mx, my, h + 9, 13, 13, 1, lp.mat(white), ang)
    lp.dome(mx, my, h + 10, 5.5, lp.mat("#E7E2D8"))
    lp.prism(8, 0.5, 0, h + 15.5, h + 19, lp.mat("#C9A35A"), mx, my)


def station(pts, floors, o):
    cream, roof, gold = "#EFE3C8", "#9C3B2E", "#D9A441"
    h = floors * 4.5
    lp.footprint_prism(pts, 0, h, lp.mat(cream))
    lp.footprint_prism(shrink(pts, 1.006), 0.6, 3.6, lp.mat("#7A5A3E"))                         # arcade shade
    bands(pts, 4.5, h, "#6E5C4A", 4.5, k=1.006, h=1.8)
    lp.footprint_prism(shrink(pts, 1.04), h, h + 1.2, lp.mat(roof))
    ang, hu, hv = frame(pts)
    cx, cy = centroid(pts)
    c, s = math.cos(ang), math.sin(ang)
    for u, w, tiers in ((0.0, 26, 5), (-0.42, 16, 3), (0.42, 16, 3), (-0.8, 13, 3), (0.8, 13, 3)):
        x, y = cx + c * u * hu, cy + s * u * hu
        lp.pyatthat(x, y, h + 1.2, w, tiers, lp.mat(roof), lp.mat(cream), lp.mat(gold), ang)


def teak(pts, floors, o):
    wood, dark = "#B9895A", "#6B4428"
    h = floors * 3.6
    lp.footprint_prism(pts, 0, h, lp.mat(wood))
    bands(pts, 0, h, "#E9D9B8", 3.6, k=1.008, h=1.1)                                             # cream window rows
    lp.footprint_prism(shrink(pts, 1.06), h, h + 0.6, lp.mat(dark))                              # wide eaves
    lp.footprint_prism(shrink(pts, 0.8), h + 0.6, h + 2.0, lp.mat(dark))
    if o.get("spire"):
        x, y = centroid(pts)
        ang, _, _ = frame(pts)
        lp.pyatthat(x, y, h + 2.0, 9, 5, lp.mat(dark), lp.mat(wood), lp.mat("#D9A441"), ang, spire=0.6)


def stadium(pts, floors, o):
    cx, cy = centroid(pts)
    H = o.get("height", 14)
    seats = o.get("seats", "#C54A3F")
    rel = [(x - cx, y - cy) for x, y in pts]
    rmax = max(math.hypot(x, y) for x, y in rel)
    main = o.get("main", "west")

    def side_h(x, y):
        if main == "west" and x < -0.35 * rmax:
            return H + 6
        return H

    inner = [(cx + x * 0.74, cy + y * 0.74, 2.0) for x, y in rel]
    outer = [(cx + x, cy + y, side_h(x, y)) for x, y in rel]
    ground = [(cx + x, cy + y, 0.0) for x, y in rel]
    low = [(cx + x * 0.74, cy + y * 0.74, 0.0) for x, y in rel]
    ring_faces(seats, inner, outer)                       # seating bowl
    ring_faces("#D8D2C6", ground, outer)                  # outer wall
    ring_faces("#D8D2C6", low, inner)                     # pitch-side wall
    lp.footprint_prism(shrink(pts, 0.72), 0, 0.15, lp.mat("#C0603F"))       # running track
    lp.footprint_prism(shrink(pts, 0.6), 0, 0.25, lp.mat("#5FA052"))        # pitch
    # roof over the main stand: the outer ring's west half, cantilevered over the seats
    idx = [i for i, (x, y) in enumerate(rel) if x < -0.35 * rmax]
    if idx:
        idx.sort(key=lambda i: math.atan2(rel[i][1], rel[i][0]) % (2 * math.pi))
        bm = bmesh.new()
        top = H + 12
        a = [bm.verts.new((cx + rel[i][0] * 1.02, cy + rel[i][1] * 1.02, top)) for i in idx]
        b = [bm.verts.new((cx + rel[i][0] * 0.8, cy + rel[i][1] * 0.8, top - 1.5)) for i in idx]
        for i in range(len(idx) - 1):
            bm.faces.new((a[i], a[i + 1], b[i + 1], b[i]))
        mesh = bpy.data.meshes.new("roof")
        bm.to_mesh(mesh)
        bm.free()
        obj = bpy.data.objects.new("roof", mesh)
        bpy.context.scene.collection.objects.link(obj)
        obj.data.materials.append(lp.mat("#ECEEF0"))
        for i in idx[:: max(1, len(idx) // 5)]:                                # roof columns
            lp.box(cx + rel[i][0] * 1.0, cy + rel[i][1] * 1.0, 0, 1.0, 1.0, top, lp.mat("#C8CDD3"))
    for k in range(4):                                                           # floodlight masts
        ang = math.pi / 4 + k * math.pi / 2
        x, y = cx + math.cos(ang) * rmax * 1.04, cy + math.sin(ang) * rmax * 1.04
        lp.box(x, y, 0, 1.2, 1.2, 42, lp.mat("#9AA1A8"))
        lp.box(x, y, 42, 7, 1.5, 4, lp.mat("#F2F2EE"), ang + math.pi / 2)


STYLES = dict(mall=mall, mall_tower=mall_tower, tower=lambda p, f, o: tower(p, f, o),
              hotel=lambda p, f, o: tower(p, f, dict(o, floor=3.4), slab=WARM),
              slab=slab, colonial=colonial, station=station, teak=teak, stadium=stadium)


def main():
    pid = opt_id()
    parts = SPECS[pid]
    rings = []
    for way, *_ in parts:
        ring = WAYS[str(way)]["ring"]
        if ring[0] == ring[-1]:
            ring = ring[:-1]
        rings.append(ring)
    # origin: centroid of all footprint points (lng/lat)
    allp = [p for r in rings for p in r]
    lng0 = sum(p[0] for p in allp) / len(allp)
    lat0 = sum(p[1] for p in allp) / len(allp)
    kx, ky = 111320 * math.cos(math.radians(lat0)), 110574
    print(f"origin lng {lng0:.6f} lat {lat0:.6f}")
    lp.reset()
    reach = 0.0
    for (way, style, floors, o), ring in zip(parts, rings):
        pts = [((x - lng0) * kx, (y - lat0) * ky) for x, y in ring]
        reach = max(reach, max(math.hypot(x, y) for x, y in pts))
        if floors is None:
            lv = WAYS[str(way)]["tags"].get("building:levels")
            floors = int(float(lv)) if lv else 3
        STYLES[style](pts, floors, o)
    print(f"reach {reach:.0f} m (use as clear / grounds in config.js)")
    lp.finish(lp.args(), camera_height_ratio=0.6)


main()
