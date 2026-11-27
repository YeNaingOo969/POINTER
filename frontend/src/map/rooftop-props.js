// Extracts flat roof polygons from loaded city tile GLB meshes (`roof_flat`) and builds
// batched 3D architectural rooftop details per tile (2 draw calls per tile):
// - Crisp perimeter parapet coping walls around rectangular flat roofs
// - Stepped elevator bulkheads / rooftop penthouses on mid & high-rise blocks
// - Metallic HVAC chillers, Yangon blue/steel water tanks, and angled navy solar arrays
import * as THREE from 'three';
import { unpackPosAccessor } from './city-occupancy.js';

const MAX_ROOFS_PER_TILE = 850;

function hash2(x, z) {
  let h = (Math.imul(Math.round(x * 10), 374761393) + Math.imul(Math.round(z * 10), 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

class PropBatch {
  constructor() {
    this.pos = [];
    this.norm = [];
    this.col = [];
  }
  addTemplate(tplPos, tplNorm, sx, sy, sz, tx, ty, tz, rgb, tiltX = 0) {
    const c = tiltX ? Math.cos(tiltX) : 1;
    const s = tiltX ? Math.sin(tiltX) : 0;
    for (let i = 0; i < tplPos.length; i += 3) {
      let x = tplPos[i] * sx;
      let y = tplPos[i + 1] * sy;
      let z = tplPos[i + 2] * sz;
      let nx = tplNorm[i], ny = tplNorm[i + 1], nz = tplNorm[i + 2];
      if (tiltX) {
        const y2 = y * c - z * s;
        const z2 = y * s + z * c;
        y = y2; z = z2;
        const ny2 = ny * c - nz * s;
        const nz2 = ny * s + nz * c;
        ny = ny2; nz = nz2;
      }
      this.pos.push(x + tx, y + ty, z + tz);
      this.norm.push(nx, ny, nz);
      this.col.push(rgb[0], rgb[1], rgb[2]);
    }
  }
  toGeometry() {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.norm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    return g;
  }
}

// Reusable unit templates centered on XZ, bottom at y = 0..1
function makeUnitTemplates() {
  const boxG = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
  boxG.translate(0, 0.5, 0);
  const cylG = new THREE.CylinderGeometry(0.5, 0.5, 1, 8).toNonIndexed();
  cylG.translate(0, 0.5, 0);
  const res = {
    boxPos: new Float32Array(boxG.attributes.position.array),
    boxNorm: new Float32Array(boxG.attributes.normal.array),
    cylPos: new Float32Array(cylG.attributes.position.array),
    cylNorm: new Float32Array(cylG.attributes.normal.array),
  };
  boxG.dispose();
  cylG.dispose();
  return res;
}

/** Fast integer-hashed flood-fill across connected horizontal roof triangles (zero string allocs). */
function clusterConnectedRoofs(scene, roofFlatMat) {
  const roofs = [];

  scene.traverse((o) => {
    if (!o.isMesh || o.material !== roofFlatMat) return;
    const pos = o.geometry?.attributes?.position;
    if (!pos) return;
    const idx = o.geometry.index;
    const count = idx ? idx.count : pos.count;
    const iarr = idx ? idx.array : null;
    const { arr, stride, offset, normDiv } = unpackPosAccessor(pos);
    const e = o.matrixWorld.elements;
    const sx = e[0] / normDiv, sy = e[5] / normDiv, sz = e[10] / normDiv;
    const tx = e[12], ty = e[13], tz = e[14];

    const tris = [];
    const vertToTris = new Map();
    const keyNum = (x, y, z) =>
      ((Math.round(x * 2) + 16384) * 32768 + (Math.round(y * 4) + 2048)) * 32768 + (Math.round(z * 2) + 16384);

    for (let i = 0; i + 2 < count; i += 3) {
      const ia = (iarr ? iarr[i] : i) * stride + offset;
      const ib = (iarr ? iarr[i + 1] : i + 1) * stride + offset;
      const ic = (iarr ? iarr[i + 2] : i + 2) * stride + offset;
      const x0 = arr[ia] * sx + tx, y0 = arr[ia + 1] * sy + ty, z0 = arr[ia + 2] * sz + tz;
      const x1 = arr[ib] * sx + tx, y1 = arr[ib + 1] * sy + ty, z1 = arr[ib + 2] * sz + tz;
      const x2 = arr[ic] * sx + tx, y2 = arr[ic + 1] * sy + ty, z2 = arr[ic + 2] * sz + tz;

      const y = (y0 + y1 + y2) * 0.333333;
      if (y < 6.8 || y > 150) continue;

      const ux = x1 - x0, uy = y1 - y0, uz = z1 - z0;
      const vx = x2 - x0, vy = y2 - y0, vz = z2 - z0;
      const cx = uy * vz - uz * vy;
      const cy = uz * vx - ux * vz;
      const cz = ux * vy - uy * vx;
      const area2 = Math.hypot(cx, cy, cz);
      if (area2 < 4 || cy / area2 < 0.7) continue;

      const k0 = keyNum(x0, y0, z0), k1 = keyNum(x1, y1, z1), k2 = keyNum(x2, y2, z2);
      const ti = tris.length;
      tris.push({
        minX: x0 < x1 ? (x0 < x2 ? x0 : x2) : (x1 < x2 ? x1 : x2),
        maxX: x0 > x1 ? (x0 > x2 ? x0 : x2) : (x1 > x2 ? x1 : x2),
        minZ: z0 < z1 ? (z0 < z2 ? z0 : z2) : (z1 < z2 ? z1 : z2),
        maxZ: z0 > z1 ? (z0 > z2 ? z0 : z2) : (z1 > z2 ? z1 : z2),
        y,
        area: area2 * 0.5,
        k0, k1, k2,
      });
      for (const k of [k0, k1, k2]) {
        let list = vertToTris.get(k);
        if (!list) vertToTris.set(k, (list = []));
        list.push(ti);
      }
    }

    const visited = new Uint8Array(tris.length);
    for (let start = 0; start < tris.length; start++) {
      if (visited[start]) continue;
      visited[start] = 1;
      const stack = [start];
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      let areaSum = 0, ySum = 0, cnt = 0;

      while (stack.length) {
        const cur = stack.pop();
        const t = tris[cur];
        if (t.minX < minX) minX = t.minX;
        if (t.maxX > maxX) maxX = t.maxX;
        if (t.minZ < minZ) minZ = t.minZ;
        if (t.maxZ > maxZ) maxZ = t.maxZ;
        areaSum += t.area;
        ySum += t.y;
        cnt++;
        for (const k of [t.k0, t.k1, t.k2]) {
          for (const nb of vertToTris.get(k)) {
            if (!visited[nb]) {
              visited[nb] = 1;
              stack.push(nb);
            }
          }
        }
      }

      const w = maxX - minX, d = maxZ - minZ;
      if (w >= 5.5 && d >= 5.5 && w <= 70 && d <= 70 && areaSum >= 44) {
        const fillRatio = areaSum / (w * d);
        if (fillRatio > 0.44) {
          roofs.push({
            cx: (minX + maxX) * 0.5,
            cz: (minZ + maxZ) * 0.5,
            w, d, y: ySum / cnt, fillRatio,
          });
        }
      }
    }
  });
  return roofs;
}

export function createRooftopProps({ roofFlatMat, envMap }) {
  const templates = makeUnitTemplates();
  const group = new THREE.Group();
  const byTile = new Map();

  const concreteMat = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    vertexColors: true,
  });

  const equipMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.36,
    metalness: 0.42,
    envMap,
    envMapIntensity: 0.72,
  });

  function addForTile(id, tileScene) {
    removeForTile(id);
    const roofs = clusterConnectedRoofs(tileScene, roofFlatMat);
    if (!roofs.length) return;

    const trim = new PropBatch();
    const equip = new PropBatch();
    const { boxPos, boxNorm, cylPos, cylNorm } = templates;

    const concreteLight = [0.91, 0.89, 0.85];
    const concreteCap = [0.83, 0.82, 0.80];
    const hvacSteel = [0.76, 0.80, 0.84];
    const tankBlue = [0.18, 0.48, 0.72]; // classic Yangon rooftop water tank blue!
    const solarNavy = [0.12, 0.24, 0.44];

    let count = 0;
    for (const r of roofs) {
      if (count >= MAX_ROOFS_PER_TILE) break;
      count++;
      const h0 = hash2(r.cx, r.cz);
      const h1 = hash2(r.cx + 13.7, r.cz - 5.3);

      // 1. Crisp 3D parapet coping frame on rectangular roofs (eliminates razor-flat paper edges)
      if (r.fillRatio > 0.86 && r.w >= 6.5 && r.d >= 6.5) {
        const pt = 0.36;
        const ph = 0.46;
        trim.addTemplate(boxPos, boxNorm, r.w, ph, pt, r.cx, r.y, r.cz - r.d / 2 + pt / 2, concreteLight);
        trim.addTemplate(boxPos, boxNorm, r.w, ph, pt, r.cx, r.y, r.cz + r.d / 2 - pt / 2, concreteLight);
        trim.addTemplate(boxPos, boxNorm, pt, ph, Math.max(0.5, r.d - pt * 2), r.cx - r.w / 2 + pt / 2, r.y, r.cz, concreteLight);
        trim.addTemplate(boxPos, boxNorm, pt, ph, Math.max(0.5, r.d - pt * 2), r.cx + r.w / 2 - pt / 2, r.y, r.cz, concreteLight);
      }

      // 2. Stepped elevator penthouse / stairwell bulkhead on mid & high-rise roofs
      const minSide = Math.min(r.w, r.d);
      if (r.y >= 9.0 && minSide >= 7.0 && h0 < 0.88) {
        const pw = Math.min(6.4, r.w * 0.36);
        const pd = Math.min(5.4, r.d * 0.36);
        const ph = 2.0 + h1 * 1.4;
        const ox = (h0 - 0.44) * r.w * 0.20;
        const oz = (h1 - 0.5) * r.d * 0.22;
        trim.addTemplate(boxPos, boxNorm, pw, ph, pd, r.cx + ox, r.y, r.cz + oz, concreteLight);
        trim.addTemplate(boxPos, boxNorm, pw + 0.45, 0.28, pd + 0.45, r.cx + ox, r.y + ph, r.cz + oz, concreteCap);
      }

      // 3. Rooftop water tanks, HVAC chillers & angled solar panels inside safe center core
      const sx = r.w * 0.22, sz = r.d * 0.22;
      if (minSide >= 6.0 && h1 < 0.94) {
        if (h0 < 0.42) {
          // Pair of Yangon cylindrical rooftop water tanks (blue + stainless)
          const tr = Math.min(0.85, minSide * 0.08);
          equip.addTemplate(cylPos, cylNorm, tr * 2, 1.5, tr * 2, r.cx - sx * 0.7, r.y, r.cz + sz * 0.6, tankBlue);
          if (minSide >= 9) {
            equip.addTemplate(cylPos, cylNorm, tr * 2, 1.4, tr * 2, r.cx - sx * 0.7 + tr * 2.4, r.y, r.cz + sz * 0.6, hvacSteel);
          }
        } else if (h0 < 0.76) {
          // Commercial HVAC condenser boxes
          equip.addTemplate(boxPos, boxNorm, 2.2, 1.25, 1.5, r.cx - sx * 0.5, r.y, r.cz - sz * 0.5, hvacSteel);
          if (minSide >= 10) {
            equip.addTemplate(boxPos, boxNorm, 1.8, 1.15, 1.4, r.cx + sx * 0.4, r.y, r.cz - sz * 0.5, hvacSteel);
          }
        } else {
          // Tilted deep navy-blue solar panel rows on large flat terraces
          equip.addTemplate(boxPos, boxNorm, Math.min(4.2, r.w * 0.35), 0.14, 1.8, r.cx, r.y + 0.45, r.cz + sz * 0.4, solarNavy, -0.32);
        }
      }
    }

    const tileGroup = new THREE.Group();
    const trimGeo = trim.toGeometry();
    if (trimGeo) {
      const m = new THREE.Mesh(trimGeo, concreteMat);
      m.castShadow = false;
      m.receiveShadow = true;
      tileGroup.add(m);
    }
    const equipGeo = equip.toGeometry();
    if (equipGeo) {
      const m = new THREE.Mesh(equipGeo, equipMat);
      m.castShadow = false;
      m.receiveShadow = true;
      tileGroup.add(m);
    }
    if (tileGroup.children.length) {
      group.add(tileGroup);
      byTile.set(id, tileGroup);
    }
  }

  function removeForTile(id) {
    const prev = byTile.get(id);
    if (!prev) return;
    group.remove(prev);
    prev.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    byTile.delete(id);
  }

  return { group, addForTile, removeForTile };
}
