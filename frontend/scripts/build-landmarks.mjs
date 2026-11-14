// Prepare the hero landmark models for the map.
//
//   npm run build:landmarks              all
//   npm run build:landmarks -- sule      only the listed ids
//
// Input:  assets/raw/models/<id>/*.glb   detailed downloads (never modified), simplified by
//         scripts/blender/landmark.py — or no download: built low-poly from scratch by
//         scripts/blender/landmarks/<id>.py (real footprints/heights, see each script)
// Work:   assets/work/landmarks/<id>.glb  Blender output
//         assets/work/landmarks/<id>.png  preview render, to check by eye
// Output: public/models/landmarks/<id>.glb  quantized, ready for the map
//
// Blender runs one model at a time (it needs a lot of RAM for million-triangle files).
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, draco, prune, quantize, weld } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { ROOT, RAW, WORK, PUBLIC, rel, formatBytes, sizeOf } from './lib.mjs';

// One entry per landmark. Downloads: `src`, real `height` in metres, triangle `target`, and `drop`
// for materials whose parts are stray props. Built ones: `built: true` runs landmarks/<id>.py,
// `built: 'modern'` runs landmarks/modern.py --id <id> (towers, malls, hotels from one table).
const LANDMARKS = [
  { id: 'shwedagon', built: true }, // hill, terrace, stairways and stupa (landmarks/shwedagon.py)
  { id: 'sule', built: true },
  { id: 'botataung', built: true },
  { id: 'thanlyin_bridge', built: true },
  { id: 'flyovers', built: true }, // every OSM road bridge in the city, one model
  { id: 'dala_bridge', built: true },
  { id: 'city_hall', built: true },
  { id: 'karaweik', built: true },
  { id: 'bogyoke_market', built: true },
  { id: 'strand_hotel', built: true },
  { id: 'secretariat', built: true },
  ...['m_tower', 'sakura_tower', 'junction_city', 'junction_square', 'myanmar_plaza', 'melia', 'lotte',
    'diamond_inya', 'novotel_max', 'chatrium', 'sule_shangri_la', 'airport'].map((id) => ({ id, built: 'modern' })),
];

const WORK_DIR = path.join(WORK, 'landmarks');
const OUT = path.join(PUBLIC, 'models', 'landmarks');

function findBlender() {
  if (process.env.BLENDER_PATH && fs.existsSync(process.env.BLENDER_PATH)) return process.env.BLENDER_PATH;
  if (!spawnSync('blender', ['--version'], { stdio: 'ignore', windowsHide: true }).error) return 'blender';
  const base = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Blender Foundation');
  if (!fs.existsSync(base)) return null;
  return fs.readdirSync(base)
    .map((d) => path.join(base, d, 'blender.exe'))
    .filter((p) => fs.existsSync(p))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0] ?? null;
}

function runBlender(blender, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(blender, ['--background', '--factory-startup', '--python-exit-code', '1', ...args], {
      stdio: 'inherit', cwd: ROOT, windowsHide: true,
    });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`Blender exited with ${code}`))));
  });
}

const blender = findBlender();
if (!blender) {
  console.error('blender.exe not found. Set BLENDER_PATH.');
  process.exit(1);
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.encoder': await draco3d.createEncoderModule(),
  'draco3d.decoder': await draco3d.createDecoderModule(),
});
fs.mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(2);

for (const lm of LANDMARKS.filter((l) => !only.length || only.includes(l.id))) {
  const work = path.join(WORK_DIR, `${lm.id}.glb`);
  const outputs = ['--out', work, '--preview', path.join(WORK_DIR, `${lm.id}.png`)];
  if (lm.built === 'modern') {
    await runBlender(blender, ['--python', path.join(ROOT, 'scripts', 'blender', 'landmarks', 'modern.py'), '--', '--id', lm.id, ...outputs]);
  } else if (lm.built) {
    await runBlender(blender, ['--python', path.join(ROOT, 'scripts', 'blender', 'landmarks', `${lm.id}.py`), '--', ...outputs]);
  } else {
    await runBlender(blender, [
      '--python', path.join(ROOT, 'scripts', 'blender', 'landmark.py'), '--',
      path.join(RAW, 'models', lm.src), ...outputs,
      '--target', String(lm.target), '--height', String(lm.height),
      ...(lm.drop ?? []).flatMap((m) => ['--drop', m]),
    ]);
  }

  const doc = await io.read(work);
  await doc.transform(weld(), dedup(), prune(), quantize(), draco()); // Draco: ~5-10x smaller downloads
  const out = path.join(OUT, `${lm.id}.glb`);
  await io.write(out, doc);
  console.log(`ok ${rel(out)} (${formatBytes(sizeOf(out))})`);
}
