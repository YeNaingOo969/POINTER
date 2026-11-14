"""The Secretariat (Ministers' Building), low-poly. Real (photos): 1889–1905 Victorian complex;
red brick with cream bands, tall storeys, domed corner turrets and a taller central tower,
wings round a large green quadrangle.
Footprint = OSM way 264732913: a U of three wings open to the north (local metres, +Y north).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lowpoly as lp  # noqa: E402

BRICK = "#C8653F"   # photo secretariat-6: orange-red brick
CREAM = "#EBCB86"   # yellow stucco bands and window surrounds
WINDOW = "#3E3A3A"
ROOF = "#9A8F86"

FOOTPRINT = [
    (-73.4, -66.4), (-52.8, -67.3), (-52.6, -62.1), (-15.5, -63.7), (-15.8, -71.8), (12.7, -73), (13, -66),
    (50, -67.6), (49.8, -72.4), (71.7, -73.4), (73.1, -42), (67.7, -41.8), (69.3, -3.7), (76, -4), (76.6, 10.2),
    (77.2, 24.6), (70.6, 24.9), (72.2, 63), (77.9, 62.8), (79.1, 92.9), (48.9, 94.1), (47.7, 64), (53.5, 63.8),
    (51.9, 25.6), (45.6, 25.9), (44.9, 9.8), (44.4, -2.8), (50.4, -2.9), (48.7, -41), (43.8, -40.8),
    (43.6, -46.4), (13.9, -45.1), (14.3, -36.6), (-14.3, -35.4), (-14.6, -43.2), (-44.2, -41.9), (-44, -36.2),
    (-49.5, -35.9), (-47.9, 1.7), (-40.4, 1.4), (-39.8, 13.2), (-39.2, 29.6), (-45.6, 29.9), (-43.9, 69.3),
    (-37.1, 69.1), (-35.8, 99.7), (-67, 101), (-68.3, 70.4), (-63.2, 70.2), (-64.9, 30.7), (-71.2, 31),
    (-71.9, 15.2), (-72.4, 2.8), (-65.8, 2.5), (-67.4, -35.3), (-72.1, -35.1),
]
H = 17.0


def turret(x, y, r, top, dome_r):
    """Octagonal brick turret with a cream band and a dome."""
    lp.prism(8, r, r, 0, top, lp.mat(BRICK), x, y)
    for z in (5.5, 11.5, top - 1.2):
        lp.prism(8, r + 0.25, r + 0.25, z, z + 0.7, lp.mat(CREAM), x, y)
    lp.dome(x, y, top, dome_r, lp.mat(BRICK), sides=8, rings=3)
    lp.prism(6, 0.35, 0.1, top + dome_r, top + dome_r + 2.5, lp.mat(CREAM), x, y)


lp.reset()

lp.footprint_prism(FOOTPRINT, 0, H, lp.mat(BRICK))
for z in (5.5, 11.5):  # cream string courses between the storeys
    lp.footprint_prism([(x * 1.004, y * 1.004) for x, y in FOOTPRINT], z, z + 0.8, lp.mat(CREAM))
lp.footprint_prism([(x * 1.006, y * 1.006) for x, y in FOOTPRINT], H, H + 0.9, lp.mat(CREAM))
lp.footprint_prism(FOOTPRINT, H + 0.9, H + 2.2, lp.mat(ROOF))
# Tall arched windows on all three storeys (wings face both the streets and the quadrangle).
lp.windows(FOOTPRINT, [1.4, 6.8], 4.0, 1.6, 3.2, lp.mat(WINDOW), arch=lp.mat(CREAM))
lp.windows(FOOTPRINT, [12.6], 4.0, 1.5, 3.0, lp.mat(WINDOW))

# Domed turrets on the wing ends and corner bays, a taller tower in the middle of the south front.
for x, y in ((-70, -63), (69, -70), (-51, 98), (64, 90), (-67, 28), (73, 22), (-48, -38), (46, -44)):
    turret(x, y, 4.2, H + 5, 3.6)
turret(-1.5, -69, 6.0, H + 11, 5.2)

lp.finish(lp.args(), camera_height_ratio=0.6, views=[("south", (60, -190, 35), (0, -40, 10), 35)])
