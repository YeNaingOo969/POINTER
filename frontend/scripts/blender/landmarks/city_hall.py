"""Yangon City Hall, low-poly. Real (Wikipedia + photos): 1936, three storeys, syncretic Burmese
style; today a warm yellow facade with red roofs, a tall central pyatthat over the main entrance
and smaller pyatthats on the corners and wings. Footprint = OSM relation 5677100 (local metres
around its centroid, +Y north): chamfered SW corner facing Sule, entrance bay on the south side.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lowpoly as lp  # noqa: E402

YELLOW = "#EBC86E"
STONE = "#D8C8A2"
WINDOW = "#C29A5F"
CORNICE = "#F4E7C6"
ROOF = "#C85F4E"
GOLD = "#E3A73A"

FOOTPRINT = [(-61.9, -21.2), (-44.1, -37.9), (-12.8, -38.8), (-12.9, -41), (-11, -41.1), (-11.1, -45.3),
             (18.4, -46.1), (18.5, -41.7), (20.2, -41.7), (20.3, -40.1), (49.7, -41), (56.9, -34.3),
             (58.7, 37.8), (-54.6, 41.1), (-60, 41.2), (-60.1, 36.8)]
WALL_TOP = 16.0


def scaled(points, k):
    return [(x * k, y * k) for x, y in points]


lp.reset()

lp.footprint_prism(FOOTPRINT, 0, 1.2, lp.mat(STONE))
lp.footprint_prism(FOOTPRINT, 1.2, WALL_TOP, lp.mat(YELLOW))
for z in (3.6, 8.4, 12.8):  # window rows on each storey
    lp.footprint_prism(scaled(FOOTPRINT, 1.004), z, z + 1.6, lp.mat(WINDOW))
lp.footprint_prism(scaled(FOOTPRINT, 1.012), WALL_TOP, WALL_TOP + 0.9, lp.mat(CORNICE))
# Four wings with hipped red roofs round a courtyard (the courtyard shows as the flat top).
roof_z = WALL_TOP + 0.9
lp.hip_roof(-1.5, -31.5, roof_z, 112, 17, 5.5, lp.mat(ROOF), overhang=0.8)                 # south
lp.hip_roof(2.0, 32.0, roof_z, 110, 17, 5.5, lp.mat(ROOF), overhang=0.8)                   # north
lp.hip_roof(-51.5, 4.0, roof_z, 52, 17, 5.5, lp.mat(ROOF), rot=1.5708, overhang=0.8)       # west
lp.hip_roof(49.5, 1.5, roof_z, 60, 17, 5.5, lp.mat(ROOF), rot=1.5708, overhang=0.8)        # east
lp.footprint_prism(scaled(FOOTPRINT, 0.66), WALL_TOP, WALL_TOP + 0.4, lp.mat(STONE))       # courtyard

top = WALL_TOP + 0.9
towers = [
    # (x, y, width, tiers): main tower over the south entrance bay, then corners and wings.
    (3.6, -43.0, 18, 6),
    (-40.0, -37.0, 7, 3), (46.0, -38.0, 7, 3),          # ends of the south facade
    (-53.0, -29.5, 9, 3),                               # chamfered corner facing Sule
    (55.0, -34.0, 7, 3), (57.5, 36.0, 7, 3), (-57.5, 38.5, 7, 3),
    (-60.5, 8.0, 8, 3), (57.8, 2.0, 8, 3), (0.0, 39.5, 8, 3),  # middle of the other sides
]
for x, y, w, tiers in towers:
    lp.box(x, y, top, w * 0.8, w * 0.8, 2.5, lp.mat(YELLOW))
    lp.pyatthat(x, y, top + 2.5, w, tiers, lp.mat(GOLD), lp.mat(YELLOW), lp.mat(GOLD))

lp.finish(lp.args(), camera_height_ratio=0.55)
