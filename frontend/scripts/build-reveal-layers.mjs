// Split the finished logo into layers for the animated logo reveal.
//
//   npm run build:reveal        (run npm run build:brand first)
//
// Input:  public/images/brand/logo-mark.png  (1024x1024, transparent, from build-brand.mjs)
// Output: public/images/brand/reveal/
//           pin.webp       pin, map, face, frame and orbit ring (everything below the cut line)
//           crown.webp     landmarks, clouds and bushes above the cut line
//           ring.webp      gold orbit ring pixels only, used as a mask for the shine sweep
//           sparkle-N.webp each gold sparkle with its white outline, cropped
//           manifest.json  canvas size, cut line and sparkle boxes for the animation
//
// The full-size layers share one 1024x1024 canvas, so they stack pixel-perfectly.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { PUBLIC, WORK, rel, formatBytes, sizeOf } from './lib.mjs';

const SRC = path.join(PUBLIC, 'images', 'brand', 'logo-mark.png');
const OUT = path.join(PUBLIC, 'images', 'brand', 'reveal');

// Horizontal line just above the top of the pin frame (measured on the 1024 master).
// The crown rises out from behind this line.
const CUT_Y = 316;
// The orbit ring's top-right arc climbs above the cut line; keep that part with the pin.
const RING_ZONE_X = 800;
// Sparkles: small gold islands that sit near the logo's outer edge.
const SPARKLE_MAX_GOLD_AREA = 6000;
const SPARKLE_EDGE_REACH = 30; // px: a sparkle has transparent pixels this close
const SPARKLE_OUTLINE = 22;    // px of white sticker outline taken along with each sparkle
// Gold specks smaller than this are left out of the ring mask (bits of map, frame highlights).
const RING_MIN_AREA = 2000;
// Bushes: green below this y (above it, the green is the City Hall roof) belongs to the pin.
const BUSH_TOP = 282;
const BUSH_GROW = 8; // px of outline / sticker edge taken along with the bush green

const luminance = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

// Ring split (needs assets/work/brand/logo-mark-noring.png from `npm run build:brand`).
const NORING = path.join(WORK, 'brand', 'logo-mark-noring.png');
const RING_OUTLINE = 3;  // px of dark/orange edge taken with the ring's gold
const RING_STICKER = 24; // px of white sticker edge the ring owns outside the pin
const PIN_STICKER = 13;  // px of white outline redrawn for the pin where the ring covered it

/** Cheap distance (px, 4-neighbour BFS, capped) from every pixel to the nearest mask pixel. */
function distanceTo(mask, w, h, cap) {
  const d = new Uint8Array(w * h).fill(255);
  let frontier = [];
  for (let i = 0; i < mask.length; i++) if (mask[i]) { d[i] = 0; frontier.push(i); }
  for (let step = 1; step <= cap && frontier.length; step++) {
    const next = [];
    for (const i of frontier) {
      const x = i % w;
      for (const n of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (n < 0 || n >= d.length || d[n] !== 255) continue;
        d[n] = step;
        next.push(n);
      }
    }
    frontier = next;
  }
  return d;
}

