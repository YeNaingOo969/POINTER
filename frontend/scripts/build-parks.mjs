// Park outlines for the people and dogs walking on the map (src/map/walkers.js).
//
//   node scripts/build-parks.mjs        (after node scripts/fetch-city.mjs)
//
// Input:  leisure=park / garden areas in assets/raw/osm/city/context/<tile>.json
// Output: public/data/parks.json — [{ name, ring: [[lng, lat], …], area }] (parks of 2,000 m²
//         or more, outlines simplified to ~3 m, coordinates rounded to ~1 m). Each park is kept
//         once, even when it reaches into several tiles.
// Data © OpenStreetMap contributors (ODbL).
import fs from 'node:fs';
import path from 'node:path';
import { RAW, PUBLIC, rel, formatBytes } from './lib.mjs';

const DIR = path.join(RAW, 'osm', 'city', 'context');
const MIN_AREA = 2000;

/** Area in m² and a ring with points closer than `tol` metres to the line dropped (Douglas–Peucker). */
function measure(ring) {
  const lat0 = ring[0][1];
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180), ky = 110574;
  const xy = ring.map(([lng, lat]) => [lng * kx, lat * ky]);
  let a = 0;
  for (let i = 0; i < xy.length; i++) {
    const [x1, y1] = xy[i], [x2, y2] = xy[(i + 1) % xy.length];
    a += x1 * y2 - x2 * y1;
  }
  return { area: Math.abs(a) / 2, xy };
}

function simplify(points, xy, tol) {
  if (points.length < 4) return points;
  const keep = new Array(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = xy[a], [bx, by] = xy[b];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    let far = -1, dist = tol;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((bx - ax) * (ay - xy[i][1]) - (ax - xy[i][0]) * (by - ay)) / len;
      if (d > dist) { dist = d; far = i; }
    }
    if (far > 0) { keep[far] = true; stack.push([a, far], [far, b]); }
  }
  return points.filter((_, i) => keep[i]);
}

const seen = new Set();
const parks = [];
for (const f of fs.readdirSync(DIR).filter((n) => n.endsWith('.json'))) {
  for (const el of JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')).elements) {
    const t = el.tags ?? {};
    if (el.type !== 'way' || !['park', 'garden'].includes(t.leisure) || !el.geometry || seen.has(el.id)) continue;
    seen.add(el.id);
    let ring = el.geometry.map((p) => [p.lon, p.lat]);
    if (ring.length > 1 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1]) ring.pop();
    if (ring.length < 3) continue;
    const { area, xy } = measure(ring);
    if (area < MIN_AREA) continue;
    ring = simplify(ring, xy, 3).map(([lng, lat]) => [+lng.toFixed(5), +lat.toFixed(5)]);
    parks.push({ name: t['name:en'] ?? t.name ?? '', ring, area: Math.round(area) });
  }
}
parks.sort((a, b) => b.area - a.area);
const out = path.join(PUBLIC, 'data', 'parks.json');
fs.writeFileSync(out, JSON.stringify(parks));
console.log(`${parks.length} parks → ${rel(out)} (${formatBytes(fs.statSync(out).size)})`);
