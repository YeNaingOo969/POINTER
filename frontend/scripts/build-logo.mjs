// Turn the team's POINTER logo (a small 434 × 395 raster on dark) into clean, scalable SVG.
//
//   npm run build:logo
//
// Input:  assets/raw/images/brand/pointer-logo-team.png   (never modified)
// Output: public/images/brand/pointer-logo.svg   full lockup: emblem, POINTER, rules, tagline
//         public/images/brand/pointer-mark.svg   emblem only (arc, stupa, star)
//         public/images/brand/pointer-word.svg   "POINTER" letters only
//         public/images/brand/pointer-mark-{128,256,512}.webp
//         public/favicon-{16,32,48}.png, apple-touch-icon.png, icon-{192,512}.png
//
// How: upscale ×6, keep the light-gold pixels as a black-on-white mask, trace it with potrace,
// then split the traced sub-paths into parts by position (arc / stupa / star / letters / rules)
// so the landing page can animate each part. Shapes are traced from the team's art, not redrawn.
// The tagline is too small in the source to trace, so it is set as text.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import potrace from 'potrace';
import { RAW, PUBLIC, rel, formatBytes, sizeOf } from './lib.mjs';

const SRC = path.join(RAW, 'images', 'brand', 'pointer-logo-team.png');
const OUT = path.join(PUBLIC, 'images', 'brand');
const SCALE = 6;
// Source pixel areas (before upscaling).
const STUPA = [165, 75, 345, 186]; // the stupa tiers: a higher threshold keeps the thin tier lines open
const EMBLEM_BOTTOM = 222; // emblem above, wordmark below
const WORD_BOTTOM = 318; // the tagline under this line is set as text instead
const DUSK = '#1a1410';
const TAGLINE = 'Explore · Discover · Enjoy';

// ---- 1. Masks ----

const { data, info } = await sharp(SRC)
  .removeAlpha()
  .resize({ width: 434 * SCALE, kernel: 'lanczos3' })
  .blur(1)
  .raw()
  .toBuffer({ resolveWithObject: true });

function mask(y0, y1) {
  const w = info.width, h = y1 - y0;
  const out = Buffer.alloc(w * h, 255);
  for (let y = y0; y < y1; y++) {
    const sy = y / SCALE;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const lum = 0.3 * r + 0.59 * g + 0.11 * b;
      const sx = x / SCALE;
      const inStupa = sx >= STUPA[0] && sx <= STUPA[2] && sy >= STUPA[1] && sy <= STUPA[3];
      const warm = r >= b + 10 || lum > 170; // the pale ground swoosh is almost white
      if (lum > (inStupa ? 150 : 105) && warm) out[(y - y0) * w + x] = 0;
    }
  }
  return sharp(out, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
}

// ---- 2. Trace ----

const trace = (png) => new Promise((resolve, reject) => {
  const tracer = new potrace.Potrace({ turdSize: 60, optTolerance: 0.3, alphaMax: 1, threshold: 128 });
  tracer.loadImage(png, (err) => (err ? reject(err) : resolve(tracer.getPathTag())));
});

/** Split potrace's single path into sub-paths, back in source pixels and shifted by `dy`. */
function subpaths(pathTag, dy) {
  const d = pathTag.match(/ d="([^"]+)"/)[1];
  return d.split(/(?=M)/).map((sp) => {
    const nums = [];
    const text = sp.replace(/-?\d+(\.\d+)?/g, (n) => {
      const v = +n / SCALE + (nums.length % 2 ? dy : 0);
      nums.push(v);
      return +v.toFixed(2);
    });
    const xs = nums.filter((_, i) => i % 2 === 0), ys = nums.filter((_, i) => i % 2 === 1);
    return { d: text.trim(), box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
  });
}

const emblem = subpaths(await trace(await mask(0, EMBLEM_BOTTOM * SCALE)), 0);
const word = subpaths(await trace(await mask(EMBLEM_BOTTOM * SCALE, WORD_BOTTOM * SCALE)), EMBLEM_BOTTOM);

// ---- 3. Parts ----

const parts = { arc: [], stupa: [], star: [], letters: [], rules: [] };
for (const p of emblem) {
  const [x0, y0, x1, y1] = p.box;
  if (x0 > 290 && y1 < 150) parts.star.push(p);
  else if (x1 - x0 > 150 && x0 < 140) parts.arc.push(p);
  else parts.stupa.push(p);
}
for (const p of word) {
  const [x0, y0, x1, y1] = p.box;
  (x1 - x0 > 60 && y1 - y0 < 6 ? parts.rules : parts.letters).push(p);
}
for (const [name, list] of Object.entries(parts)) {
  if (!list.length) throw new Error(`no traced shapes for "${name}" — check the mask areas`);
}

const boxOf = (lists) => {
  const all = lists.flat().map((p) => p.box);
  return [Math.min(...all.map((b) => b[0])), Math.min(...all.map((b) => b[1])),
    Math.max(...all.map((b) => b[2])), Math.max(...all.map((b) => b[3]))];
};

