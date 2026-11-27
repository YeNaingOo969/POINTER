// Animated 3D cargo ships, container feeders, Yangon-Dala ferries, wooden longtail boats,
// and seafoam wakes cruising beneath Dala Bridge and along the Yangon River waterfront.
// All vessels use 4 lightweight InstancedMesh draw calls verified against MapLibre 'omt'
// water polygons and kept clear of Dala Bridge pylons.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const MIN_ZOOM = 13.0;
const DALA_PYLONS_LL = [
  [96.14325, 16.76695], // south cable-stayed pylon footing
  [96.14422, 16.77051], // north cable-stayed pylon footing
];

// Curated river channels & jetties validated against 'omt' water polygons at runtime
const CARGO_LANES = [
  // Central shipping channel straight under Dala Bridge 690m main span (two-way traffic)
  { pts: [[96.126, 16.7728], [96.135, 16.7704], [96.1437, 16.7689], [96.154, 16.7672], [96.167, 16.7652]], speed: 12.0, phase: 0.44, len: 74, col: '#2d4b69' },
  { pts: [[96.169, 16.7636], [96.155, 16.7658], [96.1437, 16.7679], [96.134, 16.7695], [96.125, 16.7717]], speed: 10.5, phase: 0.56, len: 66, col: '#8f342a' },
  { pts: [[96.128, 16.7721], [96.138, 16.7698], [96.149, 16.7680], [96.161, 16.7660]], speed: 9.0, phase: 0.18, len: 56, col: '#314f5c' },
  { pts: [[96.176, 16.7618], [96.164, 16.7642], [96.152, 16.7664], [96.141, 16.7684]], speed: 11.2, phase: 0.34, len: 78, col: '#29574d' },
];

const CARGO_ANCHORED = [
  { lng: 96.1315, lat: 16.7708, yaw: -0.25, len: 62, col: '#3a4c5e' },
  { lng: 96.1482, lat: 16.7663, yaw: 2.85, len: 52, col: '#7c3b2c' },
  { lng: 96.1695, lat: 16.7629, yaw: -0.32, len: 70, col: '#284560' },
  { lng: 96.1388, lat: 16.7701, yaw: 0.22, len: 48, col: '#4a5568' },
];

const FERRY_ROUTES = [
  // Iconic Pansodan <-> Dala ferry shuttles just east of Dala Bridge
  { pts: [[96.1592, 16.7677], [96.1578, 16.7646], [96.1564, 16.7618]], speed: 7.2, phase: 0.25, len: 30, pingPong: true },
  { pts: [[96.1548, 16.7620], [96.1561, 16.7651], [96.1576, 16.7679]], speed: 6.8, phase: 0.62, len: 28, pingPong: true },
  // Near-bridge shuttle (just east of Dala Bridge main towers)
  { pts: [[96.1476, 16.7698], [96.1479, 16.7670], [96.1483, 16.7645]], speed: 6.4, phase: 0.36, len: 27, pingPong: true },
  // West-of-bridge shuttle (Wardan Jetty <-> Kamakasit Dala shore)
  { pts: [[96.1380, 16.7712], [96.1372, 16.7682], [96.1364, 16.7654]], speed: 6.5, phase: 0.40, len: 26, pingPong: true },
  // River cruise loop near Dala Bridge -> Botataung waterfront
  { pts: [[96.1455, 16.7673], [96.1545, 16.7656], [96.1650, 16.7644]], speed: 8.2, phase: 0.48, len: 29, pingPong: true },
];

const FERRY_MOORED = [
  { lng: 96.1604, lat: 16.7680, yaw: 1.38, len: 27 },
  { lng: 96.1552, lat: 16.7615, yaw: -1.75, len: 26 },
  { lng: 96.1404, lat: 16.7707, yaw: 1.42, len: 24 },
];

