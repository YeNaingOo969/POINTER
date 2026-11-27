// Live procedural 3D roadside & urban-block infill generator driven by MapLibre vector tiles
// ('omt') and CityOccupancy (loaded GLB tiles + landmark grounds).
// Lines empty urban roadsides and unfilled city blocks with crisp Yangon shophouses, walk-up
// apartments, boutique glass mid-rises, and pitched-roof houses using cityTiles' shared PBR materials.
import * as THREE from 'three';
import { OCC_BUILDING, OCC_CLEAR, OCC_FILLER } from './city-occupancy.js';

const DOWNTOWN = [96.136, 16.762, 96.188, 16.795];
const SULE = [96.158764, 16.774401];
const BAY = 3.6;
const STOREY = 3.2;
const SHOP_H = 3.8;
const MAX_FILL_PER_TILE = 16000;
const PASS1_CAP = 3500;

const ROAD_HW = {
  motorway: 14,
  trunk: 12,
  primary: 9.5,
  secondary: 7.5,
  tertiary: 6.5,
  minor: 5.0,
  service: 3.5,
  track: 3.5,
  path: 2.5,
  rail: 7,
  transit: 7,
};
const FILLABLE_ROADS = new Set(['primary', 'secondary', 'tertiary', 'minor']);
const EXCLUDE_LANDUSE = new Set([
  'cemetery', 'pitch', 'stadium', 'playground', 'zoo', 'railway', 'recreation_ground',
]);
const CAMPUS_LANDUSE = new Set(['school', 'university', 'college', 'hospital', 'military']);
const EXCLUDE_LANDCOVER = new Set(['wood', 'wetland', 'grass', 'farmland']);

const WALL_PALETTE = [
  [0.98, 0.94, 0.84],
  [0.97, 0.89, 0.67],
  [0.96, 0.84, 0.80],
  [0.83, 0.92, 0.85],
  [0.82, 0.89, 0.96],
  [0.96, 0.96, 0.95],
  [0.94, 0.83, 0.68],
];
const ROOF_ZINC_PALETTE = [
  [0.80, 0.39, 0.29], // terracotta
  [0.37, 0.48, 0.59], // slate blue
  [0.35, 0.51, 0.40], // tropic green
  [0.78, 0.81, 0.84], // galvanized silver
];
const GLASS_PALETTE = [
  [0.88, 0.94, 1.00],
  [0.82, 0.91, 0.97],
  [0.92, 0.95, 0.98],
];

function hash2(x, z) {
  let h = (Math.imul(Math.round(x * 10), 374761393) + Math.imul(Math.round(z * 10), 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function insidePoly(x, z, pts) {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
}

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz || 1;
  const u = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  return Math.hypot(ax + u * dx - px, az + u * dz - pz);
}

class SpatialGrid {
  constructor(cell) { this.cell = cell; this.map = new Map(); }
  add(item, x0, z0, x1, z1) {
    const c = this.cell;
    const gx0 = Math.floor(x0 / c), gx1 = Math.floor(x1 / c);
    const gz0 = Math.floor(z0 / c), gz1 = Math.floor(z1 / c);
    for (let gz = gz0; gz <= gz1; gz++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const k = `${gx},${gz}`;
        let list = this.map.get(k);
        if (!list) this.map.set(k, (list = []));
        list.push(item);
      }
    }
  }
  near(x0, z0, x1, z1) {
    const c = this.cell, seen = new Set();
    const gx0 = Math.floor(x0 / c), gx1 = Math.floor(x1 / c);
    const gz0 = Math.floor(z0 / c), gz1 = Math.floor(z1 / c);
    for (let gz = gz0; gz <= gz1; gz++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const list = this.map.get(`${gx},${gz}`);
        if (list) for (const it of list) seen.add(it);
      }
    }
    return seen;
  }
}

class MeshAccumulator {
  constructor() {
    this.pos = [];
    this.norm = [];
    this.uv = [];
    this.col = [];
  }
  pushTri(ax, ay, az, bx, by, bz, cx, cy, cz, nx, ny, nz, ua, va, ub, vb, uc, vc, rgb) {
    this.pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    this.norm.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    this.uv.push(ua, va, ub, vb, uc, vc);
    this.col.push(rgb[0], rgb[1], rgb[2], rgb[0], rgb[1], rgb[2], rgb[0], rgb[1], rgb[2]);
  }
  pushQuad(a, b, c, d, nx, ny, nz, u0, v0, u1, v1, rgb) {
    this.pushTri(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], nx, ny, nz, u0, v0, u1, v0, u1, v1, rgb);
    this.pushTri(a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2], nx, ny, nz, u0, v0, u1, v1, u0, v1, rgb);
  }
  toGeometry() {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.norm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    return g;
  }
}

