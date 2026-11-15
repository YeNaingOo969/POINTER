// Filler buildings for the generated city: OpenStreetMap is missing the footprints of many Yangon
// neighbourhoods, so where land use says people live or work but no buildings are mapped, line the
// streets with plausible lots — houses and walk-ups in residential areas, shophouses in commercial
// ones, sheds in industrial zones. Used by build-city.mjs; the result looks like OSM buildings
// (tags.source = "filler") so the Blender generator treats both the same way.
//
//   node scripts/city-filler.mjs 16.86_96.05     print the count for one tile (debug)
//
// Input:  assets/raw/osm/city/tiles/<id>.json (mapped buildings), .../context/<id>.json (fetch-city.mjs)
// Rules:  lots face the nearest street, set back from it by the road's half width; never on roads,
//         rail, water, parks, schools, temples, cemeteries, landmark grounds or mapped buildings.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RAW, ROOT } from './lib.mjs';

const STEP = 0.04;
const MAX_PER_TILE = 7000;             // 610M budget: ~12 triangles each; extra lots are thinned evenly
const SULE = [96.158764, 16.774401];
const DOWNTOWN = [96.138, 16.763, 96.185, 16.792];   // same box as scripts/blender/city/buildings.py
const HALF_WIDTH = {                   // metres from the centre line to the kerb
  motorway: 12, trunk: 11, primary: 9, secondary: 7.5, tertiary: 6.5, unclassified: 5,
  residential: 4.5, living_street: 4, road: 5, service: 3,
};
const ZONE = { residential: 'residential', commercial: 'commercial', retail: 'commercial', industrial: 'industrial' };

/** Deterministic 0..1 random from a string seed. */
function rng(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function insidePoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const L = dx * dx + dy * dy || 1;
  const u = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L));
  return Math.hypot(ax + u * dx - px, ay + u * dy - py);
}

/** Uniform grid of items by bounding box, for quick "what is near here" lookups. */
class Grid {
  constructor(cell) { this.cell = cell; this.map = new Map(); }
  keys(x0, y0, x1, y1) {
    const c = this.cell, out = [];
    for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++) for (let j = Math.floor(y0 / c); j <= Math.floor(y1 / c); j++) out.push(`${i},${j}`);
    return out;
  }
  add(item, x0, y0, x1, y1) { for (const k of this.keys(x0, y0, x1, y1)) (this.map.get(k) ?? this.map.set(k, []).get(k)).push(item); }
  near(x0, y0, x1, y1) {
    const seen = new Set();
    for (const k of this.keys(x0, y0, x1, y1)) for (const it of this.map.get(k) ?? []) seen.add(it);
    return seen;
  }
}

/** Join the outer member ways of a multipolygon relation into closed rings. */
function rings(members, role) {
  const parts = members.filter((m) => m.role === role && m.geometry?.length > 1).map((m) => m.geometry.map((p) => [p.lon, p.lat]));
  const out = [];
  const same = (a, b) => a[0] === b[0] && a[1] === b[1];
  while (parts.length) {
    let ring = parts.shift();
    let grew = true;
    while (!same(ring[0], ring.at(-1)) && grew) {
      grew = false;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (same(ring.at(-1), p[0])) ring = ring.concat(p.slice(1));
        else if (same(ring.at(-1), p.at(-1))) ring = ring.concat(p.slice(0, -1).reverse());
        else continue;
        parts.splice(i, 1); grew = true; break;
      }
    }
    if (ring.length > 3) out.push(ring);
  }
  return out;
}

function landmarkGrounds() {
  const text = fs.readFileSync(path.join(ROOT, 'src', 'map', 'config.js'), 'utf8');
  return [...text.matchAll(/lng: ([\d.]+), lat: ([\d.]+),[^}]*?grounds: ([\d.]+)/g)].map((m) => m.slice(1).map(Number));
}

