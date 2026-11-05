"""Bogyoke Aung San Market, low-poly. Real (photos): 1926 colonial market; two-storey cream
blocks with red arches and terracotta tiled hipped roofs, cobbled lanes between long rows, and
a clock tower with a white dome over the main entrance on Bogyoke Aung San Road (south side).
Block = OSM way 23395611 (~190 × 190 m, local metres around its centroid, +Y north).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lowpoly as lp  # noqa: E402

CREAM = "#F2EBDA"
ARCH = "#C55A4A"
ROOF = "#D4845F"
DOME = "#F7F5F0"

H = 10.5  # two tall colonial storeys


def block(cx, cy, sx, sy):
    """One market row: cream walls, red arch band at street level, terracotta hipped roof."""
    lp.box(cx, cy, 0, sx, sy, H, lp.mat(CREAM))
    lp.box(cx, cy, 2.6, sx + 0.3, sy + 0.3, 1.0, lp.mat(ARCH))
    lp.box(cx, cy, 6.8, sx + 0.3, sy + 0.3, 0.6, lp.mat(ARCH))
    rot = 0.0 if sx >= sy else 1.5708
    lx, ly = (sx, sy) if sx >= sy else (sy, sx)
    lp.hip_roof(cx, cy, H, lx, ly, 4.2, lp.mat(ROOF), rot=rot, overhang=1.2)


lp.reset()

# Perimeter rows on all four streets, then long inner rows with lanes between them.
block(-2, -84, 182, 20)   # south, main front
block(2, 86, 182, 20)
block(-84, 1, 20, 150)
block(86, 1, 20, 150)
for x in (-42, 0, 42):
    block(x, 1, 16, 132)

# Clock tower over the main entrance: square tower, red bands, clock faces, white dome.
tx, ty = 0, -95
lp.box(tx, ty, 0, 13, 13, 21, lp.mat(CREAM))
for z in (10.5, 17.5):
    lp.box(tx, ty, z, 13.4, 13.4, 0.8, lp.mat(ARCH))
lp.box(tx, ty - 6.7, 14, 3.2, 0.4, 3.2, lp.mat("#F7F2E6"))  # clock face
lp.prism(12, 6.2, 6.2, 21, 23, lp.mat(CREAM), tx, ty)
lp.prism(12, 6.4, 6.4, 23, 23.8, lp.mat(ARCH), tx, ty)
lp.dome(tx, ty, 23.8, 6.0, lp.mat(DOME))
lp.prism(6, 0.3, 0.1, 29.8, 33, lp.mat(ARCH), tx, ty)
lp.gable(tx, ty - 7.2, 10.5, 12, 1.5, 3.2, lp.mat(ROOF))  # entrance gable

lp.finish(lp.args(), camera_height_ratio=0.6)