// Canonical right-handed XZ frame: u=(ux,uz), r=(-uz,ux) where r x u = +Y.
// Corners in order: a(-hw,-hd), b(-hw,+hd), c(+hw,+hd), d(+hw,-hd).
function addWallRing(acc, pts, y0, y1, storeyH, rgb) {
  let d = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[(i + 1) % pts.length];
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 0.25) continue;
    const nx = -((z1 - z0) / len);
    const nz = (x1 - x0) / len;
    const u0 = d / BAY, u1 = (d + len) / BAY;
    // glTF flipY=false: v=1 at floor (y0), v=1-(h/storey) at ceiling (y1)
    const vBot = 1.0;
    const vTop = 1.0 - (y1 - y0) / storeyH;
    acc.pushQuad([x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0], nx, 0, nz, u0, vBot, u1, vTop, rgb);
    d += len;
  }
}

function addFlatRoof(acc, corners, y, rgb) {
  const [a, b, c, d] = corners;
  acc.pushTri(
    a[0], y, a[1], b[0], y, b[1], c[0], y, c[1],
    0, 1, 0, a[0] / 24, a[1] / 24, b[0] / 24, b[1] / 24, c[0] / 24, c[1] / 24, rgb,
  );
  acc.pushTri(
    a[0], y, a[1], c[0], y, c[1], d[0], y, d[1],
    0, 1, 0, a[0] / 24, a[1] / 24, c[0] / 24, c[1] / 24, d[0] / 24, d[1] / 24, rgb,
  );
}

function addGableRoof(roofAcc, wallAcc, cx, cz, ux, uz, rx, rz, w, d, yBase, wallRgb, roofRgb) {
  const hw = w / 2 + 0.35;
  const hd = d / 2 + 0.35;
  const ridgeH = Math.min(2.6, Math.max(1.2, Math.min(w, d) * 0.24));
  const yTop = yBase + ridgeH;

  // Canonical right-handed corners: a(-hw,-hd), b(-hw,+hd), c(+hw,+hd), d(+hw,-hd)
  const pA = [cx - ux * hw - rx * hd, yBase, cz - uz * hw - rz * hd]; // -u, -r
  const pB = [cx - ux * hw + rx * hd, yBase, cz - uz * hw + rz * hd]; // -u, +r
  const pC = [cx + ux * hw + rx * hd, yBase, cz + uz * hw + rz * hd]; // +u, +r
  const pD = [cx + ux * hw - rx * hd, yBase, cz + uz * hw - rz * hd]; // +u, -r
  const rL = [cx - ux * hw, yTop, cz - uz * hw];
  const rR = [cx + ux * hw, yTop, cz + uz * hw];

  const slopeLen = Math.hypot(hd, ridgeH);
  const sny = hd / slopeLen;
  const nrX = (rx * ridgeH) / slopeLen, nrZ = (rz * ridgeH) / slopeLen;
  const tileU = (hw * 2) / 3.0, tileV = slopeLen / 3.0;

  // -r slope: (pD, pA, rL, rR) -> (-u) x (+r + y) = +Y & -r outward
  roofAcc.pushQuad(pD, pA, rL, rR, -nrX, sny, -nrZ, 0, 0, tileU, tileV, roofRgb);
  // +r slope: (pB, pC, rR, rL) -> (+u) x (-r + y) = +Y & +r outward
  roofAcc.pushQuad(pB, pC, rR, rL, nrX, sny, nrZ, 0, 0, tileU, tileV, roofRgb);

  // Flush gable end triangles (-u end & +u end)
  const bw = w / 2, bd = d / 2;
  const gA = [cx - ux * bw - rx * bd, yBase, cz - uz * bw - rz * bd];
  const gB = [cx - ux * bw + rx * bd, yBase, cz - uz * bw + rz * bd];
  const gC = [cx + ux * bw + rx * bd, yBase, cz + uz * bw + rz * bd];
  const gD = [cx + ux * bw - rx * bd, yBase, cz + uz * bw - rz * bd];
  const gRL = [cx - ux * bw, yTop, cz - uz * bw];
  const gRR = [cx + ux * bw, yTop, cz + uz * bw];
  // -u gable: gA->gB (+r), edge up -> (-r)x(+y) = -u outward -> (gA, gB, gRL)
  wallAcc.pushTri(gA[0], gA[1], gA[2], gB[0], gB[1], gB[2], gRL[0], gRL[1], gRL[2], -ux, 0, -uz, 0, 1, 1, 1, 0.5, 0.5, wallRgb);
  // +u gable: gC->gD (-r), edge up -> (+r)x(+y) = +u outward -> (gC, gD, gRR)
  wallAcc.pushTri(gC[0], gC[1], gC[2], gD[0], gD[1], gD[2], gRR[0], gRR[1], gRR[2], ux, 0, uz, 0, 1, 1, 1, 0.5, 0.5, wallRgb);
}

