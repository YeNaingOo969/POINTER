// Architecturally detailed 3D Myanmar Pagodas built in Three.js from real Yangon landmarks
// and OSM footprints (`shwedagon`, `sule`, `botataung`):
// - 20-corner indented redented terraces (`ပစ္စယာ`) & octagonal Mon profiles
// - Hammered 24k Burmese gold-leaf bump/roughness foil maps (`shwe-bya`)
// - Open 7-ring filigree `Hti` umbrella crowns with radial ribs, halo rings, vane & diamond orb
// - Curved upturned sweeping Burmese multi-tiered `Pyatthat` roofs + golden triangular `စိန်တောင်` gables
// - Glossy diamond-inlaid marble courtyard with cardinal emerald walkway runners (`Shwedagon`)
// - Tiled perimeter arcade base with shop awnings, gilded gables & gatehouses (`Sule`, `Botataung`)
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Real OSM upper terrace ring for Shwedagon (from assets/raw/osm/shwedagon-nominatim.json)
const SHWEDAGON_CENTER = [96.14959, 16.79834];
const SHWEDAGON_OSM_RING = [
  [96.1482365, 16.7995677],
  [96.1486828, 16.7981043],
  [96.1486910, 16.7980712],
  [96.1489887, 16.7971829],
  [96.1498722, 16.7974498],
  [96.1508680, 16.7977270],
  [96.1506102, 16.7985588],
  [96.1501447, 16.8000765],
  [96.1492774, 16.7999027],
];

// -----------------------------------------------------------------------------
// Procedural PBR Maps (generated once per layer)
// -----------------------------------------------------------------------------

function seededRand(seed = 7) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Hammered Burmese gold-leaf (`shwe-bya`) square panel bump + roughness map. */
function buildGoldFoilBump() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const rand = seededRand(108);
  const cell = 16;
  for (let y = 0; y < 256; y += cell) {
    for (let x = 0; x < 256; x += cell) {
      const v = Math.round(135 + (rand() - 0.5) * 60);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, cell, cell);
      // Subtle hammered bezel & crease around each gold leaf sheet
      ctx.strokeStyle = 'rgba(65,65,65,0.45)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.anisotropy = 4;
  return tex;
}

/** Glossy inlaid marble courtyard + radial emerald axial walkway carpets (for Shwedagon). */
function buildShwedagonCourtMaps() {
  const S = 1024;
  const colC = document.createElement('canvas');
  const rghC = document.createElement('canvas');
  colC.width = colC.height = S;
  rghC.width = rghC.height = S;
  const cCtx = colC.getContext('2d');
  const rCtx = rghC.getContext('2d');

  cCtx.fillStyle = '#ede5d7';
  cCtx.fillRect(0, 0, S, S);
  // Low value in roughnessMap -> crisp mirror sheen on polished marble slabs!
  rCtx.fillStyle = 'rgb(70, 70, 70)';
  rCtx.fillRect(0, 0, S, S);

  const tiles = 32;
  const step = S / tiles;
  const shades = ['#f2ece0', '#e9dfd0', '#efe7da', '#e5dbc9'];
  for (let y = 0; y < tiles; y++) {
    for (let x = 0; x < tiles; x++) {
      cCtx.fillStyle = shades[(x * 3 + y * 5) & 3];
      cCtx.fillRect(x * step + 1, y * step + 1, step - 2, step - 2);
      const rv = 58 + (((x * 7 + y * 11) & 3) * 10);
      rCtx.fillStyle = `rgb(${rv},${rv},${rv})`;
      rCtx.fillRect(x * step + 1, y * step + 1, step - 2, step - 2);
    }
  }

  // Concentric warm sandstone & muted brass courtyard rings around the stupa plinth center (S/2, S/2)
  const cx = S / 2, cy = S / 2;
  for (const [r, w, col] of [
    [138, 12, '#d8ccb7'],
    [195, 10, '#ded2be'],
    [262, 12, '#d6cab4'],
    [340, 14, '#ded3c0'],
  ]) {
    cCtx.strokeStyle = col;
    cCtx.lineWidth = w;
    cCtx.beginPath();
    cCtx.arc(cx, cy, r, 0, Math.PI * 2);
    cCtx.stroke();
  }

  // Iconic emerald-jade axial carpet strips heading N/S/E/W (ref: shwedagon-3.jpg!)
  cCtx.fillStyle = '#266d5a';
  rCtx.fillStyle = 'rgb(215, 215, 215)'; // matte carpet vs glossy marble
  const stripW = 28;
  // North, South, East, West walkway strips stopping cleanly at plinth perimeter (r ~ 115..430)
  for (const [rx, ry, rw, rh] of [
    [cx - stripW / 2, 55, stripW, cy - 165],
    [cx - stripW / 2, cy + 115, stripW, S - 55 - (cy + 115)],
    [55, cy - stripW / 2, cx - 165, stripW],
    [cx + 115, cy - stripW / 2, S - 55 - (cx + 115), stripW],
  ]) {
    cCtx.fillRect(rx, ry, rw, rh);
    rCtx.fillRect(rx, ry, rw, rh);
    cCtx.strokeStyle = '#c89b3c';
    cCtx.lineWidth = 2.5;
    cCtx.strokeRect(rx, ry, rw, rh);
  }

  // Fine stone mortar joints
  cCtx.strokeStyle = 'rgba(155, 140, 120, 0.35)';
  cCtx.lineWidth = 1.5;
  for (let i = 0; i <= tiles; i++) {
    const p = i * step;
    cCtx.beginPath(); cCtx.moveTo(p, 0); cCtx.lineTo(p, S); cCtx.stroke();
    cCtx.beginPath(); cCtx.moveTo(0, p); cCtx.lineTo(S, p); cCtx.stroke();
  }

  const map = new THREE.CanvasTexture(colC);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;

  const rough = new THREE.CanvasTexture(rghC);
  rough.colorSpace = THREE.NoColorSpace;
  rough.anisotropy = 4;

  return { map, rough };
}

/** Glazed cream-ochre ceramic wall tile texture (for Sule & Botataung base shrines). */
function buildCeramicTileTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#efe5cb';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(165, 146, 112, 0.42)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= 256; i += 16) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 1.5);
  return tex;
}

// -----------------------------------------------------------------------------
// Geometry Sculpting Helpers
// -----------------------------------------------------------------------------

function mergeSafe(geos) {
  const valid = geos.filter(Boolean);
  if (!valid.length) return null;
  const normalized = valid.map((raw) => {
    const g = raw.index ? raw.toNonIndexed() : raw.clone();
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) {
      const pos = g.attributes.position;
      const uvs = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) {
        uvs[i * 2] = pos.getX(i) * 0.08 + pos.getZ(i) * 0.04;
        uvs[i * 2 + 1] = pos.getY(i) * 0.08;
      }
      g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    }
    for (const k of Object.keys(g.attributes)) {
      if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    }
    raw.dispose();
    return g;
  });
  const merged = mergeGeometries(normalized, false);
  normalized.forEach((g) => g.dispose());
  return merged;
}

function addBox(bucket, cx, cy, cz, sx, sy, sz, rotY = 0) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  if (rotY) g.rotateY(rotY);
  g.translate(cx, cy + sy / 2, cz);
  bucket.push(g);
}

function addCyl(bucket, cx, cy, cz, rBot, rTop, h, segs = 16, rotY = 0) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, segs);
  if (rotY) g.rotateY(rotY);
  g.translate(cx, cy + h / 2, cz);
  bucket.push(g);
}

