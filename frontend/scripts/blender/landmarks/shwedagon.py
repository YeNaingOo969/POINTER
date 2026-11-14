"""Shwedagon Pagoda on Singuttara Hill, modelled from public facts and reference photos
(assets/raw/reference/landmarks/shwedagon-*.jpg).

Real: the hill rises about 51 m; the upper terrace follows the OpenStreetMap outline
(assets/raw/osm/shwedagon-nominatim.json, about 280 x 320 m); the stupa stands 99 m above the
terrace. Gold stupa on a square-then-octagonal stepped plinth, ringed by 64 small stupas with
four larger ones at the cardinal points; prayer halls with tiered roofs along the terrace edge;
four covered stairways (zaungdan) with stepped tiered roofs run down the hill to gates guarded by
white chinthe lions. Wooded slopes.

Origin = centre of the stupa at street level (z 0). North = +Y. 1 unit = 1 metre.
"""

import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lowpoly as lp  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
CENTER = (96.14959, 16.79834)  # stupa, as in src/map/config.js
HILL = 51.0                    # terrace height above the streets
SLOPE = 105.0                  # horizontal run of the hill side
STUPA = 99.0                   # stupa height above the terrace

lp.reset()  # before any material: reset() clears them

GOLD = lp.mat("#E2AA3C", 0.3)
GOLD_DARK = lp.mat("#B9842A", 0.45)
MARBLE = lp.mat("#EFE9DF", 0.6)
WALL = lp.mat("#F3EEE6", 0.7)
ROOF_RED = lp.mat("#A8432E", 0.6)
STEP = lp.mat("#CFC6B8", 0.8)
HILLSIDE = lp.mat("#6F9A55", 0.95)
LEAF = lp.mat("#4F7F3F", 0.95)
LEAF2 = lp.mat("#679A4A", 0.95)
TRUNK = lp.mat("#6B4F35", 0.9)
LION = lp.mat("#F4F1EA", 0.6)

# ---------------------------------------------------------------- terrace outline (OSM)
data = json.loads((ROOT / "assets/raw/osm/shwedagon-nominatim.json").read_text(encoding="utf8"))
ring = next(e for e in data if e["geojson"]["type"] == "Polygon")["geojson"]["coordinates"][0]
kx = 111320 * math.cos(math.radians(CENTER[1]))
outline = [((lng - CENTER[0]) * kx, (lat - CENTER[1]) * 110574) for lng, lat in ring[:-1]]


def inside(x, y, poly=outline):
    hit = False
    for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            hit = not hit
    return hit