/** Four-sloped hipped roof (zero blank boxy top, right-handed outward normals on all 4 slopes). */
function addHipRoof(roofAcc, cx, cz, ux, uz, rx, rz, w, d, yBase, roofRgb) {
  const hw = w / 2 + 0.35;
  const hd = d / 2 + 0.35;
  const rhw = Math.max(0.6, hw - hd * 0.55);
  const ridgeH = Math.min(2.8, Math.max(1.3, hd * 0.32));
  const yTop = yBase + ridgeH;

  const pA = [cx - ux * hw - rx * hd, yBase, cz - uz * hw - rz * hd];
  const pB = [cx - ux * hw + rx * hd, yBase, cz - uz * hw + rz * hd];
  const pC = [cx + ux * hw + rx * hd, yBase, cz + uz * hw + rz * hd];
  const pD = [cx + ux * hw - rx * hd, yBase, cz + uz * hw - rz * hd];
  const rL = [cx - ux * rhw, yTop, cz - uz * rhw];
  const rR = [cx + ux * rhw, yTop, cz + uz * rhw];

  const slopeLen = Math.hypot(hd, ridgeH);
  const sny = hd / slopeLen;
  const nrX = (rx * ridgeH) / slopeLen, nrZ = (rz * ridgeH) / slopeLen;
  const tileU = (hw * 2) / 3.0, tileV = slopeLen / 3.0;

  roofAcc.pushQuad(pD, pA, rL, rR, -nrX, sny, -nrZ, 0, 0, tileU, tileV, roofRgb);
  roofAcc.pushQuad(pB, pC, rR, rL, nrX, sny, nrZ, 0, 0, tileU, tileV, roofRgb);
  roofAcc.pushTri(pA[0], pA[1], pA[2], pB[0], pB[1], pB[2], rL[0], rL[1], rL[2], -ux * 0.65, sny, -uz * 0.65, 0, 0, tileV, 0, tileV * 0.5, tileV, roofRgb);
  roofAcc.pushTri(pC[0], pC[1], pC[2], pD[0], pD[1], pD[2], rR[0], rR[1], rR[2], ux * 0.65, sny, uz * 0.65, 0, 0, tileV, 0, tileV * 0.5, tileV, roofRgb);
}

function addRooftopCrown(acc, cx, cz, corners, yTop, scale = 0.42, height = 2.2) {
  const pc = corners.map(([px, pz]) => [cx + (px - cx) * scale, cz + (pz - cz) * scale]);
  addWallRing(acc.apartment, pc, yTop, yTop + height, height, [0.92, 0.91, 0.88]);
  addFlatRoof(acc.roof_flat, pc, yTop + height, [0.87, 0.86, 0.84]);
}

function emitBuilding(acc, cx, cz, ux, uz, rx, rz, corners, w, d, kind, floors, r1) {
  const wallRgb = WALL_PALETTE[Math.floor(hash2(cx + 3, cz - 5) * WALL_PALETTE.length)];
  const hCrown = hash2(cx - 4.1, cz + 8.3);
  if (kind === 'glass') {
    const splitSetback = floors >= 4 && hCrown < 0.58;
    const baseH = SHOP_H + (splitSetback ? floors - 2 : floors - 1) * STOREY;
    const gRgb = GLASS_PALETTE[Math.floor(r1 * GLASS_PALETTE.length)];
    addWallRing(acc.glass, corners, 0, baseH, STOREY, gRgb);
    addFlatRoof(acc.roof_flat, corners, baseH, [0.84, 0.86, 0.89]);
    if (splitSetback) {
      const sc = corners.map(([px, pz]) => [cx + (px - cx) * 0.78, cz + (pz - cz) * 0.78]);
      addWallRing(acc.glass, sc, baseH, baseH + STOREY * 1.4, STOREY, gRgb);
      addFlatRoof(acc.roof_flat, sc, baseH + STOREY * 1.4, [0.86, 0.88, 0.91]);
      addRooftopCrown(acc, cx, cz, sc, baseH + STOREY * 1.4, 0.45, 2.3);
    } else if (floors >= 4) {
      addRooftopCrown(acc, cx, cz, corners, baseH, 0.44, 2.3);
    }
  } else if (kind === 'shophouse') {
    const splitSetback = floors >= 4 && hCrown < 0.52;
    const mainH = SHOP_H + Math.max(1, (splitSetback ? floors - 2 : floors - 1)) * STOREY;
    addWallRing(acc.shop, corners, 0, SHOP_H, SHOP_H, wallRgb);
    if (mainH > SHOP_H) addWallRing(acc.apartment, corners, SHOP_H, mainH, STOREY, wallRgb);
    addFlatRoof(acc.roof_flat, corners, mainH, [0.90, 0.89, 0.86]);
    if (splitSetback) {
      const sc = corners.map(([px, pz]) => [cx + (px - cx) * 0.78, cz + (pz - cz) * 0.78]);
      addWallRing(acc.apartment, sc, mainH, mainH + STOREY, STOREY, wallRgb);
      addFlatRoof(acc.roof_flat, sc, mainH + STOREY, [0.91, 0.90, 0.87]);
      addRooftopCrown(acc, cx, cz, sc, mainH + STOREY, 0.42, 1.9);
    } else if (hCrown < 0.72) {
      addRooftopCrown(acc, cx, cz, corners, mainH, 0.40, 2.0);
    }
  } else if (kind === 'apartment') {
    const h = floors * STOREY;
    addWallRing(acc.apartment, corners, 0, h, STOREY, wallRgb);
    if (floors <= 3 && hCrown > 0.60) {
      const roofRgb = ROOF_ZINC_PALETTE[Math.floor(hash2(cx - 7, cz + 11) * ROOF_ZINC_PALETTE.length)];
      addHipRoof(acc.roof_zinc, cx, cz, ux, uz, rx, rz, w, d, h, roofRgb);
    } else {
      addFlatRoof(acc.roof_flat, corners, h, [0.90, 0.89, 0.86]);
      if (hCrown < 0.72) addRooftopCrown(acc, cx, cz, corners, h, 0.38, 2.0);
    }
  } else if (kind === 'factory') {
    const h = floors * STOREY;
    addWallRing(acc.factory, corners, 0, h, STOREY, [0.92, 0.94, 0.96]);
    const roofRgb = ROOF_ZINC_PALETTE[Math.floor(hash2(cx + 5, cz - 9) * ROOF_ZINC_PALETTE.length)];
    addGableRoof(acc.roof_zinc, acc.factory, cx, cz, ux, uz, rx, rz, w, d, h, [0.90, 0.92, 0.94], roofRgb);
  } else {
    const h = floors * STOREY;
    addWallRing(acc.house, corners, 0, h, STOREY, wallRgb);
    const roofRgb = ROOF_ZINC_PALETTE[Math.floor(hash2(cx - 7, cz + 11) * ROOF_ZINC_PALETTE.length)];
    if (hCrown < 0.50) addHipRoof(acc.roof_zinc, cx, cz, ux, uz, rx, rz, w, d, h, roofRgb);
    else addGableRoof(acc.roof_zinc, acc.house, cx, cz, ux, uz, rx, rz, w, d, h, wallRgb, roofRgb);
  }
}