// Champagne gold sampled from the source: the emblem runs light → deeper gold top to bottom,
// the wordmark stays pale. Each part's gradient spans that part (objectBoundingBox).
const GRADIENTS = '<linearGradient id="pointer-gold" x1="0" y1="0" x2="0" y2="1">'
  + '<stop offset="0" stop-color="#f6e7cb"/><stop offset=".6" stop-color="#e0b67f"/><stop offset="1" stop-color="#c2925a"/></linearGradient>'
  + '<linearGradient id="pointer-champagne" x1="0" y1="0" x2="0" y2="1">'
  + '<stop offset="0" stop-color="#f5e6cf"/><stop offset="1" stop-color="#d9b88d"/></linearGradient>';
const FILL = { arc: 'pointer-gold', stupa: 'pointer-gold', star: 'pointer-champagne', letters: 'pointer-champagne', rules: 'pointer-gold' };
const inside = (a, b) => a.box[0] >= b.box[0] && a.box[1] >= b.box[1] && a.box[2] <= b.box[2] && a.box[3] <= b.box[3];
/** Letters as one path each (a counter like the hole in O goes with its letter), left to right. */
function letterPaths(list) {
  const outers = list.filter((p) => !list.some((q) => q !== p && inside(p, q))).sort((a, b) => a.box[0] - b.box[0]);
  return outers.map((o) => [o, ...list.filter((p) => p !== o && inside(p, o))]);
}
const group = (id, list) => {
  const paths = id === 'letters' ? letterPaths(list) : [list];
  return `<g id="${id}" fill="url(#${FILL[id]})">${paths.map((ps) => `<path fill-rule="evenodd" d="${ps.map((p) => p.d).join(' ')}"/>`).join('')}</g>`;
};

function svg(names, { pad = 8, square = false, tagline = false, title = 'POINTER' } = {}) {
  let [x0, y0, x1, y1] = boxOf(names.map((n) => parts[n]));
  if (tagline) y1 += 30;
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  if (square) {
    const size = Math.max(x1 - x0, y1 - y0), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    [x0, y0, x1, y1] = [cx - size / 2, cy - size / 2, cx + size / 2, cy + size / 2];
  }
  const vb = [x0, y0, x1 - x0, y1 - y0].map((v) => +v.toFixed(1)).join(' ');
  const text = tagline
    ? `<text x="${((boxOf([parts.rules])[0] + boxOf([parts.rules])[2]) / 2).toFixed(1)}" y="${(boxOf([parts.rules])[3] + 24).toFixed(1)}" id="tagline" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-style="italic" font-size="17" letter-spacing=".5" fill="#e9d6b8">${TAGLINE}</text>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="${title}">`
    + `<title>${title}</title><defs>${GRADIENTS}</defs>`
    + `${names.map((n) => group(n, parts[n])).join('')}${text}</svg>\n`;
}

// ---- 4. Files ----

fs.mkdirSync(OUT, { recursive: true });
const write = (file, content) => {
  fs.writeFileSync(file, content);
  console.log(`ok ${rel(file)} (${formatBytes(sizeOf(file))})`);
};
const full = svg(['arc', 'stupa', 'star', 'letters', 'rules'], { tagline: true, title: `POINTER — ${TAGLINE}` });
const mark = svg(['arc', 'stupa', 'star'], { pad: 10, square: true });
write(path.join(OUT, 'pointer-logo.svg'), full);
write(path.join(OUT, 'pointer-mark.svg'), mark);
write(path.join(OUT, 'pointer-word.svg'), svg(['letters'], { pad: 1 })); // wordmark for the top bars

for (const size of [128, 256, 512]) {
  const file = path.join(OUT, `pointer-mark-${size}.webp`);
  await sharp(Buffer.from(mark), { density: 72 * (size / 120) }).resize(size, size).webp({ quality: 92, alphaQuality: 100 }).toFile(file);
  console.log(`ok ${rel(file)} (${formatBytes(sizeOf(file))})`);
}

// Icons: gold emblem on a dusk rounded square, so it reads on light and dark browser tabs.
async function icon(size, rounded) {
  const inner = Math.round(size * 0.96);
  const markPng = await sharp(Buffer.from(mark), { density: 72 * (inner / 100) }).resize(inner, inner).png().toBuffer();
  const r = rounded ? Math.round(size * 0.22) : 0;
  const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="${DUSK}"/></svg>`);
  return sharp(bg).composite([{ input: markPng, gravity: 'center' }]).png({ compressionLevel: 9 });
}
for (const [name, size, rounded] of [
  ['favicon-16.png', 16, true], ['favicon-32.png', 32, true], ['favicon-48.png', 48, true],
  ['apple-touch-icon.png', 180, false], ['icon-192.png', 192, false], ['icon-512.png', 512, false],
]) {
  const file = path.join(PUBLIC, name);
  await (await icon(size, rounded)).toFile(file);
  console.log(`ok ${rel(file)} (${formatBytes(sizeOf(file))})`);
}
console.log('parts:', Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, v.length])));