/** Fill enclosed holes in a mask (anything not reachable from the image border). */
function fillHoles(mask, w, h) {
  const outside = new Uint8Array(w * h);
  const stack = [];
  const push = (i) => { if (!outside[i] && !mask[i]) { outside[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < w * (h - 1)) push(i + w);
  }
  return outside.map((v) => (v ? 0 : 1));
}

/** Bright yellow gold of the orbit ring and sparkles (not the map's peach blocks or the frame). */
function isGold(r, g, b) {
  return r >= 200 && g >= 150 && r - b >= 70 && g - b >= 40;
}

/** Label 4-connected islands of mask pixels. */
function islands(mask, w, h) {
  const labels = new Int32Array(w * h).fill(-1);
  const list = [];
  for (let start = 0; start < labels.length; start++) {
    if (labels[start] !== -1 || !mask[start]) continue;
    const id = list.length;
    let area = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
    const stack = [start];
    labels[start] = id;
    while (stack.length) {
      const i = stack.pop();
      const x = i % w, y = (i - x) / w;
      area++;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (const n of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (n < 0 || n >= labels.length || labels[n] !== -1 || !mask[n]) continue;
        labels[n] = id;
        stack.push(n);
      }
    }
    list.push({ area, x0, y0, x1, y1 });
  }
  return { labels, list };
}

async function save(buf, w, h, file, crop) {
  let img = sharp(buf, { raw: { width: w, height: h, channels: 4 } });
  if (crop) img = img.extract({ left: crop.x, top: crop.y, width: crop.w, height: crop.h });
  await img.webp({ quality: 90, alphaQuality: 100 }).toFile(file);
  console.log(`ok ${rel(file)} (${formatBytes(sizeOf(file))})`);
}

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h } = info;
const px = (i) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3]];
const copy = (dst, i) => { for (let c = 0; c < 4; c++) dst[i * 4 + c] = data[i * 4 + c]; };

// ---- Find sparkles ----
const gold = new Uint8Array(w * h);
for (let i = 0; i < gold.length; i++) {
  const [r, g, b, a] = px(i);
  gold[i] = a > 128 && isGold(r, g, b) ? 1 : 0;
}
const { labels, list } = islands(gold, w, h);

const nearEdge = (isl) => {
  const R = SPARKLE_EDGE_REACH;
  for (let y = Math.max(0, isl.y0 - R); y <= Math.min(h - 1, isl.y1 + R); y += 2) {
    for (let x = Math.max(0, isl.x0 - R); x <= Math.min(w - 1, isl.x1 + R); x += 2) {
      if (data[(y * w + x) * 4 + 3] === 0) return true;
    }
  }
  return false;
};

/** Share of near-white (sticker outline) pixels in a thin band just around the island's box.
    Real sparkles are wrapped in white; gold bits of the spire or the map are not. */
const whiteAround = (isl) => {
  let white = 0, total = 0;
  const band = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    total++;
    const [r, g, b, a] = px(i);
    if (a === 0 || Math.min(r, g, b) >= 225) white++;
  };
  for (const d of [8, 11]) {
    for (let x = isl.x0 - d; x <= isl.x1 + d; x += 2) { band(x, isl.y0 - d); band(x, isl.y1 + d); }
    for (let y = isl.y0 - d; y <= isl.y1 + d; y += 2) { band(isl.x0 - d, y); band(isl.x1 + d, y); }
  }
  return total ? white / total : 0;
};

const sparkleOf = new Int32Array(w * h).fill(-1); // pixel -> sparkle index
const sparkleBoxes = [];
list.forEach((isl, id) => {
  if (isl.area < 150 || isl.area > SPARKLE_MAX_GOLD_AREA || !nearEdge(isl)) return;
  const ratio = whiteAround(isl);
  if (process.env.REVEAL_DEBUG) console.log('  candidate', isl, ratio.toFixed(2));
  if (ratio < 0.7 || isl.y0 < 200) return; // y < 200 is the Karaweik spire's gold tip
  const k = sparkleBoxes.length;
  const O = SPARKLE_OUTLINE;
  const box = {
    x: Math.max(0, isl.x0 - O), y: Math.max(0, isl.y0 - O),
    x1: Math.min(w - 1, isl.x1 + O), y1: Math.min(h - 1, isl.y1 + O),
  };
  // Take the gold star plus everything light within the outline's reach of it (the white
  // sticker outline and its soft edge), so no star-shaped ghost is left on the pin layer.
  const star = [];
  for (let y = isl.y0; y <= isl.y1; y++) {
    for (let x = isl.x0; x <= isl.x1; x++) if (labels[y * w + x] === id) star.push([x, y]);
  }
  const reach2 = (O + 2) ** 2;
  for (let y = box.y; y <= box.y1; y++) {
    for (let x = box.x; x <= box.x1; x++) {
      const i = y * w + x;
      const [r, g, b, a] = px(i);
      if (a === 0) continue;
      if (labels[i] === id) { sparkleOf[i] = k; continue; }
      const light = Math.min(r, g, b) >= 150 || a < 255;
      if (!light || (gold[i] && labels[i] !== -1)) continue; // other gold (the ring) stays put
      let near = false;
      for (const [sx, sy] of star) {
        if ((sx - x) ** 2 + (sy - y) ** 2 <= reach2) { near = true; break; }
      }
      if (near) sparkleOf[i] = k;
    }
  }
  sparkleBoxes.push({ x: box.x, y: box.y, w: box.x1 - box.x + 1, h: box.y1 - box.y + 1 });
});

