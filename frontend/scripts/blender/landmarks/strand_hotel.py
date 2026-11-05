"""The Strand Hotel, low-poly. Real (photos): 1901 neoclassical hotel on Strand Road; three
storeys, white facade with pilasters, a central pediment ("STRAND HOTEL") and a ground-floor
colonnade with a balcony above, facing south to the road and river.
Footprint = OSM way 102682120 (~36 × 60 m, local metres around its centroid, +Y north).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lowpoly as lp  # noqa: E402

WHITE = "#F6F2E9"
TRIM = "#E4DCCB"
WINDOW = "#8FA7B5"
ROOF = "#D9D2C4"

FOOTPRINT = [(-19.7, -29.6), (16, -30.4), (17.3, 29.1), (7.4, 29.4), (-18.3, 30)]
H = 18.0
FRONT_Y = -30.2

lp.reset()

lp.footprint_prism(FOOTPRINT, 0, H, lp.mat(WHITE))
for z in (7.2, 12.2):  # upper-floor window rows
    lp.footprint_prism([(x * 1.008, y * 1.008) for x, y in FOOTPRINT], z, z + 2.4, lp.mat(WINDOW))
lp.footprint_prism([(x * 1.02, y * 1.02) for x, y in FOOTPRINT], H, H + 0.8, lp.mat(TRIM))   # cornice
lp.footprint_prism([(x * 0.95, y * 0.95) for x, y in FOOTPRINT], H + 0.8, H + 1.4, lp.mat(ROOF))

# Pilasters on the front, pediment over the middle bay.
for i in range(7):
    x = -16 + i * 5.3
    lp.box(x, FRONT_Y - 0.35, 5.6, 1.1, 0.7, H - 5.6, lp.mat(TRIM))
lp.gable(-1.5, FRONT_Y + 0.4, H + 0.8, 20, 2.0, 4.2, lp.mat(WHITE))

# Ground-floor colonnade with a balcony slab on top.
lp.box(-1.5, FRONT_Y - 2.4, 5.2, 34, 4.8, 0.7, lp.mat(TRIM))
for i in range(10):
    lp.prism(8, 0.5, 0.45, 0, 5.2, lp.mat(WHITE), -17.5 + i * 3.55, FRONT_Y - 4.3)

lp.finish(lp.args(), camera_height_ratio=0.5)
