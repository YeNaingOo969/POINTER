// Cute 3D city: Kenney models (pastel) on the real map, drawn by Three.js inside MapLibre as a
// custom layer.
//
// - Real buildings: every OpenStreetMap building in view gets a model picked by its size and
//   height, turned to the footprint's main direction and stretched to fill it.
// - Filler: OSM has few building outlines in Yangon, so the gaps along streets are filled with
//   decorative houses/shops facing the nearest road (never on roads, water, parks or sports
//   grounds). Roads, parks and places stay geographically exact; only the filler is invented.
// - Trees and bushes are scattered inside parks and woods.
// - One InstancedMesh per model part, so the whole city is a few dozen draw calls (610M budget).
// - Shown from CITY_MIN_ZOOM; below that the style's simple 3D blocks are used instead.
// - Hero landmarks (Shwedagon…) are single detailed models, shown from LANDMARK_MIN_ZOOM.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { maplibregl } from './map.js';
import { START_VIEW, BUILDINGS_3D_MIN_ZOOM, LANDMARKS, LANDMARK_MIN_ZOOM } from './config.js';
import { BUILDING_TINTS } from './style.js';

export const CITY_MIN_ZOOM = 15;
const MODELS_URL = '/models/kit/';
const MAX_BUILDINGS = 2600; // real + filler, nearest the view centre first
const MAX_TREES = 1400;
const MAX_BUSHES = 700;
const RADIUS_M = 1300; // area around the view centre that gets models
const DEFAULT_HEIGHT_M = 9; // many Yangon buildings have no height in OSM
const TREE_SPACING_M = 22;
const SLICE_MS = 8; // main-thread time per frame for re-placing models

// Filler grid: one lot per cell, only near a road and clear of it.
const LOT_M = 16;
const FRONTAGE_M = 48; // lots further than this from any road stay empty (inner yards)
// Half-width of each road class plus a pavement, in metres.
const ROAD_HALF_WIDTH = {
  motorway: 14, trunk: 13, primary: 11, secondary: 9, tertiary: 8, minor: 6, service: 4.5,
  track: 3, path: 2.5, rail: 5, transit: 4, pier: 3, bridge: 8,
};
// Areas that never get filler buildings (besides water, parks and all landcover).
const OPEN_LANDUSE = ['pitch', 'stadium', 'playground', 'track', 'railway', 'cemetery', 'zoo'];

// ---- Small helpers (module-level temps: no allocation per instance) ----

const tmpMatrix = new THREE.Matrix4();
const tmpPos = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
// Per-building colour: each house/shop/tower is multiplied by one pastel tint, so streets
// look colourful instead of one beige. Trees and bushes keep their own colours.
const TINTS = BUILDING_TINTS.map((c) => new THREE.Color(c));
const NO_TINT = new THREE.Color(1, 1, 1);
const TINTED = new Set(['building', 'tower', 'house']);
const tintAt = (x, z) => Math.floor(hash01(x + 3.7, z - 1.9) * TINTS.length);

/** Cheap stable hash → [0, 1), so the same spot always gets the same model. */
function hash01(x, y) {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

const scanXs = [];
/**
 * Visit every point of a `step`-metre grid (whole multiples of step) inside a ring of [x, z]
 * metre points, clipped to `bounds` [minX, minZ, maxX, maxZ]. Scanline fill: the cost grows
 * with rows × edges instead of cells × edges, which matters for big lakes and parks.
 */
function scanRing(pts, step, [minX, minZ, maxX, maxZ], fn) {
  let z0 = Infinity, z1 = -Infinity;
  for (const p of pts) { if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1]; }
  const r1 = Math.floor(Math.min(z1, maxZ) / step);
  for (let r = Math.ceil(Math.max(z0, minZ) / step); r <= r1; r++) {
    const z = r * step;
    scanXs.length = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, zi] = pts[i], [xj, zj] = pts[j];
      if (zi > z !== zj > z) scanXs.push(xi + ((z - zi) * (xj - xi)) / (zj - zi));
    }
    scanXs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < scanXs.length; k += 2) {
      const c1 = Math.floor(Math.min(scanXs[k + 1], maxX) / step);
      for (let c = Math.ceil(Math.max(scanXs[k], minX) / step); c <= c1; c++) fn(c * step, z);
    }
  }
}

