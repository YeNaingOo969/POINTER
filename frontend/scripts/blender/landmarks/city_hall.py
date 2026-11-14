"""Yangon City Hall, low-poly. Real (Wikipedia + photos): 1936, three storeys, syncretic Burmese
style; today a white facade with pale green-grey roofs (2016-2019 photos), a tall central pyatthat over the main entrance
and smaller pyatthats on the corners and wings. Footprint = OSM relation 5677100 (local metres
around its centroid, +Y north): chamfered SW corner facing Sule, entrance bay on the south side.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lowpoly as lp  # noqa: E402

WHITE = "#ECEFF1"      # today's facade (photos 2016-2019, assets/raw/reference/landmarks/city_hall-*)
TRIM = "#F8F9FA"
STONE = "#C9CCC8"
WINDOW = "#3A4651"
ROOF = "#B7C9B1"       # pale green-grey hipped roofs
TIER = "#DADFE0"       # the pyatthat tiers are white too
GOLD = "#E3A73A"       # finials only

FOOTPRINT = [(-61.9, -21.2), (-44.1, -37.9), (-12.8, -38.8), (-12.9, -41), (-11, -41.1), (-11.1, -45.3),
             (18.4, -46.1), (18.5, -41.7), (20.2, -41.7), (20.3, -40.1), (49.7, -41), (56.9, -34.3),
             (58.7, 37.8), (-54.6, 41.1), (-60, 41.2), (-60.1, 36.8)]
WALL_TOP = 16.0


def scaled(points, k):
    return [(x * k, y * k) for x, y in points]


lp.reset()

lp.footprint_prism(FOOTPRINT, 0, 1.2, lp.mat(STONE))
lp.footprint_prism(FOOTPRINT, 1.2, WALL_TOP, lp.mat(WHITE))
for z in (5.6, 10.6):  # moulded string courses between storeys
    lp.footprint_prism(scaled(FOOTPRINT, 1.006), z, z + 0.5, lp.mat(TRIM))
lp.footprint_prism(scaled(FOOTPRINT, 1.012), WALL_TOP, WALL_TOP + 1.1, lp.mat(TRIM))
# Three storeys of windows all round; the ground floor has round-headed arches.
lp.windows(FOOTPRINT, [2.2], 4.2, 1.8, 2.6, lp.mat(WINDOW), arch=lp.mat(WINDOW))
lp.windows(FOOTPRINT, [7.0, 12.0], 4.2, 1.7, 2.4, lp.mat(WINDOW))

# Entrance bay on the south front: three tall arches under the main tower.
for dx in (-6, 0, 6):
    lp.box(3.6 + dx, -46.3, 1.2, 4.2, 0.5, 8.5, lp.mat(WINDOW))
    lp.prism(12, 2.1, 2.1, 9.7, 9.9, lp.mat(WINDOW), 3.6 + dx, -46.3)
lp.box(3.6, -46.6, WALL_TOP - 3.5, 20, 0.4, 2.2, lp.mat(TRIM))

roof_z = WALL_TOP + 1.1
lp.hip_roof(-1.5, -31.5, roof_z, 112, 17, 4.0, lp.mat(ROOF), overhang=0.6)                 # south
lp.hip_roof(2.0, 32.0, roof_z, 110, 17, 4.0, lp.mat(ROOF), overhang=0.6)                   # north
lp.hip_roof(-51.5, 4.0, roof_z, 52, 17, 4.0, lp.mat(ROOF), rot=1.5708, overhang=0.6)       # west
lp.hip_roof(49.5, 1.5, roof_z, 60, 17, 4.0, lp.mat(ROOF), rot=1.5708, overhang=0.6)        # east
lp.footprint_prism(scaled(FOOTPRINT, 0.66), WALL_TOP, WALL_TOP + 0.4, lp.mat(STONE))       # courtyard

top = WALL_TOP + 1.1
towers = [
    # (x, y, width, tiers): main tower over the south entrance bay, then corners and wings.
    (3.6, -43.0, 18, 5),
    (-40.0, -37.0, 7, 3), (46.0, -38.0, 7, 3),
    (-53.0, -29.5, 9, 3),
    (55.0, -34.0, 7, 3), (57.5, 36.0, 7, 3), (-57.5, 38.5, 7, 3),
    (-60.5, 8.0, 8, 3), (57.8, 2.0, 8, 3), (0.0, 39.5, 8, 3),
]
for x, y, w, tiers in towers:
    lp.box(x, y, top, w * 0.8, w * 0.8, 3.0 if w > 10 else 2.2, lp.mat(WHITE))
    lp.windows([(x - w * 0.4, y - w * 0.4), (x + w * 0.4, y - w * 0.4), (x + w * 0.4, y + w * 0.4), (x - w * 0.4, y + w * 0.4)],
               [top + 0.6], 2.4, 0.9, 1.4, lp.mat(WINDOW), margin=0.8)
    lp.pyatthat(x, y, top + (3.0 if w > 10 else 2.2), w, tiers, lp.mat(TIER), lp.mat(WHITE), lp.mat(GOLD), spire=0.4)

lp.finish(lp.args(), camera_height_ratio=0.55, views=[("south", (10, -150, 25), (0, 0, 14), 35)])