/** 20-corner indented Burmese cruciform redented terrace (`ပစ္စယာ`). */
function addRedentedTerrace(bucket, cx, cy, cz, halfW, height, steps = 3, armRatio = 0.56) {
  const pts = [];
  const stepSpan = (1 - armRatio) * halfW / steps;
  // Walk quadrant 1 -> 4 counter-clockwise generating crisp zig-zag indented corners
  const quadCorner = (sx, sy, rev) => {
    const corner = [];
    for (let i = 0; i <= steps; i++) {
      const u = halfW - i * stepSpan;
      const v = armRatio * halfW + i * stepSpan;
      corner.push([sx * u, sy * v]);
      if (i < steps) corner.push([sx * (u - stepSpan), sy * v]);
    }
    return rev ? corner.reverse() : corner;
  };
  pts.push(...quadCorner(1, 1, false));
  pts.push(...quadCorner(-1, 1, true));
  pts.push(...quadCorner(-1, -1, false));
  pts.push(...quadCorner(1, -1, true));

  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.2, height - 0.12),
    bevelEnabled: true,
    bevelSize: 0.14,
    bevelThickness: 0.10,
    bevelSegments: 1,
    curveSegments: 1,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(cx, cy + 0.10, cz);
  bucket.push(geo);
}

/** Smooth 48/64-seg or octagonal lathe profile, shifted to y0 and centered on (cx, cz). */
function addLatheProfile(bucket, profileRY, cx, y0, cz, segs = 48, rotY = 0) {
  const pts = profileRY.map(([y, r]) => new THREE.Vector2(Math.max(0.01, r), y));
  const geo = new THREE.LatheGeometry(pts, segs);
  if (rotY) geo.rotateY(rotY);
  geo.translate(cx, y0, cz);
  bucket.push(geo);
}

/** Ring of 3D protruding lotus petals or miniature stupa finials around radius r. */
function addCrownRing(bucket, cx, y, cz, radius, count, elemH, elemR) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const g = new THREE.ConeGeometry(elemR, elemH, 5);
    g.translate(cx + Math.cos(a) * radius, y + elemH * 0.45, cz + Math.sin(a) * radius);
    bucket.push(g);
  }
}

/**
 * Iconographic Open Filigree Golden Umbrella Crown (`ထီးတော် / Hti`) + Vane + Diamond Orb (`စိန်ဖူးတော်`).
 * Open torus rings + radial filigree struts let sky light pass directly through!
 */
function addFiligreeHti(goldBright, orbBucket, cx, baseY, cz, htiHeight, baseR, { haloCount = 0 } = {}) {
  const tiers = 7;
  const topY = baseY + htiHeight * 0.72;
  // Central gilded shaft spine
  addCyl(goldBright, cx, baseY, cz, baseR * 0.24, baseR * 0.09, htiHeight * 0.90, 10);

  // 7 open tiered umbrella torus rings + delicate radial struts
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const y = baseY + t * htiHeight * 0.66;
    const r = baseR * Math.pow(0.76, i);
    const ring = new THREE.TorusGeometry(r, Math.max(0.055, baseR * 0.045 * (1 - t * 0.45)), 6, 18);
    ring.rotateX(Math.PI / 2);
    ring.translate(cx, y, cz);
    goldBright.push(ring);

    // Dangling tiny golden pendant chimes (`ခြူ`) on lower 3 tiers
    if (i < 3 && baseR > 0.6) {
      const chimes = 8;
      for (let c = 0; c < chimes; c++) {
        const a = (c / chimes) * Math.PI * 2 + i * 0.4;
        const drop = new THREE.OctahedronGeometry(baseR * 0.055, 0);
        drop.translate(cx + Math.cos(a) * r, y - baseR * 0.08, cz + Math.sin(a) * r);
        goldBright.push(drop);
      }
    }
  }

  // 6 inclined cage ribs tying rings cleanly from bottom ring to apex
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const rib = new THREE.CylinderGeometry(Math.max(0.03, baseR * 0.025), Math.max(0.04, baseR * 0.03), htiHeight * 0.72, 4);
    const tilt = Math.atan2(baseR * 0.78, htiHeight * 0.66);
    rib.translate(0, htiHeight * 0.34, 0);
    rib.rotateZ(tilt);
    rib.rotateY(-a);
    rib.translate(cx + Math.cos(a) * baseR * 0.92, baseY, cz + Math.sin(a) * baseR * 0.92);
    goldBright.push(rib);
  }

  // Sule & Botataung iconic concentric golden/wire safety halo aura ring(s) around shaft!
  for (let h = 0; h < haloCount; h++) {
    const hr = baseR * (1.25 + h * 0.55);
    const hy = baseY - htiHeight * (0.04 + h * 0.28);
    const halo = new THREE.TorusGeometry(hr, Math.max(0.05, baseR * 0.032), 6, 28);
    halo.rotateY(Math.PI * 0.15);
    halo.translate(cx, hy, cz);
    goldBright.push(halo);
  }

  // Weather Vane flag (`ငှက်မြတ်နား`) near upper spire
  const vaneW = Math.max(0.7, baseR * 0.95);
  addBox(goldBright, cx + vaneW * 0.48, topY + htiHeight * 0.03, cz, vaneW, htiHeight * 0.11, Math.max(0.08, baseR * 0.06));

  // Faceted shining Diamond Orb (`စိန်ဖူးတော်`) pinnacle!
  const orbR = Math.max(0.28, baseR * 0.24);
  const orb = new THREE.OctahedronGeometry(orbR, 1);
  orb.scale(1.0, 1.35, 1.0);
  orb.translate(cx, baseY + htiHeight * 0.94, cz);
  orbBucket.push(orb);
}

/** Flared concave Burmese roof hip tier (`ပြာသာဒ်` tier with upturned edges + golden gables). */
function addFlaredRoofTier(roofBucket, goldBucket, cx, y, cz, w, d, h, rotY = 0) {
  const hw = w / 2, hd = d / 2;
  const insetW = hw * 0.54, insetD = hd * 0.54;
  // Build custom flared pyramidal frustum with curved upturned corner tips
  const flare = Math.max(0.25, h * 0.22);
  const topW = insetW, topD = insetD;
  const g = new THREE.BufferGeometry();
  const c = Math.cos(rotY), s = Math.sin(rotY);
  const rot = (x, yy, z) => [cx + x * c - z * s, y + yy, cz + x * s + z * c];

  const bFL = rot(-hw, flare, -hd), bFR = rot(hw, flare, -hd), bBR = rot(hw, flare, hd), bBL = rot(-hw, flare, hd);
  const tFL = rot(-topW, h, -topD), tFR = rot(topW, h, -topD), tBR = rot(topW, h, topD), tBL = rot(-topW, h, topD);
  const tris = [
    // North (-Z): (bFR, bFL, tFL, tFR) -> -X x (+Y + +Z) = -Z, +Y
    bFR, bFL, tFL, bFR, tFL, tFR,
    // East (+X): (bBR, bFR, tFR, tBR) -> -Z x (-X + +Y) = +X, +Y
    bBR, bFR, tFR, bBR, tFR, tBR,
    // South (+Z): (bBL, bBR, tBR, tBL) -> +X x (+Y - +Z) = +Z, +Y
    bBL, bBR, tBR, bBL, tBR, tBL,
    // West (-X): (bFL, bBL, tBL, tFL) -> +Z x (+X + +Y) = -X, +Y
    bFL, bBL, tBL, bFL, tBL, tFL,
    // Top cap (+Y): (tFL, tBL, tBR, tFR)
    tFL, tBL, tBR, tFL, tBR, tFR,
  ];
  const pos = new Float32Array(tris.length * 3);
  tris.forEach((p, i) => pos.set(p, i * 3));
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  roofBucket.push(g);

  // Golden triangular Burmese flame gable (`စိန်တောင်`) crowning front/back/sides
  const gableH = h * 0.85;
  const gw = Math.min(w, d) * 0.26;
  for (const ang of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const ra = rotY + ang;
    const dist = (ang === 0 || ang === Math.PI) ? hd * 0.94 : hw * 0.94;
    const gx = cx + Math.sin(ra) * dist;
    const gz = cz + Math.cos(ra) * dist;
    const gTri = new THREE.ConeGeometry(gw * 0.55, gableH, 4);
    gTri.scale(1.0, 1.0, 0.28);
    gTri.rotateY(ra);
    gTri.translate(gx, y + flare + gableH * 0.42, gz);
    goldBucket.push(gTri);
  }
}

