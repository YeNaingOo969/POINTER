// Download OpenStreetMap buildings for all of Yangon in tiles (Overpass API), for npm run build:city.
//
//   node scripts/fetch-city.mjs            fetch missing tiles (existing ones are kept)
//
// Tiles are 0.04° × 0.04° (~4.3 × 4.4 km) over 16.70–16.98 N, 96.05–96.33 E. Each building is kept in
// the one tile that holds its centre, so tiles never overlap. Also saves every landuse=industrial
// area (assets/raw/osm/city/industrial.json) so the generator can draw factories there, and per tile
// the land use, roads and open spaces (assets/raw/osm/city/context) that the filler buildings need.
// Data © OpenStreetMap contributors (ODbL). Waits between requests to be polite to the free server.
import fs from 'node:fs';
import path from 'node:path';
import { RAW } from './lib.mjs';

const DIR = path.join(RAW, 'osm', 'city', 'tiles');
const CONTEXT_DIR = path.join(RAW, 'osm', 'city', 'context');
const STEP = 0.04;
const LAT0 = 16.70, LAT1 = 16.98, LNG0 = 96.05, LNG1 = 96.33;
const UA = { 'User-Agent': 'school-map-project/1.0 (educational)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(DIR, { recursive: true });
fs.mkdirSync(CONTEXT_DIR, { recursive: true });

async function overpass(query) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    let status = 'network error';
    try {
      const res = await fetch(process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter', {
        method: 'POST', headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      });
      const text = await res.text();
      if (res.ok && text.trim().startsWith('{')) return JSON.parse(text);
      status = res.status;
    } catch { /* connection dropped: retry like a busy server */ }
    console.log(`  busy (${status}), retry ${attempt} in ${attempt * 15}s`);
    await sleep(attempt * 15000);
  }
  throw new Error('Overpass kept failing');
}

const industrial = path.join(RAW, 'osm', 'city', 'industrial.json');
if (!fs.existsSync(industrial)) {
  const data = await overpass(`[out:json][timeout:180];way["landuse"="industrial"](${LAT0},${LNG0},${LAT1},${LNG1});out tags geom;`);
  fs.writeFileSync(industrial, JSON.stringify(data));
  console.log('industrial areas:', data.elements.length);
  await sleep(5000);
}

// OVERPASS_URL picks another public server; REVERSE=1 walks the tiles backwards, so two runs on two
// servers can share the work (a tile that already exists is skipped).
const cells = [];
for (let lat = LAT0; lat < LAT1 - 1e-9; lat += STEP) for (let lng = LNG0; lng < LNG1 - 1e-9; lng += STEP) cells.push([lat, lng]);
if (process.env.REVERSE) cells.reverse();
let total = 0;
// Context for the filler buildings (scripts/city-filler.mjs): where people live or work, and what to keep
// clear (roads, rail, water, parks, schools, temples…). Big areas come back whole in every tile they touch.
const CONTEXT = `(
  way["landuse"~"^(residential|industrial|commercial|retail)$"](S);
  relation["landuse"~"^(residential|industrial|commercial|retail)$"](S);
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|road)(_link)?$"](S);
  way["railway"="rail"](S);
  way["natural"="water"](S);
  way["waterway"~"^(river|canal|stream|drain)$"](S);
  way["leisure"~"^(park|pitch|stadium|golf_course|playground|sports_centre)$"](S);
  way["landuse"~"^(cemetery|grass|recreation_ground|military|religious|farmland|meadow)$"](S);
  way["amenity"~"^(school|university|college|hospital|place_of_worship|monastery)$"](S);
);out tags geom;`;
for (const [lat, lng] of cells) {
  const id = `${lat.toFixed(2)}_${lng.toFixed(2)}`;
  const s = lat, w = lng, n = lat + STEP, e = lng + STEP;
  const file = path.join(DIR, `${id}.json`);
  if (fs.existsSync(file)) total += JSON.parse(fs.readFileSync(file, 'utf8')).elements.length;
  else {
    let data;
    try {
      data = await overpass(`[out:json][timeout:180];way["building"](${s},${w},${n},${e});out tags geom;`);
    } catch {
      console.log(`${id}: skipped for now (server busy) — run again to fetch it`);
      continue;
    }
    // Keep each building only in the tile that holds its centre.
    data.elements = data.elements.filter((el) => {
      const g = el.geometry ?? [];
      if (!g.length) return false;
      const cy = g.reduce((a, p) => a + p.lat, 0) / g.length;
      const cx = g.reduce((a, p) => a + p.lon, 0) / g.length;
      return cy >= s && cy < n && cx >= w && cx < e;
    });
    fs.writeFileSync(file, JSON.stringify(data));
    total += data.elements.length;
    console.log(`${id}: ${data.elements.length} buildings`);
    await sleep(4000);
  }
  const ctx = path.join(CONTEXT_DIR, `${id}.json`);
  if (fs.existsSync(ctx)) continue;
  try {
    const data = await overpass(`[out:json][timeout:180];${CONTEXT.replaceAll('(S)', `(${s},${w},${n},${e})`)}`);
    fs.writeFileSync(ctx, JSON.stringify(data));
    console.log(`${id}: ${data.elements.length} context features`);
  } catch {
    console.log(`${id}: context skipped for now (server busy) — run again to fetch it`);
  }
  await sleep(4000);
}
console.log('done, buildings in all tiles:', total);