const BOAT_ROUTES = [
  { pts: [[96.1462, 16.7644], [96.1476, 16.7676], [96.1494, 16.7694]], speed: 5.2, phase: 0.10, len: 13.5, pingPong: true, col: '#8c5a34' },
  { pts: [[96.1408, 16.7656], [96.1432, 16.7684], [96.1452, 16.7704]], speed: 4.8, phase: 0.55, len: 12.5, pingPong: true, col: '#2d6888' },
  { pts: [[96.1510, 16.7634], [96.1525, 16.7668], [96.1538, 16.7688]], speed: 5.5, phase: 0.30, len: 14.0, pingPong: true, col: '#a46b3e' },
  { pts: [[96.1365, 16.7692], [96.1415, 16.7690], [96.1465, 16.7674]], speed: 5.8, phase: 0.72, len: 13.0, pingPong: true, col: '#c04d39' },
  { pts: [[96.1620, 16.7662], [96.1655, 16.7640], [96.1688, 16.7638]], speed: 5.0, phase: 0.88, len: 12.0, pingPong: true, col: '#3a7560' },
];

const BOAT_MOORED_SEEDS = [
  [96.1452, 16.7646, 0.4, 12.5, '#8c5a34'], [96.1459, 16.7644, 0.3, 11.5, '#3b6d8c'],
  [96.1467, 16.7642, 0.25, 13.0, '#9c663b'], [96.1475, 16.7640, 0.35, 11.0, '#b54c38'],
  [96.1485, 16.7643, 0.2, 12.0, '#447965'], [96.1402, 16.7658, -0.3, 13.0, '#8e5d38'],
  [96.1394, 16.7660, -0.25, 11.8, '#2f6582'], [96.1385, 16.7663, -0.2, 12.2, '#a86e42'],
  [96.1458, 16.7711, 2.8, 12.8, '#8c5a34'], [96.1466, 16.7709, 2.9, 11.5, '#3a6f8c'],
  [96.1502, 16.7701, 2.75, 13.2, '#9a6539'], [96.1511, 16.7698, 2.8, 11.6, '#b84f3a'],
  [96.1548, 16.7632, 0.25, 12.6, '#8e5d38'], [96.1538, 16.7635, 0.3, 11.4, '#346883'],
  [96.1612, 16.7676, 2.95, 12.0, '#a46a3f'], [96.1621, 16.7673, 2.88, 13.5, '#3c7361'],
];

function insidePoly(x, z, pts) {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
}

function paintVerts(raw, hex) {
  const g = raw.index ? raw.toNonIndexed() : raw;
  const n = g.attributes.position.count;
  const col = new THREE.Color(hex);
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = col.r;
    arr[i * 3 + 1] = col.g;
    arr[i * 3 + 2] = col.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (!g.attributes.normal) g.computeVertexNormals();
  for (const k of Object.keys(g.attributes)) {
    if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k);
  }
  return g;
}

