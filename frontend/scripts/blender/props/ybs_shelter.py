"""YBS bus shelter, low-poly — the YCDC / FMIDecaux design at about 500 stops in Yangon (from photos,
2019): white steel frame on a concrete pad, a flat roof cantilevered from the back posts, a glass back
wall, a long white bench, an advert lightbox at one end and a sign box on the roof with the YBS name
and red route-number tiles. About 5 m long; the street side is -Y.

    blender --background --factory-startup --python scripts/blender/props/ybs_shelter.py -- \
        --out assets/work/props/ybs-shelter.glb --preview assets/work/props/ybs-shelter.png

The map (src/map/bus-shelters.js) draws one InstancedMesh of it at every stop, so keep it small:
each colour becomes a vertex colour there, and the whole shelter stays under ~200 triangles.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lowpoly as lp  # noqa: E402

CONCRETE = "#D9D5CC"
STEEL = "#C8CDD3"
ROOF = "#F1F3F4"
GLASS = "#B7D0DA"
BENCH = "#F4F4F1"
LIGHTBOX = "#E8EBEE"
ADVERT = "#4FA65E"      # backlit poster (no brand)
SIGN = "#F7F7F5"
SIGN_BAND = "#2D5FA8"   # YBS name band
ROUTE = "#D23A33"       # red route-number tiles

opts = lp.args()
lp.reset()

# pad and frame
lp.box(0, 0.1, 0, 5.4, 2.3, 0.1, lp.mat(CONCRETE))
for x in (-1.6, 2.2):
    lp.box(x, 0.78, 0.1, 0.12, 0.12, 2.45, lp.mat(STEEL))
lp.box(0.3, 0.78, 2.43, 5.0, 0.14, 0.14, lp.mat(STEEL))         # beam carrying the roof

# roof, cantilevered towards the street
lp.box(0.3, 0.05, 2.55, 5.2, 1.9, 0.08, lp.mat(ROOF))

# glass back wall and bench
lp.box(0.6, 0.76, 0.3, 3.4, 0.04, 1.85, lp.mat(GLASS))
lp.box(0.6, 0.42, 0.42, 2.8, 0.42, 0.06, lp.mat(BENCH))
lp.box(0.6, 0.6, 0.1, 2.6, 0.06, 0.32, lp.mat(STEEL))            # bench support rail

# advert lightbox at the west end: frame with a poster on both faces
lp.box(-2.25, 0.25, 0.1, 1.3, 0.3, 2.1, lp.mat(LIGHTBOX))
lp.box(-2.25, 0.095, 0.3, 1.08, 0.02, 1.7, lp.mat(ADVERT))
lp.box(-2.25, 0.405, 0.3, 1.08, 0.02, 1.7, lp.mat(ADVERT))

# sign box on the roof: YBS band and red route tiles on the street face
lp.box(-0.7, 0.55, 2.63, 1.5, 0.16, 0.44, lp.mat(SIGN))
lp.box(-1.15, 0.465, 2.7, 0.5, 0.02, 0.3, lp.mat(SIGN_BAND))
for i in range(4):
    lp.box(-0.68 + i * 0.2, 0.465, 2.74, 0.15, 0.02, 0.15, lp.mat(ROUTE))

lp.finish(opts, view_span=7, views=[("street", (4.5, -7.5, 2.2), (0, 0.2, 1.3), 35)])