// ---- Bushes ----
// The bushes along the top of the pin stay with the pin, so the buildings come up from behind
// their rounded, arch-shaped line instead of from a straight cut. Bushes are the green pixels
// in the band around the pin top, plus their dark outline and white sticker edge.
// Whole bushes go with the pin: any green island that reaches below BUSH_TOP is taken in full,
// so no clipped bush tops are left behind on the crown (or bush bottoms on the pin).
const isGreen = (r, g, b) => g > r + 20 && g > b + 10;
const greenMask = new Uint8Array(w * h);
for (let i = 0; i < w * h; i++) {
  const y = (i - (i % w)) / w;
  if (y > CUT_Y + 80) continue;
  const [r, g, b, a] = px(i);
  if (a > 128 && isGreen(r, g, b)) greenMask[i] = 1;
}
const greenIslands = islands(greenMask, w, h);
const greenSeed = new Uint8Array(w * h);
for (let i = 0; i < w * h; i++) {
  const id = greenIslands.labels[i];
  if (id !== -1 && greenIslands.list[id].y1 >= BUSH_TOP) greenSeed[i] = 1;
}
const nearBushGreen = new Uint8Array(w * h);
{
  // Grow the green area a few px so outlines and anti-aliased edges come along.
  let frontier = greenSeed.slice();
  nearBushGreen.set(greenSeed);
  for (let step = 0; step < BUSH_GROW; step++) {
    const next = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      if (!frontier[i]) continue;
      const x = i % w;
      for (const n of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (n < 0 || n >= w * h || nearBushGreen[n]) continue;
        const [r, g, b, a] = px(n);
        const outline = luminance(r, g, b) < 90 || Math.min(r, g, b) >= 225 || a < 255;
        if (a > 0 && (outline || isGreen(r, g, b))) { nearBushGreen[n] = 1; next[n] = 1; }
      }
    }
    frontier = next;
  }
}

// ---- Orbit ring: its own layer, so it can arrive last ----
// Ring = the big gold islands plus a few px of their outline. Outside the pin it also owns its
// white sticker edge. Under the ring, the pin is filled from the ring-free redraw.
const ringGold = new Uint8Array(w * h);
for (let i = 0; i < w * h; i++) {
  const id = labels[i];
  // (The ring reaches far down the pin; the Karaweik's gold hull is also a big gold island, but stays up top.)
  if (gold[i] && id !== -1 && list[id].area >= RING_MIN_AREA && list[id].y1 > 450 && sparkleOf[i] === -1) ringGold[i] = 1;
}
const toRing = distanceTo(ringGold, w, h, RING_STICKER + 2);

let noring = null;
if (fs.existsSync(NORING)) {
  noring = await sharp(NORING).removeAlpha().raw().toBuffer();
}
const isWhite = (r, g, b) => Math.min(r, g, b) >= 235;
// Where the ring-free redraw has logo (holes such as white roads filled in).
const noringLogo = new Uint8Array(w * h);
if (noring) {
  const raw = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) raw[i] = isWhite(noring[i * 3], noring[i * 3 + 1], noring[i * 3 + 2]) ? 0 : 1;
  // Keep only the main body: the redraw's own sparkles sit in different places.
  const filled = fillHoles(raw, w, h);
  const parts = islands(filled, w, h);
  let main = -1;
  parts.list.forEach((isl, id) => { if (main === -1 || isl.area > parts.list[main].area) main = id; });
  for (let i = 0; i < w * h; i++) noringLogo[i] = parts.labels[i] === main ? 1 : 0;
}

