// Prepare the Kenney model kit for the map: pastel colours, textures embedded as WebP.
//
//   npm run build:models
//
// Input:  assets/raw/models/kit/{commercial,suburban,nature}/*.glb  (never modified)
//         Kenney models share one palette texture per kit (Textures/colormap.png), or use
//         plain material colours (nature kit).
// Output: public/models/kit/<kit>-<name>.glb
//         public/models/kit/manifest.json   footprint/height of every model, for placement
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds, prune, dedup } from '@gltf-transform/functions';
import { RAW, PUBLIC, rel, formatBytes, sizeOf } from './lib.mjs';

const SRC = path.join(RAW, 'models', 'kit');
const OUT = path.join(PUBLIC, 'models', 'kit');

// What each kit becomes on the map.
const KIND = { commercial: 'building', suburban: 'house', nature: 'tree' };

// ---- Pastel palette transform ----

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255));
}

/**
 * Map one Kenney colour to our pastel palette: lighter and softer overall; green roofs become
 * soft terracotta (Yangon roofs), blue glass becomes lavender, dark greys become warm.
 */
function pastel(r, g, b, kind) {
  let [h, s, l] = rgbToHsl(r, g, b);
  if (kind === 'tree') {
    // Keep trees green, just softer and lighter so they sit with the pastel parks.
    return hslToRgb(h, s * 0.7, 0.42 + l * 0.45);
  }
  if (s > 0.25 && h >= 90 && h <= 175) { h = 12; s = 0.4; l = Math.max(0.7, 0.56 + l * 0.32); }
  else if (s > 0.2 && h >= 190 && h <= 250) { h = 262; s *= 0.4; l = 0.7 + l * 0.2; }
  else if (l < 0.3) { h = 22; s = 0.2; l = 0.56 + l * 0.35; }
  // Walls go almost white: the map multiplies each building by a pastel tint (BUILDING_TINTS in
  // src/map/style.js), and a white wall shows that tint clean instead of muddy.
  else { s *= 0.2; l = 0.82 + l * 0.16; }
  return hslToRgb(h, s, l);
}

/** Recolour a palette texture (PNG buffer) into a pastel WebP. */
async function pastelTexture(png, kind) {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 3) {
    const [r, g, b] = pastel(data[i], data[i + 1], data[i + 2], kind);
    data[i] = r; data[i + 1] = g; data[i + 2] = b;
  }
  return sharp(data, { raw: info }).webp({ lossless: true }).toBuffer();
}

// ---- Build ----

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
fs.mkdirSync(OUT, { recursive: true });
const manifest = { models: [] };

for (const kit of fs.readdirSync(SRC)) {
  const dir = path.join(SRC, kit);
  if (!fs.statSync(dir).isDirectory()) continue;
  const kind = KIND[kit] ?? 'building';
  const colormap = path.join(dir, 'Textures', 'colormap.png');
  const pastelMap = fs.existsSync(colormap) ? await pastelTexture(fs.readFileSync(colormap), kind) : null;

  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.glb')).sort()) {
    const doc = await io.read(path.join(dir, file)); // also loads Textures/colormap.png
    const root = doc.getRoot();

    for (const texture of root.listTextures()) {
      if (pastelMap) texture.setImage(pastelMap).setMimeType('image/webp').setURI('');
    }
    for (const material of root.listMaterials()) {
      const [r, g, b, a] = material.getBaseColorFactor();
      if (!material.getBaseColorTexture() && (r !== 1 || g !== 1 || b !== 1)) {
        const [pr, pg, pb] = pastel(r * 255, g * 255, b * 255, kind);
        material.setBaseColorFactor([pr / 255, pg / 255, pb / 255, a]);
      }
      material.setRoughnessFactor(0.9).setMetallicFactor(0);
    }
    if (pastelMap) doc.createExtension(ALL_EXTENSIONS.find((e) => e.EXTENSION_NAME === 'EXT_texture_webp')).setRequired(true);
    await doc.transform(dedup(), prune());

    const bounds = getBounds(root.listScenes()[0]);
    const size = bounds.max.map((v, i) => +(v - bounds.min[i]).toFixed(3));
    const id = `${kit}-${path.basename(file, '.glb')}`;
    const out = path.join(OUT, `${id}.glb`);
    await io.write(out, doc);
    manifest.models.push({ id, kind, file: `${id}.glb`, size, min: bounds.min.map((v) => +v.toFixed(3)) });
    console.log(`ok ${rel(out)} (${formatBytes(sizeOf(out))}, ${size.join(' x ')})`);
  }
}

fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`ok ${rel(path.join(OUT, 'manifest.json'))} (${manifest.models.length} models)`);