/** Stacked Burmese Pyatthat Pavilion (`တန်ဆောင်း` / `မုခ်ဦး` - sweeping curved tiers + spire). */
function addPyatthatPavilion(buckets, cx, y0, cz, w, d, wallH, tiers, rotY, roofBucket, wallBucket, trimGold) {
  addBox(wallBucket, cx, y0, cz, w, wallH, d, rotY);
  // Dark carved doorway arches on main faces
  const doorW = Math.min(w, d) * 0.36;
  for (const side of [-1, 1]) {
    const s = Math.sin(rotY), c = Math.cos(rotY);
    addBox(buckets.darkRecess, cx - s * side * (d * 0.49), y0, cz + c * side * (d * 0.49), doorW, wallH * 0.72, 0.35, rotY);
  }
  // Golden cornice & corner pillars
  addBox(trimGold, cx, y0 + wallH - 0.35, cz, w * 1.04, 0.38, d * 1.04, rotY);

  let y = y0 + wallH;
  let rw = w * 1.18, rd = d * 1.18;
  for (let i = 0; i < tiers; i++) {
    const th = 1.65 * Math.pow(0.84, i);
    addFlaredRoofTier(roofBucket, trimGold, cx, y, cz, rw, rd, th, rotY);
    y += th * 0.85;
    if (i < tiers - 1) {
      addBox(wallBucket, cx, y, cz, rw * 0.48, th * 0.45, rd * 0.48, rotY);
      y += th * 0.40;
    }
    rw *= 0.66;
    rd *= 0.66;
  }
  // Gilded finial spire atop pyatthat
  addCyl(trimGold, cx, y, cz, Math.max(0.35, rw * 0.35), 0.04, 2.8 + tiers * 0.45, 8);
}

function addChinthe(whiteBucket, goldBucket, crimsonBucket, cx, y0, cz, size, rotY) {
  const c = Math.cos(rotY), s = Math.sin(rotY);
  const off = (u, v) => [cx + u * c - v * s, cz + u * s + v * c];
  addBox(whiteBucket, cx, y0, cz, 4.2 * size, 2.0 * size, 5.4 * size, rotY);
  const [hx, hz] = off(0, -1.1 * size);
  const [fx, fz] = off(0, 0.9 * size);
  addCyl(whiteBucket, hx, y0 + 2.0 * size, hz, 1.5 * size, 1.1 * size, 2.4 * size, 10);
  addCyl(whiteBucket, fx, y0 + 2.0 * size, fz, 1.1 * size, 1.0 * size, 3.6 * size, 10);
  // Gold lion mane crest & crimson roar mouth
  addCyl(goldBucket, fx, y0 + 5.2 * size, fz, 1.35 * size, 0.9 * size, 2.2 * size, 10);
  const [mx, mz] = off(0, 1.85 * size);
  addBox(crimsonBucket, mx, y0 + 5.6 * size, mz, 0.9 * size, 0.6 * size, 0.55 * size, rotY);
}

/** Convert polygon edge intersections -> inside test. */
function insidePoly(x, z, poly) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
}

function polyEdgeDist(x, z, poly) {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length];
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - (ax + t * dx), z - (az + t * dz)));
  }
  return best;
}

// -----------------------------------------------------------------------------
// Shared Pagoda PBR Materials
// -----------------------------------------------------------------------------

export function createPagodaMaterials({ envMap }) {
  const goldBump = buildGoldFoilBump();
  const shwedagonCourt = buildShwedagonCourtMaps();
  const ceramicTex = buildCeramicTileTexture();

  const goldBright = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#F09C0E'),
    emissive: new THREE.Color('#663602'),
    emissiveIntensity: 0.24,
    metalness: 0.40,
    roughness: 0.34,
    bumpMap: goldBump,
    bumpScale: 0.11,
    envMap,
    envMapIntensity: 0.60,
  });

  const goldDark = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#C47508'),
    emissive: new THREE.Color('#4a2602'),
    emissiveIntensity: 0.20,
    metalness: 0.36,
    roughness: 0.42,
    bumpMap: goldBump,
    bumpScale: 0.12,
    envMap,
    envMapIntensity: 0.50,
  });

  const diamondOrb = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#FFFFFF'),
    emissive: new THREE.Color('#FFF2B8'),
    emissiveIntensity: 1.1,
    metalness: 0.9,
    roughness: 0.05,
    envMap,
    envMapIntensity: 1.4,
  });

  const shwedagonMarble = new THREE.MeshStandardMaterial({
    map: shwedagonCourt.map,
    roughnessMap: shwedagonCourt.rough,
    roughness: 0.95, // scaled cleanly by roughnessMap (marble ~0.24 glossy, carpets ~0.82 matte)
    metalness: 0.04,
    envMap,
    envMapIntensity: 0.55,
  });

  const courtyardTile = new THREE.MeshStandardMaterial({
    map: ceramicTex,
    color: new THREE.Color('#F4EFE4'),
    roughness: 0.32,
    metalness: 0.03,
    envMap,
    envMapIntensity: 0.44,
  });

  const ceramicWall = new THREE.MeshStandardMaterial({
    map: ceramicTex,
    color: new THREE.Color('#F3E8CB'),
    roughness: 0.58,
    metalness: 0.02,
    envMap,
    envMapIntensity: 0.26,
  });

  const whiteStucco = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#F4EFE5'),
    roughness: 0.72,
    metalness: 0.02,
    envMap,
    envMapIntensity: 0.26,
  });

  const crimsonRoof = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#9E2D20'),
    roughness: 0.44,
    metalness: 0.10,
    envMap,
    envMapIntensity: 0.42,
  });

  const emeraldRoof = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1E5E42'),
    roughness: 0.42,
    metalness: 0.10,
    envMap,
    envMapIntensity: 0.45,
  });

  const hillsideGrass = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#5A933D'),
    roughness: 0.88,
    metalness: 0.0,
    envMap,
    envMapIntensity: 0.18,
  });

  const canopyLeaf = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#4B8D3C'),
    roughness: 0.78,
    metalness: 0.0,
    envMap,
    envMapIntensity: 0.22,
  });

  const trunkWood = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#694B32'),
    roughness: 0.90,
    metalness: 0.0,
    envMap,
    envMapIntensity: 0.14,
  });

  const darkRecess = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#2B231D'),
    roughness: 0.85,
    metalness: 0.05,
    envMap,
    envMapIntensity: 0.15,
  });

  return {
    goldBright,
    goldDark,
    diamondOrb,
    shwedagonMarble,
    courtyardTile,
    ceramicWall,
    whiteStucco,
    crimsonRoof,
    emeraldRoof,
    hillsideGrass,
    canopyLeaf,
    trunkWood,
    darkRecess,
  };
}

// -----------------------------------------------------------------------------
// 1. SHWEDAGON PAGODA (Architectural Monument)
// -----------------------------------------------------------------------------