def edge_distance(x, y, poly=outline):
    best = 1e9
    for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
        dx, dy = x2 - x1, y2 - y1
        t = max(0.0, min(1.0, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
        best = min(best, math.hypot(x - (x1 + t * dx), y - (y1 + t * dy)))
    return best


def edge_along(angle):
    """Distance from the centre to the terrace edge in a direction (radians, 0 = east)."""
    r = 0.0
    while inside(r * math.cos(angle), r * math.sin(angle)) and r < 400:
        r += 1.0
    return r


# The four stairways leave the terrace on the main axes (south one is the main entrance).
STAIRS = {name: (ang, edge_along(ang)) for name, ang in
          (("east", 0.0), ("north", math.pi / 2), ("west", math.pi), ("south", -math.pi / 2))}
STAIR_W = 12.0


def stair_height(x, y):
    """Street-to-terrace height along a stairway (None when (x, y) is not on one)."""
    for ang, edge in STAIRS.values():
        along = x * math.cos(ang) + y * math.sin(ang)
        across = -x * math.sin(ang) + y * math.cos(ang)
        if abs(across) <= STAIR_W / 2 + 2 and edge <= along <= edge + SLOPE:
            return HILL * (1 - (along - edge) / SLOPE)
    return None


def hill(x, y):
    if inside(x, y):
        return HILL - 1.2  # the terrace slab sits on top
    d = edge_distance(x, y)
    if d >= SLOPE:
        return 0.0
    t = d / SLOPE
    h = HILL * (1 - t * t * (3 - 2 * t))
    s = stair_height(x, y)
    return min(h, s - 2.0) if s is not None else h


# ---------------------------------------------------------------- hill, terrace, trees
xs = [p[0] for p in outline]
ys = [p[1] for p in outline]
lp.terrain(min(xs) - SLOPE, min(ys) - SLOPE, max(xs) + SLOPE, max(ys) + SLOPE, 7.0, hill, HILLSIDE)
lp.footprint_prism(outline, HILL - 2.0, HILL, MARBLE)

seed = 0
for gx in range(int(min(xs) - SLOPE), int(max(xs) + SLOPE), 12):
    for gy in range(int(min(ys) - SLOPE), int(max(ys) + SLOPE), 12):
        seed += 1
        if (seed * 2654435761) % 10 < 1:
            continue  # gaps, so the woods look natural
        x = gx + ((seed * 7919) % 17) - 8
        y = gy + ((seed * 104729) % 17) - 8
        z = hill(x, y)
        if 3 < z < HILL - 6 and stair_height(x, y) is None:
            size = 7 + ((seed * 31) % 9) * 1.3
            lp.tree(x, y, z - 0.5, size, LEAF if seed % 3 else LEAF2, TRUNK, seed)

# ---------------------------------------------------------------- the stupa
Z = HILL
# Stepped plinth: three square terraces, then three octagonal ones (all gilded).
for side, z0, z1 in ((66, 0, 3.6), (60, 3.6, 6.8), (54, 6.8, 9.6)):
    lp.box(0, 0, Z + z0, side, side, z1 - z0, GOLD_DARK)
    lp.box(0, 0, Z + z1 - 0.4, side + 0.8, side + 0.8, 0.4, GOLD)  # moulding
for r, z0, z1 in ((25.5, 9.6, 12.2), (23.0, 12.2, 14.8), (20.8, 14.8, 17.2)):
    lp.prism(8, r, r, Z + z0, Z + z1, GOLD_DARK)
    lp.prism(8, r + 0.5, r + 0.5, Z + z1 - 0.35, Z + z1, GOLD)

# Bell, bands, inverted bowl, turban, lotus petals, banana bud, umbrella (hti), vane, orb.
# Heights are scaled so the top lands at 99 m above the terrace.
PROFILE = [
    (17.2, 18.0), (18.6, 18.2), (21, 17.6), (25, 16.2), (29, 14.4), (33, 12.4), (37, 10.6), (41, 9.4),
    (41, 9.9), (42.2, 9.9), (42.2, 9.3), (43.4, 9.3), (43.4, 9.6), (44.6, 9.6), (44.6, 8.9),
    (46.0, 8.9), (47.6, 9.3), (49.4, 9.0), (51.0, 8.0),                      # inverted alms bowl
    (51.0, 7.5), (52.4, 7.4), (52.4, 7.7), (53.4, 7.7), (53.4, 7.0), (54.6, 6.8),  # turban bands
    (54.6, 7.2), (56.0, 7.8), (57.2, 6.6), (57.2, 6.9), (58.8, 7.2), (60.2, 5.6),  # lotus petals
    (60.2, 5.4), (63, 5.1), (66, 4.5), (69, 3.7), (72, 2.8), (75, 1.9), (77.5, 1.2), (79, 0.9),
]
HTI = [(79, 0.9)]
z, r = 79.0, 2.5
for i in range(7):  # seven umbrella tiers, shrinking
    HTI += [(z, r), (z + 0.55, r * 0.92), (z + 0.55, r * 0.62)]
    z += 1.25
    r *= 0.82
HTI += [(z, 0.35), (z + 1.6, 0.3), (z + 1.6, 0.0)]
scale = STUPA / (z + 4.2)
lp.revolve([(pz * scale, pr) for pz, pr in PROFILE + HTI[1:]], 64, GOLD, z=Z)
top = Z + (z + 1.6) * scale
lp.box(0.9, 0, top - 0.2, 1.6, 0.12, 0.9, GOLD)            # vane
lp.revolve([(0, 0.0), (0.4, 0.55), (0.9, 0.62), (1.3, 0.4), (1.6, 0.0)], 16, GOLD, z=top + 0.8)  # diamond orb
lp.prism(6, 0.12, 0.0, top + 2.4, top + 4.2, GOLD)


def small_stupa(x, y, z0, h, mat=GOLD):
    """Miniature stupa: square base, bell, banana bud and spire, scaled to height h."""
    s = h / 10
    lp.box(x, y, z0, 2.6 * s, 2.6 * s, 0.9 * s, GOLD_DARK)
    lp.revolve([(0, 1.25 * s), (0.6 * s, 1.3 * s), (2.2 * s, 1.0 * s), (3.4 * s, 0.6 * s), (3.4 * s, 0.68 * s),
                (3.9 * s, 0.6 * s), (5.6 * s, 0.32 * s), (7.4 * s, 0.12 * s), (9.1 * s, 0.03 * s), (9.1 * s, 0.0)],
               16, mat, x, y, z0 + 0.9 * s)


# 64 small stupas around the plinth (16 a side), larger ones at the four cardinal points.
half = 37.0
for i in range(16):
    t = -half + (i + 0.5) * (2 * half / 16)
    for x, y in ((t, -half), (t, half), (-half, t), (half, t)):
        if abs(t) > 5:
            small_stupa(x, y, Z, 8.5)
for x, y in ((0, -half - 4), (0, half + 4), (-half - 4, 0), (half + 4, 0)):
    small_stupa(x, y, Z, 16)
for x, y in ((-half - 6, -half - 6), (half + 6, -half - 6), (-half - 6, half + 6), (half + 6, half + 6)):
    small_stupa(x, y, Z, 12)


def hall(cx, cy, w, d, rot, tiers=3, roof=GOLD):
    """Prayer hall (tazaung): white walls with dark doorways and a Burmese tiered roof."""
    lp.box(cx, cy, Z, w, d, 5.5, WALL, rot)
    c, s = math.cos(rot), math.sin(rot)
    for k in (-1, 1):  # doorway shadows on the long sides
        lp.box(cx - s * k * (d / 2 + 0.05), cy + c * k * (d / 2 + 0.05), Z, w * 0.3, 0.12, 3.6, STEP, rot)
    lp.hip_roof(cx, cy, Z + 5.5, w, d, 2.6, roof, rot, overhang=1.4)
    lp.pyatthat(cx, cy, Z + 7.6, min(w, d) * 0.7, tiers, roof, WALL, GOLD, rot)


# Halls: one facing each stairway head, plus a ring along the terrace edge.
for name, (ang, edge) in STAIRS.items():
    r = edge - 14
    hall(r * math.cos(ang), r * math.sin(ang), 18, 12, ang + math.pi / 2, tiers=5 if name == "south" else 4)
count = 0
for k in range(48):
    ang = 2 * math.pi * k / 48 + 0.03
    if any(abs(math.atan2(math.sin(ang - a), math.cos(ang - a))) < 0.16 for a, _ in STAIRS.values()):
        continue
    r = edge_along(ang) - 10
    if r < half + 22:
        continue
    count += 1
    hall(r * math.cos(ang), r * math.sin(ang), 9, 8, ang + math.pi / 2, tiers=3,
         roof=GOLD if count % 3 else ROOF_RED)

# Inner rings: small shrines and stupas crowd the terrace, as in the photos; the four walkways
# from the stairway heads to the stupa stay open.
k = 0
for ring_r in (half + 16, half + 30, half + 44):
    n = int(2 * math.pi * ring_r / 15)
    for i in range(n):
        ang = 2 * math.pi * (i + 0.5 * (ring_r % 2)) / n
        if any(abs(math.atan2(math.sin(ang - a), math.cos(ang - a))) < 0.2 for a, _ in STAIRS.values()):
            continue
        x, y = ring_r * math.cos(ang), ring_r * math.sin(ang)
        if edge_along(ang) - ring_r < 20:
            continue
        k += 1
        if k % 3 == 0:
            small_stupa(x, y, Z, 7 + (k % 4) * 2.0, GOLD if k % 2 else WALL)
        else:
            side = 5.5 + (k % 3) * 1.5
            lp.box(x, y, Z, side, side, 3.6, WALL, ang)
            lp.pyatthat(x, y, Z + 3.6, side * 0.95, 2 + k % 3, GOLD if k % 4 else ROOF_RED, WALL, GOLD, ang)

# ---------------------------------------------------------------- covered stairways and gates
for name, (ang, edge) in STAIRS.items():
    c, s = math.cos(ang), math.sin(ang)
    steps = 8
    seg = SLOPE / steps
    for i in range(steps):
        a0, a1 = edge + i * seg, edge + (i + 1) * seg
        z0 = HILL * (1 - (a1 - edge) / SLOPE)
        mid = (a0 + a1) / 2
        cx, cy = c * mid, s * mid
        zt = HILL * (1 - (mid - edge) / SLOPE)
        # Floor of this flight and its two side walls with arcades.
        lp.box(cx, cy, z0 - 0.6, seg + 0.4, STAIR_W, (HILL * seg / SLOPE) + 0.6, STEP, ang)
        for k in (-1, 1):
            lp.box(cx - s * k * STAIR_W / 2, cy + c * k * STAIR_W / 2, zt - 1.0, seg, 0.6, 5.2, WALL, ang)
        # Two-tier roof stepping down the hill, gilded every other bay.
        lp.hip_roof(cx, cy, zt + 4.2, seg * 0.98, STAIR_W, 2.2, GOLD if i % 2 else ROOF_RED, ang, overhang=1.0)
        lp.hip_roof(cx, cy, zt + 6.0, seg * 0.6, STAIR_W * 0.55, 1.6, GOLD, ang, overhang=0.6)
    # Gate at the foot: a tall tiered pavilion and two chinthe lions.
    g = edge + SLOPE + 6
    gx, gy = c * g, s * g
    lp.box(gx, gy, 0, 10, STAIR_W + 6, 8, WALL, ang)
    lp.hip_roof(gx, gy, 8, 10, STAIR_W + 6, 3, GOLD, ang, overhang=1.2)
    lp.pyatthat(gx, gy, 10.5, 8, 7 if name == "south" else 5, GOLD, WALL, GOLD, ang)
    for k in (-1, 1):
        lx = gx + c * 12 - s * k * (STAIR_W / 2 + 6)
        ly = gy + s * 12 + c * k * (STAIR_W / 2 + 6)
        size = 1.6 if name == "south" else 1.0
        lp.box(lx, ly, 0, 5 * size, 7 * size, 2.5 * size, WALL, ang)                     # pedestal
        # Seated chinthe: rounded haunches, upright chest, maned head with an open red mouth.
        lp.revolve([(0, 2.0 * size), (1.2 * size, 2.2 * size), (2.6 * size, 1.5 * size), (3.0 * size, 0.0)], 12, LION,
                   lx - c * 1.2 * size, ly - s * 1.2 * size, 2.5 * size)
        lp.revolve([(0, 1.4 * size), (2.5 * size, 1.3 * size), (4.2 * size, 1.0 * size), (4.6 * size, 0.0)], 12, LION,
                   lx + c * 0.8 * size, ly + s * 0.8 * size, 2.5 * size)
        hx, hy = lx + c * 1.4 * size, ly + s * 1.4 * size
        lp.revolve([(0, 0.4 * size), (0.6 * size, 1.9 * size), (2.0 * size, 2.0 * size), (3.0 * size, 1.2 * size), (3.4 * size, 0.0)],
                   12, LION, hx, hy, 6.4 * size)
        lp.box(hx + c * 1.8 * size, hy + s * 1.8 * size, 7.4 * size, 0.5 * size, 1.6 * size, 0.9 * size, ROOF_RED, ang)  # mouth

opts = lp.args()
far = 520
lp.finish(opts, keep_smooth=True, view_span=560, views=[
    ("aerial", (-far * 0.6, -far * 0.85, far * 0.62), (0, 0, 60), 35),
    ("south", (30, -360, 70), (0, 0, 80), 40),
])
