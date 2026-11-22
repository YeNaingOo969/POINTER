// Turn the picked logo (white-background AI image) into web assets.
//
//   npm run build:brand
//
// Input:  assets/raw/images/brand/logo-mark-landmarks.jpg + map-texture.jpg  (never modified)
//         (logo-mark.jpg is the earlier single-spire version, kept for reference)
// Output: public/images/brand/logo-mark-{1024,512,256,128}.webp  transparent, trimmed
//         public/images/brand/logo-mark.png                      transparent master (1024)
//         public/favicon-{16,32,48}.png, apple-touch-icon.png (180), icon-{192,512}.png
//
// Steps: fill the gold pin body with the pastel map, remove the white background and drop
// shadow, then draw a clean white sticker outline around the whole logo so light details
// (white buildings) never turn into holes on dark pages.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { RAW, WORK, PUBLIC, rel, formatBytes, sizeOf } from './lib.mjs';

const SRC = path.join(RAW, 'images', 'brand', 'logo-mark-landmarks.jpg');
// When present, this finished logo (cleaned-up redraw of the user's own edit) is used as-is
// and the map-fill / crown compositing below is skipped.
// Versions: logo-final.jpg (gold frame) → logo-final-coral.jpg (thick coral frame, FLUX kept the
// ring gold more cleanly than recolouring pixels could) → logo-final-thin.jpg (thin coral frame).
const FINAL_SRC = path.join(RAW, 'images', 'brand', 'logo-final-thin.jpg');
const OUT = path.join(PUBLIC, 'images', 'brand');

// ---- Background ----

// A pixel counts as background when it is light and almost colourless.
const BG_MIN_CHANNEL = 120; // low enough to catch the sticker's soft drop shadow
const BG_MAX_SATURATION = 45; // the final logo's ground shadow is slightly warm
// Width of the white sticker outline we draw back around the logo (px at 1024).
const STICKER_PX = 14;

function isBackground(r, g, b) {
  const lo = Math.min(r, g, b);
  const sat = Math.max(r, g, b) - lo;
  // Light, warm-pink ground shadow under the pin tip also counts as background.
  // (Warm only, so the pale blue cloud outlines are left alone.)
  const warmShadow = lo >= 150 && sat <= 75 && r >= g && r > b + 15;
  return (lo >= BG_MIN_CHANNEL && sat <= BG_MAX_SATURATION) || warmShadow;
}

/** Flood-fill background pixels connected to the image border. Returns a 0/1 mask. */
function floodBackground(px, w, h, channels) {
  const bg = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    const i = y * w + x;
    if (bg[i]) return;
    const o = i * channels;
    if (!isBackground(px[o], px[o + 1], px[o + 2])) return;
    bg[i] = 1;
    stack.push(i);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    const y = (i - x) / w;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  return bg;
}

/** Like floodBackground, but the fill can't squeeze through gaps narrower than ~2*gap px, so
    thin, slightly broken outlines (cloud edges) still keep their white insides. */
function floodBackgroundSealed(px, w, h, channels, gap) {
  const candidate = new Uint8Array(w * h);
  for (let i = 0; i < candidate.length; i++) {
    const o = i * channels;
    candidate[i] = isBackground(px[o], px[o + 1], px[o + 2]) ? 1 : 0;
  }
  // Shrink the candidate area, flood from the border inside the shrunken area, then grow back.
  const toSolid = distanceToLogo(candidate, w, h); // distance to the nearest non-background pixel
  const core = new Uint8Array(w * h);
  const stack = [];
  const push = (i) => { if (!core[i] && toSolid[i] > gap) { core[i] = 1; stack.push(i); } };
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
  const toCore = distanceToLogo(core.map((v) => (v ? 0 : 1)), w, h);
  const bg = new Uint8Array(w * h);
  for (let i = 0; i < bg.length; i++) bg[i] = candidate[i] && toCore[i] <= gap + 1.5 ? 1 : 0;
  return bg;
}