/** Outer rings of a GeoJSON Polygon / MultiPolygon. */
function outerRings(geometry) {
  if (geometry.type === 'Polygon') return [geometry.coordinates[0]];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.map((p) => p[0]);
  return [];
}

/** Lines of a GeoJSON LineString / MultiLineString. */
function lines(geometry) {
  if (geometry.type === 'LineString') return [geometry.coordinates];
  if (geometry.type === 'MultiLineString') return geometry.coordinates;
  return [];
}

// ---- Model loading ----

/**
 * Load every model in the manifest and turn each mesh part into an InstancedMesh template.
 * Geometry is moved so the model's base centre sits at the origin and normalised to 1×1×1,
 * so an instance's scale is simply its size in metres.
 */
async function loadKit() {
  const manifest = await fetch(`${MODELS_URL}manifest.json`).then((r) => r.json());
  const loader = new GLTFLoader();
  const kit = { building: [], tower: [], house: [], tree: [], bush: [] };

  await Promise.all(manifest.models.map(async (m) => {
    const gltf = await loader.loadAsync(MODELS_URL + m.file);
    gltf.scene.updateMatrixWorld(true);
    const [w, h, d] = m.size;
    const normalise = new THREE.Matrix4()
      .makeScale(1 / w, 1 / h, 1 / d)
      .multiply(new THREE.Matrix4().makeTranslation(-(m.min[0] + w / 2), -m.min[1], -(m.min[2] + d / 2)));
    const parts = [];
    gltf.scene.traverse((obj) => {
      if (!obj.isMesh) return;
      const geometry = obj.geometry.clone().applyMatrix4(obj.matrixWorld).applyMatrix4(normalise);
      parts.push({ geometry, material: obj.material });
    });
    let family = m.kind;
    if (/skyscraper/.test(m.id)) family = 'tower';
    else if (/bush/.test(m.id)) family = 'bush';
    kit[family].push({ id: m.id, parts, size: m.size });
  }));
  return kit;
}

// ---- Placement ----

/** Turn an OSM building ring (local metres) into { x, z, angle, width, depth }. */
function footprint(pts) {
  // Main direction = the longest edge.
  let best = 0, angle = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0], dz = pts[i][1] - pts[i - 1][1];
    const len = dx * dx + dz * dz;
    if (len > best) { best = len; angle = Math.atan2(dz, dx); }
  }
  const c = Math.cos(-angle), s = Math.sin(-angle);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of pts) {
    const rx = x * c - z * s, rz = x * s + z * c;
    x0 = Math.min(x0, rx); x1 = Math.max(x1, rx); z0 = Math.min(z0, rz); z1 = Math.max(z1, rz);
  }
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const ci = Math.cos(angle), si = Math.sin(angle);
  return { x: cx * ci - cz * si, z: cx * si + cz * ci, angle, width: x1 - x0, depth: z1 - z0 };
}

/** Pick a model family for a real building from its height and footprint area. */
function familyFor(width, depth, height) {
  if (height >= 40) return 'tower';
  if (height <= 8 && width * depth < 260) return 'house';
  return 'building';
}

/**
 * A square grid of lots around the view centre, aligned to whole multiples of LOT_M so lots
 * don't jump while panning. Per lot: distance past the nearest road edge, that road's angle,
 * which side the road is on, and whether the lot is taken or open ground.
 */
