// Build the generated city: ordinary buildings from OpenStreetMap footprints plus filler buildings
// where OSM has none (scripts/city-filler.mjs), one model per tile.
//
//   node scripts/fetch-city.mjs     first: download the tiles (assets/raw/osm/city/tiles, .../context)
//   npm run build:city              build every tile that changed (or all with --force;
//                                   --blender also re-runs Blender for tiles whose work model is fresh)
//   npm run build:city -- 16.74_96.13   only the listed tiles
//
// Work:   assets/work/city/<tile>.glb + .png preview (Blender, scripts/blender/city/buildings.py)
// Output: public/models/city/<tile>.glb (Draco, no textures — the map shares six textures from
//         public/models/city/tex, see src/map/city-tiles.js) and public/models/city/tiles.json
// Blender runs one tile at a time (RAM).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, draco, prune, quantize, weld } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { ROOT, RAW, WORK, PUBLIC, rel, formatBytes, sizeOf } from './lib.mjs';
import { fillTile } from './city-filler.mjs';

const TILES = path.join(RAW, 'osm', 'city', 'tiles');
const OUT = path.join(PUBLIC, 'models', 'city');
const STEP = 0.04;
const BLENDER = process.env.BLENDER_PATH ?? 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe';
const run = (args) => new Promise((resolve, reject) => {
  const child = spawn(BLENDER, ['--background', '--factory-startup', '--python-exit-code', '1', ...args], { stdio: ['ignore', 'pipe', 'inherit'], windowsHide: true });
  child.stdout.on('data', (d) => { for (const line of String(d).split('\n')) if (/buildings:|Error/.test(line)) console.log('  ' + line.trim()); });
  child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`Blender exited with ${code}`))));
});

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.encoder': await draco3d.createEncoderModule(),
  'draco3d.decoder': await draco3d.createDecoderModule(),
});
const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.filter((a) => !a.startsWith('--'));
fs.mkdirSync(OUT, { recursive: true });
const prevFile = path.join(OUT, 'tiles.json');
const prevManifest = fs.existsSync(prevFile) ? JSON.parse(fs.readFileSync(prevFile, 'utf8')) : [];

const manifest = [];
const generator = path.join(ROOT, 'scripts', 'blender', 'city', 'buildings.py');
const fillerScript = path.join(ROOT, 'scripts', 'city-filler.mjs');
const mtime = (f) => (fs.existsSync(f) ? fs.statSync(f).mtimeMs : 0);
fs.mkdirSync(path.join(WORK, 'city'), { recursive: true });
for (const file of fs.readdirSync(TILES).filter((f) => f.endsWith('.json')).sort()) {
  const id = file.replace('.json', '');
  const [lat, lng] = id.split('_').map(Number);
  const src = path.join(TILES, file);
  const context = path.join(RAW, 'osm', 'city', 'context', file);
  // Inputs that change this tile: the footprints, the land use/roads (filler) and both generators.
  const inputsTime = Math.max(mtime(src), mtime(context), mtime(fillerScript), mtime(generator), mtime(path.join(RAW, 'osm', 'city', 'poi.json')),
    mtime(path.join(ROOT, 'src', 'map', 'config.js'))); // landmark clear radii
  const out = path.join(OUT, `${id}.glb`);
  const wanted = (!only.length || only.includes(id)) && (force || mtime(out) <= inputsTime);
  const mapped = JSON.parse(fs.readFileSync(src, 'utf8')).elements;
  const fill = wanted || !fs.existsSync(out) ? fillTile(id) : null;
  const previous = prevManifest.find((t) => t.id === id);
  const fillCount = fill ? fill.length : previous?.filler ?? 0;
  if (!mapped.length && !fillCount) continue;
  const tile = { id, lng: +(lng + STEP / 2).toFixed(4), lat: +(lat + STEP / 2).toFixed(4), file: `/models/city/${id}.glb`, buildings: mapped.length, filler: fillCount };
  manifest.push(tile);
  if (!wanted && fs.existsSync(out)) continue;
  console.log(`${id}: ${mapped.length} footprints + ${fillCount} filler`);
  const work = path.join(WORK, 'city', `${id}.glb`);
  // Blender is the slow part: reuse its output unless an input changed (--blender forces it).
  if (mtime(work) <= inputsTime || args.includes('--blender')) {
    const input = path.join(WORK, 'city', `${id}.input.json`);
    fs.writeFileSync(input, JSON.stringify({ elements: mapped.concat(fill ?? []) }));
    await run(['--python', generator, '--',
      '--data', input, '--kind', 'auto', '--industrial', path.join(RAW, 'osm', 'city', 'industrial.json'),
      '--poi', path.join(RAW, 'osm', 'city', 'poi.json'),
      '--origin', `${tile.lng},${tile.lat}`, '--out', work]);
  }
  const doc = await io.read(work);
  // Textures are shared on the map: drop them from each tile. The map finds its shared material by
  // name and needs the UVs, so keep both (prune would drop UVs no texture uses; dedup would merge
  // the now-identical materials into one).
  for (const m of doc.getRoot().listMaterials()) m.setBaseColorTexture(null);
  await doc.transform(prune({ keepAttributes: true }), weld(), dedup({ keepUniqueNames: true }), quantize(), draco());
  await io.write(out, doc);
  console.log(`  ok ${rel(out)} (${formatBytes(sizeOf(out))})`);
}
fs.writeFileSync(path.join(OUT, 'tiles.json'), JSON.stringify(manifest));
console.log(`tiles.json: ${manifest.length} tiles, ${manifest.reduce((a, t) => a + t.buildings, 0)} mapped + ${manifest.reduce((a, t) => a + t.filler, 0)} filler buildings`);