/** Approximate distance (px) from every pixel to the logo, via a two-pass 3-4 chamfer. */
function distanceToLogo(bg, w, h) {
  const INF = 1e9;
  const d = new Float64Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = bg[i] ? INF : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!d[i]) continue;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 3);
      if (y > 0) {
        v = Math.min(v, d[i - w] + 3);
        if (x > 0) v = Math.min(v, d[i - w - 1] + 4);
        if (x < w - 1) v = Math.min(v, d[i - w + 1] + 4);
      }
      d[i] = v;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!d[i]) continue;
      let v = d[i];
      if (x < w - 1) v = Math.min(v, d[i + 1] + 3);
      if (y < h - 1) {
        v = Math.min(v, d[i + w] + 3);
        if (x < w - 1) v = Math.min(v, d[i + w + 1] + 4);
        if (x > 0) v = Math.min(v, d[i + w - 1] + 4);
      }
      d[i] = v;
    }
  }
  for (let i = 0; i < d.length; i++) d[i] /= 3;
  return d;
}

// ---- Map fill: replace the gold pin body with the pastel Yangon map texture ----

const MAP_TEXTURE = path.join(RAW, 'images', 'brand', 'map-texture.jpg');
// The flood fill for the body starts here (below the face, inside the pin).
const BODY_SEED = { x: 512, y: 780 };
// How far to zoom into the texture, and which part to show (0-1 from left/top).
const MAP_ZOOM = 2;
const MAP_FOCUS = { x: 0.6, y: 0.28 };

/** Gold body pixels: warm, bright enough, and clearly more yellow than pink (excludes blush).
    The second test catches the pale glossy highlight, which is almost cream. */
function isGold(r, g, b) {
  const body = r >= 140 && g >= 90 && r >= g * 0.95 && b < g * 0.8;
  const highlight = r >= 210 && g >= r * 0.85 && b < g * 0.98 && r - b >= 15;
  return body || highlight;
}

const luminance = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

/** Flood-fill the gold pin body from BODY_SEED; the outline, face and crown stop it. */
function floodBody(px, w, h, channels) {
  const mask = new Uint8Array(w * h);
  const stack = [BODY_SEED.y * w + BODY_SEED.x];
  while (stack.length) {
    const i = stack.pop();
    if (mask[i]) continue;
    const o = i * channels;
    if (!isGold(px[o], px[o + 1], px[o + 2])) continue;
    mask[i] = 1;
    const x = i % w;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (i >= w) stack.push(i - w);
    if (i < w * (h - 1)) stack.push(i + w);
  }
  // Grow one pixel into the anti-aliased rim so no gold fringe is left next to the outline.
  const grown = mask.slice();
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) continue;
    const x = i % w;
    const near = (x > 0 && mask[i - 1]) || (x < w - 1 && mask[i + 1]) || mask[i - w] || mask[i + w];
    const o = i * channels;
    if (near && luminance(px[o], px[o + 1], px[o + 2]) > 110 && px[o + 2] < px[o + 1] * 0.85) grown[i] = 1;
  }
  return grown;
}