/** Unit-length (1.0 along +Z bow, center at water y=0) ocean/river cargo vessel hull & bridge. */
function buildCargoHullGeo() {
  const parts = [];
  const box = (x, y, z, w, h, d, hex) => {
    const g = paintVerts(new THREE.BoxGeometry(w, h, d), hex);
    g.translate(x, y, z);
    parts.push(g);
  };
  // Lower waterline boot stripe + main steel hull body + tapered V bow
  box(0, 0.015, -0.04, 0.20, 0.03, 0.78, '#7a2c26');
  box(0, 0.045, -0.04, 0.21, 0.045, 0.78, '#ffffff');
  const bow = new THREE.ConeGeometry(0.115, 0.22, 4);
  bow.rotateY(Math.PI / 4);
  bow.rotateX(Math.PI / 2);
  bow.scale(0.92, 0.56, 1.0);
  bow.translate(0, 0.042, 0.43);
  parts.push(paintVerts(bow, '#ffffff'));
  // Stern wheelhouse superstructure + glass bridge + funnel
  box(0, 0.085, -0.31, 0.17, 0.065, 0.14, '#f7f4ec');
  box(0, 0.132, -0.32, 0.15, 0.042, 0.095, '#ffffff');
  box(0, 0.136, -0.275, 0.145, 0.022, 0.014, '#24374a');
  box(0, 0.17, -0.35, 0.036, 0.055, 0.045, '#d64532');
  box(0, 0.20, -0.35, 0.038, 0.014, 0.047, '#1d242c');
  // Foremast
  box(0, 0.11, 0.36, 0.014, 0.11, 0.014, '#f2eee4');

  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

/** Colorful stacked shipping container blocks on cargo ship foredeck. */
function buildCargoContainersGeo() {
  const parts = [];
  const colors = ['#d95340', '#2b709c', '#2e8769', '#df9b36', '#456b96', '#b84654'];
  let idx = 0;
  for (let row = 0; row < 4; row++) {
    const z = -0.14 + row * 0.135;
    for (const x of [-0.045, 0.045]) {
      const tiers = row === 1 || row === 2 ? 2 : 1;
      for (let t = 0; t < tiers; t++) {
        const g = paintVerts(new THREE.BoxGeometry(0.075, 0.038, 0.118), colors[idx++ % colors.length]);
        g.translate(x, 0.086 + t * 0.040, z);
        parts.push(g);
      }
    }
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

/** Double-deck Yangon-Dala ferry silhouette (length 1.0 along +Z). */
function buildFerryGeo() {
  const parts = [];
  const box = (x, y, z, w, h, d, hex) => {
    const g = paintVerts(new THREE.BoxGeometry(w, h, d), hex);
    g.translate(x, y, z);
    parts.push(g);
  };
  box(0, 0.025, 0, 0.28, 0.05, 0.84, '#f5f2ea');
  box(0, 0.052, 0, 0.29, 0.018, 0.84, '#246eb9');
  const bow = paintVerts(new THREE.ConeGeometry(0.14, 0.18, 4).rotateY(Math.PI / 4).rotateX(Math.PI / 2).scale(1, 0.36, 1), '#246eb9');
  bow.translate(0, 0.032, 0.48);
  parts.push(bow);
  // Main passenger cabin + dark windows + azure upper deck awning + wheelhouse
  box(0, 0.095, -0.02, 0.24, 0.072, 0.62, '#ffffff');
  box(0, 0.10, -0.02, 0.246, 0.028, 0.56, '#2e445c');
  box(0, 0.145, -0.03, 0.26, 0.018, 0.66, '#3988c9');
  box(0, 0.18, 0.14, 0.16, 0.052, 0.16, '#ffffff');
  box(0, 0.188, 0.15, 0.166, 0.022, 0.14, '#24374a');

  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

/** Traditional Burmese wooden riverboat / harbor launch with arched sunshade canopy. */
function buildSmallBoatGeo() {
  const parts = [];
  const hull = paintVerts(new THREE.BoxGeometry(0.24, 0.065, 0.72), '#ffffff');
  hull.translate(0, 0.032, 0);
  parts.push(hull);
  const bow = paintVerts(new THREE.ConeGeometry(0.125, 0.28, 4).rotateY(Math.PI / 4).rotateX(Math.PI / 2).scale(0.95, 0.48, 1), '#ffffff');
  bow.translate(0, 0.036, 0.46);
  parts.push(bow);
  const stern = paintVerts(new THREE.ConeGeometry(0.12, 0.20, 4).rotateY(Math.PI / 4).rotateX(-Math.PI / 2).scale(0.92, 0.45, 1), '#ffffff');
  stern.translate(0, 0.035, -0.42);
  parts.push(stern);
  // Warm bamboo/canvas shade canopy
  const roof = paintVerts(new THREE.CylinderGeometry(0.135, 0.135, 0.46, 8, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), '#efe4c8');
  roof.scale(1.0, 0.55, 1.0);
  roof.translate(0, 0.095, -0.02);
  parts.push(roof);

  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

/** Soft translucent seafoam V-wake trail trailing behind moving vessels (-Z direction). */
function buildWakeGeo() {
  const v = new Float32Array([
    0, 0.0, 0.05,  -0.28, 0.0, -1.15,  -0.06, 0.0, -1.15,
    0, 0.0, 0.05,   0.06, 0.0, -1.15,   0.28, 0.0, -1.15,
  ]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

function buildRouteLocal(pts, toLocal) {
  const xy = pts.map(([lng, lat]) => toLocal(lng, lat));
  const segs = [];
  let total = 0;
  for (let i = 1; i < xy.length; i++) {
    const dx = xy[i][0] - xy[i - 1][0], dz = xy[i][1] - xy[i - 1][1];
    const len = Math.hypot(dx, dz) || 1;
    segs.push({ ax: xy[i - 1][0], az: xy[i - 1][1], dx, dz, len, start: total });
    total += len;
  }
  return { segs, total };
}

function sampleRoute(route, dist) {
  const d = ((dist % route.total) + route.total) % route.total;
  for (const s of route.segs) {
    if (d <= s.start + s.len || s === route.segs[route.segs.length - 1]) {
      const f = Math.min(1, Math.max(0, (d - s.start) / s.len));
      return { x: s.ax + s.dx * f, z: s.az + s.dz * f, yaw: Math.atan2(s.dx, s.dz) };
    }
  }
  return { x: 0, z: 0, yaw: 0 };
}

/** @param {{ map: maplibregl.Map, toLocal: Function, envMap?: THREE.Texture }} ctx */
export function riverBoats({ map, toLocal, envMap = null }) {
  const group = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.25, envMap, envMapIntensity: 0.5 });
  const boxMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const wakeMat = new THREE.MeshBasicMaterial({ color: 0xeaf7ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });

  const cargoHullGeo = buildCargoHullGeo();
  const cargoBoxGeo = buildCargoContainersGeo();
  const ferryGeo = buildFerryGeo();
  const boatGeo = buildSmallBoatGeo();
  const wakeGeo = buildWakeGeo();

  const cargoCount = CARGO_LANES.length + CARGO_ANCHORED.length;
  const ferryCount = FERRY_ROUTES.length + FERRY_MOORED.length;
  const boatCount = BOAT_ROUTES.length + BOAT_MOORED_SEEDS.length;
  const movingMax = CARGO_LANES.length + FERRY_ROUTES.length + BOAT_ROUTES.length;

  const cargoHullMesh = new THREE.InstancedMesh(cargoHullGeo, hullMat, cargoCount);
  const cargoBoxMesh = new THREE.InstancedMesh(cargoBoxGeo, boxMat, cargoCount);
  const ferryMesh = new THREE.InstancedMesh(ferryGeo, boxMat, ferryCount);
  const boatMesh = new THREE.InstancedMesh(boatGeo, boxMat, boatCount);
  const wakeMesh = new THREE.InstancedMesh(wakeGeo, wakeMat, movingMax);

  for (const m of [cargoHullMesh, cargoBoxMesh, ferryMesh, boatMesh, wakeMesh]) {
    m.count = 0;
    m.frustumCulled = false;
    m.castShadow = m !== wakeMesh;
    m.receiveShadow = m !== wakeMesh;
  }
  group.add(cargoHullMesh, cargoBoxMesh, ferryMesh, boatMesh, wakeMesh);

  const pylonsLocal = DALA_PYLONS_LL.map(([lng, lat]) => toLocal(lng, lat));

  let initialized = false;
  let activeCargos = [];
  let activeFerries = [];
  let activeBoats = [];

  function initWaterVessels() {
    if (initialized) return;
    if (map.isSourceLoaded && !map.isSourceLoaded('omt')) return;

    const waterPolys = [];
    for (const f of map.querySourceFeatures('omt', { sourceLayer: 'water' })) {
      const polys = f.geometry?.type === 'Polygon'
        ? [f.geometry.coordinates]
        : f.geometry?.type === 'MultiPolygon' ? f.geometry.coordinates : null;
      if (!polys) continue;
      for (const poly of polys) {
        const ring = poly[0];
        if (!ring || ring.length < 3) continue;
        const pts = ring.map(([lng, lat]) => toLocal(lng, lat));
        let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
        for (const [px, pz] of pts) {
          if (px < x0) x0 = px; if (px > x1) x1 = px;
          if (pz < z0) z0 = pz; if (pz > z1) z1 = pz;
        }
        if (f.properties?.class === 'river' || x1 - x0 > 320 || z1 - z0 > 320) {
          waterPolys.push({ pts, x0, z0, x1, z1 });
        }
      }
    }
    if (!waterPolys.length) return;
    initialized = true;

    const isInRiver = (x, z, clearance = 14) => {
      if (pylonsLocal.some(([px, pz]) => Math.hypot(x - px, z - pz) < 50)) return false;
      const probes = [[x, z], [x - clearance, z], [x + clearance, z], [x, z - clearance], [x, z + clearance]];
      return probes.every(([qx, qz]) =>
        waterPolys.some((p) => qx >= p.x0 && qx <= p.x1 && qz >= p.z0 && qz <= p.z1 && insidePoly(qx, qz, p.pts)));
    };
    const isRouteSafe = (pts) => {
      let inRiverHits = 0;
      for (const [lng, lat] of pts) {
        const [x, z] = toLocal(lng, lat);
        if (pylonsLocal.some(([px, pz]) => Math.hypot(x - px, z - pz) < 50)) return false;
        const nearKnownTile = waterPolys.some((p) => x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1);
        if (isInRiver(x, z, 10)) inRiverHits++;
        else if (nearKnownTile) return false;
      }
      return inRiverHits >= 2;
    };

    activeCargos = [];
    CARGO_LANES.forEach((c, idx) => {
      if (isRouteSafe(c.pts)) {
        activeCargos.push({ route: buildRouteLocal(c.pts, toLocal), speed: c.speed, phase: c.phase, len: c.len, col: new THREE.Color(c.col), bobSeed: idx * 1.7 });
      }
    });
    CARGO_ANCHORED.forEach((a, idx) => {
      const [x, z] = toLocal(a.lng, a.lat);
      if (isInRiver(x, z, 14)) {
        activeCargos.push({ x, z, yaw: a.yaw, len: a.len, col: new THREE.Color(a.col), bobSeed: (idx + 5) * 1.9 });
      }
    });

    activeFerries = [];
    FERRY_ROUTES.forEach((r, idx) => {
      if (isRouteSafe(r.pts)) {
        activeFerries.push({ route: buildRouteLocal(r.pts, toLocal), speed: r.speed, phase: r.phase, len: r.len, pingPong: !!r.pingPong, bobSeed: idx * 2.1 });
      }
    });
    FERRY_MOORED.forEach((m, idx) => {
      const [x, z] = toLocal(m.lng, m.lat);
      if (isInRiver(x, z, 8)) activeFerries.push({ x, z, yaw: m.yaw, len: m.len, bobSeed: (idx + 4) * 2.3 });
    });

    activeBoats = [];
    BOAT_ROUTES.forEach((r, idx) => {
      if (isRouteSafe(r.pts)) {
        activeBoats.push({ route: buildRouteLocal(r.pts, toLocal), speed: r.speed, phase: r.phase, len: r.len, pingPong: !!r.pingPong, col: new THREE.Color(r.col), bobSeed: idx * 2.7 });
      }
    });
    BOAT_MOORED_SEEDS.forEach(([lng, lat, yaw, len, col], idx) => {
      const [x, z] = toLocal(lng, lat);
      if (isInRiver(x, z, 5)) activeBoats.push({ x, z, yaw, len, col: new THREE.Color(col), bobSeed: (idx + 6) * 1.4 });
    });

    cargoHullMesh.count = activeCargos.length;
    cargoBoxMesh.count = activeCargos.length;
    ferryMesh.count = activeFerries.length;
    boatMesh.count = activeBoats.length;
    activeCargos.forEach((v, i) => cargoHullMesh.setColorAt(i, v.col));
    activeBoats.forEach((v, i) => boatMesh.setColorAt(i, v.col));
    if (cargoHullMesh.instanceColor) cargoHullMesh.instanceColor.needsUpdate = true;
    if (boatMesh.instanceColor) boatMesh.instanceColor.needsUpdate = true;
    updateMatrices(0);
  }

  const mat4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();

  function sampleMotion(v, t) {
    if (!v.route) return { x: v.x, z: v.z, yaw: v.yaw, moving: false };
    const span = v.route.total;
    if (v.pingPong) {
      const cycle = ((t * v.speed) / span + v.phase) % 2;
      const forward = cycle <= 1;
      const dist = (forward ? cycle : 2 - cycle) * span;
      const s = sampleRoute(v.route, dist);
      return { x: s.x, z: s.z, yaw: forward ? s.yaw : s.yaw + Math.PI, moving: true };
    }
    const s = sampleRoute(v.route, t * v.speed + v.phase * span);
    return { x: s.x, z: s.z, yaw: s.yaw, moving: true };
  }

  function updateMatrices(t) {
    if (!initialized) return;
    let wakeIdx = 0;

    for (let i = 0; i < activeCargos.length; i++) {
      const v = activeCargos[i];
      const st = sampleMotion(v, t);
      const bob = Math.sin(t * 1.2 + v.bobSeed) * 0.10;
      const roll = Math.sin(t * 0.9 + v.bobSeed) * 0.015;
      euler.set(0, st.yaw, roll, 'YXZ');
      quat.setFromEuler(euler);
      scl.set(v.len, v.len, v.len);
      mat4.compose(pos.set(st.x, bob, st.z), quat, scl);
      cargoHullMesh.setMatrixAt(i, mat4);
      cargoBoxMesh.setMatrixAt(i, mat4);
      if (st.moving && wakeIdx < movingMax) {
        const wLen = v.len * (0.42 + 0.04 * Math.sin(t * 2.4 + v.bobSeed));
        mat4.compose(pos.set(st.x - Math.sin(st.yaw) * v.len * 0.42, 0.22, st.z - Math.cos(st.yaw) * v.len * 0.42), quat, scl.set(v.len * 0.36, 1, wLen));
        wakeMesh.setMatrixAt(wakeIdx++, mat4);
      }
    }

    for (let i = 0; i < activeFerries.length; i++) {
      const v = activeFerries[i];
      const st = sampleMotion(v, t);
      const bob = Math.sin(t * 1.6 + v.bobSeed) * 0.08;
      const roll = Math.sin(t * 1.3 + v.bobSeed) * 0.025;
      euler.set(0, st.yaw, roll, 'YXZ');
      quat.setFromEuler(euler);
      mat4.compose(pos.set(st.x, bob, st.z), quat, scl.set(v.len, v.len, v.len));
      ferryMesh.setMatrixAt(i, mat4);
      if (st.moving && wakeIdx < movingMax) {
        const wLen = v.len * 0.48;
        mat4.compose(pos.set(st.x - Math.sin(st.yaw) * v.len * 0.38, 0.20, st.z - Math.cos(st.yaw) * v.len * 0.38), quat, scl.set(v.len * 0.34, 1, wLen));
        wakeMesh.setMatrixAt(wakeIdx++, mat4);
      }
    }

    for (let i = 0; i < activeBoats.length; i++) {
      const v = activeBoats[i];
      const st = sampleMotion(v, t);
      const bob = Math.sin(t * 2.1 + v.bobSeed) * 0.07;
      const roll = Math.sin(t * 1.9 + v.bobSeed) * 0.04;
      euler.set(0, st.yaw, roll, 'YXZ');
      quat.setFromEuler(euler);
      mat4.compose(pos.set(st.x, bob, st.z), quat, scl.set(v.len, v.len, v.len));
      boatMesh.setMatrixAt(i, mat4);
      if (st.moving && wakeIdx < movingMax) {
        mat4.compose(pos.set(st.x - Math.sin(st.yaw) * v.len * 0.34, 0.18, st.z - Math.cos(st.yaw) * v.len * 0.34), quat, scl.set(v.len * 0.28, 1, v.len * 0.52));
        wakeMesh.setMatrixAt(wakeIdx++, mat4);
      }
    }

    wakeMesh.count = wakeIdx;
    for (const m of [cargoHullMesh, cargoBoxMesh, ferryMesh, boatMesh, wakeMesh]) {
      m.instanceMatrix.needsUpdate = true;
    }
  }

  group.userData.isActive = () => {
    if (map.getZoom() < MIN_ZOOM) return false;
    const c = map.getCenter();
    const [cx, cz] = toLocal(c.lng, c.lat);
    const [dx, dz] = toLocal(96.150, 16.767);
    return Math.hypot(cx - dx, cz - dz) < 6200;
  };
  group.userData.tick = (t) => {
    const show = map.getZoom() >= MIN_ZOOM;
    group.visible = show;
    if (!show) return;
    if (!initialized) initWaterVessels();
    if (initialized && group.userData.isActive()) updateMatrices(t);
  };

  map.on('idle', initWaterVessels);
  map.on('moveend', initWaterVessels);
  initWaterVessels();

  if (import.meta.env.DEV) window.__riverBoats = group;
  return group;
}
