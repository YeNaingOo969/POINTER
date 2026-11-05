"""Modern landmarks (towers, malls, hotels), low-poly, from one spec table.

    blender ... --python modern.py -- --id m_tower --out <glb> --preview <png>

Each building = its real OSM footprint (assets/raw/osm/landmarks-nominatim.json, or points
given here) as a podium, plus towers placed in the footprint's own frame (along its longest
edge), with floor bands of glass and slab. Heights come from OSM levels / height and published
figures (Wikipedia, Skyscraper Center), noted per entry. The script prints the footprint
centroid: that is the landmark's lng/lat in src/map/config.js (rotation 0).
"""

import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lowpoly as lp  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
OSM = {e["osm_id"]: e for e in json.loads((ROOT / "assets/raw/osm/landmarks-nominatim.json").read_text(encoding="utf-8"))}

SLAB = "#F1EDE4"
PODIUM = "#E6DED0"
ROOFTOP = "#D6D0C4"
GLASS = "#8FB3C9"
GLASS_DARK = "#6F93AE"
WARM = "#E9D3AE"

# Towers: (u, v, width, depth, height) in the footprint frame — u along the longest edge,
# v across it, both as fractions of the half-size (-1…1); width/depth in metres.
SPECS = {
    # 26 storeys on 4 basements, ~111 m, steel frame and blue glass (Wikipedia, JLL brochure).
    "m_tower": dict(osm=1514269236, podium=0, towers="footprint", height=111, glass=GLASS_DARK, crown=True),
    # 23 storeys, 100 m, opened 1999: white concrete with glass bands, crown on top (Wikipedia).
    "sakura_tower": dict(osm=129485357, podium=0, towers="footprint", height=100, glass=GLASS, slab=SLAB, crown=True),
    # Mall podium with the Junction City office tower and the Pan Pacific hotel (25 storeys).
    "junction_city": dict(osm=481323871, podium=26, towers=[(-0.55, 0.1, 38, 30, 102), (0.55, -0.05, 40, 26, 98)],
                          glass=GLASS),
    # Four-storey mall with cinema (OSM levels 4).
    "junction_square": dict(osm=247753397, podium=21, towers=[], glass=GLASS, sign=True),
    # Myanmar Plaza mall podium with its office tower.
    "myanmar_plaza": dict(osm=421632377, podium=27, towers=[(0.55, 0.55, 34, 30, 88)], glass=GLASS),
    # Meliá Yangon hotel tower on a low podium.
    "melia": dict(osm=463189671, podium=14, towers=[(0.0, -0.35, 70, 22, 92)], glass=GLASS, slab=WARM),
    # LOTTE Hotel Yangon: hotel and serviced-residence slabs on a podium by Inya Lake.
    "lotte": dict(osm=1525507325, podium=16, towers=[(-0.45, 0.0, 70, 22, 84), (0.4, 0.05, 64, 22, 80)],
                  glass=GLASS, slab=WARM),
    # Diamond Inya Palace, 33 storeys, ~105 m (OSM height; Skyscraper Center 122 m).
    "diamond_inya": dict(osm=522822395, podium=12, towers=[(-0.35, -0.3, 34, 30, 105), (0.35, 0.3, 34, 30, 102)],
                         glass=GLASS, slab=SLAB),
    # Novotel Yangon Max, 12 storeys.
    "novotel_max": dict(osm=471327865, podium=10, towers=[(0.0, 0.2, 80, 22, 46)], glass=GLASS, slab=WARM),
    # Chatrium Hotel Royal Lake, 10 storeys by Kandawgyi.
    "chatrium": dict(osm=236949218, podium=8, towers=[(0.0, 0.0, 70, 20, 38)], glass=GLASS, slab=WARM),
    # Sule Shangri-La, 22 storeys (~81 m in OSM): one long slab. Footprint from the map tiles
    # around node 6315351091 (local metres around 16.77855, 96.15853).
    "sule_shangri_la": dict(points=[(-20.1, 74.9), (10.7, 74.3), (7.9, -47.2), (-23.0, -46.1)],
                            origin=(96.15853, 16.77855), podium=0, towers="footprint", height=81,
                            glass=GLASS, slab=WARM, crown=True),
    # Yangon International Airport passenger terminal: the largest terminal building in OSM
    # (from the map tiles, local metres around 16.9035, 96.1345), glass walls under a wide white
    # roof that overhangs the kerb.
    "airport": dict(points=[(-55.8, -311.1), (-66.7, -327), (-58.7, -338.9), (-99.8, -400.2), (-109, -393.4),
                            (-119.8, -408.2), (-115.2, -411.6), (-119.8, -419), (-126.7, -422.9), (-134.1, -425.8),
                            (-143.2, -427.5), (-152.9, -425.8), (-166.1, -416.1), (-149.5, -390.6), (-164.9, -382.1),
                            (-37, -192.5), (14.5, -224.9), (-45, -316.2)],
                    origin=(96.1345, 16.9035), podium=13, towers=[], glass=GLASS, roof="#F6F4EF"),
}