/** Paint the map into the body, keeping the original light and shade so it still looks round. */
async function fillBodyWithMap(px, w, h, channels) {
  const mask = floodBody(px, w, h, channels);
  let x0 = w, y0 = h, x1 = 0, y1 = 0, lumSum = 0, count = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const x = i % w, y = (i - x) / w;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    const o = i * channels;
    lumSum += luminance(px[o], px[o + 1], px[o + 2]);
    count++;
  }
  if (!count) throw new Error('pin body not found - check BODY_SEED');
  const avgLum = lumSum / count;
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  // Zoom into the texture so streets, the lake and the river read as big, calm shapes.
  const zw = Math.round(bw * MAP_ZOOM), zh = Math.round(bh * MAP_ZOOM);
  const map = await sharp(MAP_TEXTURE)
    .modulate({ saturation: 1.45, brightness: 0.97 }) // the texture is very pale; make it read
    .linear(1.12, -14)
    .resize(zw, zh, { fit: 'cover' })
    .extract({
      left: Math.round((zw - bw) * MAP_FOCUS.x), top: Math.round((zh - bh) * MAP_FOCUS.y),
      width: bw, height: bh,
    })
    .removeAlpha()
    .raw()
    .toBuffer();

  const out = Buffer.from(px);
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const x = i % w, y = (i - x) / w;
    const o = i * channels;
    const m = ((y - y0) * bw + (x - x0)) * 3;
    const shade = luminance(px[o], px[o + 1], px[o + 2]) / avgLum;
    const k = 0.62 + 0.38 * Math.min(shade, 1.04); // keep the body's roundness (darker edges)
    const gloss = Math.max(0, shade - 1.3) * 0.8;   // only a hint of the original gloss
    for (let c = 0; c < 3; c++) {
      const v = map[m + c] * k;
      out[o + c] = Math.max(0, Math.min(255, Math.round(v + (255 - v) * Math.min(0.3, gloss))));
    }
  }
  console.log(`  map fill: ${count} px body, box ${bw}x${bh}`);
  return out;
}

