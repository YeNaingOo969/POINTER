// Pull the OSM footprints of the detailed places (scripts/blender/landmarks/places.py) out of the city
// tiles into one small file, so the Blender script doesn't parse 38 MB of tiles for every build.
//
//   node scripts/extract-places.mjs      (after node scripts/fetch-city.mjs)
//
// Output: assets/raw/osm/landmarks-places.json — { "<way id>": { tags, ring: [[lng, lat], …] } }
// Data © OpenStreetMap contributors (ODbL).
import fs from 'node:fs';
import path from 'node:path';
import { RAW } from './lib.mjs';

// Way ids used in places.py (keep in sync).
const WAYS = [
  596747619,                                   // Ocean Supercenter, Hlaing Tharyar
  374512164,                                   // Sedona Yangon
  793349746, 793349747, 793349748, 922255284,  // Times City towers and podium
  15059554,                                    // Thuwunna Stadium
  1355408858,                                  // Junction 8
  374912639, 235380314,                        // Dagon Center I and II
  1514269235,                                  // Hledan Center
  222162072,                                   // Taw Win Centre
  260947691,                                   // Junction Centre Maw Tin
  132021404, 132003321, 1557971575,            // Kandawgyi Palace Hotel (three joined wings)
  102685394,                                   // Yangon Central Railway Station
  216882182,                                   // Inya Lake Hotel
  482554981,                                   // Yangon General Hospital, main building
  613396987,                                   // Bogyoke Aung San Stadium
  400578781,                                   // Capital Hypermarket (Dawbon)
];

const want = new Set(WAYS);
const out = {};
for (const dir of ['tiles', 'context']) {
  for (const f of fs.readdirSync(path.join(RAW, 'osm', 'city', dir))) {
    for (const el of JSON.parse(fs.readFileSync(path.join(RAW, 'osm', 'city', dir, f), 'utf8')).elements) {
      if (el.type === 'way' && want.has(el.id) && el.geometry && !out[el.id]) {
        out[el.id] = { tags: el.tags ?? {}, ring: el.geometry.map((p) => [p.lon, p.lat]) };
      }
    }
  }
}
const missing = WAYS.filter((id) => !out[id]);
fs.writeFileSync(path.join(RAW, 'osm', 'landmarks-places.json'), JSON.stringify(out, null, 1));
console.log(`places: ${Object.keys(out).length} footprints${missing.length ? `, missing ${missing.join(', ')}` : ''}`);
for (const [id, { tags }] of Object.entries(out)) console.log(id, tags['name:en'] ?? tags.name ?? '', tags['building:levels'] ?? '', tags.height ?? '');