function createLotGrid(cx, cz) {
  const x0 = Math.floor((cx - RADIUS_M) / LOT_M) * LOT_M;
  const z0 = Math.floor((cz - RADIUS_M) / LOT_M) * LOT_M;
  const n = Math.ceil((2 * RADIUS_M) / LOT_M) + 1;
  return {
    x0, z0, n,
    bounds: [x0, z0, x0 + (n - 1) * LOT_M, z0 + (n - 1) * LOT_M],
    index: (x, z) => Math.round((z - z0) / LOT_M) * n + Math.round((x - x0) / LOT_M),
    gap: new Float32Array(n * n).fill(Infinity),
    angle: new Float32Array(n * n),
    facing: new Int8Array(n * n), // +1: road on the model's front (+z) side, -1: behind
    blocked: new Uint8Array(n * n),
    /** Visit every lot centre inside a local-metre box. */
    each(minX, minZ, maxX, maxZ, fn) {
      const i0 = Math.max(0, Math.ceil((minX - x0) / LOT_M)), i1 = Math.min(n - 1, Math.floor((maxX - x0) / LOT_M));
      const j0 = Math.max(0, Math.ceil((minZ - z0) / LOT_M)), j1 = Math.min(n - 1, Math.floor((maxZ - z0) / LOT_M));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(j * n + i, x0 + i * LOT_M, z0 + j * LOT_M);
    },
  };
}

/**
 * Record each lot's nearest road (distance past its edge, angle, side). The hottest loop of a
 * refresh, so it is written out flat. A generator: yields after each road (see runSliced).
 */
function* addRoads(grid, roads, toLocal) {
  const { x0, z0, n, gap, angle: angles, facing } = grid;
  for (const f of roads) {
    const half = ROAD_HALF_WIDTH[f.properties.class];
    if (!half) continue;
    const reach = FRONTAGE_M + half;
    for (const line of lines(f.geometry)) {
      const pts = line.map(([lng, lat]) => toLocal(lng, lat));
      for (let k = 1; k < pts.length; k++) {
        const [ax, az] = pts[k - 1], [bx, bz] = pts[k];
        const dx = bx - ax, dz = bz - az;
        const len2 = dx * dx + dz * dz;
        if (len2 === 0) continue;
        const angle = Math.atan2(dz, dx);
        const sin = Math.sin(angle), cos = Math.cos(angle);
        const i0 = Math.max(0, Math.ceil((Math.min(ax, bx) - reach - x0) / LOT_M));
        const i1 = Math.min(n - 1, Math.floor((Math.max(ax, bx) + reach - x0) / LOT_M));
        const j0 = Math.max(0, Math.ceil((Math.min(az, bz) - reach - z0) / LOT_M));
        const j1 = Math.min(n - 1, Math.floor((Math.max(az, bz) + reach - z0) / LOT_M));
        for (let j = j0; j <= j1; j++) {
          const z = z0 + j * LOT_M;
          for (let i = i0; i <= i1; i++) {
            const x = x0 + i * LOT_M;
            const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
            const px = ax + t * dx - x, pz = az + t * dz - z; // lot centre → closest road point
            const g = Math.sqrt(px * px + pz * pz) - half;
            const idx = j * n + i;
            if (g < gap[idx]) {
              gap[idx] = g;
              angles[idx] = angle;
              // Model front (+z after rotation) points along (-sin a, cos a).
              facing[idx] = -sin * px + cos * pz >= 0 ? 1 : -1;
            }
          }
        }
      }
    }
    yield;
  }
}

/** Mark lots inside open-ground polygons (water, parks, landcover, sports grounds). */
function* blockAreas(grid, features, toLocal) {
  for (const f of features) {
    for (const ring of outerRings(f.geometry)) {
      const pts = ring.map(([lng, lat]) => toLocal(lng, lat));
      scanRing(pts, LOT_M, grid.bounds, (x, z) => { grid.blocked[grid.index(x, z)] = 1; });
    }
    yield;
  }
}