/** @param {{ map: maplibregl.Map, toLocal: Function, materials: Object, occupancy: Object, markShadowsDirty?: Function }} ctx */
export function createRoadsideFiller({ map, toLocal, materials, occupancy, markShadowsDirty }) {
  const group = new THREE.Group();
  const activeTiles = new Map(); // tileId -> tile metadata
  const filledTiles = new Map(); // tileId -> { tileGroup, processedSegs, placed, bounds, interiorDone }
  const [suleX, suleZ] = toLocal(SULE[0], SULE[1]);

  let fillTimer = 0;

  /** Build one shared spatial snapshot from MapLibre 'omt' vector tiles per fill tick. */
  function buildOmtSnapshot() {
    const allRoads = map.querySourceFeatures('omt', { sourceLayer: 'transportation' });
    if (!allRoads.length) return null;

    const roadGrid = new SpatialGrid(60);
    const streetSegs = [];
    const seenCoords = new Set();

    for (const f of allRoads) {
      const cls = f.properties?.class;
      const brunnel = f.properties?.brunnel;
      if (brunnel === 'tunnel') continue;
      const lines = f.geometry?.type === 'LineString'
        ? [f.geometry.coordinates]
        : f.geometry?.type === 'MultiLineString' ? f.geometry.coordinates : null;
      if (!lines) continue;

      const hw = ROAD_HW[cls] ?? 4.5;
      const isBridge = brunnel === 'bridge';
      const allowBuild = !isBridge && FILLABLE_ROADS.has(cls);

      for (const line of lines) {
        for (let i = 1; i < line.length; i++) {
          const [ax, az] = toLocal(line[i - 1][0], line[i - 1][1]);
          const [bx, bz] = toLocal(line[i][0], line[i][1]);
          const seg = { ax, az, bx, bz, hw: isBridge ? hw + 6 : hw, cls };
          roadGrid.add(seg, Math.min(ax, bx) - seg.hw, Math.min(az, bz) - seg.hw, Math.max(ax, bx) + seg.hw, Math.max(az, bz) + seg.hw);
          if (allowBuild) {
            const key = `${Math.round(ax)}:${Math.round(az)}:${Math.round(bx)}:${Math.round(bz)}`;
            if (!seenCoords.has(key)) {
              seenCoords.add(key);
              streetSegs.push(seg);
            }
          }
        }
      }
    }

    const exclusions = new SpatialGrid(140);
    const zones = new SpatialGrid(160);
    const omtBuildings = new SpatialGrid(60);

    const addPolyRings = (grid, geom, extra) => {
      const polys = geom?.type === 'Polygon'
        ? [geom.coordinates]
        : geom?.type === 'MultiPolygon' ? geom.coordinates : null;
      if (!polys) return;
      for (const poly of polys) {
        const ring = poly[0];
        if (!ring || ring.length < 3) continue;
        const pts = ring.map(([lng, lat]) => toLocal(lng, lat));
        let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
        for (const [px, pz] of pts) {
          if (px < x0) x0 = px; if (px > x1) x1 = px;
          if (pz < z0) z0 = pz; if (pz > z1) z1 = pz;
        }
        grid.add({ pts, x0, z0, x1, z1, ...extra }, x0, z0, x1, z1);
      }
    };

    for (const layerName of ['water', 'park', 'aeroway']) {
      for (const f of map.querySourceFeatures('omt', { sourceLayer: layerName })) addPolyRings(exclusions, f.geometry);
    }
    for (const f of map.querySourceFeatures('omt', { sourceLayer: 'landcover' })) {
      if (EXCLUDE_LANDCOVER.has(f.properties?.class)) addPolyRings(exclusions, f.geometry);
    }
    for (const f of map.querySourceFeatures('omt', { sourceLayer: 'landuse' })) {
      const cls = f.properties?.class;
      if (EXCLUDE_LANDUSE.has(cls)) addPolyRings(exclusions, f.geometry);
      else if (CAMPUS_LANDUSE.has(cls)) addPolyRings(zones, f.geometry, { zone: 'campus' });
      else if (cls === 'residential' || cls === 'quarter' || cls === 'commercial' || cls === 'retail' || cls === 'industrial') {
        addPolyRings(zones, f.geometry, { zone: cls === 'retail' ? 'commercial' : cls === 'quarter' ? 'residential' : cls });
      }
    }
    for (const f of map.querySourceFeatures('omt', { sourceLayer: 'building' })) {
      addPolyRings(omtBuildings, f.geometry);
    }
    for (const f of map.querySourceFeatures('omt', { sourceLayer: 'waterway' })) {
      const lines = f.geometry?.type === 'LineString'
        ? [f.geometry.coordinates]
        : f.geometry?.type === 'MultiLineString' ? f.geometry.coordinates : null;
      if (!lines) continue;
      const hw = f.properties?.class === 'river' ? 28 : 7;
      for (const line of lines) {
        for (let i = 1; i < line.length; i++) {
          const [ax, az] = toLocal(line[i - 1][0], line[i - 1][1]);
          const [bx, bz] = toLocal(line[i][0], line[i][1]);
          const seg = { ax, az, bx, bz, hw };
          roadGrid.add(seg, Math.min(ax, bx) - hw, Math.min(az, bz) - hw, Math.max(ax, bx) + hw, Math.max(az, bz) + hw);
        }
      }
    }

    const isExcluded = (x, z) => {
      if (occupancy.isOccupied(x, z, OCC_BUILDING | OCC_CLEAR | OCC_FILLER)) return true;
      for (const p of exclusions.near(x, z, x, z)) {
        if (x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1 && insidePoly(x, z, p.pts)) return true;
      }
      return false;
    };
    const hitsRoad = (x, z, extra = 1.2) => {
      for (const s of roadGrid.near(x - 24, z - 24, x + 24, z + 24)) {
        if (segDist(x, z, s.ax, s.az, s.bx, s.bz) < s.hw + extra) return true;
      }
      return false;
    };
    const hitsOmtBldg = (corners, pad = 0.9) => {
      let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
      for (const [cx, cz] of corners) {
        if (cx < x0) x0 = cx; if (cx > x1) x1 = cx;
        if (cz < z0) z0 = cz; if (cz > z1) z1 = cz;
      }
      x0 -= pad; z0 -= pad; x1 += pad; z1 += pad;
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      for (const b of omtBuildings.near(x0, z0, x1, z1)) {
        if (b.x1 < x0 || b.x0 > x1 || b.z1 < z0 || b.z0 > z1) continue;
        if (b.pts.some(([px, pz]) => px > x0 && px < x1 && pz > z0 && pz < z1)) return true;
        if (corners.some(([px, pz]) => insidePoly(px, pz, b.pts)) || insidePoly(mx, mz, b.pts)) return true;
      }
      return false;
    };
    const zoneAt = (x, z) => {
      for (const zPoly of zones.near(x, z, x, z)) {
        if (x >= zPoly.x0 && x <= zPoly.x1 && z >= zPoly.z0 && z <= zPoly.z1 && insidePoly(x, z, zPoly.pts)) return zPoly.zone;
      }
      return null;
    };

    return { roadGrid, streetSegs, isExcluded, hitsRoad, hitsOmtBldg, zoneAt };
  }

  function fillTileIncremental(tile, snap) {
    const step = 0.04;
    const minLng = tile.lng - step / 2, maxLng = tile.lng + step / 2;
    const minLat = tile.lat - step / 2, maxLat = tile.lat + step / 2;
    const [txMin, tzMax] = toLocal(minLng, minLat);
    const [txMax, tzMin] = toLocal(maxLng, maxLat);

    let state = filledTiles.get(tile.id);
    if (!state) {
      state = {
        tileGroup: new THREE.Group(),
        processedSegs: new Set(),
        placed: 0,
        bounds: [txMin, tzMin, txMax, tzMax],
        sectorsDone: new Set(),
      };
      filledTiles.set(tile.id, state);
      group.add(state.tileGroup);
    }
    if (state.placed >= MAX_FILL_PER_TILE) return false;

    const bounds = map.getBounds?.();
    let vxMin = txMin, vxMax = txMax, vzMin = tzMin, vzMax = tzMax;
    if (bounds) {
      const [bx0, bz1] = toLocal(bounds.getWest(), bounds.getSouth());
      const [bx1, bz0] = toLocal(bounds.getEast(), bounds.getNorth());
      vxMin = Math.max(txMin, bx0);
      vxMax = Math.min(txMax, bx1);
      vzMin = Math.max(tzMin, bz0);
      vzMax = Math.min(tzMax, bz1);
    }

    const { roadGrid, streetSegs, isExcluded, hitsRoad, hitsOmtBldg, zoneAt } = snap;
    const newStreetSegs = [];
    for (const s of streetSegs) {
      if (Math.max(s.ax, s.bx) < vxMin - 40 || Math.min(s.ax, s.bx) > vxMax + 40) continue;
      if (Math.max(s.az, s.bz) < vzMin - 40 || Math.min(s.az, s.bz) > vzMax + 40) continue;
      const key = `${Math.round(s.ax)}:${Math.round(s.az)}:${Math.round(s.bx)}:${Math.round(s.bz)}`;
      if (!state.processedSegs.has(key)) {
        state.processedSegs.add(key);
        newStreetSegs.push(s);
      }
    }

    const acc = {
      apartment: new MeshAccumulator(),
      shop: new MeshAccumulator(),
      house: new MeshAccumulator(),
      factory: new MeshAccumulator(),
      glass: new MeshAccumulator(),
      roof_flat: new MeshAccumulator(),
      roof_zinc: new MeshAccumulator(),
    };

    let batchPlaced = 0;
    const tryPlaceLot = (cx, cz, ux, uz, rx, rz, kind, w, d, floors, r1, extraPad = 0.4) => {
      if (cx < txMin + 5 || cx > txMax - 5 || cz < tzMin + 5 || cz > tzMax - 5) return false;
      const hw = w / 2, hd = d / 2;
      const corners = [
        [cx - ux * hw - rx * hd, cz - uz * hw - rz * hd],
        [cx - ux * hw + rx * hd, cz - uz * hw + rz * hd],
        [cx + ux * hw + rx * hd, cz + uz * hw + rz * hd],
        [cx + ux * hw - rx * hd, cz + uz * hw - rz * hd],
      ];
      if (isExcluded(cx, cz) || corners.some(([px, pz]) => isExcluded(px, pz))) return false;
      if (hitsRoad(cx, cz, 1.5) || corners.some(([px, pz]) => hitsRoad(px, pz, 1.1))) return false;
      if (occupancy.hasAnyBox(cx, cz, ux, uz, hw + extraPad, hd + extraPad, OCC_BUILDING | OCC_CLEAR | OCC_FILLER)) return false;
      if (hitsOmtBldg(corners, 0.9)) return false;

      occupancy.stampBox(cx, cz, ux, uz, hw, hd, OCC_FILLER);
      emitBuilding(acc, cx, cz, ux, uz, rx, rz, corners, w, d, kind, floors, r1);
      state.placed++;
      batchPlaced++;
      return true;
    };

    // Pass 1: Tight continuous roadside urban frontage (leaves budget headroom for Pass 2 interiors)
    newStreetSegs.sort((a, b) => hash2(a.ax, a.az) - hash2(b.ax, b.az));
    for (const s of newStreetSegs) {
      if (state.placed >= PASS1_CAP) break;
      const len = Math.hypot(s.bx - s.ax, s.bz - s.az);
      if (len < 10) continue;
      const ux = (s.bx - s.ax) / len, uz = (s.bz - s.az) / len;
      const rx = -uz, rz = ux;
      const isMajor = s.cls === 'primary' || s.cls === 'secondary';

      for (const side of [1, -1]) {
        const sx = rx * side, sz = rz * side;
        let t = 3.5 + hash2(s.ax + side * 3, s.az) * 2.5;
        while (t < len - 5 && state.placed < PASS1_CAP) {
          const mx = s.ax + ux * t, mz = s.az + uz * t;
          if (mx < txMin + 5 || mx > txMax - 5 || mz < tzMin + 5 || mz > tzMax - 5) { t += 12; continue; }

          const r0 = hash2(mx, mz);
          const r1 = hash2(mx + 19.3, mz - 7.1);
          const r2 = hash2(mx - 11.7, mz + 23.4);

          const probeZone = zoneAt(mx + sx * (s.hw + 9), mz + sz * (s.hw + 9));
          const distSuleKm = Math.hypot(mx - suleX, mz - suleZ) / 1000;
          if (!probeZone && distSuleKm > 18.0) { t += 15; continue; }
          if (probeZone === 'campus' && r0 < 0.52) { t += 18; continue; }

          const probeLng = tile.lng + (mx - (txMin + txMax) / 2) / (111320 * Math.cos((tile.lat * Math.PI) / 180));
          const probeLat = tile.lat - (mz - (tzMin + tzMax) / 2) / 110574;
          const inDowntown = probeLng >= DOWNTOWN[0] && probeLng <= DOWNTOWN[2] && probeLat >= DOWNTOWN[1] && probeLat <= DOWNTOWN[3];

          let kind, w, d, floors;
          if (probeZone === 'industrial') {
            w = 15.0 + r0 * 7.0; d = 13.0 + r1 * 5.0; floors = 2;
            kind = 'factory';
          } else if (probeZone === 'campus') {
            w = 13.0 + r0 * 5.0; d = 10.5 + r1 * 3.5; floors = 2 + (r2 > 0.5 ? 1 : 0);
            kind = 'apartment';
          } else if (inDowntown) {
            w = 6.2 + r0 * 4.2; d = 11.8 + r1 * 5.2; floors = 3 + Math.floor(r2 * 4);
            kind = r1 > 0.78 && isMajor ? 'glass' : 'shophouse';
          } else if (probeZone === 'commercial' || (isMajor && distSuleKm < 6.8)) {
            w = 7.4 + r0 * 5.0; d = 12.2 + r1 * 5.0; floors = 3 + Math.floor(r2 * 4);
            kind = r2 > 0.76 ? 'glass' : 'shophouse';
          } else if (r0 < (distSuleKm < 6.0 ? 0.46 : 0.25)) {
            w = 9.5 + r0 * 6.0; d = 12.5 + r1 * 5.5; floors = 3 + Math.floor(r2 * 3);
            kind = 'apartment';
          } else {
            w = 6.6 + r0 * 3.8; d = 8.6 + r1 * 4.2; floors = 1 + (r2 > 0.46 ? 1 : 0);
            kind = 'house';
          }

          const gap = kind === 'shophouse' ? 0.35 + r2 * 0.7 : kind === 'factory' ? 5.0 + r1 * 3.0 : probeZone === 'campus' ? 7.0 + r1 * 4.0 : kind === 'house' ? 1.0 + r1 * 1.6 : 1.0 + r1 * 1.4;
          const rows = inDowntown && distSuleKm < 6.5 ? 2 : 1;
          for (let row = 0; row < rows && state.placed < PASS1_CAP; row++) {
            const off = s.hw + 2.2 + row * (d + 3.4);
            const cx = mx + ux * (w / 2) + sx * (off + d / 2);
            const cz = mz + uz * (w / 2) + sz * (off + d / 2);
            tryPlaceLot(cx, cz, ux, uz, rx, rz, kind, w, d, floors, r1, probeZone === 'campus' ? 3.5 : 0.4);
          }
          t += w + gap;
        }
      }
    }

    // Pass 2: Empty Block Interior Infill by visible 256m sector (broader compound blocks at 23m step -> full coverage + fewer tris)
    const SEC = 256;
    const stepG = 23.0;
    const sx0 = Math.floor(Math.max(txMin + 12, vxMin) / SEC);
    const sx1 = Math.floor(Math.min(txMax - 12, vxMax) / SEC);
    const sz0 = Math.floor(Math.max(tzMin + 12, vzMin) / SEC);
    const sz1 = Math.floor(Math.min(tzMax - 12, vzMax) / SEC);

    for (let sz = sz0; sz <= sz1 && state.placed < MAX_FILL_PER_TILE; sz++) {
      for (let sx = sx0; sx <= sx1 && state.placed < MAX_FILL_PER_TILE; sx++) {
        const sKey = (sx + 512) * 1024 + (sz + 512);
        if (state.sectorsDone.has(sKey)) continue;

        const xA = Math.max(txMin + 12, sx * SEC);
        const xB = Math.min(txMax - 12, (sx + 1) * SEC);
        const zA = Math.max(tzMin + 12, sz * SEC);
        const zB = Math.min(tzMax - 12, (sz + 1) * SEC);

        for (let gz = Math.ceil(zA / stepG) * stepG; gz < zB && state.placed < MAX_FILL_PER_TILE; gz += stepG) {
          for (let gx = Math.ceil(xA / stepG) * stepG; gx < xB && state.placed < MAX_FILL_PER_TILE; gx += stepG) {
            const distSuleKm = Math.hypot(gx - suleX, gz - suleZ) / 1000;
            const zone = zoneAt(gx, gz);
            if (!zone && distSuleKm > 16.0) continue;

            const r0 = hash2(gx, gz);
            if (zone === 'campus' && r0 < 0.64) continue; // airy spacious institutional grounds
            if (zone === 'industrial' && r0 < 0.38) continue;
            if (r0 < 0.06 || isExcluded(gx, gz) || hitsRoad(gx, gz, 2.2)) continue;

            // Align to closest street orientation within 240m, or default compass grid inside mapped urban blocks
            let bestS = null, bestD = 240;
            for (const s of roadGrid.near(gx - 240, gz - 240, gx + 240, gz + 240)) {
              const d = segDist(gx, gz, s.ax, s.az, s.bx, s.bz);
              if (d < bestD) { bestD = d; bestS = s; }
            }
            if (!bestS && !zone) continue;
            let ux = 1, uz = 0;
            if (bestS) {
              const slen = Math.hypot(bestS.bx - bestS.ax, bestS.bz - bestS.az) || 1;
              ux = (bestS.bx - bestS.ax) / slen;
              uz = (bestS.bz - bestS.az) / slen;
            }
            const rx = -uz, rz = ux;
            const r1 = hash2(gx + 9.1, gz - 4.7);
            const r2 = hash2(gx - 5.3, gz + 17.2);

            if (zone === 'industrial') {
              tryPlaceLot(gx, gz, ux, uz, rx, rz, 'factory', 16.5 + r0 * 5.0, 14.5 + r1 * 4.5, 2, r1, 1.8);
            } else if (zone === 'campus') {
              tryPlaceLot(gx, gz, ux, uz, rx, rz, 'apartment', 14.5 + r0 * 4.5, 11.5 + r1 * 3.5, 2 + (r2 > 0.45 ? 1 : 0), r1, 4.5);
            } else {
              const isApt = r1 < (distSuleKm < 4.8 ? 0.56 : 0.38);
              const w = isApt ? 13.4 + r0 * 4.4 : 10.6 + r0 * 4.0;
              const d = isApt ? 13.8 + r1 * 4.0 : 11.8 + r1 * 3.6;
              const floors = isApt ? 2 + Math.floor(r2 * 4) : 1 + (r2 > 0.38 ? 1 : 0);
              tryPlaceLot(gx, gz, ux, uz, rx, rz, isApt ? 'apartment' : 'house', w, d, floors, r1);
            }
          }
        }
        if (state.placed < MAX_FILL_PER_TILE) state.sectorsDone.add(sKey);
      }
    }

    if (!batchPlaced) return false;

    const batchGroup = new THREE.Group();
    for (const [matName, bucket] of Object.entries(acc)) {
      const geo = bucket.toGeometry();
      if (!geo) continue;
      const mesh = new THREE.Mesh(geo, materials[matName]);
      mesh.castShadow = matName === 'apartment' || matName === 'house' || matName === 'shop' || matName === 'glass';
      mesh.receiveShadow = true;
      batchGroup.add(mesh);
    }
    state.tileGroup.add(batchGroup);
    return true;
  }

  function hasPendingWork() {
    const b = map.getBounds?.();
    if (!b) return true;
    const [vx0, vz1] = toLocal(b.getWest(), b.getSouth());
    const [vx1, vz0] = toLocal(b.getEast(), b.getNorth());
    const SEC = 256;
    for (const tile of activeTiles.values()) {
      const state = filledTiles.get(tile.id);
      if (!state) return true;
      if (state.placed >= MAX_FILL_PER_TILE) continue;
      const [tx0, tz0, tx1, tz1] = state.bounds;
      const sx0 = Math.floor(Math.max(tx0 + 12, vx0) / SEC);
      const sx1 = Math.floor(Math.min(tx1 - 12, vx1) / SEC);
      const sz0 = Math.floor(Math.max(tz0 + 12, vz0) / SEC);
      const sz1 = Math.floor(Math.min(tz1 - 12, vz1) / SEC);
      for (let sz = sz0; sz <= sz1; sz++) {
        for (let sx = sx0; sx <= sx1; sx++) {
          if (!state.sectorsDone.has((sx + 512) * 1024 + (sz + 512))) return true;
        }
      }
    }
    return false;
  }

  function scheduleFill() {
    if (fillTimer) clearTimeout(fillTimer);
    fillTimer = setTimeout(() => {
      fillTimer = 0;
      if (map.getZoom() < 13.0 || !activeTiles.size) return;
      if (map.isSourceLoaded && !map.isSourceLoaded('omt')) return;
      if (!hasPendingWork()) return;
      const snap = buildOmtSnapshot();
      if (!snap) return;
      let changed = false;
      for (const tile of activeTiles.values()) {
        if (fillTileIncremental(tile, snap)) changed = true;
      }
      if (changed) {
        markShadowsDirty?.();
        map.triggerRepaint();
      }
    }, 90);
  }

  map.on('idle', scheduleFill);
  map.on('moveend', scheduleFill);

  return {
    group,
    onTileLoaded(tile) {
      activeTiles.set(tile.id, tile);
      scheduleFill();
    },
    onTileDropped(id) {
      activeTiles.delete(id);
      const state = filledTiles.get(id);
      if (!state) return;
      const [x0, z0, x1, z1] = state.bounds;
      occupancy.clearRectMask(x0 - 25, z0 - 25, x1 + 25, z1 + 25, OCC_FILLER);
      group.remove(state.tileGroup);
      state.tileGroup.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
      filledTiles.delete(id);
    },
  };
}
