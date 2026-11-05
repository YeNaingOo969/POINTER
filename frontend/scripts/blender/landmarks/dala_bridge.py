"""Dala Bridge (Myanmar–Korea Friendship Bridge), low-poly. Opened 6 Feb 2026.

Real (news + photos): steel cable-stayed main bridge 690 m with two white single-column
pylons and one central fan of cables; Yangon approach 601 m, Dala approach 577 m; four lanes;
~49 m (160 ft) navigation clearance. No published pylon height, so 140 m is estimated from
photos. The route follows the OSM bridge way (assets/raw/osm/dala-bridge-nominatim.json),
including its bends; the cable-stayed part sits on its long straight middle segment.
Origin = middle of that segment; +Y = north, +X = east (metres).
"""

import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lowpoly as lp  # noqa: E402
from mathutils import Vector  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
WAY = json.loads((ROOT / "assets/raw/osm/dala-bridge-nominatim.json").read_text(encoding="utf-8"))

DECK = "#ECE9E2"
ROAD = "#A39C94"
WHITE = "#F6F4EF"
PIER = "#E2DDD3"

MAIN_LEN = 690.0
SIDE_SPAN = 140.0              # pylon to end of the cable-stayed part
DECK_Z = 52.0                  # 49 m clearance + deck depth
PYLON_H = 140.0
DECK_W = 22.0                  # four lanes + barriers

# ---- Route in local metres ----
coords = WAY["geojson"]["coordinates"]
MAIN_SEG = (8, 9)  # the long straight segment over the river
lng0 = (coords[MAIN_SEG[0]][0] + coords[MAIN_SEG[1]][0]) / 2
lat0 = (coords[MAIN_SEG[0]][1] + coords[MAIN_SEG[1]][1]) / 2
kx, ky = 111320 * math.cos(math.radians(lat0)), 110574
pts = [Vector(((lng - lng0) * kx, (lat - lat0) * ky)) for lng, lat in coords]
print(f"origin lng {lng0:.6f} lat {lat0:.6f}")

dist = [0.0]
for a, b in zip(pts, pts[1:]):
    dist.append(dist[-1] + (b - a).length)
total = dist[-1]
mid = (dist[MAIN_SEG[0]] + dist[MAIN_SEG[1]]) / 2
main0, main1 = mid - MAIN_LEN / 2, mid + MAIN_LEN / 2


def point_at(d):
    for i in range(1, len(dist)):
        if d <= dist[i]:
            t = (d - dist[i - 1]) / (dist[i] - dist[i - 1])
            return pts[i - 1].lerp(pts[i], t)
    return pts[-1]


def height_at(d):
    """Ramps up from the streets to the main bridge, smoothed at both ends."""
    if main0 <= d <= main1:
        return DECK_Z
    t = d / main0 if d < main0 else (total - d) / (total - main1)
    return DECK_Z * (3 * t * t - 2 * t * t * t) + 0.5


lp.reset()

# Deck and road surface along the route (sampled every 25 m, plus the route's own bends).
samples = sorted(set([i * 25.0 for i in range(int(total // 25) + 1)] + dist + [main0, main1]))
path = [(*point_at(d), height_at(d)) for d in samples]
lp.ribbon(path, DECK_W, 3.0, lp.mat(DECK))
lp.ribbon([(x, y, z + 0.25) for x, y, z in path], DECK_W - 3, 0.3, lp.mat(ROAD))

# Approach piers every 40 m where the deck is high enough to need them.
d = 20.0
while d < total:
    if not (main0 < d < main1):
        z = height_at(d) - 3.0
        if z > 3:
            p = point_at(d)
            t = (point_at(d + 1) - point_at(d - 1)).normalized()
            lp.box(p.x, p.y, 0, 2.6, DECK_W * 0.55, z, lp.mat(PIER), rot=math.atan2(t.y, t.x))
    d += 40.0

# Main bridge: two pylons, end piers, one central fan of cables per side of each pylon.
axis = (point_at(main1) - point_at(main0)).normalized()
ang = math.atan2(axis.y, axis.x)
for end in (main0, main1):
    p = point_at(end)
    lp.box(p.x, p.y, 0, 5, DECK_W * 0.7, DECK_Z - 3, lp.mat(PIER), rot=ang)

for pd, span_out, span_in in ((main0 + SIDE_SPAN, SIDE_SPAN, MAIN_LEN / 2 - SIDE_SPAN),
                              (main1 - SIDE_SPAN, SIDE_SPAN, MAIN_LEN / 2 - SIDE_SPAN)):
    p = point_at(pd)
    lp.box(p.x, p.y, 0, 24, 16, 6, lp.mat(PIER), rot=ang)              # footing in the river
    lp.prism(4, 7.0, 3.2, 6, PYLON_H, lp.mat(WHITE), p.x, p.y, rot=ang)  # tapered column
    lp.prism(4, 3.2, 1.2, PYLON_H, PYLON_H + 6, lp.mat(WHITE), p.x, p.y, rot=ang)
    outward = -1 if pd < mid else 1
    for side, reach in ((outward, span_out - 8), (-outward, span_in - 8)):
        for k in range(14):
            f = (k + 1) / 14
            top = PYLON_H - 4 - k * 3.6
            q = point_at(pd + side * (14 + f * reach))
            lp.beam((p.x, p.y, top), (q.x, q.y, DECK_Z + 0.4), 0.7, lp.mat(WHITE))

lp.finish(lp.args(), camera_height_ratio=0.35, view_span=520)
