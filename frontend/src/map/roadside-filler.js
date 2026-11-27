// Live procedural 3D roadside & urban-block infill generator driven by MapLibre vector tiles
// ('omt') and CityOccupancy (loaded GLB tiles + landmark grounds).
// Lines empty urban roadsides and unfilled city blocks with crisp Yangon shophouses, walk-up
// apartments, boutique glass mid-rises, and pitched-roof houses using cityTiles' shared PBR materials.
import * as THREE from 'three';
import { OCC_BUILDING, OCC_CLEAR, OCC_FILLER, unpackPosAccessor } from './city-occupancy.js';

const DOWNTOWN = [96.136, 16.762, 96.188, 16.795];
const SULE = [96.158764, 16.774401];
const BAY = 3.6;
const STOREY = 3.2;
const SHOP_H = 3.8;
const MAX_FILL_PER_TILE = 12000;
const PASS1_CAP = 4200;

const ROAD_HW = {
  motorway: 16,
  trunk: 14,
  primary: 11.5,
  secondary: 9.5,
  tertiary: 8.0,
  minor: 6.0,
  service: 4.5,
  track: 4.0,
  path: 3.0,
  rail: 8.0,
  transit: 8.0,
};

function segDistOBB(ax, az, bx, bz, cx, cz, ux, uz, rx, rz, hw, hd) {
  const dax = ax - cx, daz = az - cz;
  const dbx = bx - cx, dbz = bz - cz;
  const p0 = dax * ux + daz * uz, q0 = dax * rx + daz * rz;
  const p1 = dbx * ux + dbz * uz, q1 = dbx * rx + dbz * rz;
  const dp = p1 - p0, dq = q1 - q0;
  let t0 = 0, t1 = 1;
  const clip = (p, q) => {
    if (Math.abs(p) < 1e-9) return q >= 0;
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
    return true;
  };
  if (
    clip(-dp, p0 + hw) && clip(dp, hw - p0) &&
    clip(-dq, q0 + hd) && clip(dq, hd - q0) &&
    t0 <= t1
  ) return 0;

  const l2 = dp * dp + dq * dq;
  let best = Infinity;
  const evalAt = (t) => {
    const tc = t < 0 ? 0 : t > 1 ? 1 : t;
    const x = Math.max(0, Math.abs(p0 + tc * dp) - hw);
    const y = Math.max(0, Math.abs(q0 + tc * dq) - hd);
    const d2 = x * x + y * y;
    if (d2 < best) best = d2;
  };
  evalAt(0);
  evalAt(1);
  if (l2 > 1e-9) {
    if (Math.abs(dp) > 1e-9) {
      evalAt((-hw - p0) / dp);
      evalAt((hw - p0) / dp);
    }
    if (Math.abs(dq) > 1e-9) {
      evalAt((-hd - q0) / dq);
      evalAt((hd - q0) / dq);
    }
    for (const sx of [-hw, hw]) {
      for (const sy of [-hd, hd]) {
        evalAt(((sx - p0) * dp + (sy - q0) * dq) / l2);
      }
    }
  }
  return Math.sqrt(best);
}
const FILLABLE_ROADS = new Set(['primary', 'secondary', 'tertiary', 'minor', 'service', 'track']);
const EXCLUDE_LANDUSE = new Set([
  'cemetery', 'pitch', 'stadium', 'playground', 'zoo', 'railway', 'recreation_ground',
]);
const CAMPUS_LANDUSE = new Set(['school', 'university', 'college', 'hospital', 'healthcare', 'military']);
const EXCLUDE_LANDCOVER = new Set(['wood', 'wetland', 'farmland']);

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
  constructor(cell) { this.cell = cell; this.map = new Map(); this.seq = 1; }
  key(gx, gz) { return (gx + 16384) * 32768 + (gz + 16384); }
  add(item, x0, z0, x1, z1) {
    const c = this.cell;
    const gx0 = Math.floor(x0 / c), gx1 = Math.floor(x1 / c);
    const gz0 = Math.floor(z0 / c), gz1 = Math.floor(z1 / c);
    for (let gz = gz0; gz <= gz1; gz++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const k = this.key(gx, gz);
        let list = this.map.get(k);
        if (!list) this.map.set(k, (list = []));
        list.push(item);
      }
    }
  }
  someNear(x0, z0, x1, z1, pred) {
    const c = this.cell, qid = ++this.seq;
    const gx0 = Math.floor(x0 / c), gx1 = Math.floor(x1 / c);
    const gz0 = Math.floor(z0 / c), gz1 = Math.floor(z1 / c);
    for (let gz = gz0; gz <= gz1; gz++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const list = this.map.get(this.key(gx, gz));
        if (!list) continue;
        for (let i = 0; i < list.length; i++) {
          const it = list[i];
          if (it._q === qid) continue;
          it._q = qid;
          if (pred(it)) return true;
        }
      }
    }
    return false;
  }
  forEachNear(x0, z0, x1, z1, fn) {
    const c = this.cell, qid = ++this.seq;
    const gx0 = Math.floor(x0 / c), gx1 = Math.floor(x1 / c);
    const gz0 = Math.floor(z0 / c), gz1 = Math.floor(z1 / c);
    for (let gz = gz0; gz <= gz1; gz++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const list = this.map.get(this.key(gx, gz));
        if (!list) continue;
        for (let i = 0; i < list.length; i++) {
          const it = list[i];
          if (it._q === qid) continue;
          it._q = qid;
          fn(it);
        }
      }
    }
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

function cleanRingXZ(pts) {
  if (!pts || pts.length < 3) return null;
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (!out.length || Math.hypot(p[0] - out[out.length - 1][0], p[1] - out[out.length - 1][1]) > 0.15) {
      out.push(p);
    }
  }
  if (out.length >= 2 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < 0.15) {
    out.pop();
  }
  return out.length >= 3 ? out : null;
}

function signedAreaXZ(pts) {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  }
  return a * 0.5;
}

/** Triangulate an arbitrary (optionally holed) flat roof in XZ with upward +Y normals. */
function addPolyRoof(acc, outerPts, holeLists, y, rgb) {
  const toVec2 = (ring) => ring.map(([px, pz]) => new THREE.Vector2(px, pz));
  const contour = toVec2(outerPts);
  const holes = holeLists.map(toVec2);
  const tris = THREE.ShapeUtils.triangulateShape(contour, holes);
  const all = [outerPts, ...holeLists].flat();
  for (let i = 0; i < tris.length; i++) {
    const [ia, ib, ic] = tris[i];
    const a = all[ia];
    let b = all[ib];
    let c = all[ic];
    if ((b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]) < 0) {
      const tmp = b; b = c; c = tmp;
    }
    acc.pushTri(
      a[0], y, a[1], b[0], y, b[1], c[0], y, c[1],
      0, 1, 0, a[0] / 24, a[1] / 24, b[0] / 24, b[1] / 24, c[0] / 24, c[1] / 24, rgb,
    );
  }
}

/** Detect an oriented bounding rectangle when a 4-vertex (or nearly-rect) building fits a pitched roof cleanly. */
function fitOrientedBox(outerPts, area) {
  if (outerPts.length !== 4) return null;
  let bestLen = 0, ux = 1, uz = 0;
  for (let i = 0; i < 4; i++) {
    const [x0, z0] = outerPts[i], [x1, z1] = outerPts[(i + 1) & 3];
    const l = Math.hypot(x1 - x0, z1 - z0);
    if (l > bestLen) { bestLen = l; ux = (x1 - x0) / l; uz = (z1 - z0) / l; }
  }
  const rx = -uz, rz = ux;
  let uMin = Infinity, uMax = -Infinity, rMin = Infinity, rMax = -Infinity;
  for (const [px, pz] of outerPts) {
    const u = px * ux + pz * uz;
    const r = px * rx + pz * rz;
    if (u < uMin) uMin = u; if (u > uMax) uMax = u;
    if (r < rMin) rMin = r; if (r > rMax) rMax = r;
  }
  const w = uMax - uMin, d = rMax - rMin;
  if (w < 3.2 || d < 3.2 || w * d <= 0) return null;
  if (area / (w * d) < 0.86) return null;
  const uc = (uMin + uMax) * 0.5, rc = (rMin + rMax) * 0.5;
  const cx = ux * uc + rx * rc, cz = uz * uc + rz * rc;
  const hw = w * 0.5, hd = d * 0.5;
  return {
    cx, cz, ux, uz, rx, rz, w, d,
    corners: [
      [cx - ux * hw - rx * hd, cz - uz * hw - rz * hd],
      [cx - ux * hw + rx * hd, cz - uz * hw + rz * hd],
      [cx + ux * hw + rx * hd, cz + uz * hw + rz * hd],
      [cx + ux * hw - rx * hd, cz + uz * hw - rz * hd],
    ],
  };
}