async function loadSource() {
  const { data, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (fs.existsSync(MAP_TEXTURE)) {
    return { data: await fillBodyWithMap(data, info.width, info.height, info.channels), info };
  }
  return { data, info };
}

// ---- Pop-up crown: landmarks rise out of the map inside the pin ----

// Where the bottom of the crown lands, as a fraction of the gap between the pin top and the
// top of the face (0 = on the rim, 1 = touching the eyebrows).
const CROWN_DEPTH = 0.9;
// Crown width as a fraction of the pin's inner width. Pieces that stick out past the pin's
// sides are kept on purpose (user's choice) — the white sticker outline wraps them too.
const CROWN_WIDTH = 0.98;

/** Pixels enclosed by the pin outline: the body plus the face features sitting in it. */
function pinInterior(body, w, h) {
  // Everything not reachable from the image border without crossing the body is inside.
  const outside = new Uint8Array(w * h);
  const stack = [];
  const push = (i) => { if (!outside[i] && !body[i]) { outside[i] = 1; stack.push(i); } };
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
  const inside = new Uint8Array(w * h);
  for (let i = 0; i < inside.length; i++) inside[i] = outside[i] ? 0 : 1;
  return inside;
}

// ---- Red rim: recolour the pin's gold rim, keeping the gold orbit ring in front of it ----

// Pixel recolouring of logo-final.jpg's gold rim (degrees). Off (null): it left seams where the
// orbit ring crosses the rim, so the coral source is used instead. Kept for experiments.
const RIM_HUE = null;
const RIM_SATURATION = 0.8; // user asked for a softer red
const RIM_LIGHTNESS = 1.06;
// Seeds inside the map, one above and one below the orbit ring that crosses the pin.
const MAP_SEEDS = [{ x: 512, y: 420 }, { x: 512, y: 720 }];

function isGoldish(r, g, b) {
  return r >= 120 && r >= g && g >= 70 && b < g * 0.85 && r - b > 50;
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hh = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [hh * 60, s, l];
}

function hslToRgb(hh, s, l) {
  const k = (n) => (n + hh / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
}

/** Map pixels inside the pin: flood from the seeds over anything that isn't gold or outline. */
function mapInterior(px, w, h, channels) {
  const inside = new Uint8Array(w * h);
  const stack = MAP_SEEDS.map((s) => s.y * w + s.x);
  while (stack.length) {
    const i = stack.pop();
    if (inside[i]) continue;
    const o = i * channels;
    const r = px[o], g = px[o + 1], b = px[o + 2];
    if (isGoldish(r, g, b) || luminance(r, g, b) < 70) continue;
    inside[i] = 1;
    const x = i % w;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (i >= w) stack.push(i - w);
    if (i < w * (h - 1)) stack.push(i + w);
  }
  return inside;
}

/** Fill the holes (face, orange building blocks) in the map region; the orbit ring stays out
    because it is connected to the background. */
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

/** Recolour the gold rim red. The rim is the gold hugging the pin's outer edge (near both the
    map and the background); the orbit ring's front segment is protected column by column. */
function redRim(px, w, h, channels) {
  const inside = fillHoles(mapInterior(px, w, h, channels), w, h);
  const toInside = distanceToLogo(inside.map((v) => (v ? 0 : 1)), w, h);
  const bg = floodBackground(px, w, h, channels);
  const toBg = distanceToLogo(bg.map((v) => (v ? 0 : 1)), w, h);

  let top = h, x0 = w, x1 = 0;
  for (let i = 0; i < inside.length; i++) {
    if (!inside[i]) continue;
    const x = i % w;
    top = Math.min(top, (i - x) / w); x0 = Math.min(x0, x); x1 = Math.max(x1, x);
  }

  // Rim width: the gold run just outside the map, measured on a row through the lower body.
  const probeY = Math.round(MAP_SEEDS[1].y);
  let edge = x0;
  while (edge < w && !inside[probeY * w + edge]) edge++;
  let run = 0;
  for (let x = edge - 1; x > 0; x--) {
    const o = (probeY * w + x) * channels;
    if (isGoldish(px[o], px[o + 1], px[o + 2])) run++;
    else if (run > 0) break;
  }
  const rimWidth = Math.max(12, run + 4);

  // Front segment of the orbit ring: gold pixels with map directly above and below them.
  const ringTop = new Float64Array(w).fill(NaN), ringBot = new Float64Array(w).fill(NaN);
  for (let x = x0; x <= x1; x++) {
    for (let y = top; y < h - 1; y++) {
      const i = y * w + x;
      const o = i * channels;
      if (inside[i] || !isGoldish(px[o], px[o + 1], px[o + 2])) continue;
      // Walk down the gold run and check there is map on both sides.
      let y2 = y;
      while (y2 < h - 1 && !inside[(y2 + 1) * w + x] && isGoldish(px[(y2 + 1) * w * channels + x * channels],
        px[(y2 + 1) * w * channels + x * channels + 1], px[(y2 + 1) * w * channels + x * channels + 2])) y2++;
      const above = y > 0 && inside[(y - 3) * w + x];
      const below = y2 < h - 3 && inside[(y2 + 3) * w + x];
      if (above && below && y2 - y >= 8) { ringTop[x] = y; ringBot[x] = y2; break; }
      y = y2;
    }
  }
  // Extend the ring's edges across the rim on both sides with a straight-line fit.
  const extend = (from, step) => {
    const xs = [];
    for (let x = from; xs.length < 40 && x > x0 - 1 && x < x1 + 1; x -= step) if (!Number.isNaN(ringTop[x])) xs.push(x);
    if (xs.length < 6) return;
    const fit = (arr) => {
      const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = xs.reduce((a, x) => a + arr[x], 0) / n;
      let num = 0, den = 0;
      for (const x of xs) { num += (x - mx) * (arr[x] - my); den += (x - mx) ** 2; }
      const k = den ? num / den : 0;
      return (x) => my + k * (x - mx);
    };
    const ft = fit(ringTop), fb = fit(ringBot);
    for (let x = xs[0] + step, n = 0; n < rimWidth * 3; x += step, n++) {
      if (x < 0 || x >= w) break;
      ringTop[x] = ft(x) - 2; ringBot[x] = fb(x) + 2;
    }
  };
  let lastL = x0; while (lastL <= x1 && Number.isNaN(ringTop[lastL])) lastL++;
  let lastR = x1; while (lastR >= x0 && Number.isNaN(ringTop[lastR])) lastR--;
  extend(lastL, -1);
  extend(lastR, 1);

  const out = Buffer.from(px);
  let changed = 0;
  for (let i = 0; i < w * h; i++) {
    if (inside[i] || toInside[i] > rimWidth) continue;
    const x = i % w, y = (i - x) / w;
    // Along the top the crown hides the background, so only the sides need the edge test.
    if (y > top + 40 && toBg[i] > rimWidth + 30) continue;
    if (!Number.isNaN(ringTop[x]) && y >= ringTop[x] && y <= ringBot[x]) continue; // orbit ring in front
    if (y < top - rimWidth) continue; // crown above the rim stays as drawn
    const o = i * channels;
    const r = px[o], g = px[o + 1], b = px[o + 2];
    if (!isGoldish(r, g, b)) continue;
    const [, s, l] = rgbToHsl(r, g, b);
    // A soft coral-red: a little less saturated and a touch lighter than the gold it replaces.
    const [nr, ng, nb] = hslToRgb(RIM_HUE, s * RIM_SATURATION, Math.min(0.92, l * RIM_LIGHTNESS));
    out[o] = nr; out[o + 1] = ng; out[o + 2] = nb;
    changed++;
  }
  console.log(`  red rim: ${changed} px, rim width ${rimWidth}, map top ${top}`);
  return out;
}

/** A finished logo needs no compositing: just lift it off its white background. */
async function liftFinal() {
  const { data: raw, info } = await sharp(FINAL_SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels } = info;
  const src = RIM_HUE == null ? raw : redRim(raw, w, h, channels);
  if (process.env.BRAND_DEBUG) {
    await sharp(src, { raw: { width: w, height: h, channels } }).png().toFile(process.env.BRAND_DEBUG);
  }
  const bg = floodBackgroundSealed(src, w, h, channels, 4);
  const out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    if (bg[i]) continue;
    out[i * 4] = src[i * channels]; out[i * 4 + 1] = src[i * channels + 1];
    out[i * 4 + 2] = src[i * channels + 2]; out[i * 4 + 3] = 255;
  }
  console.log(`  using ${rel(FINAL_SRC)}`);
  return { rgba: out, w, h };
}

/** Build the final RGBA logo: map-filled pin, with the landmark crown popping out of it. */
async function compose() {
  if (fs.existsSync(FINAL_SRC)) return liftFinal();
  const { data: src, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels } = info;
  const bg = floodBackground(src, w, h, channels);
  const body = floodBody(src, w, h, channels);
  const inside = pinInterior(body, w, h);
  const toInside = distanceToLogo(inside.map((v) => (v ? 0 : 1)), w, h);

  // Measure the pin and the face.
  let pinTop = h, faceTop = h, px0 = w, px1 = 0;
  for (let i = 0; i < inside.length; i++) {
    if (!inside[i]) continue;
    const x = i % w, y = (i - x) / w;
    pinTop = Math.min(pinTop, y);
    px0 = Math.min(px0, x); px1 = Math.max(px1, x);
    // Eyes and brows are the dark pixels sitting inside the body.
    const o = i * channels;
    if (!body[i] && toInside[i] === 0 && luminance(src[o], src[o + 1], src[o + 2]) < 80
      && y > pinTop + 40) faceTop = Math.min(faceTop, y);
  }

  // The crown is every logo pixel above the pin that isn't part of its outline.
  const crownMask = new Uint8Array(w * h);
  let cx0 = w, cy0 = h, cx1 = 0, cy1 = 0;
  for (let i = 0; i < crownMask.length; i++) {
    const x = i % w, y = (i - x) / w;
    if (bg[i] || inside[i] || y >= pinTop || toInside[i] <= 14) continue;
    crownMask[i] = 1;
    cx0 = Math.min(cx0, x); cx1 = Math.max(cx1, x); cy0 = Math.min(cy0, y); cy1 = Math.max(cy1, y);
  }
  const cw = cx1 - cx0 + 1, ch = cy1 - cy0 + 1;
  const crownRgba = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const i = (y + cy0) * w + (x + cx0);
      const o = (y * cw + x) * 4;
      if (!crownMask[i]) continue;
      crownRgba[o] = src[i * channels]; crownRgba[o + 1] = src[i * channels + 1];
      crownRgba[o + 2] = src[i * channels + 2]; crownRgba[o + 3] = 255;
    }
  }
  const scale = Math.min(1, ((px1 - px0) * CROWN_WIDTH) / cw);
  const sw = Math.round(cw * scale), sh = Math.round(ch * scale);
  const crown = await sharp(crownRgba, { raw: { width: cw, height: ch, channels: 4 } })
    .resize(sw, sh)
    .raw()
    .toBuffer();

  // Pin layer: interior (map-filled) plus its outline ring; the old crown is dropped.
  const filled = fs.existsSync(MAP_TEXTURE) ? await fillBodyWithMap(src, w, h, channels) : src;
  const out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    if (bg[i] || crownMask[i]) continue;
    if (!inside[i] && toInside[i] > 14) continue;
    out[i * 4] = filled[i * channels]; out[i * 4 + 1] = filled[i * channels + 1];
    out[i * 4 + 2] = filled[i * channels + 2]; out[i * 4 + 3] = 255;
  }

  // Crown layer: its base sinks into the map inside the pin, the rest rises above the rim.
  const bottom = Math.round(pinTop + (faceTop - pinTop) * CROWN_DEPTH);
  const left = Math.round((px0 + px1) / 2 - sw / 2);
  const top = bottom - sh;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const a = crown[(y * sw + x) * 4 + 3];
      const X = left + x, Y = top + y;
      if (a === 0 || X < 0 || Y < 0 || X >= w || Y >= h) continue;
      const i = Y * w + X;
      const f = a / 255;
      for (let c = 0; c < 3; c++) {
        out[i * 4 + c] = Math.round(crown[(y * sw + x) * 4 + c] * f + out[i * 4 + c] * (1 - f) * (out[i * 4 + 3] / 255));
      }
      out[i * 4 + 3] = Math.max(out[i * 4 + 3], a);
    }
  }
  console.log(`  crown ${cw}x${ch} -> ${sw}x${sh}, pin top ${pinTop}, face top ${faceTop}`);
  return { rgba: out, w, h };
}

