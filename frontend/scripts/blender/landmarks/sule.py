"""Sule Pagoda, low-poly. Real: octagonal Mon-style chedi, 44.13 m, sides 7.3 m (Wikipedia),
on an octagonal base ringed with shops and four entrance halls, in the middle of a roundabout.
Built facing north (+Y); rotate on the map to match the street grid.
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lowpoly as lp  # noqa: E402

GOLD = "#E3A73A"
WHITE = "#F4EEE2"
ROOF = "#D9826B"
FLOOR = "#F6EEDD"
BAND = "#C9A27A"

HEIGHT = 44.13
BASE_R = 18.5  # octagonal base with shops
BASE_H = 5.6

lp.reset()

# Base: shop ring (white walls, terracotta eave), platform on top.
lp.prism(8, BASE_R, BASE_R, 0, 0.6, lp.mat(BAND))
lp.prism(8, BASE_R - 0.3, BASE_R - 0.3, 0.6, 4.2, lp.mat(WHITE))
lp.prism(8, BASE_R + 0.8, BASE_R - 1.6, 4.2, 5.4, lp.mat(ROOF))
lp.prism(8, BASE_R - 1.6, BASE_R - 1.6, 5.4, BASE_H, lp.mat(FLOOR))

# Four entrance halls with three-tier roofs, on the street axes.
for k in range(4):
    a = k * math.pi / 2
    x, y = math.sin(a) * (BASE_R + 1.5), math.cos(a) * (BASE_R + 1.5)
    lp.box(x, y, 0, 7, 6, 4.6, lp.mat(WHITE), rot=-a)
    lp.box(x, y, 0, 3, 6.2, 3.2, lp.mat(BAND), rot=-a)  # doorway
    lp.pyatthat(x, y, 4.6, 7.5, 3, lp.mat(ROOF), lp.mat(WHITE), lp.mat(GOLD), rot=-a)

# Chedi profile (z, radius) above the platform; scaled so the top is at HEIGHT.
s = (HEIGHT - BASE_H) / 44.13
terraces = [(0, 13.5, 2.2), (2.2, 12.2, 2.0), (4.2, 11.0, 1.8), (6.0, 10.0, 1.5)]
for z, r, h in terraces:
    lp.prism(8, r * s, r * s, BASE_H + z * s, BASE_H + (z + h) * s, lp.mat(GOLD))

octagonal_bell = [(7.5, 9.54), (9, 9.4), (11, 8.8), (13, 7.8), (15, 6.4), (16.5, 5.2)]
round_top = [
    (16.5, 4.8), (17.3, 4.8), (17.3, 4.3), (18.1, 4.3), (18.1, 3.8), (18.9, 3.8),
    (18.9, 3.3), (19.7, 3.3),                                   # rings
    (19.7, 3.0), (21, 3.4), (22.2, 3.0),                         # inverted bowl
    (22.2, 2.6), (23.5, 2.9), (24.5, 2.4),                       # lotus petals
    (24.5, 2.3), (26.5, 2.2), (29, 1.7), (31.5, 1.0), (33.5, 0.45),  # banana bud
    (33.5, 1.5), (38.5, 0.25),                                   # hti (umbrella)
    (38.5, 0.18), (41, 0.12), (41, 0.4), (41.6, 0.4), (41.6, 0.2), (44.13, 0),  # vane, orb, tip
]
scale = lambda prof: [(BASE_H + z * s, r * s) for z, r in prof]
lp.lathe(scale(octagonal_bell), 8, lp.mat(GOLD))
lp.lathe(scale(round_top), 16, lp.mat(GOLD))

lp.finish(lp.args())