/** Extrude a real OMT polygon building cleanly into matching batched PBR meshes (never fragmented). */
function emitOmtBuilding(acc, b, zone) {
  const outer = cleanRingXZ(b.outer);
  if (!outer) return null;
  let sa = signedAreaXZ(outer);
  if (Math.abs(sa) < 6) return null;
  const ccwOuter = sa > 0 ? [...outer].reverse() : outer;
  const cleanHoles = [];
  for (const h of b.holes) {
    const ch = cleanRingXZ(h);
    if (!ch || Math.abs(signedAreaXZ(ch)) < 4) continue;
    cleanHoles.push(signedAreaXZ(ch) < 0 ? [...ch].reverse() : ch);
  }

  const area = Math.abs(sa);
  const r0 = hash2(b.cx + 11.3, b.cz - 7.9);
  const r1 = hash2(b.cx - 4.7, b.cz + 13.1);
  const rawH = b.height > 0 ? b.height : (zone === 'industrial' || area > 400 ? 6.4 + r0 * 2.5 : area > 220 ? 9.6 + r0 * 6.4 : 4.0 + r1 * 2.8);
  const h = Math.max(3.6, Math.min(48, rawH));

  let kind = 'house';
  if ((zone === 'industrial' || area > 380) && h <= 14) kind = 'factory';
  else if (h >= 12.5 && (zone === 'commercial' || area > 240)) kind = r0 > 0.45 ? 'glass' : 'shophouse';
  else if (h >= 6.8 || area > 170) kind = zone === 'commercial' ? 'shophouse' : 'apartment';

  const box = !cleanHoles.length ? fitOrientedBox(ccwOuter, area) : null;
  if (box && ((kind === 'house' && Math.max(box.w, box.d) <= 26) || (kind === 'factory' && Math.max(box.w, box.d) <= 46))) {
    const floors = Math.max(1, Math.round(h / STOREY));
    emitBuilding(acc, box.cx, box.cz, box.ux, box.uz, box.rx, box.rz, box.corners, box.w, box.d, kind, floors, r1);
    return box;
  }

  const wallRgb = WALL_PALETTE[Math.floor(hash2(b.cx + 3, b.cz - 5) * WALL_PALETTE.length)];
  const ringWall = (accWall, y0, y1, stH, rgb) => {
    addWallRing(accWall, ccwOuter, y0, y1, stH, rgb);
    for (const hr of cleanHoles) addWallRing(accWall, hr, y0, y1, stH, rgb);
  };
  if (kind === 'glass') {
    const gRgb = GLASS_PALETTE[Math.floor(r1 * GLASS_PALETTE.length)];
    ringWall(acc.glass, 0, h, STOREY, gRgb);
    addPolyRoof(acc.roof_flat, ccwOuter, cleanHoles, h, [0.84, 0.86, 0.89]);
    if (box && h >= 12) addRooftopCrown(acc, box.cx, box.cz, box.corners, h, 0.42, 2.2);
  } else if (kind === 'shophouse') {
    const shopH = Math.min(SHOP_H, h * 0.52);
    ringWall(acc.shop, 0, shopH, shopH, wallRgb);
    if (h > shopH + 0.5) ringWall(acc.apartment, shopH, h, STOREY, wallRgb);
    addPolyRoof(acc.roof_flat, ccwOuter, cleanHoles, h, [0.90, 0.89, 0.86]);
    if (box && h >= 10) addRooftopCrown(acc, box.cx, box.cz, box.corners, h, 0.40, 2.0);
  } else if (kind === 'apartment') {
    ringWall(acc.apartment, 0, h, STOREY, wallRgb);
    addPolyRoof(acc.roof_flat, ccwOuter, cleanHoles, h, [0.90, 0.89, 0.86]);
    if (box && h >= 10 && r0 < 0.72) addRooftopCrown(acc, box.cx, box.cz, box.corners, h, 0.38, 2.0);
  } else if (kind === 'factory') {
    ringWall(acc.factory, 0, h, STOREY, [0.92, 0.94, 0.96]);
    const roofRgb = ROOF_ZINC_PALETTE[Math.floor(hash2(b.cx + 5, b.cz - 9) * ROOF_ZINC_PALETTE.length)];
    addPolyRoof(acc.roof_zinc, ccwOuter, cleanHoles, h, roofRgb);
  } else {
    ringWall(acc.house, 0, h, STOREY, wallRgb);
    const roofRgb = ROOF_ZINC_PALETTE[Math.floor(hash2(b.cx - 7, b.cz + 11) * ROOF_ZINC_PALETTE.length)];
    addPolyRoof(acc.roof_zinc, ccwOuter, cleanHoles, h, roofRgb);
  }
  return box;
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

/** @param {{ map: maplibregl.Map, toLocal: Function, materials: Object, occupancy: Object, markShadowsDirty?: Function, onFillSettled?: Function }} ctx */
export function createRoadsideFiller({ map, toLocal, materials, occupancy, markShadowsDirty, onFillSettled }) {
  const group = new THREE.Group();
  const activeTiles = new Map(); // tileId -> tile metadata
  const filledTiles = new Map(); // tileId -> { tileGroup, processedSegs, placed, bounds, interiorDone }
  const [suleX, suleZ] = toLocal(SULE[0], SULE[1]);

  let fillTimer = 0;

  /** Build one shared spatial snapshot from MapLibre 'omt' vector tiles per fill tick. */
  function buildOmtSnapshot() {
    const allRoads = map.querySourceFeatures('omt', { sourceLayer: 'transportation' });
    if (!allRoads.length) return null;

    const bounds = map.getBounds?.();
    let omtX0 = -Infinity, omtZ0 = -Infinity, omtX1 = Infinity, omtZ1 = Infinity;
    let maskX0 = -20000, maskZ0 = -20000, maskX1 = 20000, maskZ1 = 20000;
    let omtKey = 'all';
    if (bounds) {
      const [bx0, bz1] = toLocal(bounds.getWest(), bounds.getSouth());
      const [bx1, bz0] = toLocal(bounds.getEast(), bounds.getNorth());
      omtX0 = bx0; omtZ0 = bz0; omtX1 = bx1; omtZ1 = bz1;
      maskX0 = bx0 - 900; maskZ0 = bz0 - 900; maskX1 = bx1 + 900; maskZ1 = bz1 + 900;
      omtKey = `${Math.round(bx0 / 350)},${Math.round(bz0 / 350)},${Math.round(bx1 / 350)},${Math.round(bz1 / 350)}`;
    }

    const MASK_WATER_IN = 1;
    const MASK_EXCLUSION = 2;
    const MASK_WATER_SHORE = 4;
    const MASK_GLB_HARD = 8;
    const MASK_GLB_ROAD = 16;
    const MASK_OSM_BLDG = 32;
    const M_CELL = 3;
    const M_CHUNK = 128; // 384m x 384m chunks
    const maskChunks = new Map();
    const mKey = (cx, cz) => (cx + 1024) * 2048 + (cz + 1024);
    const setMaskCell = (gx, gz, bit) => {
      const cx = Math.floor(gx / M_CHUNK), cz = Math.floor(gz / M_CHUNK);
      const k = mKey(cx, cz);
      let buf = maskChunks.get(k);
      if (!buf) maskChunks.set(k, (buf = new Uint8Array(M_CHUNK * M_CHUNK)));
      buf[(gz - cz * M_CHUNK) * M_CHUNK + (gx - cx * M_CHUNK)] |= bit;
    };
    const getMask = (x, z) => {
      const gx = Math.floor(x / M_CELL), gz = Math.floor(z / M_CELL);
      const cx = Math.floor(gx / M_CHUNK), cz = Math.floor(gz / M_CHUNK);
      const buf = maskChunks.get(mKey(cx, cz));
      return buf ? buf[(gz - cz * M_CHUNK) * M_CHUNK + (gx - cx * M_CHUNK)] : 0;
    };

    const xsCross = [];
    const rasterPoly = (ringPtsList, bit) => {
      let minZ = Infinity, maxZ = -Infinity, minX = Infinity, maxX = -Infinity;
      for (const pts of ringPtsList) {
        for (let i = 0; i < pts.length; i++) {
          const px = pts[i][0], pz = pts[i][1];
          if (px < minX) minX = px; if (px > maxX) maxX = px;
          if (pz < minZ) minZ = pz; if (pz > maxZ) maxZ = pz;
        }
      }
      if (maxX < maskX0 || minX > maskX1 || maxZ < maskZ0 || minZ > maskZ1) return;
      const gz0 = Math.floor(Math.max(minZ, maskZ0) / M_CELL);
      const gz1 = Math.floor(Math.min(maxZ, maskZ1) / M_CELL);
      const gxMin = Math.floor(Math.max(minX, maskX0) / M_CELL);
      const gxMax = Math.floor(Math.min(maxX, maskX1) / M_CELL);
      for (let gz = gz0; gz <= gz1; gz++) {
        const z = (gz + 0.5) * M_CELL;
        xsCross.length = 0;
        for (const pts of ringPtsList) {
          for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const xi = pts[i][0], zi = pts[i][1];
            const xj = pts[j][0], zj = pts[j][1];
            if ((zi > z) !== (zj > z)) xsCross.push(((xj - xi) * (z - zi)) / (zj - zi) + xi);
          }
        }
        if (xsCross.length < 2) continue;
        xsCross.sort((a, b) => a - b);
        for (let k = 0; k + 1 < xsCross.length; k += 2) {
          let ga = Math.ceil(xsCross[k] / M_CELL - 0.5);
          let gb = Math.floor(xsCross[k + 1] / M_CELL - 0.5);
          if (ga < gxMin) ga = gxMin;
          if (gb > gxMax) gb = gxMax;
          if (ga > gb) continue;
          let gx = ga;
          while (gx <= gb) {
            const cx = Math.floor(gx / M_CHUNK), cz = Math.floor(gz / M_CHUNK);
            const cEnd = Math.min(gb, (cx + 1) * M_CHUNK - 1);
            const kChunk = mKey(cx, cz);
            let buf = maskChunks.get(kChunk);
            if (!buf) maskChunks.set(kChunk, (buf = new Uint8Array(M_CHUNK * M_CHUNK)));
            const rowOff = (gz - cz * M_CHUNK) * M_CHUNK;
            const lx0 = gx - cx * M_CHUNK, lx1 = cEnd - cx * M_CHUNK;
            for (let lx = lx0; lx <= lx1; lx++) buf[rowOff + lx] |= bit;
            gx = cEnd + 1;
          }
        }
      }
    };
    const rasterSeg = (ax, az, bx, bz, rad, bit) => {
      if (rad <= 0) return;
      if (Math.max(ax, bx) + rad < maskX0 || Math.min(ax, bx) - rad > maskX1) return;
      if (Math.max(az, bz) + rad < maskZ0 || Math.min(az, bz) - rad > maskZ1) return;
      const len = Math.hypot(bx - ax, bz - az);
      const rc = Math.ceil(rad / M_CELL);
      const r2 = (rad / M_CELL) ** 2;
      const steps = Math.max(1, Math.ceil(len / Math.max(2.2, rad * 0.7)));
      const dx = (bx - ax) / steps, dz = (bz - az) / steps;
      for (let s = 0; s <= steps; s++) {
        const px = ax + dx * s, pz = az + dz * s;
        if (px + rad < maskX0 || px - rad > maskX1 || pz + rad < maskZ0 || pz - rad > maskZ1) continue;
        const gcx = Math.floor(px / M_CELL), gcz = Math.floor(pz / M_CELL);
        for (let dzc = -rc; dzc <= rc; dzc++) {
          for (let dxc = -rc; dxc <= rc; dxc++) {
            if (dxc * dxc + dzc * dzc <= r2) setMaskCell(gcx + dxc, gcz + dzc, bit);
          }
        }
      }
    };

    const roadGrid = new SpatialGrid(60);
    const waterEdgeGrid = new SpatialGrid(48);
    const zones = new SpatialGrid(160);
    const omtBuildings = new SpatialGrid(60);
    const omtBldgList = [];
    const seenOmtKeys = new Set();
    const streetSegs = [];
    const bridgeSegs = [];
    const seenCoords = new Set();

    const toLocalRing = (ring) => ring.map(([lng, lat]) => toLocal(lng, lat));
    const addPolyRings = (grid, geom, extra, maskBit = 0) => {
      const polys = geom?.type === 'Polygon'
        ? [geom.coordinates]
        : geom?.type === 'MultiPolygon' ? geom.coordinates : null;
      if (!polys) return;
      for (const poly of polys) {
        if (!poly?.length || !poly[0] || poly[0].length < 3) continue;
        const ringPtsList = [];
        for (let r = 0; r < poly.length; r++) {
          if (poly[r]?.length >= 3) ringPtsList.push(toLocalRing(poly[r]));
        }
        const pts = ringPtsList[0];
        if (maskBit) rasterPoly(ringPtsList, maskBit);
        if (grid) {
          let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
          for (const [px, pz] of pts) {
            if (px < x0) x0 = px; if (px > x1) x1 = px;
            if (pz < z0) z0 = pz; if (pz > z1) z1 = pz;
          }
          grid.add({ pts, x0, z0, x1, z1, ...extra }, x0, z0, x1, z1);
        }
      }
    };

    for (const f of allRoads) {
      const cls = f.properties?.class;
      const brunnel = f.properties?.brunnel;
      if (brunnel === 'tunnel' || cls === 'ferry') continue;
      const t = f.geometry?.type;
      if (t === 'Polygon' || t === 'MultiPolygon') {
        const bit = cls === 'path' ? MASK_EXCLUSION : (MASK_EXCLUSION | MASK_GLB_HARD);
        addPolyRings(null, f.geometry, null, bit);
        continue;
      }
      const lines = t === 'LineString'
        ? [f.geometry.coordinates]
        : t === 'MultiLineString' ? f.geometry.coordinates : null;
      if (!lines) continue;

      const baseHw = ROAD_HW[cls] ?? 4.5;
      const isBridge = brunnel === 'bridge';
      const allowBuild = !isBridge && FILLABLE_ROADS.has(cls);
      const isService = cls === 'service' || cls === 'track';
      const isTrack = cls === 'track';
      const hw = isBridge ? baseHw + 9 : baseHw;
      const isMajorGlb = cls === 'motorway' || cls === 'trunk' || cls === 'primary' || cls === 'secondary' || cls === 'tertiary' || cls === 'rail' || cls === 'transit';

      for (const line of lines) {
        const localPts = line.map(([lng, lat]) => toLocal(lng, lat));
        for (let i = 1; i < localPts.length; i++) {
          const [ax, az] = localPts[i - 1];
          const [bx, bz] = localPts[i];
          const seg = { ax, az, bx, bz, hw: isBridge ? baseHw + 6 : baseHw, cls, isService, isTrack };
          roadGrid.add(seg, Math.min(ax, bx) - hw, Math.min(az, bz) - hw, Math.max(ax, bx) + hw, Math.max(az, bz) + hw);
          if (isBridge) {
            bridgeSegs.push({ ax, az, bx, bz, hw });
            rasterSeg(ax, az, bx, bz, hw * 0.82, MASK_GLB_HARD);
          } else if (isMajorGlb) {
            rasterSeg(ax, az, bx, bz, baseHw * 0.48, MASK_GLB_ROAD);
          } else if (cls === 'minor') {
            rasterSeg(ax, az, bx, bz, 1.5, MASK_GLB_ROAD);
          }
        }
        if (!allowBuild || localPts.length < 2) continue;
        // Merge short collinear/gentle-curve steps (<11m) into smooth frontage spans without skipping curves
        let sx = localPts[0][0], sz = localPts[0][1];
        for (let i = 1; i < localPts.length; i++) {
          const [ex, ez] = localPts[i];
          const chord = Math.hypot(ex - sx, ez - sz);
          let split = i === localPts.length - 1 || chord >= 14;
          if (!split && i + 1 < localPts.length) {
            const [nx, nz] = localPts[i + 1];
            const d1 = Math.hypot(ex - sx, ez - sz) || 1;
            const d2 = Math.hypot(nx - ex, nz - ez) || 1;
            const dot = ((ex - sx) * (nx - ex) + (ez - sz) * (nz - ez)) / (d1 * d2);
            if (dot < 0.84) split = true; // ~33 deg turn
          }
          if (split) {
            if (chord >= 6) {
              const key = `${Math.round(sx)}:${Math.round(sz)}:${Math.round(ex)}:${Math.round(ez)}`;
              if (!seenCoords.has(key)) {
                seenCoords.add(key);
                streetSegs.push({ ax: sx, az: sz, bx: ex, bz: ez, hw: baseHw, cls, isService, isTrack });
              }
            }
            sx = ex; sz = ez;
          }
        }
      }
    }

    for (const f of map.querySourceFeatures('omt', { sourceLayer: 'water' })) {
      const polys = f.geometry?.type === 'Polygon'
        ? [f.geometry.coordinates]
        : f.geometry?.type === 'MultiPolygon' ? f.geometry.coordinates : null;
      if (!polys) continue;
      const isPool = f.properties?.class === 'swimming_pool';
      const wBit = isPool ? MASK_WATER_IN : (MASK_WATER_IN | MASK_GLB_HARD);
      for (const poly of polys) {
        if (!poly?.length || poly[0].length < 3) continue;
        const ringPtsList = [];
        for (let r = 0; r < poly.length; r++) {
          if (poly[r]?.length >= 3) ringPtsList.push(toLocalRing(poly[r]));
        }
        rasterPoly(ringPtsList, wBit);
        for (let r = 0; r < ringPtsList.length; r++) {
          const pts = ringPtsList[r];
          for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const [ax, az] = pts[j], [bx, bz] = pts[i];
            if (Math.max(ax, bx) < maskX0 - 40 || Math.min(ax, bx) > maskX1 + 40) continue;
            if (Math.max(az, bz) < maskZ0 - 40 || Math.min(az, bz) > maskZ1 + 40) continue;
            if (r === 0) rasterSeg(ax, az, bx, bz, 0.5, wBit);
            rasterSeg(ax, az, bx, bz, 3.2, MASK_WATER_SHORE);
            waterEdgeGrid.add({ ax, az, bx, bz }, Math.min(ax, bx) - 4, Math.min(az, bz) - 4, Math.max(ax, bx) + 4, Math.max(az, bz) + 4);
          }
        }
      }
    }
    for (const layerName of ['park', 'aeroway']) {
      for (const f of map.querySourceFeatures('omt', { sourceLayer: layerName })) addPolyRings(null, f.geometry, null, MASK_EXCLUSION);
    }
    for (const f of map.querySourceFeatures('omt', { sourceLayer: 'landcover' })) {
      if (EXCLUDE_LANDCOVER.has(f.properties?.class)) addPolyRings(null, f.geometry, null, MASK_EXCLUSION);
    }
    for (const f of map.querySourceFeatures('omt', { sourceLayer: 'landuse' })) {
      const cls = f.properties?.class;
      if (EXCLUDE_LANDUSE.has(cls)) addPolyRings(null, f.geometry, null, MASK_EXCLUSION);
      else if (CAMPUS_LANDUSE.has(cls)) addPolyRings(zones, f.geometry, { zone: 'campus' });
      else if (cls === 'residential' || cls === 'quarter' || cls === 'commercial' || cls === 'retail' || cls === 'industrial') {
        addPolyRings(zones, f.geometry, { zone: cls === 'retail' ? 'commercial' : cls === 'quarter' ? 'residential' : cls });
      }
    }
    for (const f of map.querySourceFeatures('omt', { sourceLayer: 'building' })) {
      const rh = Number(f.properties?.render_height) || Number(f.properties?.height) || 0;
      const polys = f.geometry?.type === 'Polygon'
        ? [f.geometry.coordinates]
        : f.geometry?.type === 'MultiPolygon' ? f.geometry.coordinates : null;
      if (!polys) continue;
      for (const poly of polys) {
        if (!poly?.length || !poly[0] || poly[0].length < 3) continue;
        const ringPtsList = [];
        for (let r = 0; r < poly.length; r++) {
          if (poly[r]?.length >= 3) ringPtsList.push(toLocalRing(poly[r]));
        }
        const pts = ringPtsList[0];
        rasterPoly(ringPtsList, MASK_OSM_BLDG);
        let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
        for (const [px, pz] of pts) {
          if (px < x0) x0 = px; if (px > x1) x1 = px;
          if (pz < z0) z0 = pz; if (pz > z1) z1 = pz;
        }
        omtBuildings.add({ pts, x0, z0, x1, z1 }, x0, z0, x1, z1);
        const bw = x1 - x0, bd = z1 - z0;
        if (bw >= 2.2 && bd >= 2.2 && bw < 260 && bd < 260) {
          const cx = (x0 + x1) * 0.5, cz = (z0 + z1) * 0.5;
          const bKey = `${Math.round(cx * 2)}:${Math.round(cz * 2)}:${Math.round(bw * 2)}:${Math.round(bd * 2)}`;
          if (!seenOmtKeys.has(bKey)) {
            seenOmtKeys.add(bKey);
            omtBldgList.push({
              key: bKey,
              outer: pts,
              holes: ringPtsList.slice(1),
              x0, z0, x1, z1, cx, cz, height: rh,
            });
          }
        }
      }
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
          rasterSeg(ax, az, bx, bz, hw * 0.72, MASK_GLB_HARD);
        }
      }
    }

    const isExcluded = (x, z, waterPad = 2.8) => {
      if (occupancy.isOccupied(x, z, OCC_BUILDING | OCC_CLEAR | OCC_FILLER)) return true;
      if (getMask(x, z) & (MASK_WATER_IN | MASK_EXCLUSION | MASK_WATER_SHORE)) return true;
      return waterEdgeGrid.someNear(x - waterPad, z - waterPad, x + waterPad, z + waterPad, (s) =>
        segDist(x, z, s.ax, s.az, s.bx, s.bz) < waterPad,
      );
    };
    const hitsRoad = (x, z, extra = 1.2) => {
      const r = 36 + extra;
      if (roadGrid.someNear(x - r, z - r, x + r, z + r, (s) => segDist(x, z, s.ax, s.az, s.bx, s.bz) < s.hw + extra)) return true;
      for (let i = 0; i < bridgeSegs.length; i++) {
        const s = bridgeSegs[i];
        if (segDist(x, z, s.ax, s.az, s.bx, s.bz) < s.hw + extra) return true;
      }
      return false;
    };
    const hitsRoadBox = (cx, cz, ux, uz, rx, rz, hw, hd, extra = 1.6) => {
      const r = Math.hypot(hw, hd) + 36 + extra;
      if (roadGrid.someNear(cx - r, cz - r, cx + r, cz + r, (s) => segDistOBB(s.ax, s.az, s.bx, s.bz, cx, cz, ux, uz, rx, rz, hw, hd) < s.hw + extra)) return true;
      for (let i = 0; i < bridgeSegs.length; i++) {
        const s = bridgeSegs[i];
        if (segDistOBB(s.ax, s.az, s.bx, s.bz, cx, cz, ux, uz, rx, rz, hw, hd) < s.hw + extra) return true;
      }
      return false;
    };
    const hitsWaterEdgeBox = (cx, cz, ux, uz, rx, rz, hw, hd, waterPad = 2.6) => {
      const span = Math.hypot(hw, hd) + waterPad;
      return waterEdgeGrid.someNear(cx - span, cz - span, cx + span, cz + span, (s) =>
        segDistOBB(s.ax, s.az, s.bx, s.bz, cx, cz, ux, uz, rx, rz, hw, hd) < waterPad,
      );
    };

    const buildCompCache = (entry, fx, fz) => {
      const structural = [];
      const other = [];
      let totalTris = 0;
      for (const m of entry.meshes) {
        const pos = m.geometry?.attributes?.position;
        if (!pos) continue;
        m.updateWorldMatrix(true, false);
        const te = m.matrixWorld.elements;
        const { arr: arrPos, stride, offset, normDiv } = unpackPosAccessor(pos);
        const fastAxis = pos.itemSize === 3 && Math.abs(te[1]) < 1e-6 && Math.abs(te[2]) < 1e-6 && Math.abs(te[8]) < 1e-6;
        const vx = new Float32Array(pos.count);
        const vz = new Float32Array(pos.count);
        if (fastAxis) {
          const sx = te[0] / normDiv, sz = te[10] / normDiv, tx = te[12] + fx, tz = te[14] + fz;
          for (let v = 0, p = offset; v < pos.count; v++, p += stride) {
            vx[v] = arrPos[p] * sx + tx;
            vz[v] = arrPos[p + 2] * sz + tz;
          }
        } else {
          for (let v = 0; v < pos.count; v++) {
            const lx = pos.getX(v), ly = pos.getY(v), lz = pos.getZ(v);
            vx[v] = te[0] * lx + te[4] * ly + te[8] * lz + te[12] + fx;
            vz[v] = te[2] * lx + te[6] * ly + te[10] * lz + te[14] + fz;
          }
        }
        const geo = m.geometry;
        let idx = geo.index;
        if (!idx) {
          const raw = new Uint32Array(pos.count);
          for (let i = 0; i < pos.count; i++) raw[i] = i;
          geo.setIndex(new THREE.BufferAttribute(raw, 1));
          idx = geo.index;
        }
        const origIdx = new Uint32Array(idx.array);
        const triCount = (origIdx.length / 3) | 0;
        const matName = m.userData._matName;
        if (matName === 'car' || matName === 'parking') {
          other.push({ geo, vx, vz, origIdx, triCount, posCount: pos.count, dropped: new Uint8Array(triCount) });
        } else {
          const isTrim = matName === 'roof_flat' || matName === 'roof_zinc' || matName === 'glass';
          structural.push({ geo, vx, vz, origIdx, triCount, triStart: totalTris, posCount: pos.count, isTrim });
          totalTris += triCount;
        }
      }

      const parent = new Int32Array(totalTris);
      const bMinX = new Float32Array(totalTris);
      const bMaxX = new Float32Array(totalTris);
      const bMinZ = new Float32Array(totalTris);
      const bMaxZ = new Float32Array(totalTris);
      const tcx = new Float32Array(totalTris);
      const tcz = new Float32Array(totalTris);
      for (let i = 0; i < totalTris; i++) parent[i] = i;
      const find = (a) => {
        while (parent[a] !== a) {
          parent[a] = parent[parent[a]];
          a = parent[a];
        }
        return a;
      };
      const vertOwner = new Map();
      let gid = 0;
      for (const sm of structural) {
        const { vx, vz, origIdx, triCount } = sm;
        for (let f = 0, t = 0; f < triCount; f++, t += 3) {
          const a = origIdx[t], b = origIdx[t + 1], c = origIdx[t + 2];
          const x0 = vx[a], x1 = vx[b], x2 = vx[c];
          const z0 = vz[a], z1 = vz[b], z2 = vz[c];
          bMinX[gid] = Math.min(x0, x1, x2); bMaxX[gid] = Math.max(x0, x1, x2);
          bMinZ[gid] = Math.min(z0, z1, z2); bMaxZ[gid] = Math.max(z0, z1, z2);
          tcx[gid] = (x0 + x1 + x2) * 0.33333334;
          tcz[gid] = (z0 + z1 + z2) * 0.33333334;
          for (const v of [a, b, c]) {
            const kx = Math.round(vx[v] * 1.5), kz = Math.round(vz[v] * 1.5);
            const k = (kx + 65536) * 131072 + (kz + 65536);
            const prev = vertOwner.get(k);
            if (prev === undefined) {
              vertOwner.set(k, gid);
            } else {
              const ra = find(prev), rb = find(gid);
              if (ra !== rb) {
                const nMinX = bMinX[ra] < bMinX[rb] ? bMinX[ra] : bMinX[rb];
                const nMaxX = bMaxX[ra] > bMaxX[rb] ? bMaxX[ra] : bMaxX[rb];
                const nMinZ = bMinZ[ra] < bMinZ[rb] ? bMinZ[ra] : bMinZ[rb];
                const nMaxZ = bMaxZ[ra] > bMaxZ[rb] ? bMaxZ[ra] : bMaxZ[rb];
                if (nMaxX - nMinX <= 160 && nMaxZ - nMinZ <= 160) {
                  parent[rb] = ra;
                  bMinX[ra] = nMinX; bMaxX[ra] = nMaxX;
                  bMinZ[ra] = nMinZ; bMaxZ[ra] = nMaxZ;
                }
              }
            }
          }
          gid++;
        }
        sm.vx = null;
        sm.vz = null;
      }

      const rootToComp = new Map();
      const triComp = new Int32Array(totalTris);
      let numComps = 0;
      for (let i = 0; i < totalTris; i++) {
        const r = find(i);
        let cid = rootToComp.get(r);
        if (cid === undefined) {
          cid = numComps++;
          rootToComp.set(r, cid);
        }
        triComp[i] = cid;
      }
      const compMinX = new Float32Array(numComps);
      const compMaxX = new Float32Array(numComps);
      const compMinZ = new Float32Array(numComps);
      const compMaxZ = new Float32Array(numComps);
      const compCount = new Int32Array(numComps);
      const compHasWall = new Uint8Array(numComps);
      for (const [r, cid] of rootToComp) {
        compMinX[cid] = bMinX[r]; compMaxX[cid] = bMaxX[r];
        compMinZ[cid] = bMinZ[r]; compMaxZ[cid] = bMaxZ[r];
      }
      for (let i = 0; i < totalTris; i++) compCount[triComp[i]]++;
      for (const sm of structural) {
        if (sm.isTrim) continue;
        const end = sm.triStart + sm.triCount;
        for (let i = sm.triStart; i < end; i++) compHasWall[triComp[i]] = 1;
      }
      return {
        structural, other, totalTris, triComp, tcx, tcz, numComps,
        compMinX, compMaxX, compMinZ, compMaxZ, compCount, compHasWall,
        droppedComps: new Uint8Array(numComps),
      };
    };

    const filterCityEntry = (entry) => {
      if (!entry?.meshes?.length) return;
      if (entry._fullyCovered || entry._omtKey === omtKey) return;
      entry.scene.updateMatrixWorld(true);
      const te0 = entry.scene.matrixWorld.elements;
      let fx = 0, fz = 0;
      if (Math.hypot(te0[12], te0[14]) < 1 && entry.tile?.lng != null) {
        const cos0 = Math.cos((16.774401 * Math.PI) / 180);
        fx = (entry.tile.lng - 96.158764) * (Math.PI / 180) * 6378137 * cos0;
        fz = -(entry.tile.lat - 16.774401) * (Math.PI / 180) * 6378137;
      }
      if (entry.tile?.lng != null) {
        const [tx0, tz1] = toLocal(entry.tile.lng - 0.02, entry.tile.lat - 0.02);
        const [tx1, tz0] = toLocal(entry.tile.lng + 0.02, entry.tile.lat + 0.02);
        entry._omtKey = omtKey;
        if (tx1 < omtX0 || tx0 > omtX1 || tz1 < omtZ0 || tz0 > omtZ1) return;
        if (omtX0 <= tx0 + 60 && omtX1 >= tx1 - 60 && omtZ0 <= tz0 + 60 && omtZ1 >= tz1 - 60) {
          entry._fullyCovered = true;
        }
      } else {
        entry._omtKey = omtKey;
      }

      const cache = entry._compCache ?? (entry._compCache = buildCompCache(entry, fx, fz));
      const { structural, other, totalTris, triComp, tcx, tcz, numComps,
        compMinX, compMaxX, compMinZ, compMaxZ, compCount, compHasWall, droppedComps } = cache;

      const compOsm = new Uint8Array(numComps);
      const compHard = new Uint16Array(numComps);
      const compRoad = new Uint16Array(numComps);
      for (let c = 0; c < numComps; c++) {
        if (droppedComps[c]) continue;
        if (compMaxX[c] < omtX0 || compMinX[c] > omtX1 || compMaxZ[c] < omtZ0 || compMinZ[c] > omtZ1) continue;
        const bx = (compMinX[c] + compMaxX[c]) * 0.5;
        const bz = (compMinZ[c] + compMaxZ[c]) * 0.5;
        const m = getMask(bx, bz);
        if (m & MASK_OSM_BLDG) { compOsm[c] = 1; continue; }
        if (m & MASK_GLB_HARD) compHard[c] += 4;
        if (m & MASK_GLB_ROAD) compRoad[c] += 4;
      }
      for (let i = 0; i < totalTris; i++) {
        const c = triComp[i];
        if (droppedComps[c] || compOsm[c]) continue;
        const x = tcx[i], z = tcz[i];
        if (x < omtX0 || x > omtX1 || z < omtZ0 || z > omtZ1) continue;
        const m = getMask(x, z);
        if (m & MASK_OSM_BLDG) { compOsm[c] = 1; continue; }
        if (m & MASK_GLB_HARD) compHard[c]++;
        if (m & MASK_GLB_ROAD) compRoad[c]++;
      }

      let newlyDropped = 0;
      const droppedBoxes = [];
      for (let c = 0; c < numComps; c++) {
        if (droppedComps[c] || compOsm[c]) continue;
        if (compMaxX[c] < omtX0 || compMinX[c] > omtX1 || compMaxZ[c] < omtZ0 || compMinZ[c] > omtZ1) continue;
        const cnt = compCount[c];
        const bx = (compMinX[c] + compMaxX[c]) * 0.5;
        const bz = (compMinZ[c] + compMaxZ[c]) * 0.5;
        const bm = getMask(bx, bz);
        const hitWaterBridge = (bm & MASK_GLB_HARD) || compHard[c] >= Math.max(2, Math.ceil(cnt * 0.28));
        const hitRoadCenter = (bm & MASK_GLB_ROAD) && compRoad[c] >= Math.max(2, Math.ceil(cnt * 0.5));
        if (hitWaterBridge || hitRoadCenter) {
          droppedComps[c] = 1;
          newlyDropped++;
          droppedBoxes.push(compMinX[c] - 4, compMinZ[c] - 4, compMaxX[c] + 4, compMaxZ[c] + 4);
        }
      }
      if (droppedBoxes.length) {
        for (let c = 0; c < numComps; c++) {
          if (droppedComps[c] || compOsm[c] || (compCount[c] >= 6 && compHasWall[c])) continue;
          const bx = (compMinX[c] + compMaxX[c]) * 0.5;
          const bz = (compMinZ[c] + compMaxZ[c]) * 0.5;
          for (let k = 0; k < droppedBoxes.length; k += 4) {
            if (bx >= droppedBoxes[k] && bx <= droppedBoxes[k + 2] && bz >= droppedBoxes[k + 1] && bz <= droppedBoxes[k + 3]) {
              droppedComps[c] = 1;
              newlyDropped++;
              break;
            }
          }
        }
      }

      const applyTriFilter = (geo, origIdx, posCount, triCount, isDropped) => {
        let keptTris = 0;
        for (let f = 0; f < triCount; f++) if (!isDropped(f)) keptTris++;
        const nextCount = keptTris * 3;
        if (nextCount === geo.index?.count) return;
        const kept = new (posCount > 65535 ? Uint32Array : Uint16Array)(nextCount);
        for (let f = 0, t = 0, w = 0; f < triCount; f++, t += 3) {
          if (!isDropped(f)) {
            kept[w++] = origIdx[t];
            kept[w++] = origIdx[t + 1];
            kept[w++] = origIdx[t + 2];
          }
        }
        geo.setIndex(new THREE.BufferAttribute(kept, 1));
        geo.index.needsUpdate = true;
      };

      let stripped = 0;
      if (newlyDropped > 0) {
        for (const sm of structural) {
          const { geo, origIdx, triCount, triStart, posCount } = sm;
          let droppedHere = 0;
          for (let f = 0; f < triCount; f++) {
            if (droppedComps[triComp[triStart + f]]) droppedHere++;
          }
          if (!droppedHere) continue;
          stripped += droppedHere;
          applyTriFilter(geo, origIdx, posCount, triCount, (f) => droppedComps[triComp[triStart + f]]);
        }
      }

      for (const om of other) {
        const { geo, vx, vz, origIdx, triCount, posCount, dropped } = om;
        let meshChanged = false;
        for (let f = 0, t = 0; f < triCount; f++, t += 3) {
          if (dropped[f]) continue;
          const a = origIdx[t], b = origIdx[t + 1], c = origIdx[t + 2];
          const cx = (vx[a] + vx[b] + vx[c]) * 0.33333334;
          const cz = (vz[a] + vz[b] + vz[c]) * 0.33333334;
          if (cx < omtX0 || cx > omtX1 || cz < omtZ0 || cz > omtZ1) continue;
          const m = getMask(cx, cz);
          if (!(m & MASK_OSM_BLDG) && (m & (MASK_GLB_HARD | MASK_GLB_ROAD | MASK_WATER_IN))) {
            dropped[f] = 1;
            meshChanged = true;
            stripped++;
          }
        }
        if (meshChanged) applyTriFilter(geo, origIdx, posCount, triCount, (f) => dropped[f]);
      }

      if (stripped > 0) {
        occupancy._onCityFiltered?.(entry);
        if (import.meta.env?.DEV) {
          console.debug(`[city-tiles] stripped ${stripped} whole-building tris (${newlyDropped} comps) from ${entry.tile?.id ?? 'tile'}`);
        }
      }
    };
    occupancy._filterCityEntry = filterCityEntry;
    const hitsOmtBldg = (corners, pad = 0.9) => {
      let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
      for (const [cx, cz] of corners) {
        if (cx < x0) x0 = cx; if (cx > x1) x1 = cx;
        if (cz < z0) z0 = cz; if (cz > z1) z1 = cz;
      }
      x0 -= pad; z0 -= pad; x1 += pad; z1 += pad;
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      return omtBuildings.someNear(x0, z0, x1, z1, (b) => {
        if (b.x1 < x0 || b.x0 > x1 || b.z1 < z0 || b.z0 > z1) return false;
        if (b.pts.some(([px, pz]) => px > x0 && px < x1 && pz > z0 && pz < z1)) return true;
        return corners.some(([px, pz]) => insidePoly(px, pz, b.pts)) || insidePoly(mx, mz, b.pts);
      });
    };
    const zoneAt = (x, z) => {
      let found = null;
      zones.forEachNear(x, z, x, z, (zPoly) => {
        if (!found && x >= zPoly.x0 && x <= zPoly.x1 && z >= zPoly.z0 && z <= zPoly.z1 && insidePoly(x, z, zPoly.pts)) {
          found = zPoly.zone;
        }
      });
      return found;
    };

    const countLocalRoads = (x, z, r = 100) => {
      let count = 0;
      roadGrid.forEachNear(x - r, z - r, x + r, z + r, (s) => {
        if (count < 4 && segDist(x, z, s.ax, s.az, s.bx, s.bz) < r) count++;
      });
      return count;
    };

    const isBlockedOmtBldg = (x, z) => (getMask(x, z) & (MASK_GLB_HARD | MASK_WATER_IN)) !== 0;

    return {
      roadGrid, streetSegs, omtBldgList, countLocalRoads, isExcluded, isBlockedOmtBldg,
      hitsRoad, hitsRoadBox, hitsWaterEdgeBox, hitsOmtBldg, zoneAt, omtKey, filterCityEntry,
    };
  }

  function fillTileIncremental(tile, snap, deadline = Infinity, maxPass2Sectors = Infinity) {
    const step = 0.04;
    const minLng = tile.lng - step / 2, maxLng = tile.lng + step / 2;
    const minLat = tile.lat - step / 2, maxLat = tile.lat + step / 2;
    const [txMin, tzMax] = toLocal(minLng, minLat);
    const [txMax, tzMin] = toLocal(maxLng, maxLat);

    let state = filledTiles.get(tile.id);
    if (!state) {
      state = {
        tileGroup: new THREE.Group(),
        processedOmt: new Set(),
        processedSegs: new Set(),
        placed: 0,
        bounds: [txMin, tzMin, txMax, tzMax],
        sectorsDone: new Set(),
      };
      filledTiles.set(tile.id, state);
      group.add(state.tileGroup);
    }
    if (state.placed >= MAX_FILL_PER_TILE) return { changed: false, more: false };

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

    const { roadGrid, streetSegs, omtBldgList, countLocalRoads, isExcluded, isBlockedOmtBldg, hitsRoad, hitsRoadBox, hitsWaterEdgeBox, hitsOmtBldg, zoneAt } = snap;
    const newStreetSegs = [];
    if (state.placed < PASS1_CAP) {
      for (const s of streetSegs) {
        if (Math.max(s.ax, s.bx) < vxMin - 40 || Math.min(s.ax, s.bx) > vxMax + 40) continue;
        if (Math.max(s.az, s.bz) < vzMin - 40 || Math.min(s.az, s.bz) > vzMax + 40) continue;
        const key = `${Math.round(s.ax)}:${Math.round(s.az)}:${Math.round(s.bx)}:${Math.round(s.bz)}`;
        if (!state.processedSegs.has(key)) newStreetSegs.push({ s, key });
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
    let incomplete = false;

    // Pass 0: Extrude real mapped OSM building footprints when not already covered by a loaded GLB / landmark
    for (let i = 0; i < omtBldgList.length; i++) {
      if (state.placed >= MAX_FILL_PER_TILE) break;
      if (i > 0 && (i & 31) === 0 && performance.now() >= deadline) { incomplete = true; break; }
      const b = omtBldgList[i];
      if (b.cx < txMin || b.cx >= txMax || b.cz < tzMin || b.cz >= tzMax) continue;
      if (b.x1 < vxMin - 80 || b.x0 > vxMax + 80 || b.z1 < vzMin - 80 || b.z0 > vzMax + 80) continue;
      if (state.processedOmt.has(b.key)) continue;
      state.processedOmt.add(b.key);

      if (isBlockedOmtBldg(b.cx, b.cz)) continue;
      if (occupancy.isOccupied(b.cx, b.cz, OCC_BUILDING | OCC_CLEAR | OCC_FILLER)) continue;
      const inClear = b.outer.some(([px, pz]) => occupancy.isOccupied(px, pz, OCC_CLEAR));
      if (inClear) continue;
      let glbHits = 0;
      for (let k = 0; k < b.outer.length; k++) {
        const mx = b.cx + (b.outer[k][0] - b.cx) * 0.6;
        const mz = b.cz + (b.outer[k][1] - b.cz) * 0.6;
        if (occupancy.isOccupied(mx, mz, OCC_BUILDING)) glbHits++;
      }
      if (glbHits >= Math.max(1, Math.ceil(b.outer.length * 0.45))) continue;

      const box = emitOmtBuilding(acc, b, zoneAt(b.cx, b.cz));
      if (box) {
        occupancy.stampBox(box.cx, box.cz, box.ux, box.uz, box.w * 0.5, box.d * 0.5, OCC_FILLER);
      } else {
        occupancy.stampBox(b.cx, b.cz, 1, 0, (b.x1 - b.x0) * 0.45, (b.z1 - b.z0) * 0.45, OCC_FILLER);
      }
      state.placed++;
      batchPlaced++;
    }

    const tryPlaceLot = (cx, cz, ux, uz, rx, rz, kind, w, d, floors, r1, extraPad = 0.4) => {
      if (cx < txMin + 5 || cx > txMax - 5 || cz < tzMin + 5 || cz > tzMax - 5) return false;
      const hw = w / 2, hd = d / 2;
      const corners = [
        [cx - ux * hw - rx * hd, cz - uz * hw - rz * hd],
        [cx - ux * hw + rx * hd, cz - uz * hw + rz * hd],
        [cx + ux * hw + rx * hd, cz + uz * hw + rz * hd],
        [cx + ux * hw - rx * hd, cz + uz * hw - rz * hd],
      ];
      const probes = [
        ...corners,
        [cx - ux * hw, cz - uz * hw],
        [cx + ux * hw, cz + uz * hw],
        [cx - rx * hd, cz - rz * hd],
        [cx + rx * hd, cz + rz * hd],
      ];
      if (isExcluded(cx, cz) || probes.some(([px, pz]) => isExcluded(px, pz))) return false;
      if (hitsWaterEdgeBox(cx, cz, ux, uz, rx, rz, hw, hd, 2.6)) return false;
      if (hitsRoadBox(cx, cz, ux, uz, rx, rz, hw, hd, 1.6)) return false;
      if (occupancy.hasAnyBox(cx, cz, ux, uz, hw + extraPad, hd + extraPad, OCC_BUILDING | OCC_CLEAR | OCC_FILLER)) return false;
      if (hitsOmtBldg(corners, 0.9)) return false;

      occupancy.stampBox(cx, cz, ux, uz, hw, hd, OCC_FILLER);
      emitBuilding(acc, cx, cz, ux, uz, rx, rz, corners, w, d, kind, floors, r1);
      state.placed++;
      batchPlaced++;
      return true;
    };

    // Pass 1: Tight continuous roadside urban frontage across all Yangon townships (no distance cutoff)
    newStreetSegs.sort((a, b) => hash2(a.s.ax, a.s.az) - hash2(b.s.ax, b.s.az));
    for (let idx = 0; idx < newStreetSegs.length && !incomplete; idx++) {
      if (state.placed >= PASS1_CAP) break;
      if (idx > 0 && performance.now() >= deadline) { incomplete = true; break; }
      const { s, key } = newStreetSegs[idx];
      state.processedSegs.add(key);
      const len = Math.hypot(s.bx - s.ax, s.bz - s.az);
      if (len < 6) continue;
      const ux = (s.bx - s.ax) / len, uz = (s.bz - s.az) / len;
      const rx = -uz, rz = ux;
      const isMajor = s.cls === 'primary' || s.cls === 'secondary';

      for (const side of [1, -1]) {
        const sx = rx * side, sz = rz * side;
        let t = 3.0 + hash2(s.ax + side * 3, s.az) * 2.5;
        while (t < len - 4 && state.placed < PASS1_CAP) {
          const mx = s.ax + ux * t, mz = s.az + uz * t;
          if (mx < txMin + 5 || mx > txMax - 5 || mz < tzMin + 5 || mz > tzMax - 5) { t += 12; continue; }

          const r0 = hash2(mx, mz);
          const r1 = hash2(mx + 19.3, mz - 7.1);
          const r2 = hash2(mx - 11.7, mz + 23.4);

          const probeX = mx + sx * (s.hw + 9), probeZ = mz + sz * (s.hw + 9);
          const probeZone = zoneAt(probeX, probeZ);
          const distSuleKm = Math.hypot(mx - suleX, mz - suleZ) / 1000;
          const localRoads = probeZone ? 3 : countLocalRoads(probeX, probeZ, 95);
          if (s.isTrack && !probeZone) { t += 18; continue; }
          if (s.isService && !probeZone && localRoads < 2) { t += 16; continue; }
          if (!probeZone && localRoads < 2 && distSuleKm > 12.0 && r0 > 0.56) { t += 14 + r1 * 12; continue; }
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
          } else if (probeZone === 'commercial' || (isMajor && (distSuleKm < 6.8 || localRoads >= 2))) {
            w = 7.4 + r0 * 5.0; d = 12.2 + r1 * 5.0; floors = distSuleKm < 10 ? 3 + Math.floor(r2 * 4) : 2 + Math.floor(r2 * 2);
            kind = r2 > 0.78 && distSuleKm < 11 ? 'glass' : 'shophouse';
          } else if (r0 < (distSuleKm < 6.0 ? 0.46 : probeZone === 'residential' ? 0.24 : 0.14)) {
            w = 9.5 + r0 * 6.0; d = 12.5 + r1 * 5.5; floors = distSuleKm < 10 ? 3 + Math.floor(r2 * 3) : 2 + (r2 > 0.5 ? 1 : 0);
            kind = 'apartment';
          } else {
            w = 6.8 + r0 * 4.0; d = 8.6 + r1 * 4.2; floors = 1 + (r2 > 0.46 ? 1 : 0);
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

    // Pass 2: Empty Block Interior Infill by visible 256m sector (mapped zones + unzoned neighborhood street grids)
    const SEC = 256;
    const [tileCx, tileCz] = toLocal(tile.lng, tile.lat);
    const stepG = Math.hypot(tileCx - suleX, tileCz - suleZ) > 8500 ? 24.5 : 19.5;
    const sx0 = Math.floor(Math.max(txMin + 12, vxMin) / SEC);
    const sx1 = Math.floor(Math.min(txMax - 12, vxMax) / SEC);
    const sz0 = Math.floor(Math.max(tzMin + 12, vzMin) / SEC);
    const sz1 = Math.floor(Math.min(tzMax - 12, vzMax) / SEC);

    let pass2SectorsRan = 0;
    for (let sz = sz0; sz <= sz1 && state.placed < MAX_FILL_PER_TILE && !incomplete; sz++) {
      for (let sx = sx0; sx <= sx1 && state.placed < MAX_FILL_PER_TILE; sx++) {
        const sKey = (sx + 512) * 1024 + (sz + 512);
        if (state.sectorsDone.has(sKey)) continue;
        if (pass2SectorsRan >= maxPass2Sectors) { incomplete = true; break; }
        const beforeSect = state.placed;

        const xA = Math.max(txMin + 12, sx * SEC);
        const xB = Math.min(txMax - 12, (sx + 1) * SEC);
        const zA = Math.max(tzMin + 12, sz * SEC);
        const zB = Math.min(tzMax - 12, (sz + 1) * SEC);

        for (let gz = Math.ceil(zA / stepG) * stepG; gz < zB && state.placed < MAX_FILL_PER_TILE; gz += stepG) {
          for (let gx = Math.ceil(xA / stepG) * stepG; gx < xB && state.placed < MAX_FILL_PER_TILE; gx += stepG) {
            const distSuleKm = Math.hypot(gx - suleX, gz - suleZ) / 1000;
            const zone = zoneAt(gx, gz);
            if (!zone && !roadGrid.someNear(gx - 100, gz - 100, gx + 100, gz + 100, (s) => segDist(gx, gz, s.ax, s.az, s.bx, s.bz) < 100)) continue;
            const r0 = hash2(gx, gz);
            if (zone === 'campus' && r0 < 0.40) continue; // natural campus / institutional compounds
            if (zone === 'industrial' && r0 < 0.34) continue;
            if (r0 < 0.05 || isExcluded(gx, gz) || hitsRoad(gx, gz, 2.2)) continue;
            if (!zone && countLocalRoads(gx, gz, 100) < 2) continue;

            // Align to closest street orientation within 240m, or default compass grid inside mapped urban blocks
            let bestS = null, bestD = 240;
            roadGrid.forEachNear(gx - 240, gz - 240, gx + 240, gz + 240, (s) => {
              const d = segDist(gx, gz, s.ax, s.az, s.bx, s.bz);
              if (d < bestD) { bestD = d; bestS = s; }
            });
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
        if (state.placed > beforeSect) pass2SectorsRan++;
        if (performance.now() >= deadline) { incomplete = true; break; }
      }
    }

    if (batchPlaced > 0) {
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
    }
    return { changed: batchPlaced > 0, more: incomplete };
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

  let activeSnap = null;
  let dirtyPending = false;
  let needsTreeRefresh = false;
  function nextPendingGlbEntry(omtKey) {
    if (!occupancy._cityTiles?.size) return null;
    for (const entry of occupancy._cityTiles) {
      if (!entry._fullyCovered && entry._omtKey !== omtKey) return entry;
    }
    return null;
  }

  function currentOmtKey() {
    const b = map.getBounds?.();
    if (!b) return 'all';
    const [bx0, bz1] = toLocal(b.getWest(), b.getSouth());
    const [bx1, bz0] = toLocal(b.getEast(), b.getNorth());
    return `${Math.round(bx0 / 350)},${Math.round(bz0 / 350)},${Math.round(bx1 / 350)},${Math.round(bz1 / 350)}`;
  }

  let srcWaitRetries = 0;
  let lastShadowTickMs = 0;
  function prioritizedActiveTiles() {
    const c = map.getCenter?.();
    const b = map.getBounds?.();
    const [cx, cz] = c ? toLocal(c.lng, c.lat) : [0, 0];
    const [bx0, bz1] = b ? toLocal(b.getWest(), b.getSouth()) : [-Infinity, Infinity];
    const [bx1, bz0] = b ? toLocal(b.getEast(), b.getNorth()) : [Infinity, -Infinity];
    return [...activeTiles.values()]
      .map((tile) => {
        const [tx, tz] = toLocal(tile.lng, tile.lat);
        const inView = b ? (tx + 2300 >= bx0 && tx - 2300 <= bx1 && tz + 2300 >= bz0 && tz - 2300 <= bz1) : true;
        return { tile, inView, d: Math.hypot(tx - cx, tz - cz) };
      })
      .sort((a, b2) => (a.inView === b2.inView ? a.d - b2.d : a.inView ? -1 : 1))
      .map((x) => x.tile);
  }

  function runFillSlice() {
    fillTimer = 0;
    if (map.getZoom() < 13.0) return;
    if (map.isMoving?.() || map.isZooming?.() || map.isRotating?.()) return;
    if (map.isSourceLoaded && !map.isSourceLoaded('omt')) {
      if (srcWaitRetries < 15) {
        srcWaitRetries++;
        fillTimer = setTimeout(runFillSlice, 160);
      }
      return;
    }
    srcWaitRetries = 0;

    const curKey = currentOmtKey();
    const pendingGlb = nextPendingGlbEntry(curKey);
    const pendingFill = activeTiles.size > 0 && hasPendingWork();
    if (!pendingGlb && !pendingFill) {
      if (dirtyPending) {
        dirtyPending = false;
        markShadowsDirty?.();
        map.triggerRepaint();
      }
      if (needsTreeRefresh) {
        needsTreeRefresh = false;
        onFillSettled?.();
      }
      return;
    }

    const snap = activeSnap ?? (activeSnap = buildOmtSnapshot());
    if (!snap) return;

    const glbDeadline = performance.now() + 24;
    let glbEntry = nextPendingGlbEntry(snap.omtKey);
    while (glbEntry) {
      snap.filterCityEntry(glbEntry);
      glbEntry = nextPendingGlbEntry(snap.omtKey);
      if (glbEntry && performance.now() >= glbDeadline) {
        fillTimer = setTimeout(runFillSlice, 10);
        return;
      }
    }

    if (!activeTiles.size || !hasPendingWork()) {
      if (dirtyPending) {
        dirtyPending = false;
        markShadowsDirty?.();
        map.triggerRepaint();
      }
      if (needsTreeRefresh) {
        needsTreeRefresh = false;
        onFillSettled?.();
      }
      return;
    }

    const tilesOrdered = prioritizedActiveTiles();
    const deadline = performance.now() + 30;
    let moreWork = false;
    // Stage 1: Pass 0/1 frontage across visible tiles first, plus max 4 Pass 2 sectors per tile round-robin
    for (const tile of tilesOrdered) {
      if (performance.now() >= deadline) { moreWork = hasPendingWork(); break; }
      const res = fillTileIncremental(tile, snap, deadline, 4);
      if (res.changed) { dirtyPending = true; needsTreeRefresh = true; }
      if (res.more) moreWork = true;
    }
    if (!moreWork) moreWork = hasPendingWork();
    const now = performance.now();
    if (dirtyPending) {
      // Avoid expensive 2048px shadow re-bakes every slice; bake cleanly once throttled & when settled
      if (!moreWork || now - lastShadowTickMs > 450) {
        markShadowsDirty?.();
        lastShadowTickMs = now;
      }
      map.triggerRepaint();
      dirtyPending = false;
    }
    if (!moreWork && needsTreeRefresh) {
      needsTreeRefresh = false;
      onFillSettled?.();
    }
    if (moreWork) {
      fillTimer = setTimeout(runFillSlice, 10);
    }
  }

  function scheduleFill(delay = 90) {
    srcWaitRetries = 0;
    activeSnap = null;
    if (fillTimer) clearTimeout(fillTimer);
    fillTimer = setTimeout(runFillSlice, delay);
  }

  map.on('movestart', () => {
    if (fillTimer) { clearTimeout(fillTimer); fillTimer = 0; }
  });
  map.on('idle', () => scheduleFill(90));
  map.on('moveend', () => scheduleFill(120));

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