export function buildShwedagonMonument(mats) {
  const group = new THREE.Group();
  const HILL = 51.0;
  const SLOPE = 105.0;
  const STUPA = 99.0;

  const kx = 111320 * Math.cos((SHWEDAGON_CENTER[1] * Math.PI) / 180);
  const ky = 110574;
  // Note: Three.js +Z is south, -Z is north!
  const outline = SHWEDAGON_OSM_RING.map(([lng, lat]) => [
    (lng - SHWEDAGON_CENTER[0]) * kx,
    (SHWEDAGON_CENTER[1] - lat) * ky,
  ]);

  const edgeAlong = (ang) => {
    let r = 0;
    while (r < 380 && insidePoly(Math.cos(ang) * r, Math.sin(ang) * r, outline)) r += 1.5;
    return r;
  };
  const STAIRS = [
    ['east', 0.0],
    ['south', Math.PI / 2],
    ['west', Math.PI],
    ['north', -Math.PI / 2],
  ].map(([name, ang]) => ({ name, ang, edge: edgeAlong(ang) }));
  const STAIR_W = 13.0;

  const stairH = (x, z) => {
    for (const s of STAIRS) {
      const along = x * Math.cos(s.ang) + z * Math.sin(s.ang);
      const across = -x * Math.sin(s.ang) + z * Math.cos(s.ang);
      if (Math.abs(across) <= STAIR_W * 0.65 && along >= s.edge && along <= s.edge + SLOPE) {
        return HILL * (1 - (along - s.edge) / SLOPE);
      }
    }
    return null;
  };

  const hillY = (x, z) => {
    if (insidePoly(x, z, outline)) return HILL - 1.4;
    const d = polyEdgeDist(x, z, outline);
    if (d >= SLOPE) return 0;
    const t = d / SLOPE;
    const h = HILL * (1 - t * t * (3 - 2 * t));
    const sh = stairH(x, z);
    return sh !== null ? Math.min(h, sh - 2.0) : h;
  };

  const buckets = {
    goldBright: [],
    goldDark: [],
    diamondOrb: [],
    whiteStucco: [],
    crimsonRoof: [],
    emeraldRoof: [],
    darkRecess: [],
    courtyardWall: [],
  };

  // --- Hill terrain mesh (12m grid: lighter vertex count, identical smooth Singuttara Hill silhouette) ---
  const xs = outline.map((p) => p[0]), zs = outline.map((p) => p[1]);
  const x0 = Math.min(...xs) - SLOPE, x1 = Math.max(...xs) + SLOPE;
  const z0 = Math.min(...zs) - SLOPE, z1 = Math.max(...zs) + SLOPE;
  const segX = Math.ceil((x1 - x0) / 12), segZ = Math.ceil((z1 - z0) / 12);
  const hillPos = [];
  for (let iz = 0; iz < segZ; iz++) {
    const za = z0 + iz * 12, zb = Math.min(z1, za + 12);
    for (let ix = 0; ix < segX; ix++) {
      const xa = x0 + ix * 12, xb = Math.min(x1, xa + 12);
      const hAA = hillY(xa, za), hBA = hillY(xb, za), hBB = hillY(xb, zb), hAB = hillY(xa, zb);
      if (hAA < 0.1 && hBA < 0.1 && hBB < 0.1 && hAB < 0.1) continue;
      hillPos.push(xa, hAA, za, xa, hAB, zb, xb, hBB, zb);
      hillPos.push(xa, hAA, za, xb, hBB, zb, xb, hBA, za);
    }
  }
  const hillGeo = new THREE.BufferGeometry();
  hillGeo.setAttribute('position', new THREE.Float32BufferAttribute(hillPos, 3));
  hillGeo.computeVertexNormals();
  const hillMesh = new THREE.Mesh(hillGeo, mats.hillsideGrass);
  hillMesh.receiveShadow = true;
  hillMesh.castShadow = false;
  group.add(hillMesh);

  // --- Singuttara Hill lush rounded canopy trees (InstancedMesh) ---
  const rand = seededRand(42);
  const treeCoords = [];
  for (let gz = Math.ceil(z0 / 12) * 12; gz <= z1; gz += 12) {
    for (let gx = Math.ceil(x0 / 12) * 12; gx <= x1; gx += 12) {
      if (rand() < 0.12) continue;
      const tx = gx + (rand() - 0.5) * 8;
      const tz = gz + (rand() - 0.5) * 8;
      const ty = hillY(tx, tz);
      if (ty > 3.5 && ty < HILL - 6.5 && stairH(tx, tz) === null) {
        treeCoords.push([tx, ty - 0.6, tz, 6.5 + rand() * 5.0]);
      }
    }
  }
  if (treeCoords.length) {
    const canopyGeo = mergeSafe([
      (() => { const g = new THREE.IcosahedronGeometry(0.68, 1); g.scale(1, 0.72, 1); g.translate(0, 1.35, 0); return g; })(),
      (() => { const g = new THREE.IcosahedronGeometry(0.48, 1); g.scale(1, 0.78, 1); g.translate(-0.34, 1.08, 0.22); return g; })(),
      (() => { const g = new THREE.IcosahedronGeometry(0.46, 1); g.scale(1, 0.78, 1); g.translate(0.32, 1.10, -0.20); return g; })(),
    ]);
    const trunkGeo = new THREE.CylinderGeometry(0.11, 0.17, 1.05, 6);
    trunkGeo.translate(0, 0.52, 0);

    const canopyInst = new THREE.InstancedMesh(canopyGeo, mats.canopyLeaf, treeCoords.length);
    const trunkInst = new THREE.InstancedMesh(trunkGeo, mats.trunkWood, treeCoords.length);
    canopyInst.castShadow = false;
    canopyInst.receiveShadow = true;
    trunkInst.castShadow = false;

    const dm = new THREE.Matrix4(), dq = new THREE.Quaternion(), dp = new THREE.Vector3(), ds = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const shades = [new THREE.Color('#478838'), new THREE.Color('#5a9f45'), new THREE.Color('#66ac4f')];
    treeCoords.forEach(([x, y, z, sz], i) => {
      dq.setFromAxisAngle(up, rand() * Math.PI * 2);
      ds.set(sz * 0.65, sz * 0.72, sz * 0.65);
      dm.compose(dp.set(x, y, z), dq, ds);
      canopyInst.setMatrixAt(i, dm);
      trunkInst.setMatrixAt(i, dm);
      canopyInst.setColorAt(i, shades[i % shades.length]);
    });
    canopyInst.instanceMatrix.needsUpdate = true;
    if (canopyInst.instanceColor) canopyInst.instanceColor.needsUpdate = true;
    trunkInst.instanceMatrix.needsUpdate = true;
    group.add(canopyInst, trunkInst);
  }

  // --- Marble Upper Courtyard Slab (mapped 0..1 planar UVs for Shwedagon axial emerald carpets!) ---
  const courtShape = new THREE.Shape();
  // Recall: shape Y -> after rotateX(-PI/2), Three Z = -Y. So shape Y = -z!
  courtShape.moveTo(outline[0][0], -outline[0][1]);
  for (let i = 1; i < outline.length; i++) courtShape.lineTo(outline[i][0], -outline[i][1]);
  courtShape.closePath();

  const deckGeo = new THREE.ExtrudeGeometry(courtShape, { depth: 2.2, bevelEnabled: false });
  deckGeo.rotateX(-Math.PI / 2);
  deckGeo.translate(0, HILL - 2.2, 0);
  // Planar world UVs centered around (0, 0) spanning +-165m -> [0..1]
  const dPos = deckGeo.attributes.position;
  const dUvs = new Float32Array(dPos.count * 2);
  for (let i = 0; i < dPos.count; i++) {
    dUvs[i * 2] = dPos.getX(i) / 330 + 0.5;
    dUvs[i * 2 + 1] = dPos.getZ(i) / 330 + 0.5;
  }
  deckGeo.setAttribute('uv', new THREE.BufferAttribute(dUvs, 2));
  const deckMesh = new THREE.Mesh(deckGeo, mats.shwedagonMarble);
  deckMesh.receiveShadow = true;
  deckMesh.castShadow = true;
  group.add(deckMesh);

  // --- Central Grand Stupa: Redented 20-Corner Cruciform Terraces + Smooth Molded Bell + Filigree Hti ---
  const Z = HILL;
  // 3 deep indented 20-corner square terraces (`ပစ္စယာ`) + 3 stepped octagonal rings
  for (const [half, y0, y1] of [[34, 0, 3.8], [30.5, 3.8, 7.2], [27, 7.2, 10.2]]) {
    addRedentedTerrace(buckets.goldDark, 0, Z + y0, 0, half, y1 - y0, 3, 0.54);
    addRedentedTerrace(buckets.goldBright, 0, Z + y1 - 0.5, 0, half + 0.5, 0.52, 3, 0.54);
  }
  for (const [r, y0, y1] of [[25.5, 10.2, 12.8], [22.8, 12.8, 15.2], [20.4, 15.2, 17.6]]) {
    addCyl(buckets.goldDark, 0, Z + y0, 0, r, r, y1 - y0, 8, Math.PI / 8);
    addCyl(buckets.goldBright, 0, Z + y1 - 0.45, 0, r + 0.45, r + 0.45, 0.45, 8, Math.PI / 8);
  }

  // Smooth curved Shwedagon golden bell, embossed waist rings, lotus petals, banana bud (y = 17.6..79)
  const bellProfile = [
    [17.6, 18.4], [19.0, 18.6], [21.5, 17.7], [25.5, 16.0], [30.0, 14.0], [34.5, 12.0], [38.5, 10.3], [41.2, 9.5],
    [41.2, 10.2], [42.4, 10.2], [42.4, 9.4], [43.6, 9.4], [43.6, 9.9], [44.8, 9.9], [44.8, 9.0],
    [46.2, 9.0], [47.8, 9.4], [49.8, 9.1], [51.5, 8.0],
    [51.5, 7.4], [52.8, 7.3], [52.8, 7.7], [53.9, 7.7], [53.9, 6.9], [55.0, 6.7],
    [55.0, 7.3], [56.3, 8.1], [57.5, 6.6], [57.5, 7.0], [59.1, 7.4], [60.6, 5.5],
    [60.6, 5.2], [63.5, 5.0], [66.8, 4.3], [70.2, 3.4], [73.6, 2.5], [76.5, 1.7], [79.0, 1.15],
  ];
  const scale = STUPA / 99.0;
  addLatheProfile(buckets.goldBright, bellProfile.map(([y, r]) => [y * scale, r]), 0, Z, 0, 64);

  // Carved 3D decorative relief rings: garlands around lower bell + protruding lotus petals (`ကြာမှောက်`)
  addCrownRing(buckets.goldDark, 0, Z + 31.0 * scale, 0, 13.7, 24, 1.8, 1.1);
  addCrownRing(buckets.goldBright, 0, Z + 55.2 * scale, 0, 7.6, 24, 2.1, 0.85);
  addCrownRing(buckets.goldBright, 0, Z + 58.0 * scale, 0, 7.1, 20, 1.8, 0.72);

  // Iconic Open Filigree Golden `Hti` Crown + Crescent Vane + Glowing Diamond Orb (`စိန်ဖူးတော်`)
  addFiligreeHti(buckets.goldBright, buckets.diamondOrb, 0, Z + 79.0 * scale, 0, 18.5 * scale, 2.85, { haloCount: 0 });

  // --- 64 Miniature Ring Stupas + 4 Cardinal Large Stupas + 4 Corner Stupas (1 InstancedMesh!) ---
  const smallStupaGold = [];
  addCyl(smallStupaGold, 0, 0, 0, 1.4, 1.4, 0.9, 4, Math.PI / 4);
  addLatheProfile(smallStupaGold, [
    [0.9, 1.25], [2.4, 0.95], [3.6, 0.60], [5.4, 0.34], [7.2, 0.14],
    [7.2, 0.32], [8.2, 0.14], [9.4, 0.02],
  ], 0, 0, 0, 12);
  const smallStupaGeo = mergeSafe(smallStupaGold);
  const stupaPlacements = [];
  const half = 38.0;
  for (let i = 0; i < 16; i++) {
    const t = -half + (i + 0.5) * ((2 * half) / 16);
    if (Math.abs(t) <= 5.5) continue;
    for (const [x, z] of [[t, -half], [t, half], [-half, t], [half, t]]) stupaPlacements.push([x, Z, z, 0.88]);
  }
  for (const [x, z] of [[0, -half - 4.5], [0, half + 4.5], [-half - 4.5, 0], [half + 4.5, 0]]) stupaPlacements.push([x, Z, z, 1.65]);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) stupaPlacements.push([sx * (half + 6.5), Z, sz * (half + 6.5), 1.25]);

  const stupaInst = new THREE.InstancedMesh(smallStupaGeo, mats.goldBright, stupaPlacements.length);
  stupaInst.castShadow = true;
  stupaInst.receiveShadow = true;
  const sm = new THREE.Matrix4(), sq = new THREE.Quaternion(), sp = new THREE.Vector3(), ss = new THREE.Vector3();
  stupaPlacements.forEach(([x, y, z, sc], i) => {
    stupaInst.setMatrixAt(i, sm.compose(sp.set(x, y, z), sq, ss.set(sc * 1.28, sc, sc * 1.28)));
  });
  stupaInst.instanceMatrix.needsUpdate = true;
  group.add(stupaInst);

  // --- 4 Cardinal Ornate Entrance Prayer Halls (`တန်ဆောင်း`) + Ring of Outer Shrines ---
  for (const s of STAIRS) {
    const r = s.edge - 15;
    addPyatthatPavilion(
      buckets, Math.cos(s.ang) * r, Z, Math.sin(s.ang) * r, 19, 13, 5.8,
      s.name === 'south' ? 5 : 4, -s.ang + Math.PI / 2,
      buckets.crimsonRoof, buckets.whiteStucco, buckets.goldBright,
    );
  }

  // --- Ring of Outer & Inner Pyatthat Shrines (InstancedMesh -> ~15x fewer GPU triangles!) ---
  const shrineSpots = [];
  for (let k = 0; k < 40; k++) {
    const ang = (2 * Math.PI * k) / 40 + 0.04;
    if (STAIRS.some((s) => Math.abs(Math.atan2(Math.sin(ang - s.ang), Math.cos(ang - s.ang))) < 0.17)) continue;
    const r = edgeAlong(ang) - 11;
    if (r < half + 22) continue;
    shrineSpots.push({
      x: Math.cos(ang) * r,
      z: Math.sin(ang) * r,
      rot: -ang + Math.PI / 2,
      sx: 1.0,
      sy: 1.0,
      roofKind: k % 3 === 0 ? 'crimson' : 'goldDark',
    });
  }
  for (const ringR of [half + 17, half + 32]) {
    const n = Math.floor((2 * Math.PI * ringR) / 18);
    for (let i = 0; i < n; i++) {
      const ang = (2 * Math.PI * (i + 0.5)) / n;
      if (STAIRS.some((s) => Math.abs(Math.atan2(Math.sin(ang - s.ang), Math.cos(ang - s.ang))) < 0.22)) continue;
      if (edgeAlong(ang) - ringR < 20) continue;
      const sc = 0.65 + (i % 3) * 0.14;
      shrineSpots.push({
        x: Math.cos(ang) * ringR,
        z: Math.sin(ang) * ringR,
        rot: -ang,
        sx: sc,
        sy: sc * 0.88,
        roofKind: i % 2 === 0 ? 'crimson' : 'emerald',
      });
    }
  }
  if (shrineSpots.length) {
    const tpl = { roof: [], wall: [], gold: [], darkRecess: [] };
    addPyatthatPavilion(tpl, 0, 0, 0, 8.8, 7.8, 4.8, 3, 0, tpl.roof, tpl.wall, tpl.gold);
    const tplWallGeo = mergeSafe(tpl.wall);
    const tplGoldGeo = mergeSafe(tpl.gold);
    const tplRoofGeo = mergeSafe(tpl.roof);
    tpl.darkRecess.forEach((g) => g.dispose());
    const wallInst = new THREE.InstancedMesh(tplWallGeo, mats.whiteStucco, shrineSpots.length);
    const goldInst = new THREE.InstancedMesh(tplGoldGeo, mats.goldBright, shrineSpots.length);
    wallInst.castShadow = goldInst.castShadow = false;
    wallInst.receiveShadow = goldInst.receiveShadow = true;

    const byRoof = { crimson: [], goldDark: [], emerald: [] };
    const up = new THREE.Vector3(0, 1, 0);
    const dp = new THREE.Vector3();
    const dq = new THREE.Quaternion();
    const ss = new THREE.Vector3();
    const sm = new THREE.Matrix4();
    shrineSpots.forEach((sp, i) => {
      dq.setFromAxisAngle(up, sp.rot);
      sm.compose(dp.set(sp.x, Z, sp.z), dq, ss.set(sp.sx, sp.sy, sp.sx));
      wallInst.setMatrixAt(i, sm);
      goldInst.setMatrixAt(i, sm);
      byRoof[sp.roofKind].push(sm.clone());
    });
    wallInst.instanceMatrix.needsUpdate = true;
    goldInst.instanceMatrix.needsUpdate = true;
    group.add(wallInst, goldInst);

    const roofMats = { crimson: mats.crimsonRoof, goldDark: mats.goldDark, emerald: mats.emeraldRoof };
    for (const [rk, matsList] of Object.entries(byRoof)) {
      if (!matsList.length) continue;
      const rInst = new THREE.InstancedMesh(tplRoofGeo, roofMats[rk], matsList.length);
      rInst.castShadow = true;
      rInst.receiveShadow = true;
      matsList.forEach((m4, j) => rInst.setMatrixAt(j, m4));
      rInst.instanceMatrix.needsUpdate = true;
      group.add(rInst);
    }
  }

  // --- 4 Covered Stairways (`Zaungdan`), Foot Gatehouses & Chinthe Guardians ---
  for (const s of STAIRS) {
    const c = Math.cos(s.ang), si = Math.sin(s.ang);
    const steps = 8;
    const seg = SLOPE / steps;
    for (let i = 0; i < steps; i++) {
      const mid = s.edge + (i + 0.5) * seg;
      const zt = HILL * (1 - (mid - s.edge) / SLOPE);
      const sx = c * mid, sz = si * mid;
      addBox(buckets.courtyardWall, sx, zt - 2.6, sz, seg + 0.5, 2.8, STAIR_W, -s.ang);
      addFlaredRoofTier(
        i % 2 ? buckets.crimsonRoof : buckets.goldDark, buckets.goldBright,
        sx, zt + 3.8, sz, seg * 1.05, STAIR_W + 1.8, 2.5, -s.ang,
      );
    }
    const gx = c * (s.edge + SLOPE + 7), gz = si * (s.edge + SLOPE + 7);
    addPyatthatPavilion(
      buckets, gx, 0, gz, STAIR_W + 7, 11, 8.2, s.name === 'south' ? 6 : 5, -s.ang + Math.PI / 2,
      buckets.crimsonRoof, buckets.whiteStucco, buckets.goldBright,
    );
    for (const side of [-1, 1]) {
      const sc = s.name === 'south' ? 1.55 : 1.0;
      const lx = gx + c * 11 - si * side * (STAIR_W * 0.5 + 5.8);
      const lz = gz + si * 11 + c * side * (STAIR_W * 0.5 + 5.8);
      addChinthe(buckets.whiteStucco, buckets.goldBright, buckets.crimsonRoof, lx, 0, lz, sc, -s.ang + Math.PI / 2);
    }
  }

  const matMap = [
    ['goldBright', mats.goldBright],
    ['goldDark', mats.goldDark],
    ['diamondOrb', mats.diamondOrb],
    ['whiteStucco', mats.whiteStucco],
    ['crimsonRoof', mats.crimsonRoof],
    ['emeraldRoof', mats.emeraldRoof],
    ['darkRecess', mats.darkRecess],
    ['courtyardWall', mats.ceramicWall],
  ];
  for (const [key, mat] of matMap) {
    const geo = mergeSafe(buckets[key]);
    if (!geo) continue;
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = key !== 'diamondOrb';
    m.receiveShadow = true;
    group.add(m);
  }
  return group;
}