// ---- Cutout ----

async function cutout() {
  const { rgba: layered, w, h } = await compose();
  const bg = new Uint8Array(w * h);
  for (let i = 0; i < bg.length; i++) bg[i] = layered[i * 4 + 3] < 128 ? 1 : 0;
  const dist = distanceToLogo(bg, w, h);

  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const o4 = i * 4;
    if (!bg[i]) {
      rgba[o4] = layered[o4]; rgba[o4 + 1] = layered[o4 + 1]; rgba[o4 + 2] = layered[o4 + 2]; rgba[o4 + 3] = 255;
    } else {
      // Background near the logo becomes the white sticker outline, fading out over 1.5 px.
      const a = Math.min(1, Math.max(0, (STICKER_PX + 1.5 - dist[i]) / 1.5));
      rgba[o4] = 255; rgba[o4 + 1] = 255; rgba[o4 + 2] = 255; rgba[o4 + 3] = Math.round(a * 255);
    }
  }

  // Trim transparent margins, then pad back to a square so every size keeps the same framing.
  const trimmed = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .trim({ threshold: 1 })
    .png()
    .toBuffer({ resolveWithObject: true });
  const side = Math.max(trimmed.info.width, trimmed.info.height);
  const padX = Math.round((side - trimmed.info.width) / 2);
  const padY = Math.round((side - trimmed.info.height) / 2);
  const framing = {
    left: -(trimmed.info.trimOffsetLeft ?? 0), top: -(trimmed.info.trimOffsetTop ?? 0),
    width: trimmed.info.width, height: trimmed.info.height, side, padX, padY,
  };
  const master = await sharp(trimmed.data)
    .extend({
      left: padX, right: side - trimmed.info.width - padX,
      top: padY, bottom: side - trimmed.info.height - padY,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  return { master, framing };
}

// ---- Ring-free version for the animated reveal ----

// FLUX redraw of the final logo with the orbit ring removed. The reveal uses it only to fill the
// map that the ring covers, so the ring can arrive last.
const NORING_SRC = path.join(RAW, 'images', 'brand', 'logo-final-thin-noring.jpg');
const NORING_OUT = path.join(WORK, 'brand', 'logo-mark-noring.png');

/** Best integer shift (dx, dy) that lines cand up with ref, judged on the crown + eyes area. */
function bestShift(ref, cand, n) {
  let best = { err: Infinity, dx: 0, dy: 0 };
  for (let dy = -16; dy <= 16; dy++) {
    for (let dx = -16; dx <= 16; dx++) {
      let s = 0, k = 0;
      for (let y = 60; y < 470; y += 2) {
        for (let x = 220; x < 800; x += 2) { s += Math.abs(ref[y * n + x] - cand[(y + dy) * n + (x + dx)]); k++; }
      }
      if (s / k < best.err) best = { err: s / k, dx, dy };
    }
  }
  return best;
}

/** Align the ring-free redraw to the final logo and frame it exactly like logo-mark.png. */
async function buildNoRing(framing) {
  const n = 1024;
  const gray = (f) => sharp(f).resize(n, n).greyscale().raw().toBuffer();
  const shift = bestShift(await gray(FINAL_SRC), await gray(NORING_SRC), n);
  // Shift the redraw by (-dx, -dy): pad white on all sides, then cut the shifted window.
  // (Two pipelines: sharp would otherwise run the extract before the extend.)
  const P = 32;
  const padded = await sharp(NORING_SRC)
    .resize(n, n)
    .removeAlpha()
    .extend({ left: P, right: P, top: P, bottom: P, background: '#ffffff' })
    .png()
    .toBuffer();
  const aligned = await sharp(padded)
    .extract({ left: P + shift.dx, top: P + shift.dy, width: n, height: n })
    .png()
    .toBuffer();
  const f = framing;
  fs.mkdirSync(path.dirname(NORING_OUT), { recursive: true });
  const cropped = await sharp(aligned)
    .extract({ left: f.left, top: f.top, width: f.width, height: f.height })
    .png()
    .toBuffer();
  const square = await sharp(cropped)
    .extend({
      left: f.padX, right: f.side - f.width - f.padX, top: f.padY, bottom: f.side - f.height - f.padY,
      background: '#ffffff',
    })
    .png()
    .toBuffer();
  await sharp(square).resize(1024, 1024).png().toFile(NORING_OUT);
  console.log(`ok ${rel(NORING_OUT)} (shift ${shift.dx},${shift.dy}, diff ${shift.err.toFixed(1)})`);
}

// ---- Outputs ----

function report(file) {
  console.log(`ok ${rel(file)} (${formatBytes(sizeOf(file))})`);
}

fs.mkdirSync(OUT, { recursive: true });
const { master, framing } = await cutout();
if (fs.existsSync(FINAL_SRC) && fs.existsSync(NORING_SRC)) await buildNoRing(framing);

const masterFile = path.join(OUT, 'logo-mark.png');
await sharp(master).resize(1024, 1024).png({ compressionLevel: 9 }).toFile(masterFile);
report(masterFile);

for (const size of [1024, 512, 256, 128]) {
  const file = path.join(OUT, `logo-mark-${size}.webp`);
  await sharp(master).resize(size, size).webp({ quality: 90, alphaQuality: 100 }).toFile(file);
  report(file);
}

const icons = [
  ['favicon-16.png', 16], ['favicon-32.png', 32], ['favicon-48.png', 48],
  ['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512],
];
for (const [name, size] of icons) {
  const file = path.join(PUBLIC, name);
  // Apple and PWA icons need an opaque background; the browser favicons stay transparent.
  const opaque = size >= 180;
  const inner = Math.round(size * (opaque ? 0.8 : 1));
  let img = sharp(master).resize(inner, inner);
  if (opaque) {
    const buf = await img.png().toBuffer();
    img = sharp({ create: { width: size, height: size, channels: 4, background: '#1A1410' } })
      .composite([{ input: buf, gravity: 'center' }]);
  }
  await img.png({ compressionLevel: 9 }).toFile(file);
  report(file);
}
