// Export the logo reveal as video for the presentation.
//
//   npm run dev                      (in another terminal; the capture page is served by Vite)
//   npm run export:reveal
//
// Opens docs/brand/reveal.html?capture in a headless browser (agent-browser CLI), seeks the
// Web Animations timeline frame by frame, screenshots each frame, then encodes with ffmpeg:
//   public/video/brand/logo-reveal.mp4   H.264, 1920x1080, 30 fps (slides, all players)
//   public/video/brand/logo-reveal.webm  VP9 (smaller, for the web)
//   public/video/brand/logo-reveal-poster.jpg  the final frame
// Frames go to assets/work/reveal-frames (git-ignored).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT, WORK, PUBLIC, rel, formatBytes, sizeOf, run, hasFlag } from './lib.mjs';

const URL = process.env.REVEAL_URL ?? 'http://localhost:5173/docs/brand/reveal.html?capture';
const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;
const REVEAL_MS = 3860; // keep in sync with TIMELINE.end in src/components/logo-reveal.js
const HOLD_MS = 1100;   // the finished logo stays on screen a little longer in the video
const FRAMES = path.join(WORK, 'reveal-frames');
const OUT = path.join(PUBLIC, 'video', 'brand');

// agent-browser keeps one browser session alive between calls, so each command is a quick
// separate process. (Its `batch` mode over stdin hung on Windows.) Call the native binary
// directly where we can, so no shell is needed and paths with spaces stay intact.
const AGENT_EXE = path.join(process.env.APPDATA ?? '', 'npm', 'node_modules', 'agent-browser', 'bin',
  'agent-browser-win32-x64.exe');
const useExe = process.platform === 'win32' && fs.existsSync(AGENT_EXE);

function agent(...args) {
  return new Promise((resolve, reject) => {
    const child = useExe
      ? spawn(AGENT_EXE, args, { windowsHide: true })
      : spawn('agent-browser', args.map((a) => JSON.stringify(a)), { shell: true, windowsHide: true });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('error', reject);
    // 'exit', not 'close': the first call starts a background browser daemon that inherits the
    // pipes, so they never close and 'close' would wait forever.
    child.on('exit', (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(`agent-browser ${args[0]}: ${out}`))));
  });
}

const total = Math.round(((REVEAL_MS + HOLD_MS) / 1000) * FPS);

if (!hasFlag('encode-only')) {
  fs.rmSync(FRAMES, { recursive: true, force: true });
  fs.mkdirSync(FRAMES, { recursive: true });
  await agent('open', URL);
  await agent('set', 'viewport', String(WIDTH), String(HEIGHT));
  await agent('wait', '3000');
  if ((await agent('eval', 'window.__revealReady === true')) !== 'true') {
    throw new Error('capture page not ready - is `npm run dev` running?');
  }
  console.log(`capturing ${total} frames from ${URL} ...`);
  for (let f = 0; f < total; f++) {
    const ms = Math.min(REVEAL_MS, (f / FPS) * 1000);
    await agent('eval', `window.__reveal.seek(${ms.toFixed(1)})`);
    await agent('screenshot', path.join(FRAMES, `f${String(f).padStart(4, '0')}.png`));
    if (f % 30 === 0) console.log(`  frame ${f}/${total}`);
  }
  await agent('close');
  const got = fs.readdirSync(FRAMES).filter((f) => f.endsWith('.png')).length;
  if (got !== total) throw new Error(`expected ${total} frames, got ${got}`);
  console.log(`ok ${got} frames in ${rel(FRAMES)}`);
}

fs.mkdirSync(OUT, { recursive: true });
const input = ['-y', '-framerate', String(FPS), '-i', path.join(FRAMES, 'f%04d.png')];
const scale = ['-vf', `scale=${WIDTH}:${HEIGHT}:flags=lanczos,format=yuv420p`];

const mp4 = path.join(OUT, 'logo-reveal.mp4');
await run('ffmpeg', [...input, ...scale, '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
  '-movflags', '+faststart', '-an', mp4]);
console.log(`ok ${rel(mp4)} (${formatBytes(sizeOf(mp4))})`);

const webm = path.join(OUT, 'logo-reveal.webm');
await run('ffmpeg', [...input, ...scale, '-c:v', 'libvpx-vp9', '-crf', '34', '-b:v', '0',
  '-row-mt', '1', '-an', webm]);
console.log(`ok ${rel(webm)} (${formatBytes(sizeOf(webm))})`);

const poster = path.join(OUT, 'logo-reveal-poster.jpg');
const last = path.join(FRAMES, `f${String(total - 1).padStart(4, '0')}.png`);
await run('ffmpeg', ['-y', '-i', last, '-q:v', '3', poster]);
console.log(`ok ${rel(poster)} (${formatBytes(sizeOf(poster))})`);
console.log(`done (${path.relative(ROOT, OUT)})`);
