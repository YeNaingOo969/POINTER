// Removes a green-screen background from images and video clips (avatars, props).
// assets/raw/greenscreen/<name>.{png,jpg,webp}  → public/keyed/<name>.png + .webp
// assets/raw/greenscreen/<name>.{mp4,mov,webm}  → public/keyed/<name>.webm (VP9 alpha, Chrome/Firefox/Edge)
//                                                 + <name>.webp (animated, alpha, also Safari)
//                                                 + <name>-poster.png
// Flags: --width <px>      output width (default 512; never upscales)
//        --fps <n>         video frame rate (default 24)
//        --pingpong        play forward then backward, for a seamless loop from a non-looping clip
//        --similarity <n>  chromakey tolerance 0.01–0.4 (default 0.15; raise if green remains)
//        --force
// Generate the source on a flat pure green background and avoid green clothes/props — they get keyed out.
// Objects that must stay green (leaves) can be generated on pure blue (#0000FF) instead; the screen colour
// is read from the corners, so both work without a flag.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { RAW, PUBLIC, argv, hasFlag, listFiles, noFiles, mirrorDir, isUpToDate, eachFile, run, rel, sizeOf, formatBytes } from './lib.mjs';

const SRC = path.join(RAW, 'greenscreen');
const DEST = path.join(PUBLIC, 'keyed');
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp'];
const VIDEO_EXTS = ['.mp4', '.mov', '.webm', '.m4v'];

const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? Number(argv[i + 1]) : fallback;
};
const WIDTH = opt('width', 512);
const FPS = opt('fps', 24);
const SIMILARITY = opt('similarity', 0.15);
const PINGPONG = hasFlag('pingpong');

/** Average colour of the four corners — the screen colour the model actually painted (green or blue). */
async function keyColour(imageFile) {
  const { data, info } = await sharp(imageFile).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const s = 8;
  const pts = [[s, s], [info.width - s, s], [s, info.height - s], [info.width - s, info.height - s]];
  const sum = [0, 0, 0];
  for (const [x, y] of pts) for (let c = 0; c < 3; c++) sum[c] += data[(y * info.width + x) * 3 + c];
  const [r, g, b] = sum.map((v) => Math.round(v / pts.length));
  const screen = g > r + 60 && g > b + 60 ? 'green' : b > r + 60 && b > g + 60 ? 'blue' : null;
  if (!screen) throw new Error(`ထောင့်တွေက အစိမ်း/အပြာ မဟုတ်ပါ (rgb ${r},${g},${b}) — green (သို့) blue screen နောက်ခံ လိုပါတယ်`);
  return { screen, hex: `0x${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}` };
}

// chromakey makes the screen transparent; geq then clamps the screen channel to the max of the
// other two — the classic spill limiter. ffmpeg's despill filter shifted skin to red or jeans to purple.
const DESPILL = {
  green: `geq=r='r(X,Y)':g='min(g(X,Y),max(r(X,Y),b(X,Y)))':b='b(X,Y)':a='alpha(X,Y)'`,
  blue: `geq=r='r(X,Y)':g='g(X,Y)':b='min(b(X,Y),max(r(X,Y),g(X,Y)))':a='alpha(X,Y)'`,
};
const keyFilter = ({ screen, hex }) => `format=rgba,chromakey=${hex}:${SIMILARITY}:0.05,${DESPILL[screen]}`;
const scale = `scale='min(${WIDTH},iw)':-2:flags=lanczos`;

async function keyImage(file, outDir, name) {
  const png = path.join(outDir, `${name}.png`);
  const webp = path.join(outDir, `${name}.webp`);
  if (isUpToDate(file, [png, webp])) return console.log(`· ${rel(file)} (up to date)`);
  const colour = await keyColour(file);
  await run('ffmpeg', ['-hide_banner', '-y', '-i', file, '-vf', `${keyFilter(colour)},${scale}`, png]);
  await sharp(png).webp({ quality: 85, alphaQuality: 90 }).toFile(webp);
  console.log(`✓ ${rel(file)} → ${rel(png)} (${formatBytes(sizeOf(png))}), .webp ${formatBytes(sizeOf(webp))}`);
}

async function keyVideo(file, outDir, name) {
  const webm = path.join(outDir, `${name}.webm`);
  const webp = path.join(outDir, `${name}.webp`);
  const poster = path.join(outDir, `${name}-poster.png`);
  if (isUpToDate(file, [webm, webp, poster])) return console.log(`· ${rel(file)} (up to date)`);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'keygreen-'));
  try {
    const first = path.join(tmp, 'first.png');
    await run('ffmpeg', ['-hide_banner', '-y', '-i', file, '-frames:v', '1', first]);
    const colour = await keyColour(first);

    // Key once into a lossless intermediate, then encode both deliverables from it.
    const loop = PINGPONG ? ',split[f][r];[r]reverse[rv];[f][rv]concat=n=2:v=1:a=0' : '';
    const master = path.join(tmp, 'master.mov');
    await run('ffmpeg', ['-hide_banner', '-y', '-i', file, '-an',
      '-filter_complex', `[0:v]fps=${FPS},${scale},${keyFilter(colour)}${loop}`,
      '-c:v', 'qtrle', master]);

    await run('ffmpeg', ['-hide_banner', '-y', '-i', master,
      '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-auto-alt-ref', '0', '-crf', '32', '-b:v', '0',
      '-row-mt', '1', '-deadline', 'good', '-cpu-used', '3', webm]);
    // libwebp (not libwebp_anim): with an RGBA master, libwebp_anim collapsed the clip into one frame.
    await run('ffmpeg', ['-hide_banner', '-y', '-i', master,
      '-c:v', 'libwebp', '-lossless', '0', '-quality', '75', '-loop', '0', webp]);
    await run('ffmpeg', ['-hide_banner', '-y', '-i', master, '-frames:v', '1', poster]);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`✓ ${rel(file)} → .webm ${formatBytes(sizeOf(webm))}, .webp ${formatBytes(sizeOf(webp))}, poster`);
}

const files = listFiles(SRC, [...IMAGE_EXTS, ...VIDEO_EXTS]);
if (!files.length) {
  noFiles(SRC, [...IMAGE_EXTS, ...VIDEO_EXTS]);
} else {
  await eachFile(files, async (file) => {
    const outDir = mirrorDir(file, SRC, DEST);
    const name = path.parse(file).name;
    if (IMAGE_EXTS.includes(path.extname(file).toLowerCase())) await keyImage(file, outDir, name);
    else await keyVideo(file, outDir, name);
  });
}