def opts():
    argv = sys.argv[sys.argv.index("--") + 1:]
    return argv[argv.index("--id") + 1]


def footprint(spec):
    """Footprint in local metres around its centroid, plus the centroid's lng/lat."""
    if "points" in spec:
        lng0, lat0 = spec["origin"]
        kx, ky = 111320 * math.cos(math.radians(lat0)), 110574
        ring = [(lng0 + x / kx, lat0 + y / ky) for x, y in spec["points"]]
    else:
        g = OSM[spec["osm"]]["geojson"]
        ring = g["coordinates"][0] if g["type"] == "Polygon" else g["coordinates"][0][0]
        ring = [tuple(p) for p in ring]
    if ring[0] == ring[-1]:
        ring = ring[:-1]
    a = cx = cy = 0.0
    for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1]):
        f = x0 * y1 - x1 * y0
        a, cx, cy = a + f, cx + (x0 + x1) * f, cy + (y0 + y1) * f
    lng0, lat0 = cx / (3 * a), cy / (3 * a)
    kx, ky = 111320 * math.cos(math.radians(lat0)), 110574
    return [((x - lng0) * kx, (y - lat0) * ky) for x, y in ring], (lng0, lat0)


def frame(points):
    """Angle of the longest edge, and the half-sizes of the footprint in that frame."""
    best, ang = 0.0, 0.0
    for (x0, y0), (x1, y1) in zip(points, points[1:] + points[:1]):
        d = (x1 - x0) ** 2 + (y1 - y0) ** 2
        if d > best:
            best, ang = d, math.atan2(y1 - y0, x1 - x0)
    c, s = math.cos(-ang), math.sin(-ang)
    us = [x * c - y * s for x, y in points]
    vs = [x * s + y * c for x, y in points]
    return ang, (max(us) - min(us)) / 2, (max(vs) - min(vs)) / 2, ((max(us) + min(us)) / 2, (max(vs) + min(vs)) / 2)


def scaled(points, k):
    return [(x * k, y * k) for x, y in points]


def banded_prism(points, z0, z1, glass, slab, floor=3.6):
    """Footprint tower: slab body with a glass band on every floor pair."""
    lp.footprint_prism(points, z0, z1, lp.mat(slab))
    z = z0 + floor * 0.6
    while z + floor * 1.2 < z1:
        lp.footprint_prism(scaled(points, 1.01), z, z + floor * 1.25, lp.mat(glass))
        z += floor * 2


def banded_box(cx, cy, z0, w, d, h, rot, glass, slab, floor=3.6):
    lp.box(cx, cy, z0, w, d, h, lp.mat(slab), rot)
    z = z0 + floor * 0.6
    while z + floor * 1.2 < z0 + h:
        lp.box(cx, cy, z, w + 0.5, d + 0.5, floor * 1.25, lp.mat(glass), rot)
        z += floor * 2


def main():
    bid = opts()
    spec = SPECS[bid]
    pts, (lng0, lat0) = footprint(spec)
    print(f"origin lng {lng0:.6f} lat {lat0:.6f}")
    glass, slab = spec.get("glass", GLASS), spec.get("slab", SLAB)
    lp.reset()

    top = 0.0
    if spec["towers"] == "footprint":
        banded_prism(pts, 0, spec["height"], glass, slab)
        top = spec["height"]
        lp.footprint_prism(scaled(pts, 0.96), top, top + 1.2, lp.mat(ROOFTOP))
        if spec.get("crown"):
            lp.footprint_prism(scaled(pts, 0.55), top + 1.2, top + 6, lp.mat(slab))
    else:
        p = spec["podium"]
        lp.footprint_prism(pts, 0, p, lp.mat(PODIUM))
        for z in [h for h in (4.5, 10.5, 16.5, 22.5) if h + 2 < p]:  # shop-front glass rows
            lp.footprint_prism(scaled(pts, 1.004), z, z + 2.6, lp.mat(glass))
        lp.footprint_prism(scaled(pts, 0.985), p, p + 1.0, lp.mat(ROOFTOP))
        if spec.get("roof"):  # wide overhanging roof (terminal canopy)
            lp.footprint_prism(scaled(pts, 1.06), p + 0.2, p + 2.4, lp.mat(spec["roof"]))
        if spec.get("sign"):
            lp.box(0, 0, p + 1, 22, 8, 6, lp.mat("#E8A54B"))
        ang, hu, hv, (ou, ov) = frame(pts)
        c, s = math.cos(ang), math.sin(ang)
        for u, v, w, d, h in spec["towers"]:
            lu, lv = ou + u * hu, ov + v * hv
            x, y = lu * c - lv * s, lu * s + lv * c
            banded_box(x, y, p + 1, w, d, h - p - 1, ang, glass, slab)
            lp.box(x, y, h, w * 0.6, d * 0.6, 4, lp.mat(ROOFTOP), ang)  # plant room
    lp.finish(lp.args(), camera_height_ratio=0.6)


main()