// -----------------------------------------------------------------------------
// 2. SULE PAGODA (Octagonal Mon Stupa + Shop Arcade Base + 4 Entrance Pyatthats)
// -----------------------------------------------------------------------------

export function buildSuleMonument(mats) {
  const group = new THREE.Group();
  const HEIGHT = 44.13;
  const BASE_R = 20.5;
  const BASE_H = 5.6;

  const buckets = {
    goldBright: [],
    goldDark: [],
    diamondOrb: [],
    ceramicWall: [],
    courtyardTile: [],
    whiteStucco: [],
    crimsonRoof: [],
    darkRecess: [],
  };

  // Perimeter octagonal shop base (`sule-2.jpg`!): cream tiled shop ring + recessed dark shop bays + eave
  addCyl(buckets.ceramicWall, 0, 0, 0, BASE_R, BASE_R, 4.4, 8, Math.PI / 8);
  addCyl(buckets.crimsonRoof, 0, 4.3, 0, BASE_R + 1.1, BASE_R - 1.4, 1.15, 8, Math.PI / 8);
  addCyl(buckets.courtyardTile, 0, 5.4, 0, BASE_R - 1.4, BASE_R - 1.4, 0.35, 8, Math.PI / 8);

  // Recessed shop door fronts + Continuous crown of Burmese golden triangular gables (`စိန်တောင်`, ref: sule-2.jpg!)
  const faceDist = BASE_R * Math.cos(Math.PI / 8);
  for (let side = 0; side < 8; side++) {
    const a = (side / 8) * Math.PI * 2;
    const fx = Math.sin(a) * faceDist;
    const fz = Math.cos(a) * faceDist;
    // Recessed dark storefront band along non-entrance sides
    if (side % 2 === 1) {
      addBox(buckets.darkRecess, fx, 0.2, fz, 11.5, 3.0, 0.45, a);
    }
    // Row of 4 ornate golden Burmese gable points per octagon face!
    const edgeLen = BASE_R * 2 * Math.sin(Math.PI / 8);
    const tx = Math.cos(a), tz = -Math.sin(a);
    for (let g = 0; g < 4; g++) {
      const off = ((g + 0.5) / 4 - 0.5) * edgeLen * 0.85;
      const gable = new THREE.ConeGeometry(1.15, 2.35, 4);
      gable.scale(1.0, 1.0, 0.26);
      gable.rotateY(a);
      gable.translate(fx + tx * off, 5.55, fz + tz * off);
      buckets.goldBright.push(gable);
    }
  }

  // 4 Grand Cardinal 5-Tier Entrance Pavilions (`မုခ်ဦး`, ref: sule-2.jpg left!)
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    const px = Math.sin(a) * (BASE_R + 0.4);
    const pz = Math.cos(a) * (BASE_R + 0.4);
    addPyatthatPavilion(
      buckets, px, 0, pz, 7.4, 6.2, 4.9, 4, a,
      buckets.crimsonRoof, buckets.whiteStucco, buckets.goldBright,
    );
    // Crimson signboard plaque & gilded tympanum archway facing street
    addBox(buckets.crimsonRoof, Math.sin(a) * (BASE_R + 3.6), 3.3, Math.cos(a) * (BASE_R + 3.6), 3.6, 1.0, 0.3, a);
  }

  // 4 Inner Corner Miniature Stupas around courtyard deck (`sule-6.jpg`!)
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2 + Math.PI / 4;
    const sx = Math.sin(a) * (BASE_R - 4.5);
    const sz = Math.cos(a) * (BASE_R - 4.5);
    addLatheProfile(buckets.goldBright, [
      [0, 1.1], [1.4, 0.95], [2.6, 0.55], [4.0, 0.25], [5.4, 0.04],
    ], sx, BASE_H, sz, 8, Math.PI / 8);
  }

  // Central Mon-Style Sweeping Octagonal Chedi (`44.13 m`)
  const s = (HEIGHT - BASE_H) / 44.13;
  // 4 Stepped Octagonal Gold Terraces (`sule-6.jpg`: strong sharp horizontal pleats!)
  for (const [z, r, h] of [[0, 14.2, 2.4], [2.4, 12.6, 2.2], [4.6, 11.2, 2.0], [6.6, 10.0, 1.6]]) {
    addCyl(buckets.goldDark, 0, BASE_H + z * s, 0, r * s, r * s, h * s, 8, Math.PI / 8);
    addCyl(buckets.goldBright, 0, BASE_H + (z + h - 0.35) * s, 0, (r + 0.32) * s, (r + 0.32) * s, 0.38 * s, 8, Math.PI / 8);
  }

  // Sweeping Octagonal Concave Bell (signature of Sule Pagoda!) + Embossed Medallions
  const octBell = [[8.2, 9.65], [10.0, 9.2], [12.5, 8.2], [15.0, 6.8], [17.0, 5.4], [18.5, 4.35]];
  addLatheProfile(buckets.goldBright, octBell.map(([y, r]) => [y * s, r * s]), 0, BASE_H, 0, 8, Math.PI / 8);
  // 4 embossed oval golden decorative plaques on the octagonal bell faces (`sule-6.jpg`)
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    addBox(buckets.goldDark, Math.sin(a) * 6.8 * s, BASE_H + 12.2 * s, Math.cos(a) * 6.8 * s, 1.4, 2.6, 0.3, a);
  }

  // Molded round spire rings + lotus petals + slim banana bud
  const roundSpire = [
    [18.5, 4.25], [19.4, 4.30], [19.4, 3.85], [20.3, 3.85], [20.3, 3.45],
    [21.2, 3.45], [21.2, 3.05], [22.1, 3.05],
    [22.1, 2.8], [23.4, 3.3], [24.6, 2.7], [25.6, 2.9], [26.8, 2.25],
    [28.5, 1.8], [30.8, 1.25], [33.2, 0.72], [35.0, 0.52],
  ];
  addLatheProfile(buckets.goldBright, roundSpire.map(([y, r]) => [y * s, r * s]), 0, BASE_H, 0, 24);
  addCrownRing(buckets.goldBright, 0, BASE_H + 23.0 * s, 0, 3.1 * s, 12, 1.1, 0.42);

  // Iconic Open Filigree `Hti` Crown + Dual Halo Rings (`sule-6.jpg`) + Diamond Orb!
  addFiligreeHti(buckets.goldBright, buckets.diamondOrb, 0, BASE_H + 35.0 * s, 0, 9.2 * s, 1.65, { haloCount: 2 });

  for (const [k, m] of [
    ['goldBright', mats.goldBright],
    ['goldDark', mats.goldDark],
    ['diamondOrb', mats.diamondOrb],
    ['ceramicWall', mats.ceramicWall],
    ['courtyardTile', mats.courtyardTile],
    ['whiteStucco', mats.whiteStucco],
    ['crimsonRoof', mats.crimsonRoof],
    ['darkRecess', mats.darkRecess],
  ]) {
    const geo = mergeSafe(buckets[k]);
    if (!geo) continue;
    const mesh = new THREE.Mesh(geo, m);
    mesh.castShadow = k !== 'diamondOrb';
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

// -----------------------------------------------------------------------------
// 3. BOTATAUNG PAGODA (Hollow Relic Stupa + Octagonal Tile Base + Twin Halo Hti)
// -----------------------------------------------------------------------------

export function buildBotataungMonument(mats) {
  const group = new THREE.Group();
  const buckets = {
    goldBright: [],
    goldDark: [],
    diamondOrb: [],
    ceramicWall: [],
    courtyardTile: [],
    whiteStucco: [],
    crimsonRoof: [],
    darkRecess: [],
  };

  // Courtyard deck & perimeter relic hall wall (74x74m)
  addBox(buckets.courtyardTile, 0, 0, 0, 74, 1.5, 74);
  addBox(buckets.ceramicWall, 0, 1.5, -36.6, 74, 2.2, 1.0);
  addBox(buckets.ceramicWall, 0, 1.5, 36.6, 74, 2.2, 1.0);
  addBox(buckets.ceramicWall, -36.6, 1.5, 0, 1.0, 2.2, 74);
  addBox(buckets.ceramicWall, 36.6, 1.5, 0, 1.0, 2.2, 74);

  // Riverside southern grand entrance pyatthat + 3 courtyard tazaung halls
  addPyatthatPavilion(buckets, 0, 1.5, 36.8, 11, 6, 5.2, 5, 0, buckets.crimsonRoof, buckets.whiteStucco, buckets.goldBright);
  for (const [px, pz, rot] of [[-28, 0, Math.PI / 2], [28, 0, -Math.PI / 2], [0, -28, Math.PI]]) {
    addPyatthatPavilion(buckets, px, 1.5, pz, 14, 7.5, 4.4, 3, rot, buckets.crimsonRoof, buckets.whiteStucco, buckets.goldBright);
  }

  // Inner cream ceramic-tiled octagonal hollow relic base + 4 arched entrance chambers (`botataung-6.jpg`)
  const bBaseY = 1.5;
  for (const [r, y0, y1] of [[16.2, 0, 3.2], [14.6, 3.2, 5.6]]) {
    addCyl(buckets.ceramicWall, 0, bBaseY + y0, 0, r, r, y1 - y0, 8, Math.PI / 8);
    addCyl(buckets.goldBright, 0, bBaseY + y1 - 0.35, 0, r + 0.35, r + 0.35, 0.38, 8, Math.PI / 8);
  }
  for (let a = 0; a < 4; a++) {
    const ang = (a * Math.PI) / 2;
    addBox(buckets.darkRecess, Math.sin(ang) * 15.8, bBaseY, Math.cos(ang) * 15.8, 3.2, 3.2, 0.5, ang);
    addPyatthatPavilion(buckets, Math.sin(ang) * 17.5, bBaseY, Math.cos(ang) * 17.5, 5.2, 4.2, 3.4, 2, ang, buckets.crimsonRoof, buckets.ceramicWall, buckets.goldBright);
  }

  // Stepped golden octagonal plinths rising from relic base
  for (const [r, y0, y1] of [[12.8, 5.6, 7.8], [11.4, 7.8, 9.8], [10.4, 9.8, 11.4]]) {
    addCyl(buckets.goldDark, 0, bBaseY + y0, 0, r, r, y1 - y0, 8, Math.PI / 8);
    addCyl(buckets.goldBright, 0, bBaseY + y1 - 0.32, 0, r + 0.32, r + 0.32, 0.34, 8, Math.PI / 8);
  }

  // Smooth 48-seg gilded Botataung bell + molded bands + lotus petals + Open Hti with Twin Halo Rings!
  const bBase = bBaseY + 11.4;
  addLatheProfile(buckets.goldBright, [
    [0, 10.6], [1.6, 10.8], [5.0, 9.7], [9.0, 7.6], [12.8, 5.7], [14.8, 5.0],
    [14.8, 5.5], [15.9, 5.5], [15.9, 4.8], [16.9, 4.8], [16.9, 5.2], [17.9, 5.2], [17.9, 4.4],
    [19.5, 4.6], [21.0, 3.8], [22.2, 4.0], [23.2, 2.9], [25.0, 2.5], [27.5, 1.9], [30.2, 1.15], [31.5, 0.72],
  ], 0, bBase, 0, 48);
  addCrownRing(buckets.goldBright, 0, bBase + 21.5, 0, 3.9, 16, 1.3, 0.48);
  addFiligreeHti(buckets.goldBright, buckets.diamondOrb, 0, bBase + 31.5, 0, 7.5, 1.55, { haloCount: 2 });

  // 4 Corner Courtyard Stupas
  for (const [sx, sz] of [[-29, -29], [29, -29], [-29, 29], [29, 29]]) {
    addLatheProfile(buckets.goldBright, [
      [0, 1.4], [1.4, 1.2], [3.4, 0.85], [5.5, 0.45], [7.8, 0.16], [9.4, 0.02],
    ], sx, bBaseY, sz, 12);
  }

  for (const [k, m] of [
    ['goldBright', mats.goldBright],
    ['goldDark', mats.goldDark],
    ['diamondOrb', mats.diamondOrb],
    ['ceramicWall', mats.ceramicWall],
    ['courtyardTile', mats.courtyardTile],
    ['whiteStucco', mats.whiteStucco],
    ['crimsonRoof', mats.crimsonRoof],
    ['darkRecess', mats.darkRecess],
  ]) {
    const geo = mergeSafe(buckets[k]);
    if (!geo) continue;
    const mesh = new THREE.Mesh(geo, m);
    mesh.castShadow = k !== 'diamondOrb';
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

// -----------------------------------------------------------------------------
// 4. INSTANCED YANGON PAGODA ARCHETYPES (unit radius = 1.0, scaled by each OSM footprint)
// -----------------------------------------------------------------------------

/**
 * Build lightweight merged unit-radius (r = 1.0) geometry maps for all Yangon pagodas,
 * authored at R = 20 m metric scale so bevels, flared eaves and Hti rings align cleanly,
 * then normalized by 1/20 for InstancedMesh rendering.
 */
export function buildPagodaArchetypes() {
  const R = 20;
  const invR = 1 / R;
  const bake = (fn) => {
    const b = {
      goldBright: [],
      goldDark: [],
      diamondOrb: [],
      courtyardTile: [],
      whiteStucco: [],
      crimsonRoof: [],
      darkRecess: [],
    };
    fn(b);
    const out = {};
    for (const [k, list] of Object.entries(b)) {
      const g = mergeSafe(list);
      if (g) {
        g.scale(invR, invR, invR);
        out[k] = g;
      }
    }
    return out;
  };

  // 1) Grand Pagoda: redented plinth, 4 cardinal Pyatthat pavilions, golden bell + filigree Hti
  const stupa_grand = bake((b) => {
    addCyl(b.courtyardTile, 0, 0, 0, R, R, 1.3, 8, Math.PI / 8);
    addRedentedTerrace(b.whiteStucco, 0, 1.3, 0, R * 0.68, 2.8, 2, 0.58);
    addRedentedTerrace(b.goldDark, 0, 4.1, 0, R * 0.54, 2.2, 2, 0.60);
    addRedentedTerrace(b.goldBright, 0, 6.3, 0, R * 0.42, 1.8, 2, 0.62);
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      addPyatthatPavilion(
        b, Math.sin(a) * R * 0.72, 1.3, Math.cos(a) * R * 0.72,
        4.6, 3.8, 2.7, 2, a, b.crimsonRoof, b.whiteStucco, b.goldBright,
      );
    }
    const bellBase = 8.1;
    addLatheProfile(b.goldBright, [
      [0, 6.8], [1.4, 6.9], [4.2, 6.1], [7.2, 4.7], [9.6, 3.6], [11.0, 3.2],
      [11.0, 3.55], [12.0, 3.55], [12.0, 3.0], [13.2, 3.1], [15.0, 2.3],
      [17.2, 1.55], [19.4, 0.92], [20.6, 0.55],
    ], 0, bellBase, 0, 24);
    addCrownRing(b.goldBright, 0, bellBase + 13.8, 0, 2.55, 10, 0.85, 0.34);
    addFiligreeHti(b.goldBright, b.diamondOrb, 0, bellBase + 20.6, 0, 6.2, 1.25, { haloCount: 1 });
  });

  // 2) Classic Burmese Pagoda: white/gold octagonal base + bell stupa + Hti crown
  const stupa_classic = bake((b) => {
    addCyl(b.courtyardTile, 0, 0, 0, R, R * 0.96, 1.4, 8, Math.PI / 8);
    addCyl(b.whiteStucco, 0, 1.4, 0, R * 0.74, R * 0.64, 4.4, 8, Math.PI / 8);
    addCyl(b.goldDark, 0, 5.8, 0, R * 0.56, R * 0.46, 2.4, 8, Math.PI / 8);
    addCyl(b.goldBright, 0, 8.2, 0, R * 0.42, R * 0.36, 1.8, 8, Math.PI / 8);
    const bellBase = 10.0;
    addLatheProfile(b.goldBright, [
      [0, 6.4], [1.6, 6.5], [4.4, 5.6], [7.4, 4.1], [9.8, 3.0], [11.2, 2.6],
      [12.4, 2.65], [14.0, 1.9], [16.5, 1.2], [19.0, 0.65], [20.2, 0.42],
    ], 0, bellBase, 0, 14);
    addCyl(b.goldBright, 0, bellBase + 20.2, 0, 0.35, 0.08, 4.8, 8);
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.TorusGeometry(1.05 * Math.pow(0.7, i), 0.08, 5, 12);
      ring.rotateX(Math.PI / 2);
      ring.translate(0, bellBase + 20.5 + i * 1.15, 0);
      b.goldBright.push(ring);
    }
    const orb = new THREE.OctahedronGeometry(0.32, 0);
    orb.translate(0, bellBase + 25.2, 0);
    b.diamondOrb.push(orb);
  });

  // 3) Grand Temple Hall (Reclining/Seated Buddha Pavilions): wide dais, arched hall, 5-tier Pyatthat
  const temple_hall = bake((b) => {
    addBox(b.courtyardTile, 0, 0, 0, R * 1.38, 1.4, R * 0.98);
    addBox(b.whiteStucco, 0, 1.4, 0, R * 1.16, 7.6, R * 0.78);
    addBox(b.goldBright, 0, 8.6, 0, R * 1.19, 0.5, R * 0.81);
    addPyatthatPavilion(b, 0, 9.0, 0, R * 1.22, R * 0.84, 0.1, 4, 0, b.crimsonRoof, b.whiteStucco, b.goldBright);
    for (const side of [-1, 1]) {
      addPyatthatPavilion(b, side * R * 0.62, 1.4, 0, 4.8, 4.4, 5.4, 3, (side * Math.PI) / 2, b.crimsonRoof, b.whiteStucco, b.goldBright);
    }
    addCyl(b.goldBright, 0, 22.8, 0, 0.75, 0.08, 4.2, 8);
    const orb = new THREE.OctahedronGeometry(0.45, 0);
    orb.translate(0, 27.2, 0);
    b.diamondOrb.push(orb);
  });

  // 4) Monastery / Dhamma Hall: multi-tiered Burmese monastery pavilion + courtyard stupa accent
  const monastery_hall = bake((b) => {
    addBox(b.courtyardTile, 0, 0, 0, R * 1.16, 1.1, R * 0.88);
    addBox(b.whiteStucco, -1.6, 1.1, 0, R * 0.84, 5.6, R * 0.62);
    addBox(b.goldDark, -1.6, 6.4, 0, R * 0.86, 0.4, R * 0.64);
    addPyatthatPavilion(b, -1.6, 6.8, 0, R * 0.90, R * 0.68, 0.1, 3, 0, b.crimsonRoof, b.whiteStucco, b.goldBright);
    // Companion gilded courtyard stupa
    addCyl(b.whiteStucco, R * 0.56, 1.1, R * 0.34, 3.6, 3.1, 2.6, 8, Math.PI / 8);
    addLatheProfile(b.goldBright, [
      [0, 2.7], [1.8, 2.5], [4.2, 1.7], [6.6, 0.9], [9.0, 0.35], [10.4, 0.12],
    ], R * 0.56, 3.7, R * 0.34, 12);
  });

  return { stupa_grand, stupa_classic, temple_hall, monastery_hall };
}
