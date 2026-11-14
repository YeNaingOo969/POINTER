"""Botataung Pagoda on the Yangon River front. Real (photos botataung-2/6, Wikipedia): a gilded
bell-shaped stupa about 40 m tall on a stepped octagonal base, hollow inside (relic halls), on a
walled riverside platform with white shrines and gold-roofed halls; small stupas at the corners.

Origin = centre of the stupa at street level. North = +Y. 1 unit = 1 metre.
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lowpoly as lp  # noqa: E402

lp.reset()

GOLD = lp.mat("#E2AA3C", 0.3)
GOLD_DARK = lp.mat("#C08B2C", 0.45)
WHITE = lp.mat("#F3EFE7", 0.7)
FLOOR = lp.mat("#E8E1D4", 0.7)
ROOF_RED = lp.mat("#A8432E", 0.6)
DARK = lp.mat("#4B3E35", 0.8)

# Walled platform with a gate on the river (south) side.
lp.box(0, 0, 0, 74, 74, 1.4, FLOOR)
for x, y, sx, sy in ((0, -37, 74, 1.0), (0, 37, 74, 1.0), (-37, 0, 1.0, 74), (37, 0, 1.0, 74)):
    lp.box(x, y, 1.4, sx, sy, 2.2, WHITE)
lp.box(0, -37.4, 1.4, 10, 2.5, 6, WHITE)
lp.pyatthat(0, -37.4, 7.4, 8, 5, GOLD, WHITE, GOLD, spire=0.5)

# Stepped octagonal base: white with gilded mouldings, doorways into the hollow relic halls.
for r, z0, z1, m in ((15.5, 1.4, 4.4, WHITE), (14.0, 4.4, 6.8, WHITE), (12.6, 6.8, 8.8, GOLD_DARK), (11.4, 8.8, 10.6, GOLD_DARK)):
    lp.prism(8, r, r, z0, z1, m)
    lp.prism(8, r + 0.4, r + 0.4, z1 - 0.3, z1, GOLD)
for a in range(4):
    ang = a * math.pi / 2 - math.pi / 2
    lp.box(15.6 * math.cos(ang), 15.6 * math.sin(ang), 1.4, 3.2, 0.4, 2.8, DARK, ang + math.pi / 2)

# Bell, bands, lotus, banana bud and hti (about 40 m in all).
z0 = 10.6
lp.revolve([(0, 10.8), (1.5, 11.0), (5, 10.0), (9, 8.0), (13, 6.0), (15, 5.2),
            (15, 5.6), (16, 5.6), (16, 5.0), (17, 5.0), (17, 5.3), (18, 5.3), (18, 4.6),
            (19.5, 4.8), (21, 4.0), (21, 3.5), (22, 3.9), (23, 3.0),
            (24, 2.7), (26, 2.3), (28, 1.7), (30, 1.1), (31.5, 0.7),
            (31.5, 1.6), (32, 1.45), (32, 1.1), (32.8, 1.25), (33.2, 0.9), (34, 1.0), (34.4, 0.6),
            (35.6, 0.25), (36.5, 0.0)], 48, GOLD, z=z0)

# Small stupas at the platform corners and halls with tiered roofs along the sides.
def small_stupa(x, y, h):
    s = h / 10
    lp.box(x, y, 1.4, 2.6 * s, 2.6 * s, 0.9 * s, GOLD_DARK)
    lp.revolve([(0, 1.25 * s), (2.2 * s, 1.0 * s), (3.4 * s, 0.6 * s), (5.6 * s, 0.32 * s), (9.1 * s, 0.0)],
               12, GOLD, x, y, 1.4 + 0.9 * s)


for x, y in ((-30, -30), (30, -30), (-30, 30), (30, 30)):
    small_stupa(x, y, 9)
for x, y, rot in ((-28, 0, math.pi / 2), (28, 0, math.pi / 2), (0, 28, 0)):
    lp.box(x, y, 1.4, 14, 7, 4.2, WHITE, rot)
    lp.hip_roof(x, y, 5.6, 14, 7, 2.2, ROOF_RED, rot, overhang=1.0)
    lp.pyatthat(x, y, 7.4, 5, 3, GOLD, WHITE, GOLD, rot, spire=0.6)

lp.finish(lp.args(), keep_smooth=True, views=[("river", (25, -110, 18), (0, 0, 16), 35)])
