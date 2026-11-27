// Lush tropical avenue & park trees across Yangon in 2 InstancedMesh draw calls total
// (1 trunk mesh + 1 multi-lobe shaded canopy mesh), respecting roads, water, sports pitches,
// landmarks, and building footprints via CityOccupancy + MapLibre 'omt' vector tiles.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { OCC_BUILDING, OCC_CLEAR, OCC_FILLER } from './city-occupancy.js';

const MAX_TREES = 2600;
const NEAR_KM = 4.2;
const MIN_ZOOM = 13.4;

const ROAD_HW = {
  motorway: 14,
  trunk: 12,
  primary: 9.5,
  secondary: 7.5,
  tertiary: 6.5,
  minor: 5.0,
  service: 3.5,
};

const CANOPY_PALETTE = [
  new THREE.Color('#4c8f3d'),
  new THREE.Color('#5ca348'),
  new THREE.Color('#6db454'),
  new THREE.Color('#437f39'),
  new THREE.Color('#7aba5b'),
];

function hash2(x, z) {
  let h = (Math.imul(Math.round(x * 2), 374761393) + Math.imul(Math.round(z * 2), 668265263)) | 0;
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

/** Smooth 3-puff rain-tree/banyan tropical canopy geometry (~90 tris, unit radius ~1). */
function buildCanopyGeometry() {
  const puffs = [
    [0.0, 1.38, 0.0, 0.72, 0.52],
    [-0.36, 1.12, 0.22, 0.50, 0.40],
    [0.36, 1.14, -0.18, 0.48, 0.39],
    [0.04, 1.16, 0.34, 0.44, 0.36],
  ];
  const parts = puffs.map(([ox, oy, oz, rx, ry]) => {
    const g = new THREE.IcosahedronGeometry(1, 1);
    g.scale(rx, ry, rx);
    g.translate(ox, oy, oz);
    // Bake gentle underside self-occlusion in vertex color so canopy crowns pop cleanly
    const pos = g.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const k = THREE.MathUtils.clamp(0.76 + (pos.getY(i) - 0.75) * 0.32, 0.72, 1.12);
      cols[i * 3] = k;
      cols[i * 3 + 1] = k * 1.02;
      cols[i * 3 + 2] = k * 0.94;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    return g;
  });
  const merged = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  merged.computeVertexNormals();
  return merged;
}

function buildTrunkGeometry() {
  const g = new THREE.CylinderGeometry(0.11, 0.17, 1.05, 6, 1);
  g.translate(0, 0.52, 0);
  return g;
}

/** @param {{ map: maplibregl.Map, toLocal: Function, envMap?: THREE.Texture, occupancy: Object, markShadowsDirty?: Function }} ctx */
export function createUrbanTrees({ map, toLocal, envMap = null, occupancy, markShadowsDirty }) {
  const group = new THREE.Group();

  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x6a4e36,
    roughness: 0.92,
    metalness: 0.0,
    envMap,
    envMapIntensity: 0.15,
  });
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.78,
    metalness: 0.0,
    envMap,
    envMapIntensity: 0.24,
  });

  const trunkGeo = buildTrunkGeometry();
  const canopyGeo = buildCanopyGeometry();
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, MAX_TREES);
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, MAX_TREES);
  trunks.count = 0;
  canopies.count = 0;
  trunks.frustumCulled = false;
  canopies.frustumCulled = false;
  trunks.castShadow = false;
  trunks.receiveShadow = false;
  canopies.castShadow = true;
  canopies.receiveShadow = true;
  group.add(trunks, canopies);

  const mat = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  let timer = 0;
  let lastCx = Infinity, lastCz = Infinity, lastZoom = -1, lastTileGen = 0, tileGen = 0;

  const packKey = (gx, gz) => (gx + 8192) * 16384 + (gz + 8192);
  function makeHash(cell) {
    const mapH = new Map();
    return {
      add(item, x0, z0, x1, z1) {
        const i0 = Math.floor(x0 / cell), i1 = Math.floor(x1 / cell);
        const j0 = Math.floor(z0 / cell), j1 = Math.floor(z1 / cell);
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const k = packKey(i, j);
          let arr = mapH.get(k);
          if (!arr) mapH.set(k, (arr = []));
          arr.push(item);
        }
      },
      some(x, z, fn) {
        const arr = mapH.get(packKey(Math.floor(x / cell), Math.floor(z / cell)));
        if (!arr) return false;
        for (let i = 0; i < arr.length; i++) if (fn(arr[i])) return true;
        return false;
      },
    };
  }

  function populate() {
    if (map.isMoving?.() || map.isZooming?.()) { schedule(); return; }
    if (map.isSourceLoaded && !map.isSourceLoaded('omt')) { schedule(); return; }
    const zoom = map.getZoom();
    if (zoom < MIN_ZOOM) {
      if (trunks.count || canopies.count) {
        trunks.count = canopies.count = 0;
        trunks.instanceMatrix.needsUpdate = true;
        canopies.instanceMatrix.needsUpdate = true;
        lastCx = Infinity;
      }
      return;
    }

    const c = map.getCenter();
    const [cx, cz] = toLocal(c.lng, c.lat);
    if (Math.hypot(cx - lastCx, cz - lastCz) < 280 && Math.abs(zoom - lastZoom) < 0.7 && lastTileGen === tileGen) {
      return;
    }
    const maxDist = NEAR_KM * 1000;
    const maxR2 = maxDist * maxDist;

    // Collect roads, waters, pitches/stadiums, parks/greens inside viewport radius
    const roadHash = makeHash(60);
    const noTreeHash = makeHash(120);
    const bldgHash = makeHash(48);
    const parkPolys = [];
    const campusPolys = [];
    const farmPolys = [];

    const within = (x0, z0, x1, z1) => x1 >= cx - maxDist && x0 <= cx + maxDist && z1 >= cz - maxDist && z0 <= cz + maxDist;

    const toPolyList = (geom) => {
      const polys = geom?.type === 'Polygon'
        ? [geom.coordinates]
        : geom?.type === 'MultiPolygon' ? geom.coordinates : null;
      if (!polys) return [];
      const out = [];
      for (const poly of polys) {
        const ring = poly[0];
        if (!ring || ring.length < 3) continue;
        const pts = ring.map(([lng, lat]) => toLocal(lng, lat));
        let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
        for (const [px, pz] of pts) {
          if (px < x0) x0 = px; if (px > x1) x1 = px;
          if (pz < z0) z0 = pz; if (pz > z1) z1 = pz;
        }
        if (within(x0, z0, x1, z1)) out.push({ pts, x0, z0, x1, z1 });
      }
      return out;
    };

    const addPolys = (hash, geom, pad = 0) => {
      for (const p of toPolyList(geom)) hash.add(p, p.x0 - pad, p.z0 - pad, p.x1 + pad, p.z1 + pad);
    };

    for (const f of map.querySourceFeatures('omt', { sourceLayer: 'water' })) addPolys(noTreeHash, f.geometry);
    for (const f of map.querySourceFeatures('omt', { sourceLayer: 'aeroway' })) addPolys(noTreeHash, f.geometry);
    for (const f of map.querySourceFeatures('omt', { sourceLayer: 'landuse' })) {
      const cls = f.properties?.class;
      if (cls === 'pitch' || cls === 'stadium' || cls === 'playground' || cls === 'railway') {
        addPolys(noTreeHash, f.geometry);
      } else if (cls === 'zoo' || cls === 'park' || cls === 'recreation_ground' || cls === 'village_green' || cls === 'cemetery') {
        parkPolys.push(...toPolyList(f.geometry));
      } else if (cls === 'school' || cls === 'university' || cls === 'college' || cls === 'hospital' || cls === 'healthcare' || cls === 'military') {
        campusPolys.push(...toPolyList(f.geometry));
      }
    }
    for (const f of map.querySourceFeatures('omt', { sourceLayer: 'building' })) addPolys(bldgHash, f.geometry, 2);
    for (const f of map.querySourceFeatures('omt', { sourceLayer: 'park' })) parkPolys.push(...toPolyList(f.geometry));
    for (const f of map.querySourceFeatures('omt', { sourceLayer: 'landcover' })) {
      const cls = f.properties?.class;
      if (cls === 'wood' || cls === 'grass') parkPolys.push(...toPolyList(f.geometry));
      else if (cls === 'farmland') farmPolys.push(...toPolyList(f.geometry));
    }

    const aveSegs = [];
    const minorSegs = [];
    const creekSegs = [];
    for (const f of map.querySourceFeatures('omt', { sourceLayer: 'transportation' })) {
      const cls = f.properties?.class;
      const brunnel = f.properties?.brunnel;
      if (brunnel === 'tunnel') continue;
      const lines = f.geometry?.type === 'LineString'
        ? [f.geometry.coordinates]
        : f.geometry?.type === 'MultiLineString' ? f.geometry.coordinates : null;
      if (!lines) continue;
      const hw = (ROAD_HW[cls] ?? 4.5) + (brunnel === 'bridge' ? 5 : 0);
      const isBoulevard = !brunnel && (cls === 'primary' || cls === 'secondary' || cls === 'tertiary');
      const isVillageRoad = !brunnel && cls === 'minor';
      for (const line of lines) {
        for (let i = 1; i < line.length; i++) {
          const [ax, az] = toLocal(line[i - 1][0], line[i - 1][1]);
          const [bx, bz] = toLocal(line[i][0], line[i][1]);
          if (!within(Math.min(ax, bx) - 20, Math.min(az, bz) - 20, Math.max(ax, bx) + 20, Math.max(az, bz) + 20)) continue;
          const seg = { ax, az, bx, bz, hw };
          roadHash.add(seg, Math.min(ax, bx) - hw - 2, Math.min(az, bz) - hw - 2, Math.max(ax, bx) + hw + 2, Math.max(az, bz) + hw + 2);
          if (isBoulevard) aveSegs.push(seg);
          else if (isVillageRoad) minorSegs.push(seg);
        }
      }
    }
    for (const f of map.querySourceFeatures('omt', { sourceLayer: 'waterway' })) {
      const cls = f.properties?.class;
      const lines = f.geometry?.type === 'LineString'
        ? [f.geometry.coordinates]
        : f.geometry?.type === 'MultiLineString' ? f.geometry.coordinates : null;
      if (!lines) continue;
      const hw = cls === 'river' ? 24 : 7;
      for (const line of lines) {
        for (let i = 1; i < line.length; i++) {
          const [ax, az] = toLocal(line[i - 1][0], line[i - 1][1]);
          const [bx, bz] = toLocal(line[i][0], line[i][1]);
          if (!within(Math.min(ax, bx) - 30, Math.min(az, bz) - 30, Math.max(ax, bx) + 30, Math.max(az, bz) + 30)) continue;
          const seg = { ax, az, bx, bz, hw };
          roadHash.add(seg, Math.min(ax, bx) - hw - 2, Math.min(az, bz) - hw - 2, Math.max(ax, bx) + hw + 2, Math.max(az, bz) + hw + 2);
          creekSegs.push(seg);
        }
      }
    }
    if (!parkPolys.length && !aveSegs.length && !campusPolys.length && !minorSegs.length && !farmPolys.length && !creekSegs.length) return;
    lastCx = cx; lastCz = cz; lastZoom = zoom; lastTileGen = tileGen;

    const canPlaceTree = (x, z) => {
      if ((x - cx) ** 2 + (z - cz) ** 2 > maxR2) return false;
      if (occupancy.isOccupied(x, z, OCC_BUILDING | OCC_CLEAR | OCC_FILLER)) return false;
      if (roadHash.some(x, z, (s) => segDist(x, z, s.ax, s.az, s.bx, s.bz) < s.hw + 1.2)) return false;
      if (noTreeHash.some(x, z, (p) => x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1 && insidePoly(x, z, p.pts))) return false;
      if (bldgHash.some(x, z, (b) => x >= b.x0 - 2 && x <= b.x1 + 2 && z >= b.z0 - 2 && z <= b.z1 + 2 && insidePoly(x, z, b.pts))) return false;
      return true;
    };

    const placed = [];
    const seenGrid = new Set();
    const pushTree = (x, z, minSep = 8) => {
      if (placed.length >= MAX_TREES) return false;
      const key = packKey(Math.round(x / minSep), Math.round(z / minSep));
      if (seenGrid.has(key)) return false;
      if (!canPlaceTree(x, z)) return false;
      seenGrid.add(key);
      placed.push([x, z]);
      return true;
    };

    const walkSegTrees = (segs, step, cb) => {
      for (const s of segs) {
        if (placed.length >= MAX_TREES) break;
        const len = Math.hypot(s.bx - s.ax, s.bz - s.az);
        if (len < 4) continue;
        const ux = (s.bx - s.ax) / len, uz = (s.bz - s.az) / len;
        const rx = -uz, rz = ux;
        if (len < step) {
          cb(s, (s.ax + s.bx) * 0.5, (s.az + s.bz) * 0.5, rx, rz);
        } else {
          for (let d = step * 0.45; d < len - 3 && placed.length < MAX_TREES; d += step) {
            cb(s, s.ax + ux * d, s.az + uz * d, rx, rz);
          }
        }
      }
    };

    // 1. Park / lakefront / grove trees (capped so rural streets & creeks still receive shade trees)
    const parkCap = Math.floor(MAX_TREES * 0.55);
    for (const p of parkPolys) {
      if (placed.length >= parkCap) break;
      const areaApprox = (p.x1 - p.x0) * (p.z1 - p.z0);
      if (areaApprox < 300) continue;
      const step = areaApprox > 60000 ? 18 : 14;
      for (let gz = Math.ceil(p.z0 / step) * step; gz <= p.z1 && placed.length < parkCap; gz += step) {
        for (let gx = Math.ceil(p.x0 / step) * step; gx <= p.x1 && placed.length < parkCap; gx += step) {
          const jx = gx + (hash2(gx, gz) - 0.5) * step * 0.7;
          const jz = gz + (hash2(gx + 13, gz - 9) - 0.5) * step * 0.7;
          if (!insidePoly(jx, jz, p.pts)) continue;
          if (hash2(jx * 1.7, jz * 1.3) < 0.25) continue; // breathing room / lawns inside parks
          pushTree(jx, jz, 9);
        }
      }
    }

    // 2. Boulevard sidewalk trees along main tree-lined avenues (including curved chords)
    walkSegTrees(aveSegs, 18, (s, px, pz, rx, rz) => {
      for (const side of [1, -1]) {
        if (hash2(px + side * 5, pz) < 0.28) continue;
        pushTree(px + rx * side * (s.hw + 1.5), pz + rz * side * (s.hw + 1.5), 10);
      }
    });

    // 3. Institutional campus / military yard shade trees around open lawns
    for (const p of campusPolys) {
      if (placed.length >= MAX_TREES) break;
      const areaApprox = (p.x1 - p.x0) * (p.z1 - p.z0);
      if (areaApprox < 900) continue;
      const step = 24;
      for (let gz = Math.ceil(p.z0 / step) * step; gz <= p.z1 && placed.length < MAX_TREES; gz += step) {
        for (let gx = Math.ceil(p.x0 / step) * step; gx <= p.x1 && placed.length < MAX_TREES; gx += step) {
          const jx = gx + (hash2(gx + 5, gz) - 0.5) * 12;
          const jz = gz + (hash2(gx, gz - 7) - 0.5) * 12;
          if (!insidePoly(jx, jz, p.pts)) continue;
          if (hash2(jx * 1.3, jz * 1.9) < 0.45) continue;
          pushTree(jx, jz, 12);
        }
      }
    }

    // 4. Neighborhood & village street trees + tropical creekside & farmland hedgerow shade trees
    walkSegTrees(minorSegs, 28, (s, px, pz, rx, rz) => {
      const side = hash2(px * 0.7, pz * 1.1) > 0.5 ? 1 : -1;
      if (hash2(px + side * 9, pz) < 0.40) return;
      pushTree(px + rx * side * (s.hw + 1.8), pz + rz * side * (s.hw + 1.8), 14);
    });
    walkSegTrees(creekSegs, 22, (s, px, pz, rx, rz) => {
      for (const side of [1, -1]) {
        if (hash2(px + side * 13, pz) < 0.40) continue;
        const dist = s.hw + 3.5 + hash2(px * 1.5, pz * side) * 9.0;
        pushTree(px + rx * side * dist, pz + rz * side * dist, 13);
      }
    });
    for (const p of farmPolys) {
      if (placed.length >= MAX_TREES) break;
      const areaApprox = (p.x1 - p.x0) * (p.z1 - p.z0);
      if (areaApprox < 2500) continue;
      const step = 48;
      for (let gz = Math.ceil(p.z0 / step) * step; gz <= p.z1 && placed.length < MAX_TREES; gz += step) {
        for (let gx = Math.ceil(p.x0 / step) * step; gx <= p.x1 && placed.length < MAX_TREES; gx += step) {
          const jx = gx + (hash2(gx + 3, gz - 11) - 0.5) * 20;
          const jz = gz + (hash2(gx - 7, gz + 5) - 0.5) * 20;
          if (!insidePoly(jx, jz, p.pts)) continue;
          if (hash2(jx * 1.1, jz * 1.7) < 0.58) continue;
          pushTree(jx, jz, 20);
        }
      }
    }

    trunks.count = placed.length;
    canopies.count = placed.length;
    for (let i = 0; i < placed.length; i++) {
      const [x, z] = placed[i];
      const r0 = hash2(x, z);
      const r1 = hash2(x + 7.1, z - 3.3);
      const sXZ = 3.2 + r0 * 2.2;
      const sY = 3.6 + r1 * 2.4;
      quat.setFromAxisAngle(up, r0 * Math.PI * 2);
      scale.set(sXZ * 0.9, sY, sXZ * 0.9);
      trunks.setMatrixAt(i, mat.compose(pos.set(x, 0, z), quat, scale));

      scale.set(sXZ, sY, sXZ);
      canopies.setMatrixAt(i, mat.compose(pos.set(x, 0, z), quat, scale));
      canopies.setColorAt(i, CANOPY_PALETTE[Math.floor(r1 * CANOPY_PALETTE.length)]);
    }
    trunks.instanceMatrix.needsUpdate = true;
    canopies.instanceMatrix.needsUpdate = true;
    if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
    markShadowsDirty?.();
    map.triggerRepaint();
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = 0;
      populate();
    }, 240);
  }

  map.on('moveend', schedule);
  map.on('idle', schedule);

  return {
    group,
    refresh() {
      tileGen++;
      schedule();
    },
  };
}
