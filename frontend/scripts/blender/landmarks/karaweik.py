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
GREEN = "#6FA77F"
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
    # Stern curling up like a tail: red body with a gold edge.
    tail = [(33, y, 3.5), (38, y, 5.5), (41.5, y, 9.5), (43.5, y, 14.5), (44, y, 19.5), (43, y, 23)]
    chain(tail, 3.6, lp.mat(RED))
    chain([(x + 0.4, y, z + 1.6) for x, y, z in tail], 1.4, lp.mat(GOLD))
    # Karaweik bird at the bow: big chest, S-curved neck, head, beak, crest.
    lp.box(-30, y, 0, 11, 9.5, 8.5, lp.mat(GOLD))
    lp.hip_roof(-30, y, 8.5, 11, 9.5, 2.5, lp.mat(GOLD), overhang=0)
    chain([(-31, y, 8), (-33.5, y, 12.5), (-33.2, y, 16.5), (-35, y, 19.5)], 3.6, lp.mat(GOLD))
    lp.box(-37, y, 18, 6, 4.4, 4.6, lp.mat(GOLD))
    lp.beam((-39.5, y, 20.6), (-43.5, y, 19.8), 1.5, lp.mat(CREAM))
    lp.prism(4, 1.5, 0, 22.6, 26, lp.mat(GOLD), x=-36.5, y=y)

# Deck across both hulls, then the two-storey hall with green tiered roofs.
lp.box(2, 0, 4.8, 60, 38, 1.4, lp.mat(GOLD))
lp.box(4, 0, 6.2, 40, 28, 5.0, lp.mat(CREAM))
lp.hip_roof(4, 0, 11.2, 40, 28, 3.2, lp.mat(GREEN), overhang=2.2)
lp.box(4, 0, 14.0, 30, 20, 3.4, lp.mat(CREAM))
lp.hip_roof(4, 0, 17.4, 30, 20, 2.8, lp.mat(GREEN), overhang=1.8)
for x, y in ((-12, -10), (-12, 10), (20, -10), (20, 10)):  # corner pavilions
    lp.pyatthat(x, y, 14.2, 6, 3, lp.mat(GREEN), lp.mat(GOLD), lp.mat(GOLD), tier_h=1.9)
lp.pyatthat(4, 0, 20.0, 12, 7, lp.mat(GREEN), lp.mat(GOLD), lp.mat(GOLD), tier_h=2.4)

lp.finish(lp.args(), camera_height_ratio=0.45)
