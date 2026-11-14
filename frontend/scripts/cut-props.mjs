// Cuts a keyed sheet of props (several objects on transparency, from `npm run key:green`) into one
// trimmed WebP per object.
//
// Usage:
//   npm run cut:props -- public/keyed/props-c.png [--names key,fan,star] [--width 320] [--out <dir>]
//
// Objects are found as separate islands of opaque pixels and numbered left to right, top to bottom
// (row by row). --names renames them in that order; without it they are saved as <sheet>-1.webp…
// Tiny islands (stray specks of spill) are skipped. Output goes to public/images/landing/props.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { ROOT, rel, formatBytes } from './lib.mjs';

const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    names: { type: 'string' },
    width: { type: 'string', default: '320' },
    out: { type: 'string', default: path.join(ROOT, 'public', 'images', 'landing', 'props') },
  },
});
const sheet = positionals[0];
if (!sheet || !fs.existsSync(sheet)) {
  console.error('Usage: npm run cut:props -- <keyed sheet .png> [--names a,b,c] [--width 320]');
  process.exit(1);
}
const WIDTH = Number(opt.width);
const names = opt.names ? opt.names.split(',').map((n) => n.trim()) : [];

// Work on a small alpha mask (1/4 size) — enough to separate objects, fast on any machine.
const STEP = 4;
const { data: alpha, info } = await sharp(sheet).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
const mw = Math.ceil(info.width / STEP);
const mh = Math.ceil(info.height / STEP);
const mask = new Uint8Array(mw * mh);
for (let y = 0; y < info.height; y += STEP) {
  for (let x = 0; x < info.width; x += STEP) if (alpha[y * info.width + x] > 40) mask[(y / STEP) * mw + x / STEP] = 1;
}

// Flood fill each island (8-connected) and keep its bounding box.
const seen = new Uint8Array(mw * mh);
const boxes = [];
const stack = [];
for (let i = 0; i < mask.length; i++) {
  if (!mask[i] || seen[i]) continue;
  let x0 = mw, y0 = mh, x1 = 0, y1 = 0, count = 0;
  stack.push(i);
  seen[i] = 1;
  while (stack.length) {
    const j = stack.pop();
    const x = j % mw, y = (j - x) / mw;
    count++;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= mw || ny >= mh) continue;
        const k = ny * mw + nx;
        if (mask[k] && !seen[k]) { seen[k] = 1; stack.push(k); }
      }
    }
  }
  if (count > 150) boxes.push({ x0, y0, x1, y1 });
}

// Reading order: group into rows by vertical centre, then left to right.
boxes.sort((a, b) => a.y0 + a.y1 - (b.y0 + b.y1));
const rows = [];
for (const box of boxes) {
  const cy = (box.y0 + box.y1) / 2;
  const row = rows.find((r) => Math.abs(r.cy - cy) < mh * 0.15);
  if (row) row.boxes.push(box); else rows.push({ cy, boxes: [box] });
}
const ordered = rows.flatMap((r) => r.boxes.sort((a, b) => a.x0 - b.x0));

fs.mkdirSync(opt.out, { recursive: true });
const base = path.parse(sheet).name;
const PAD = 6;
for (const [n, b] of ordered.entries()) {
  const left = Math.max(0, b.x0 * STEP - PAD);
  const top = Math.max(0, b.y0 * STEP - PAD);
  const width = Math.min(info.width - left, (b.x1 - b.x0 + 1) * STEP + PAD * 2);
  const height = Math.min(info.height - top, (b.y1 - b.y0 + 1) * STEP + PAD * 2);
  const file = path.join(opt.out, `${names[n] ?? `${base}-${n + 1}`}.webp`);
  // Trim again at full resolution so the edges sit tight on the object.
  const piece = await sharp(sheet).extract({ left, top, width, height }).png().toBuffer();
  await sharp(piece).trim({ threshold: 1 })
    .resize({ width: WIDTH, withoutEnlargement: true })
    .webp({ quality: 85, alphaQuality: 90 })
    .toFile(file);
  console.log(`✓ ${n + 1}: ${width}×${height} → ${rel(file)} (${formatBytes(fs.statSync(file).size)})`);
}
if (names.length && names.length !== ordered.length) {
  console.warn(`! found ${ordered.length} objects but got ${names.length} names — check the sheet`);
}
