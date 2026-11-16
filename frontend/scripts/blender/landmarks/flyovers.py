"""Every road flyover and bridge in Yangon as one model, from OpenStreetMap
(assets/raw/osm/road-bridges-overpass.json: ways with bridge=* on main roads, Overpass API).

Ways that share an end are joined into chains, so a flyover made of several OSM ways rises once
at its first ramp and comes down at its last. Each chain gets a concrete box deck with an asphalt
top and parapets, round piers every ~40 m, ramps at both ends (flyovers ~7.5 m high, long river
bridges ~10 m). The Yangon–Dala and the first Thanlyin bridge have their own detailed models and
are left out here.

Origin = START_VIEW centre in src/map/config.js (96.1555, 16.7845) at street level. North = +Y.
"""

import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lowpoly as lp  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
ORIGIN = (96.1555, 16.7845)
SKIP = ("ဒလ", "Dala", "သံလျှင် တံတား")  # own models: dala_bridge.py, thanlyin_bridge.py
WIDTH = {"motorway": 11, "trunk": 11, "primary": 10, "secondary": 8.5, "tertiary": 7.5}
STEP = 25.0       # deck segment length
PIER_EVERY = 40.0

lp.reset()
CONCRETE = lp.mat("#E2DCD1", 0.85)   # light concrete, close to the map's pastel roads
ASPHALT = lp.mat("#9A958E", 0.9)
PARAPET = lp.mat("#F6F3ED", 0.7)
PIER = lp.mat("#D6D0C5", 0.85)

kx = 111320 * math.cos(math.radians(ORIGIN[1]))
to_local = lambda lon, lat: ((lon - ORIGIN[0]) * kx, (lat - ORIGIN[1]) * 110574)

ways = []
for w in json.loads((ROOT / "assets/raw/osm/road-bridges-overpass.json").read_text(encoding="utf8"))["elements"]:
    tags = w.get("tags", {})
    name = tags.get("name", "") + " " + tags.get("name:en", "")
    if any(s in name for s in SKIP):
        continue
    hw = tags["highway"].replace("_link", "")
    pts = [to_local(p["lon"], p["lat"]) for p in w["geometry"]]
    ways.append({"pts": pts, "width": WIDTH.get(hw, 7) * (0.75 if tags["highway"].endswith("_link") else 1.0)})

# Join ways end to end into chains (same rounded end point).
key = lambda p: (round(p[0], 1), round(p[1], 1))
chains = []
used = [False] * len(ways)
for i, w in enumerate(ways):
    if used[i]:
        continue
    used[i] = True
    pts, width = list(w["pts"]), w["width"]
    grown = True
    while grown:
        grown = False
        for j, o in enumerate(ways):
            if used[j]:
                continue
            op = o["pts"]
            if key(op[0]) == key(pts[-1]):
                pts += op[1:]
            elif key(op[-1]) == key(pts[-1]):
                pts += list(reversed(op))[1:]
            elif key(op[-1]) == key(pts[0]):
                pts = op[:-1] + pts
            elif key(op[0]) == key(pts[0]):
                pts = list(reversed(op))[:-1] + pts
            else:
                continue
            used[j] = grown = True
    chains.append((pts, width))


def resample(pts, step):
    """Points every `step` metres along a polyline (keeps the ends), with their distance."""
    out = [(pts[0][0], pts[0][1], 0.0)]
    dist = 0.0
    carry = 0.0
    for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
        seg = math.hypot(x2 - x1, y2 - y1)
        t = step - carry
        while t < seg:
            out.append((x1 + (x2 - x1) * t / seg, y1 + (y2 - y1) * t / seg, dist + t))
            t += step
        carry = seg - (t - step)
        dist += seg
    out.append((pts[-1][0], pts[-1][1], dist))
    return out, dist


total = 0.0
for pts, width in chains:
    line, length = resample(pts, STEP)
    if length < 30:
        continue
    total += length
    river = length > 1200
    top, ramp = (10.0, 160.0) if river else (7.5, min(90.0, length / 3))
    height = lambda s: max(0.6, top * min(1.0, s / ramp, (length - s) / ramp))
    path = [(x, y, height(s)) for x, y, s in line]
    # Layers are ≥ 0.3 m apart: the model is quantized for the web (≈ 0.4 m steps over the city's
    # 6 km), and thinner gaps flickered into stripes.
    lp.ribbon(path, width, 1.0, CONCRETE)
    lp.ribbon([(x, y, z + 0.35) for x, y, z in path], width - 1.2, 0.4, ASPHALT)
    # Parapets on both edges.
    for k in (-1, 1):
        edge = []
        for i, (x, y, z) in enumerate(path):
            a = path[max(i - 1, 0)]
            b = path[min(i + 1, len(path) - 1)]
            dx, dy = b[0] - a[0], b[1] - a[1]
            n = math.hypot(dx, dy) or 1.0
            edge.append((x - dy / n * k * (width / 2 - 0.25), y + dx / n * k * (width / 2 - 0.25), z + 1.2))
        lp.ribbon(edge, 0.5, 1.2, PARAPET)
    # Piers under the raised part.
    s = PIER_EVERY / 2
    while s < length:
        z = height(s)
        if z > 3.0:
            i = min(range(len(line)), key=lambda k: abs(line[k][2] - s))
            x, y, _ = line[i]
            # T-shaped pier: a round column and a cap under the deck
            lp.prism(8, 0.85, 0.85, 0, z - 1.8, PIER, x, y)
            a = line[max(i - 1, 0)]
            b = line[min(i + 1, len(line) - 1)]
            lp.box(x, y, z - 1.8, width * 0.8, 1.6, 0.8, PIER, math.atan2(b[1] - a[1], b[0] - a[0]) + math.pi / 2)
        s += PIER_EVERY

print(f"chains: {len(chains)}  deck length: {total / 1000:.1f} km")
lp.finish(lp.args(), camera_height_ratio=0.5, view_span=6000)
