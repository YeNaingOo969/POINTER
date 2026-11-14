"""Karaweik, Kandawgyi Lake, low-poly. Real (Wikipedia + photos): concrete replica of a royal
barge, 82 × 39 m, two storeys, seven-tier pyatthat; twin golden karaweik birds side by side at
the bow, red-and-gold twin hulls, stern rising like a tail, green tiered roofs.
Built along +X (bow at -X); the map turns it to the OSM footprint (way 117381678, ~10° clockwise).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lowpoly as lp  # noqa: E402

GOLD = "#E3A73A"
GREEN = "#D69A36"  # tier roofs: gilded (photos karaweik-3/4)
RED = "#B9483E"
CREAM = "#F2DFA6"

HULL_Y = (-13.0, 13.0)
HULL_W = 11.0

lp.reset()

def chain(points, size, material):
    """Bars joining consecutive points: a cheap curved shape (neck, tail)."""
    for a, b in zip(points, points[1:]):
        lp.beam(a, b, size, material)


for y in HULL_Y:
    # Hull: red below, gold band above.
    lp.box(3, y, 0, 64, HULL_W, 3.2, lp.mat(RED))
    lp.box(3, y, 3.2, 64, HULL_W, 1.6, lp.mat(GOLD))
    # Stern curling up and forward like a tail feather: red with a gold edge (photos karaweik-3/4).
    tail = [(31, y, 3.5), (37, y, 5.5), (41, y, 9.5), (43.5, y, 15), (43.6, y, 20), (41.5, y, 23.5)]
    lp.tube(tail, [2.6, 2.4, 2.1, 1.7, 1.2, 0.5], lp.mat(RED), sides=10)
    lp.tube([(x + 0.6, yy, z + 1.4) for x, yy, z in tail], [0.9, 0.9, 0.8, 0.7, 0.5, 0.2], lp.mat(GOLD), sides=8)
    # Karaweik bird at the bow: full chest, S-curved neck, head with crest and an open beak.
    lp.tube([(-24, y, 3.5), (-28, y, 5.5), (-32, y, 6.5), (-35, y, 5.5)], [4.6, 5.2, 4.6, 2.5], lp.mat(GOLD), sides=14)
    neck = [(-32, y, 8), (-34, y, 12), (-33, y, 16), (-34.5, y, 19.5), (-37, y, 21)]
    lp.tube(neck, [3.0, 2.3, 2.0, 1.9, 1.9], lp.mat(GOLD), sides=12)
    lp.tube([(-36, y, 21.2), (-38.5, y, 21.6), (-40.5, y, 21.0)], [2.0, 1.6, 1.0], lp.mat(GOLD), sides=12)   # head
    lp.tube([(-40, y, 21.3), (-43, y, 21.0), (-45, y, 20.2)], [0.75, 0.45, 0.05], lp.mat(CREAM), sides=8)  # upper beak
    lp.tube([(-40, y, 20.4), (-42.5, y, 19.8), (-44, y, 19.2)], [0.5, 0.3, 0.05], lp.mat(RED), sides=8)    # lower beak
    lp.tube([(-36.5, y, 22.5), (-35.5, y, 25.5), (-33, y, 27.5), (-30.5, y, 27.8)], [0.9, 0.7, 0.45, 0.1], lp.mat(GOLD), sides=8)  # crest
    for k in (-1, 1):  # wing fins along the chest
        lp.tube([(-26, y + k * 4.6, 6), (-30, y + k * 5.4, 9), (-34, y + k * 4.8, 11)], [0.8, 0.6, 0.2], lp.mat(RED), sides=6)

# Deck across both hulls, then the two-storey hall with green tiered roofs.
lp.box(2, 0, 4.8, 60, 38, 1.4, lp.mat(GOLD))
lp.box(4, 0, 6.2, 40, 28, 5.0, lp.mat(CREAM))
lp.hip_roof(4, 0, 11.2, 40, 28, 3.2, lp.mat(GREEN), overhang=2.2)
lp.box(4, 0, 14.0, 30, 20, 3.4, lp.mat(CREAM))
lp.hip_roof(4, 0, 17.4, 30, 20, 2.8, lp.mat(GREEN), overhang=1.8)
for x, y in ((-12, -10), (-12, 10), (20, -10), (20, 10)):  # corner pavilions
    lp.pyatthat(x, y, 14.2, 6, 3, lp.mat(GREEN), lp.mat(GOLD), lp.mat(GOLD), tier_h=1.9)
lp.pyatthat(4, 0, 20.0, 12, 7, lp.mat(GREEN), lp.mat(GOLD), lp.mat(GOLD), tier_h=2.4)

lp.finish(lp.args(), camera_height_ratio=0.45, views=[("lake", (0, -110, 12), (0, 0, 12), 40)])
