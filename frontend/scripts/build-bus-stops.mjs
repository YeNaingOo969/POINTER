// Place a YBS shelter at every bus stop: on the kerb next to the nearest street, facing it.
//
//   node scripts/build-bus-stops.mjs
//
// Input:  assets/raw/osm/city/bus-stops.json (OSM highway=bus_stop nodes) and the roads in
//         assets/raw/osm/city/context/<tile>.json (node scripts/fetch-city.mjs)
// Output: public/data/bus-stops.json — [[lng, lat, heading], …]; heading = degrees clockwise from
//         north of the shelter's street side (src/map/bus-shelters.js turns the model by it).
// OSM puts many stops on the road's centre line, so a stop is moved sideways to the kerb (the side
// it already leans to, else the left), half the road width plus 2.5 m from the centre.
import fs from 'node:fs';
import path from 'node:path';
import { RAW, PUBLIC } from './lib.mjs';

const STEP = 0.04, LAT0 = 16.70, LNG0 = 96.05;
const HALF_WIDTH = { motorway: 12, trunk: 11, primary: 9, secondary: 7.5, tertiary: 6.5, unclassified: 5, residential: 4.5, living_street: 4, road: 5, service: 3 };
const stops = JSON.parse(fs.readFileSync(path.join(RAW, 'osm', 'city', 'bus-stops.json'), 'utf8')).elements;

const roadsByTile = new Map();
function roads(id) {
  if (!roadsByTile.has(id)) {
    const file = path.join(RAW, 'osm', 'city', 'context', `${id}.json`);
    const list = [];
    if (fs.existsSync(file)) {
      for (const el of JSON.parse(fs.readFileSync(file, 'utf8')).elements) {
        const hw = el.tags?.highway && HALF_WIDTH[el.tags.highway.replace('_link', '')];
        if (hw && el.geometry) list.push({ hw, pts: el.geometry.map((p) => [p.lon, p.lat]) });
      }
    }
    roadsByTile.set(id, list);
  }
  return roadsByTile.get(id);
}

const out = [];
let moved = 0;
for (const s of stops) {
  const kx = 111320 * Math.cos((s.lat * Math.PI) / 180), ky = 110574;
  const tile = `${(Math.floor((s.lat - LAT0) / STEP) * STEP + LAT0).toFixed(2)}_${(Math.floor((s.lon - LNG0) / STEP) * STEP + LNG0).toFixed(2)}`;
  let best = null;
  for (const r of roads(tile)) {
    for (let i = 1; i < r.pts.length; i++) {
      const ax = (r.pts[i - 1][0] - s.lon) * kx, ay = (r.pts[i - 1][1] - s.lat) * ky;
      const bx = (r.pts[i][0] - s.lon) * kx, by = (r.pts[i][1] - s.lat) * ky;
      const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1;
      const u = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L));
      const px = ax + u * dx, py = ay + u * dy;               // nearest point on the road (stop at 0,0)
      const d = Math.hypot(px, py);
      if (!best || d < best.d) best = { d, px, py, dx, dy, hw: r.hw };
    }
  }
  if (!best || best.d > 40) { out.push([s.lon, s.lat, 0]); continue; }
  const len = Math.hypot(best.dx, best.dy);
  const ux = best.dx / len, uy = best.dy / len;                // along the road
  let nx = -uy, ny = ux;                                        // left of the road direction
  if (best.d > 0.5 && (-best.px * nx + -best.py * ny) < 0) { nx = -nx; ny = -ny; } // the side the stop is on
  const off = best.hw + 2.5;
  const x = best.px + nx * off, y = best.py + ny * off;         // kerb position, metres from the stop
  if (Math.hypot(x, y) > 1) moved++;
  // the shelter's street side (model -Y) must point back at the road: direction (-nx, -ny)
  const heading = (Math.atan2(-nx, -ny) * 180) / Math.PI;      // clockwise from north
  out.push([+(s.lon + x / kx).toFixed(7), +(s.lat + y / ky).toFixed(7), Math.round((heading + 360) % 360)]);
}
fs.writeFileSync(path.join(PUBLIC, 'data', 'bus-stops.json'), JSON.stringify(out));
console.log(`bus stops: ${out.length}, moved to the kerb: ${moved}`);