/** Filler buildings for one tile, as Overpass-style ways. */
export function fillTile(id) {
  const ctxFile = path.join(RAW, 'osm', 'city', 'context', `${id}.json`);
  if (!fs.existsSync(ctxFile)) return [];
  const [lat0, lng0] = id.split('_').map(Number);
  const LAT = lat0 + STEP / 2, LNG = lng0 + STEP / 2;
  const KX = 111320 * Math.cos((LAT * Math.PI) / 180), KY = 110574;
  const toXY = ([lng, lat]) => [(lng - LNG) * KX, (lat - LAT) * KY];
  const toLL = ([x, y]) => ({ lon: +(LNG + x / KX).toFixed(7), lat: +(LAT + y / KY).toFixed(7) });
  const half = (STEP / 2) * KY;                       // tile half size in metres (roughly square)
  const halfX = (STEP / 2) * KX;
  const rand = rng(id);
  const downtownKm = Math.hypot((LNG - SULE[0]) * KX, (LAT - SULE[1]) * KY) / 1000;

  // --- context: zones, keep-clear areas, roads ---
  const zones = [], clear = [], roads = new Grid(60);
  const addPoly = (list, ring, extra) => {
    const pts = ring.map(toXY);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    list.push({ pts, x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), ...extra });
  };
  for (const el of JSON.parse(fs.readFileSync(ctxFile, 'utf8')).elements) {
    const t = el.tags ?? {};
    const ringsOf = el.type === 'relation' ? rings(el.members ?? [], 'outer') : el.geometry ? [el.geometry.map((p) => [p.lon, p.lat])] : [];
    if (ZONE[t.landuse]) {
      for (const r of ringsOf) addPoly(zones, r, { zone: ZONE[t.landuse] });
      if (el.type === 'relation') for (const r of rings(el.members ?? [], 'inner')) addPoly(clear, r);
    } else if (t.highway || t.railway || t.waterway) {
      const hw = t.railway ? 6 : t.waterway ? (t.waterway === 'river' ? 25 : 5) : HALF_WIDTH[t.highway.replace('_link', '')] ?? 4;
      const pts = (el.geometry ?? []).map((p) => toXY([p.lon, p.lat]));
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
        const seg = { ax, ay, bx, by, hw, street: !!t.highway && !t.highway.startsWith('motorway') && t.highway !== 'trunk',
          homes: t.highway === 'residential' || t.highway === 'living_street' };
        roads.add(seg, Math.min(ax, bx) - hw, Math.min(ay, by) - hw, Math.max(ax, bx) + hw, Math.max(ay, by) + hw);
      }
    } else {
      for (const r of ringsOf) if (r.length > 3) addPoly(clear, r);
    }
  }
  // Car parks, malls, markets and hospitals (poi.json) stay clear too.
  const poiFile = path.join(RAW, 'osm', 'city', 'poi.json');
  if (fs.existsSync(poiFile)) {
    for (const el of JSON.parse(fs.readFileSync(poiFile, 'utf8')).elements) {
      const t = el.tags ?? {};
      if (!(t.amenity === 'parking' || t.amenity === 'marketplace' || t.amenity === 'hospital' || t.shop === 'mall')) continue;
      const ringsOf = el.type === 'relation' ? rings(el.members ?? [], 'outer') : el.geometry ? [el.geometry.map((p) => [p.lon, p.lat])] : [];
      for (const r of ringsOf) if (r.length > 3) addPoly(clear, r);
    }
  }
  if (!zones.length) return [];
  for (const [lng, lat, r] of landmarkGrounds()) {
    const [x, y] = toXY([lng, lat]);
    if (r > 0) clear.push({ circle: [x, y, r], x0: x - r, y0: y - r, x1: x + r, y1: y + r });
  }
  const zoneGrid = new Grid(200), clearGrid = new Grid(200);
  for (const z of zones) zoneGrid.add(z, z.x0, z.y0, z.x1, z.y1);
  for (const c of clear) clearGrid.add(c, c.x0, c.y0, c.x1, c.y1);
  const zoneAt = (x, y) => {
    for (const z of zoneGrid.near(x, y, x, y)) if (x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1 && insidePoly(x, y, z.pts)) return z.zone;
    return null;
  };
  const isClear = (x, y) => {
    for (const c of clearGrid.near(x, y, x, y)) {
      if (c.circle ? Math.hypot(x - c.circle[0], y - c.circle[1]) < c.circle[2] : x >= c.x0 && x <= c.x1 && y >= c.y0 && y <= c.y1 && insidePoly(x, y, c.pts)) return true;
    }
    return false;
  };

  // --- mapped buildings, plus lots as they are placed: nothing may overlap them ---
  // Mapped buildings of this tile and, near the edges, of the eight neighbours (a building belongs to
  // the tile holding its centre, so one can reach over the edge).
  const taken = new Grid(40);
  for (const dLat of [-STEP, 0, STEP]) for (const dLng of [-STEP, 0, STEP]) {
    const file = path.join(RAW, 'osm', 'city', 'tiles', `${(lat0 + dLat).toFixed(2)}_${(lng0 + dLng).toFixed(2)}.json`);
    if (!fs.existsSync(file)) continue;
    for (const el of JSON.parse(fs.readFileSync(file, 'utf8')).elements) {
      if (!el.geometry) continue;
      const pts = el.geometry.map((p) => toXY([p.lon, p.lat]));
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
      if (x1 < -halfX || x0 > halfX || y1 < -half || y0 > half) continue;
      taken.add({ pts }, x0, y0, x1, y1);
    }
  }
  const overlaps = (corners, pad) => {
    const xs = corners.map((p) => p[0]), ys = corners.map((p) => p[1]);
    const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad, x1 = Math.max(...xs) + pad, y1 = Math.max(...ys) + pad;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    for (const b of taken.near(x0, y0, x1, y1)) {
      // a corner of the other building within the padded box, or the lot's corners/centre inside it
      if (b.pts.some(([x, y]) => x > x0 && x < x1 && y > y0 && y < y1)) return true;
      if (corners.some(([x, y]) => insidePoly(x, y, b.pts)) || insidePoly(cx, cy, b.pts)) return true;
    }
    return false;
  };
  const nearRoad = (x, y, extra) => {
    for (const s of roads.near(x - 30, y - 30, x + 30, y + 30)) if (segDist(x, y, s.ax, s.ay, s.bx, s.by) < s.hw + extra) return true;
    return false;
  };

  // --- walk every street and put lots on both sides ---
  const out = [];
  const segs = new Set();
  for (const list of roads.map.values()) for (const s of list) if (s.street) segs.add(s);
  const order = [...segs].sort((a, b) => a.ax - b.ax || a.ay - b.ay);   // stable across runs
  for (const s of order) {

    const len = Math.hypot(s.bx - s.ax, s.by - s.ay);
    if (len < 8) continue;
    const ux = (s.bx - s.ax) / len, uy = (s.by - s.ay) / len;     // along the street
    for (const side of [1, -1]) {
      const nx = -uy * side, ny = ux * side;                         // away from the street
      let t = 3 + rand() * 4;
      while (t < len - 3) {
        const mx = s.ax + ux * t, my = s.ay + uy * t;
        // Land use where OSM has it; along a residential street without any, assume homes.
        const zoneOf = (x, y) => zoneAt(x, y) ?? (s.homes ? 'residential' : null);
        const probe = zoneOf(mx + nx * (s.hw + 8), my + ny * (s.hw + 8));
        if (!probe) { t += 12; continue; }
        const r = rand();
        let w, d, building;
        if (probe === 'industrial') { w = 24 + r * 22; d = 26 + rand() * 24; building = 'industrial'; }
        else if (probe === 'commercial') { w = 7 + r * 6; d = 14 + rand() * 10; building = 'commercial'; }
        else if (r < (downtownKm < 6 ? 0.35 : 0.12)) { w = 12 + rand() * 8; d = 16 + rand() * 10; building = 'apartments'; }
        else { w = 7 + r * 5; d = 9 + rand() * 6; building = 'house'; }
        // Downtown is shophouse blocks: let the generator's downtown rules (3–6 storeys, shop floor) apply.
        const cl = [LNG + mx / KX, LAT + my / KY];
        if (building !== 'industrial' && cl[0] >= DOWNTOWN[0] && cl[0] <= DOWNTOWN[2] && cl[1] >= DOWNTOWN[1] && cl[1] <= DOWNTOWN[3]) {
          w = 6 + r * 6; d = 14 + rand() * 8; building = 'yes';
        }
        const gap = building === 'industrial' ? 8 : building === 'house' ? 2 + rand() * 3 : building === 'yes' ? 0.5 : 1.5;
        const rows = building === 'house' && rand() < 0.5 ? 2 : 1;          // a second row behind, as in deep blocks
        for (let row = 0; row < rows; row++) {
          const off = s.hw + 2.5 + row * (d + 4);
          const c = [mx + ux * (w / 2) + nx * (off + d / 2), my + uy * (w / 2) + ny * (off + d / 2)];
          const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [c[0] + ux * (a * w / 2) + nx * (b * d / 2), c[1] + uy * (a * w / 2) + ny * (b * d / 2)]);
          if (side < 0) corners.reverse();
          // whole lot inside this tile (so lots of two tiles never overlap), and some empty plots
          const edge = corners.some(([x, y]) => Math.abs(x) > halfX - 1 || Math.abs(y) > half - 1);
          if (edge || rand() < 0.12) continue;
          if (zoneOf(c[0], c[1]) !== probe || isClear(c[0], c[1]) || corners.some(([x, y]) => isClear(x, y))) continue;
          if (corners.some(([x, y]) => nearRoad(x, y, 1)) || nearRoad(c[0], c[1], 1)) continue;
          if (overlaps(corners, 2)) continue;
          const xs = corners.map((p) => p[0]), ys = corners.map((p) => p[1]);
          taken.add({ pts: corners }, Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
          const ring = corners.map(toLL);
          out.push({ type: 'way', id: 9e9 + out.length, tags: { building, source: 'filler' }, geometry: [...ring, ring[0]] });
        }
        t += w + gap;
      }
    }
  }
  if (out.length <= MAX_PER_TILE) return out;
  // Over budget: thin evenly over the whole tile (gaps read as empty plots), not by cutting one side off.
  const keep = MAX_PER_TILE / out.length;
  return out.filter(() => rand() < keep).map((b, i) => ({ ...b, id: 9e9 + i }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const id of process.argv.slice(2)) console.log(id, fillTile(id).length, 'filler buildings');
}