/** Mark lots covered by a real building (its rotated rectangle plus half a lot). */
function blockFootprint(grid, fp) {
  const r = Math.hypot(fp.width, fp.depth) / 2 + LOT_M / 2;
  const c = Math.cos(-fp.angle), s = Math.sin(-fp.angle);
  const hw = fp.width / 2 + LOT_M / 2, hd = fp.depth / 2 + LOT_M / 2;
  grid.each(fp.x - r, fp.z - r, fp.x + r, fp.z + r, (idx, x, z) => {
    const dx = x - fp.x, dz = z - fp.z;
    if (Math.abs(dx * c - dz * s) <= hw && Math.abs(dx * s + dz * c) <= hd) grid.blocked[idx] = 1;
  });
}

/**
 * @param {maplibregl.Map} map
 * @param {object} [options]
 * @param {{ lng: number, lat: number, radius: number }[]} [options.clearings]
 *   Spots kept free of filler buildings (our places, so their landmark or bubble stays visible).
 * @param {(spots: { lng: number, lat: number, radius: number, height: number, minZoom: number }[]) => void} [options.onLandmarks]
 *   Called once the landmark models are loaded, with each one's spot and real model height.
 */
export function createCityLayer(map, { clearings = [], onLandmarks } = {}) {
  const origin = maplibregl.MercatorCoordinate.fromLngLat(START_VIEW.center, 0);
  const metre = origin.meterInMercatorCoordinateUnits();
  // Local metres: x east, z south (MapLibre's mercator y grows southward), y up.
  // Same maths as MercatorCoordinate.fromLngLat, without allocating an object per vertex.
  const toLocal = (lng, lat) => [
    ((180 + lng) / 360 - origin.x) / metre,
    ((180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360 - origin.y) / metre,
  ];
  const sceneToMercator = new THREE.Matrix4()
    .makeTranslation(origin.x, origin.y, origin.z)
    .scale(new THREE.Vector3(metre, -metre, metre))
    .multiply(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2));

  let renderer, scene, camera, kit;
  const kitGroup = new THREE.Group(); // instanced city models
  const landmarkGroup = new THREE.Group();
  const meshes = []; // { model, mesh }
  let ready = false;
  // Landmark spots in local metres, so the OSM buildings under them can be skipped.
  const landmarkSpots = LANDMARKS.map((lm) => [...toLocal(lm.lng, lm.lat), lm.clear]);
  const underLandmark = (x, z) => landmarkSpots.some(([lx, lz, r]) => (x - lx) ** 2 + (z - lz) ** 2 < r * r);

  function updateVisibility() {
    const zoom = map.getZoom();
    kitGroup.visible = zoom >= CITY_MIN_ZOOM;
    landmarkGroup.visible = zoom >= LANDMARK_MIN_ZOOM;
  }

  async function loadLandmarks() {
    const loader = new GLTFLoader();
    const spots = await Promise.all(LANDMARKS.map(async (lm) => {
      const gltf = await loader.loadAsync(lm.file);
      const [x, z] = toLocal(lm.lng, lm.lat);
      gltf.scene.position.set(x, 0, z);
      gltf.scene.rotation.y = -THREE.MathUtils.degToRad(lm.rotation);
      landmarkGroup.add(gltf.scene);
      const height = new THREE.Box3().setFromObject(gltf.scene).max.y;
      return { lng: lm.lng, lat: lm.lat, radius: Math.max(lm.grounds, 40), height, minZoom: LANDMARK_MIN_ZOOM };
    }));
    map.triggerRepaint();
    onLandmarks?.(spots);
  }

  function buildMeshes() {
    const caps = { tree: MAX_TREES, bush: MAX_BUSHES };
    for (const [family, models] of Object.entries(kit)) {
      for (const model of models) {
        for (const part of model.parts) {
          const cap = caps[family] ?? MAX_BUILDINGS;
          const mesh = new THREE.InstancedMesh(part.geometry, part.material, cap);
          mesh.count = 0;
          if (TINTED.has(family)) {
            // Created up front so the shader is compiled with instance colours from the start.
            mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
            mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
          }
          mesh.frustumCulled = false; // instances span the whole view; per-mesh culling would be wrong
          mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          kitGroup.add(mesh);
          meshes.push({ model, mesh });
        }
      }
    }
  }

  const pick = (family, x, z) => kit[family][Math.floor(hash01(x, z) * kit[family].length)];

  /**
   * Re-place all instances from the features currently loaded. A generator that yields often,
   * so runSliced can spread the work over several frames; the result is applied all at once
   * at the end, so a half-built city never shows.
   */
  function* refreshSteps() {
    updateVisibility();
    if (!kitGroup.visible) { map.triggerRepaint(); return; }

    const center = map.getCenter();
    const [cx, cz] = toLocal(center.lng, center.lat);
    const near = (x, z) => (x - cx) ** 2 + (z - cz) ** 2 <= RADIUS_M ** 2;
    const placements = new Map(); // model id -> matrices
    const tints = new Map(); // model id -> tint index per instance (-1 = none)
    const place = (model, x, z, angle, sx, sy, sz, tint = -1) => {
      tmpPos.set(x, 0, z);
      tmpQuat.setFromAxisAngle(UP, angle);
      tmpScale.set(sx, sy, sz);
      if (!placements.has(model.id)) { placements.set(model.id, []); tints.set(model.id, []); }
      placements.get(model.id).push(tmpMatrix.compose(tmpPos, tmpQuat, tmpScale).clone());
      tints.get(model.id).push(tint);
    };
    const query = (sourceLayer, filter) => map.querySourceFeatures('omt', { sourceLayer, filter });

    const grid = createLotGrid(cx, cz);
    const buildings = []; // { x, z, dist, draw() }

    // 1. Real buildings (deduplicated: the same building can appear in several tiles).
    const seen = new Set();
    for (const f of query('building')) {
      const ring = outerRings(f.geometry)[0];
      if (!ring || ring.length < 4) continue;
      const fp = footprint(ring.map(([lng, lat]) => toLocal(lng, lat)));
      const key = `${Math.round(fp.x)}:${Math.round(fp.z)}`;
      if (seen.has(key) || fp.width < 3 || fp.depth < 3 || !near(fp.x, fp.z) || underLandmark(fp.x, fp.z)) continue;
      seen.add(key);
      blockFootprint(grid, fp);
      const height = f.properties.render_height || DEFAULT_HEIGHT_M;
      const family = familyFor(fp.width, fp.depth, height);
      const model = pick(family, fp.x, fp.z);
      // Fill the footprint; very large blocks are capped so models don't look smeared.
      const h = family === 'house' ? Math.max(5, Math.min(height, 9)) : Math.max(height, 8);
      buildings.push({
        x: fp.x, z: fp.z,
        draw: () => place(model, fp.x, fp.z, -fp.angle, Math.min(fp.width, 70), h, Math.min(fp.depth, 70), tintAt(fp.x, fp.z)),
      });
      yield;
    }

    // 2. Filler lots along streets.
    yield* addRoads(grid, query('transportation'), toLocal);
    yield* blockAreas(grid, [
      ...query('water'),
      ...query('park'),
      ...query('landcover'),
      ...query('landuse', ['in', ['get', 'class'], ['literal', OPEN_LANDUSE]]),
      ...query('aeroway'), // airport grounds, aprons, runways
    ], toLocal);
    // Our places, plus each landmark's grounds (e.g. the Shwedagon platform).
    const landmarkGrounds = LANDMARKS.map((lm) => ({ lng: lm.lng, lat: lm.lat, radius: lm.grounds }));
    for (const c of [...clearings, ...landmarkGrounds]) {
      const [x, z] = toLocal(c.lng, c.lat);
      grid.each(x - c.radius, z - c.radius, x + c.radius, z + c.radius, (idx, lx, lz) => {
        if ((lx - x) ** 2 + (lz - z) ** 2 <= c.radius ** 2) grid.blocked[idx] = 1;
      });
    }
    const fillLot = (idx, x, z) => {
      const gap = grid.gap[idx];
      if (grid.blocked[idx] || gap > FRONTAGE_M || !near(x, z)) return;
      const r = hash01(x, z);
      if (r < 0.12) return; // the odd empty lot / courtyard
      // Thin out towards the edge of the radius so the city fades instead of ending in a circle.
      const edge = (Math.sqrt((x - cx) ** 2 + (z - cz) ** 2) / RADIUS_M - 0.6) / 0.4;
      if (edge > 0 && hash01(x + 7.1, z - 3.3) < edge) return;
      const family = r < 0.62 ? 'house' : 'building';
      const model = pick(family, z, x);
      const [w, h, d] = model.size;
      // Uniform scale (no stretching), sized to the lot and kept clear of the road.
      const width = LOT_M * (0.72 + hash01(z, x) * 0.16);
      const k = Math.min(width / w, (LOT_M * 0.92) / d);
      if (gap < (d * k) / 2 + 1) return;
      const angle = grid.angle[idx] + (grid.facing[idx] > 0 ? 0 : Math.PI);
      buildings.push({ x, z, draw: () => place(model, x, z, -angle, w * k, Math.min(h * k, 24), d * k, tintAt(x, z)) });
    };
    for (let z = cz - RADIUS_M; z <= cz + RADIUS_M; z += LOT_M) {
      grid.each(cx - RADIUS_M, z, cx + RADIUS_M, z + LOT_M - 0.001, fillLot); // one row per slice step
      yield;
    }

    for (const b of buildings) b.dist = (b.x - cx) ** 2 + (b.z - cz) ** 2;
    buildings.sort((a, b) => a.dist - b.dist);
    yield;
    for (const b of buildings.slice(0, MAX_BUILDINGS)) b.draw();
    yield;

    // 3. Trees and bushes on a jittered grid inside parks and woods.
    let trees = 0, bushes = 0;
    const planted = new Set();
    const greens = [
      ...query('park'),
      ...query('landcover', ['in', ['get', 'class'], ['literal', ['wood', 'grass']]]),
    ];
    const treeBounds = [cx - RADIUS_M, cz - RADIUS_M, cx + RADIUS_M, cz + RADIUS_M];
    // Parks can contain lakes (Kandawgyi): mark their grid points as taken so no tree stands in water.
    for (const f of query('water')) {
      for (const ring of outerRings(f.geometry)) {
        scanRing(ring.map(([lng, lat]) => toLocal(lng, lat)), TREE_SPACING_M, treeBounds, (gx, gz) => planted.add(`${gx}:${gz}`));
      }
    }
    yield;
    for (const f of greens) {
      for (const ring of outerRings(f.geometry)) {
        if (trees >= MAX_TREES) break;
        const pts = ring.map(([lng, lat]) => toLocal(lng, lat));
        scanRing(pts, TREE_SPACING_M, treeBounds, (gx, gz) => {
          const key = `${gx}:${gz}`;
          if (trees >= MAX_TREES || planted.has(key) || !near(gx, gz)) return;
          planted.add(key);
          const r = hash01(gx, gz);
          if (r < 0.25) return; // clearings
          // Jitter so the grid doesn't show.
          const x = gx + (hash01(gz, gx) - 0.5) * TREE_SPACING_M * 0.5;
          const z = gz + (r - 0.5) * TREE_SPACING_M * 0.5;
          const tree = pick('tree', x, z);
          const k = (7 + hash01(z, x) * 5) / tree.size[1]; // 7–12 m tall, natural proportions
          place(tree, x, z, r * Math.PI * 2, tree.size[0] * k, tree.size[1] * k, tree.size[2] * k);
          trees++;
          // A bush beside some trees.
          if (r > 0.6 && bushes < MAX_BUSHES) {
            const bush = pick('bush', z, x);
            const kb = (1.6 + r * 1.2) / bush.size[1];
            place(bush, x + 4, z - 3, r * 9, bush.size[0] * kb, bush.size[1] * kb, bush.size[2] * kb);
            bushes++;
          }
        });
      }
      yield;
    }

    layer.stats = { buildings: Math.min(buildings.length, MAX_BUILDINGS), trees, bushes };
    for (const { model, mesh } of meshes) {
      const list = placements.get(model.id) ?? [];
      const n = Math.min(list.length, mesh.instanceMatrix.count);
      for (let i = 0; i < n; i++) mesh.setMatrixAt(i, list[i]);
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) {
        const tintList = tints.get(model.id) ?? [];
        for (let i = 0; i < n; i++) mesh.setColorAt(i, tintList[i] >= 0 ? TINTS[tintList[i]] : NO_TINT);
        mesh.instanceColor.needsUpdate = true;
      }
    }
    layer.stats.drawCalls = meshes.filter(({ mesh }) => mesh.count > 0).length;
    map.triggerRepaint();
  }

  // A refresh takes ~50–100 ms at zoom 15 on the 610M, so it runs in slices of SLICE_MS between
  // frames instead of freezing the map. A new refresh cancels the one in progress.
  let job = null, sliceTimer = 0;
  function runSlice() {
    const start = performance.now();
    while (performance.now() - start < SLICE_MS) {
      if (job.next().done) { job = null; return; }
    }
    sliceTimer = setTimeout(runSlice, 0);
  }
  function refresh() {
    if (!ready) return;
    clearTimeout(sliceTimer);
    job?.return();
    job = refreshSteps();
    runSlice();
  }

  // Re-place after the camera stops or a new tile arrives (not on 'idle': our own repaint
  // would fire it again and loop).
  let refreshTimer = 0;
  const scheduleRefresh = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, 150);
  };
  const onSourceData = (e) => { if (e.sourceId === 'omt' && e.tile) scheduleRefresh(); };

  const layer = {
    id: 'city-3d',
    type: 'custom',
    renderingMode: '3d',
    stats: null, // instance counts after each refresh, for debugging

    onAdd(_map, gl) {
      camera = new THREE.Camera();
      scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xfff4e2, 0xd9c7b0, 2.2));
      const sun = new THREE.DirectionalLight(0xffe7c4, 1.6);
      sun.position.set(-0.6, 1, 0.8);
      scene.add(sun, kitGroup, landmarkGroup);
      updateVisibility();

      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: false });
      renderer.autoClear = false;
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      loadKit().then((loaded) => {
        kit = loaded;
        buildMeshes();
        ready = true;
        // Models take over from the style's plain extrusions (kept as fallback if loading fails).
        if (map.getLayer('building-3d')) map.setLayerZoomRange('building-3d', BUILDINGS_3D_MIN_ZOOM, CITY_MIN_ZOOM);
        refresh();
      }).catch((error) => console.error('3D kit failed to load', error));
      loadLandmarks().catch((error) => console.error('Landmarks failed to load', error));

      map.on('zoom', updateVisibility);
      map.on('moveend', scheduleRefresh);
      map.on('sourcedata', onSourceData);
    },

    render(_gl, options) {
      if (!kitGroup.visible && !landmarkGroup.visible) return;
      camera.projectionMatrix.fromArray(options.defaultProjectionData.mainMatrix).multiply(sceneToMercator);
      renderer.resetState();
      renderer.render(scene, camera);
    },

    onRemove() {
      map.off('zoom', updateVisibility);
      map.off('moveend', scheduleRefresh);
      map.off('sourcedata', onSourceData);
      clearTimeout(refreshTimer);
      clearTimeout(sliceTimer);
      job?.return();
      for (const { mesh } of meshes) {
        mesh.geometry.dispose();
        (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => {
          m.map?.dispose();
          m.dispose();
        });
        mesh.dispose();
      }
      meshes.length = 0;
      landmarkGroup.traverse((obj) => {
        if (!obj.isMesh) return;
        obj.geometry.dispose();
        (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach((m) => m.dispose());
      });
      landmarkGroup.clear();
      renderer?.dispose();
    },
  };
  return layer;
}

/** Add the 3D city under the map labels. */
export function addCityLayer(map, options) {
  const firstLabel = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
  map.addLayer(createCityLayer(map, options), firstLabel);
}
