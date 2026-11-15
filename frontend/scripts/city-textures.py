"""Facade and roof textures for the generated city (Python 3 + Pillow).

    python scripts/city-textures.py

Writes 512 × 512 tiles to public/models/city/tex/. Each wall texture is one bay wide and one storey
high, so the Blender generator can repeat it along a wall (u = metres / bay width, v = metres / storey).
They are greyscale-ish on purpose: each building's own colour is a vertex colour multiplied on top.
Kinds: apartment (Yangon walk-up: window with grille, AC box, balcony slab), shop (ground floor with a
rolling shutter and a sign band), house (shuttered window), factory (corrugated steel with a high
window strip), roof_flat (stained concrete), roof_zinc (corrugated metal), glass (mall / hotel curtain
wall), parking (car park stalls and aisle).
"""

import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parents[1] / "public" / "models" / "city" / "tex"
OUT.mkdir(parents=True, exist_ok=True)
S = 512
rng = random.Random(7)


def noise(img, amount=10, blur=0.6):
    """Plaster grain so walls don't look like plastic."""
    px = img.load()
    for y in range(S):
        for x in range(S):
            n = rng.randint(-amount, amount)
            r, g, b = px[x, y][:3]
            px[x, y] = (max(0, min(255, r + n)), max(0, min(255, g + n)), max(0, min(255, b + n)))
    return img.filter(ImageFilter.GaussianBlur(blur))


def stains(d, top=True):
    """Monsoon streaks under the slab edge."""
    for _ in range(14):
        x = rng.randint(0, S)
        w = rng.randint(6, 26)
        h = rng.randint(40, 180)
        y0 = 40 if top else rng.randint(0, S - h)
        d.rectangle([x, y0, x + w, y0 + h], fill=(226, 226, 222))


def apartment():
    img = Image.new("RGB", (S, S), (238, 238, 234))
    d = ImageDraw.Draw(img)
    stains(d)
    d.rectangle([0, 0, S, 34], fill=(214, 214, 208))                 # slab edge / balcony lip
    d.rectangle([96, 120, 416, 420], fill=(58, 64, 70))              # window opening
    d.rectangle([110, 134, 402, 406], fill=(92, 112, 124))           # glass
    for x in range(110, 402, 26):                                     # security grille
        d.rectangle([x, 134, x + 5, 406], fill=(40, 42, 44))
    for y in range(160, 406, 70):
        d.rectangle([110, y, 402, y + 5], fill=(40, 42, 44))
    d.rectangle([300, 140, 396, 210], fill=(226, 226, 222))          # air conditioner box
    d.rectangle([306, 146, 390, 204], outline=(150, 150, 146), width=4)
    d.rectangle([60, 420, 452, 446], fill=(200, 200, 194))           # sill
    d.line([(120, 300), (400, 300)], fill=(180, 60, 60), width=6)    # laundry line with a red cloth
    d.rectangle([180, 300, 230, 360], fill=(176, 64, 58))
    return noise(img)


def shop():
    img = Image.new("RGB", (S, S), (230, 230, 226))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 60, S, 150], fill=(150, 64, 52))                 # sign band (no text)
    d.rectangle([0, 150, S, 170], fill=(90, 90, 92))                 # awning edge
    d.rectangle([40, 190, 472, S], fill=(70, 74, 78))                # opening
    for y in range(200, S, 18):                                       # rolling shutter half down
        if y < 330:
            d.rectangle([40, y, 472, y + 10], fill=(150, 154, 158))
    d.rectangle([60, 360, 200, S], fill=(176, 140, 90))              # goods on shelves
    d.rectangle([300, 380, 450, S], fill=(110, 140, 120))
    return noise(img, 8)


def house():
    img = Image.new("RGB", (S, S), (236, 234, 228))
    d = ImageDraw.Draw(img)
    stains(d)
    d.rectangle([150, 150, 362, 400], fill=(70, 60, 50))             # window
    d.rectangle([110, 150, 150, 400], fill=(120, 96, 70))            # wooden shutters
    d.rectangle([362, 150, 402, 400], fill=(120, 96, 70))
    for x in range(160, 362, 30):
        d.rectangle([x, 150, x + 5, 400], fill=(36, 34, 32))
    return noise(img)


def factory():
    img = Image.new("RGB", (S, S), (214, 218, 222))
    d = ImageDraw.Draw(img)
    for x in range(0, S, 32):                                         # corrugated ribs
        d.rectangle([x, 0, x + 10, S], fill=(184, 190, 196))
    d.rectangle([0, 40, S, 120], fill=(112, 128, 140))               # high window strip
    for x in range(0, S, 64):
        d.rectangle([x, 40, x + 6, 120], fill=(80, 84, 88))
    d.rectangle([0, S - 30, S, S], fill=(150, 150, 146))             # plinth
    return noise(img, 6)


def roof_flat():
    img = Image.new("RGB", (S, S), (214, 212, 206))
    d = ImageDraw.Draw(img)
    for _ in range(18):                                               # soft weather marks
        x, y = rng.randint(0, S), rng.randint(0, S)
        r = rng.randint(20, 80)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(204, 202, 196))
    return noise(img, 8, 3)


def roof_zinc():
    img = Image.new("RGB", (S, S), (170, 176, 180))
    d = ImageDraw.Draw(img)
    for x in range(0, S, 22):
        d.rectangle([x, 0, x + 8, S], fill=(140, 146, 150))
    for _ in range(10):                                               # rust patches
        x, y = rng.randint(0, S), rng.randint(0, S)
        d.ellipse([x - 30, y - 18, x + 30, y + 18], fill=(150, 104, 80))
    return noise(img, 8, 0.8)


def glass():
    """Mall / hotel curtain wall: one bay, one storey — tinted panes, thin mullions, a spandrel band."""
    img = Image.new("RGB", (S, S), (120, 150, 172))
    d = ImageDraw.Draw(img)
    for y in range(S):                                                # sky reflection, lighter at the top
        t = y / S
        d.line([(0, y), (S, y)], fill=(int(176 - 60 * t), int(200 - 56 * t), int(220 - 48 * t)))
    d.rectangle([0, 0, S, 46], fill=(200, 204, 208))                  # spandrel at the floor slab
    for x in (0, 254):                                                # mullions (two panes per bay)
        d.rectangle([x, 0, x + 10, S], fill=(214, 218, 222))
    d.rectangle([0, 46, S, 52], fill=(170, 176, 182))
    return noise(img, 4, 0.8)


def parking():
    """Car park surface, 5 m along the row × 16 m across: two back-to-back rows of 2.5 m stalls (10 m)
    and a 6 m driving aisle. u = metres / 5, v = metres / 16."""
    img = Image.new("RGB", (S, S), (92, 96, 100))
    d = ImageDraw.Draw(img)
    row = int(S * 10 / 16)
    for x in (0, S // 2):                                             # stall dividers
        d.rectangle([x, 8, x + 7, row - 8], fill=(236, 236, 230))
    d.rectangle([0, row // 2 - 3, S, row // 2 + 3], fill=(236, 236, 230))   # line between the two rows
    d.rectangle([0, row - 4, S, row + 2], fill=(214, 200, 120))       # aisle edge (yellow)
    return noise(img, 10, 0.7)


for name, fn in (("apartment", apartment), ("shop", shop), ("house", house), ("factory", factory),
                 ("roof_flat", roof_flat), ("roof_zinc", roof_zinc), ("glass", glass), ("parking", parking)):
    path = OUT / f"{name}.jpg"
    fn().save(path, quality=82)
    print("wrote", path.relative_to(OUT.parents[3]))
