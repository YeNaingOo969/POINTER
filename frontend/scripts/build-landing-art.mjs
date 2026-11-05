// Landing illustrations: picked art → 4K → responsive WebP.
//
//   npm run build:landing-art            (add --force to redo the upscales)
//
// Input:  assets/raw/images/landing-art/<name>.jpg   picked originals (1920 px, never modified)
// Work:   assets/work/landing-art/<name>-x2.png       2× upscale by Upscayl (cached, git-ignored)
// Output: public/images/landing/<name>-<width>.webp  e.g. 1280 / 1920 / 3840 for full-screen art
//
// Upscayl (installed with winget) runs its digital-art model on the GPU (Vulkan, works on the
// Radeon 610M). One image at a time; each takes about 1–2 minutes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { RAW, WORK, PUBLIC, FORCE, isUpToDate, run, rel, sizeOf, formatBytes } from './lib.mjs';

const SRC = path.join(RAW, 'images', 'landing-art');
const CACHE = path.join(WORK, 'landing-art');
const OUT = path.join(PUBLIC, 'images', 'landing');
const UPSCAYL = 'C:\\Program Files\\Upscayl\\resources';

const FULL = { size: [3840, 2160], widths: [1280, 1920, 3840] }; // full-screen backgrounds
const PANEL = { size: [3240, 2160], widths: [800, 1600, 3240] }; // 3:2 panels
// blur: small areas with unwanted lettering in the art (x, y, w, h in source pixels).
const ART = [
  { name: 'hero-river', ...FULL },
  { name: 'downtown', ...FULL },
  { name: 'route-bridge', ...PANEL },
  { name: 'shwedagon-dusk', ...PANEL },
  { name: 'teashop', ...FULL, blur: [[1650, 250, 270, 240]] },
  { name: 'aerial-city', ...FULL },
];

async function upscale(src, dest, blur = []) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'art-'));
  try {
    let input = src;
    if (blur.length) {
      // Soften fake lettering before upscaling, so the upscaler doesn't sharpen it back.
      input = path.join(tmp, 'clean.png');
      const patches = await Promise.all(blur.map(async ([left, top, width, height]) => ({
        input: await sharp(src).extract({ left, top, width, height }).blur(9).toBuffer(), left, top,
      })));
      await sharp(src).composite(patches).png().toFile(input);
    }
    await run(path.join(UPSCAYL, 'bin', 'upscayl-bin.exe'), [
      '-i', input, '-o', dest, '-s', '2', '-m', path.join(UPSCAYL, 'models'), '-n', 'digital-art-4x', '-f', 'png',
    ]);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

fs.mkdirSync(CACHE, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
for (const art of ART) {
  const src = path.join(SRC, `${art.name}.jpg`);
  const big = path.join(CACHE, `${art.name}-x2.png`);
  if (FORCE || !isUpToDate(src, [big])) {
    console.log(`… upscaling ${art.name}`);
    await upscale(src, big, art.blur);
  }
  const [w, h] = art.size;
  const master = await sharp(big).resize(w, h, { fit: 'cover', position: 'centre' }).toBuffer();
  const sizes = [];
  for (const width of art.widths) {
    const file = path.join(OUT, `${art.name}-${width}.webp`);
    await sharp(master).resize({ width }).webp({ quality: width > 2000 ? 70 : 76 }).toFile(file);
    sizes.push(`${width} ${formatBytes(sizeOf(file))}`);
  }
  console.log(`ok ${art.name}: ${sizes.join(', ')}`);
}
console.log(`done → ${rel(OUT)}`);
