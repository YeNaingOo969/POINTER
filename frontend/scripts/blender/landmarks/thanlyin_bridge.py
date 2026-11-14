"""Thanlyin Bridge over the Bago River (1993). Real (Wikipedia mirrors, OSM way 24940017):
about 2 km long, two traffic lanes, a rail track and two footpaths; steel truss spans over the
main channel on concrete piers, lower concrete approach spans at both ends.

Origin = middle of the OSM centre line at water level (z 0). North = +Y. 1 unit = 1 metre.
"""

import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lowpoly as lp  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
data = json.loads((ROOT / "assets/raw/osm/thanlyin-bridge-nominatim.json").read_text(encoding="utf8"))
(lng0, lat0), (lng1, lat1) = next(e for e in data if e["geojson"]["type"] == "LineString")["geojson"]["coordinates"]
mid_lng, mid_lat = (lng0 + lng1) / 2, (lat0 + lat1) / 2
kx = 111320 * math.cos(math.radians(mid_lat))
ax, ay = (lng0 - mid_lng) * kx, (lat0 - mid_lat) * 110574
bx, by = (lng1 - mid_lng) * kx, (lat1 - mid_lat) * 110574
LENGTH = math.hypot(bx - ax, by - ay)
ANGLE = math.atan2(by - ay, bx - ax)
print(f"centre {mid_lng:.6f}, {mid_lat:.6f}  length {LENGTH:.0f} m")

lp.reset()  # before any material

STEEL = lp.mat("#9AA4AD", 0.5)
STEEL_DARK = lp.mat("#6E7881", 0.5)
CONCRETE = lp.mat("#C9C4BA", 0.85)
ROAD = lp.mat("#5E5B57", 0.9)
RAIL = lp.mat("#7A6A5A", 0.9)
WHITE = lp.mat("#F2EFE8", 0.7)

DECK = 12.0           # deck height over the main channel
WIDTH = 16.0
TRUSS = 0.6           # central share of the length carried by steel trusses
PANEL = 16.0          # truss panel length
TRUSS_H = 11.0
PIER_EVERY = 64.0


def at(s):
    """Point on the centre line at distance s from the middle (negative = towards the north end)."""
    return s * math.cos(ANGLE), s * math.sin(ANGLE)


def deck_z(s):
    """Flat over the river, ramping down to the banks at both ends."""
    half = LENGTH / 2
    ramp = half * 0.18
    d = half - abs(s)
    return 3.0 + (DECK - 3.0) * min(1.0, d / ramp)


# Deck: a ribbon along the line, with a rail track and two footpaths on top.
path = [(*at(s), deck_z(s)) for s in [-LENGTH / 2 + i * LENGTH / 80 for i in range(81)]]
lp.ribbon(path, WIDTH, 1.6, CONCRETE)
lp.ribbon([(x, y, z + 0.1) for x, y, z in path], WIDTH * 0.5, 0.12, ROAD)
nx, ny = -math.sin(ANGLE), math.cos(ANGLE)
lp.ribbon([(x + nx * 5.4, y + ny * 5.4, z + 0.1) for x, y, z in path], 2.4, 0.12, RAIL)
for k in (-1, 1):  # parapets
    lp.ribbon([(x + nx * k * WIDTH / 2, y + ny * k * WIDTH / 2, z + 1.1) for x, y, z in path], 0.3, 1.0, WHITE)

# Piers: round twin columns with a cap beam.
s = -LENGTH / 2 + PIER_EVERY / 2
while s < LENGTH / 2:
    x, y = at(s)
    z = deck_z(s) - 1.6
    for k in (-1, 1):
        lp.prism(10, 1.4, 1.2, -4, z, CONCRETE, x + nx * k * 4.5, y + ny * k * 4.5)
    lp.box(x, y, z - 1.4, 3.0, WIDTH + 1.5, 1.4, CONCRETE, ANGLE)
    s += PIER_EVERY

# Steel through-truss over the main channel: top chords, verticals and diagonals each side,
# cross bracing on top.
t0, t1 = -LENGTH * TRUSS / 2, LENGTH * TRUSS / 2
n = int((t1 - t0) / PANEL)
for k in (-1, 1):
    ox, oy = nx * k * (WIDTH / 2 + 0.3), ny * k * (WIDTH / 2 + 0.3)
    top = []
    for i in range(n + 1):
        sx, sy = at(t0 + i * PANEL)
        base = (sx + ox, sy + oy, DECK + 0.2)
        up = (sx + ox, sy + oy, DECK + TRUSS_H)
        top.append(up)
        lp.beam(base, up, 0.55, STEEL)
        if i < n:
            nx2, ny2 = at(t0 + (i + 1) * PANEL)
            nb = (nx2 + ox, ny2 + oy, DECK + 0.2)
            nu = (nx2 + ox, ny2 + oy, DECK + TRUSS_H)
            lp.beam(base, nb, 0.7, STEEL_DARK)                    # bottom chord
            lp.beam(up, nu, 0.7, STEEL_DARK)                      # top chord
            lp.beam(up if i % 2 else base, nb if i % 2 else nu, 0.45, STEEL)  # diagonal (warren)
for i in range(0, n + 1, 2):
    sx, sy = at(t0 + i * PANEL)
    lp.beam((sx + nx * WIDTH / 2, sy + ny * WIDTH / 2, DECK + TRUSS_H), (sx - nx * WIDTH / 2, sy - ny * WIDTH / 2, DECK + TRUSS_H), 0.4, STEEL)

lp.finish(lp.args(), camera_height_ratio=0.25, view_span=700, views=[
    ("river", (at(0)[0] + 350 * nx, at(0)[1] + 350 * ny, 40), (0, 0, 10), 35),
])
