// Landing section 3 fly-in: turn the Blender frames into the WebP sequence src/lib/frame-scrub.js plays.
//
//   blender … --python scripts/blender/film/flyin.py      first: renders assets/work/flyin/0001.png …
//   npm run build:flyin
//
// Output: public/video/scrub/flyin/{1280,640}/0001.webp … + poster.webp (the last frame, used with
// reduced motion) + manifest.json.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { WORK, PUBLIC, rel, formatBytes } from './lib.mjs';

const SRC = path.join(WORK, 'flyin');
const OUT = path.join(PUBLIC, 'video', 'scrub', 'flyin');
// Busy city detail compresses poorly, so the budget comes from fewer frames and a 1024 px top size:
// 72 of the 120 rendered frames (still smooth when scrubbed over 2½ screens) ≈ 5 MB + 2.6 MB.
const WIDTHS = [1024, 640];
const QUALITY = 55;
const KEEP = 72;

const rendered = fs.readdirSync(SRC).filter((f) => /^\d{4}\.png$/.test(f)).sort();
// evenly spaced, always keeping the first and the last frame
const frames = rendered.length <= KEEP ? rendered
  : Array.from({ length: KEEP }, (_, i) => rendered[Math.round((i * (rendered.length - 1)) / (KEEP - 1))]);
if (!rendered.length) {
  console.error(`No frames in ${rel(SRC)} — render them with scripts/blender/film/flyin.py first.`);
  process.exit(1);
}
fs.rmSync(OUT, { recursive: true, force: true });
let bytes = 0;
const meta = await sharp(path.join(SRC, frames[0])).metadata();
for (const w of WIDTHS) {
  const dir = path.join(OUT, String(w));
  fs.mkdirSync(dir, { recursive: true });
  for (const [i, f] of frames.entries()) {
    const out = path.join(dir, `${String(i + 1).padStart(4, '0')}.webp`);
    await sharp(path.join(SRC, f)).resize({ width: w }).webp({ quality: QUALITY, effort: 5 }).toFile(out);
    bytes += fs.statSync(out).size;
  }
}
await sharp(path.join(SRC, frames.at(-1))).resize({ width: WIDTHS[0] }).webp({ quality: 70 }).toFile(path.join(OUT, 'poster.webp'));
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({
  frames: frames.length, width: Math.min(meta.width, WIDTHS[0]), height: Math.round((meta.height * Math.min(meta.width, WIDTHS[0])) / meta.width),
  sizes: WIDTHS, pattern: '{size}/{frame}.webp', pad: 4,
}, null, 2));
console.log(`${frames.length} frames → ${rel(OUT)} (${formatBytes(bytes)} for both sizes)`);