const ringArt = Buffer.alloc(w * h * 4);
const ringPart = new Uint8Array(w * h); // 1 = ring core, 2 = ring's sticker edge
for (let i = 0; i < w * h; i++) {
  if (data[i * 4 + 3] === 0 || sparkleOf[i] !== -1) continue;
  if (toRing[i] <= RING_OUTLINE) { ringPart[i] = 1; continue; }
  if (noring && toRing[i] <= RING_STICKER && !noringLogo[i]) ringPart[i] = 2;
}

// ---- Pin / crown / ring layers ----
const pin = Buffer.alloc(w * h * 4);
const crown = Buffer.alloc(w * h * 4);
const ring = Buffer.alloc(w * h * 4);
const setPx = (dst, i, r, g, b, a) => { dst[i * 4] = r; dst[i * 4 + 1] = g; dst[i * 4 + 2] = b; dst[i * 4 + 3] = a; };
for (let i = 0; i < w * h; i++) {
  if (data[i * 4 + 3] === 0 || sparkleOf[i] !== -1) continue;
  const x = i % w, y = (i - x) / w;
  if (noring && ringPart[i]) {
    copy(ringArt, i);
    if (ringGold[i]) copy(ring, i);
    if (noringLogo[i]) {
      // The map / frame the ring was covering, from the ring-free redraw.
      setPx(pin, i, noring[i * 3], noring[i * 3 + 1], noring[i * 3 + 2], 255);
    }
    continue;
  }
  const inRingZone = gold[i] && x >= RING_ZONE_X;
  if (y < CUT_Y && !inRingZone && !nearBushGreen[i]) {
    copy(crown, i);
  } else {
    copy(pin, i);
    if (!noring && ringGold[i]) copy(ring, i);
  }
}

// Redraw the pin's own white outline where the ring used to cover it: measured from what the
// pin layer now actually shows, so it hugs the pin exactly.
if (noring) {
  const content = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const a = pin[i * 4 + 3];
    content[i] = a > 0 && !isWhite(pin[i * 4], pin[i * 4 + 1], pin[i * 4 + 2]) ? 1 : 0;
  }
  const toContent = distanceTo(fillHoles(content, w, h), w, h, 60);
  for (let i = 0; i < w * h; i++) {
    const near = toContent[i] <= PIN_STICKER;
    if (ringPart[i] && pin[i * 4 + 3] === 0 && near) setPx(pin, i, 255, 255, 255, 255);
    // Leftover white that belonged to the ring's outline, floating away from the pin.
    if (pin[i * 4 + 3] > 0 && toContent[i] > PIN_STICKER + 3) setPx(pin, i, 0, 0, 0, 0);
  }
}

fs.mkdirSync(OUT, { recursive: true });
await save(pin, w, h, path.join(OUT, 'pin.webp'));
await save(crown, w, h, path.join(OUT, 'crown.webp'));
await save(ring, w, h, path.join(OUT, 'ring.webp'));
let ringBox = null;
if (noring) {
  await save(ringArt, w, h, path.join(OUT, 'ring-art.webp'));
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let i = 0; i < w * h; i++) {
    if (!ringGold[i]) continue;
    const x = i % w, y = (i - x) / w;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  ringBox = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

const sparkles = [];
for (let k = 0; k < sparkleBoxes.length; k++) {
  const buf = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) if (sparkleOf[i] === k) copy(buf, i);
  const file = `sparkle-${k + 1}.webp`;
  await save(buf, w, h, path.join(OUT, file), sparkleBoxes[k]);
  sparkles.push({ file, ...sparkleBoxes[k] });
}

const manifest = { size: w, cutY: CUT_Y, ringBox, sparkles };
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`ok ${rel(path.join(OUT, 'manifest.json'))} (${sparkles.length} sparkles)`);
