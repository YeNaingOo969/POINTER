// Lightweight 4m x 4m chunked spatial occupancy bitgrid (toLocal metres) shared by cityTiles,
// roadsideFiller, and urbanTrees so new buildings and street trees never overlap existing GLBs,
// mapped buildings, parks, water, roads, or landmarks.
import * as THREE from 'three';
import { LANDMARKS } from './config.js';

export const CELL_M = 4;
const CHUNK_CELLS = 128; // 512m x 512m per chunk -> 16 KB Uint8Array allocated on demand

/** Extract backing typed array, element stride, offset, and integer normalization divisor for a position BufferAttribute or InterleavedBufferAttribute. */
export function unpackPosAccessor(pos) {
  const isInt = !!pos.isInterleavedBufferAttribute;
  const arr = isInt ? pos.data.array : pos.array;
  const normDiv = !pos.normalized ? 1
    : (arr instanceof Int16Array ? 32767 : arr instanceof Uint16Array ? 65535 : arr instanceof Int8Array ? 127 : 255);
  return {
    arr,
    stride: isInt ? pos.data.stride : pos.itemSize,
    offset: isInt ? pos.offset : 0,
    normDiv,
  };
}

export const OCC_BUILDING = 1;
export const OCC_CLEAR    = 2; // landmarks, parks, water, roads
export const OCC_TREE     = 4;
export const OCC_FILLER   = 8;

export function createOccupancyGrid(toLocal) {
  const chunks = new Map();

  function getChunk(cx, cz, create = false) {
    const key = (cx + 512) * 1024 + (cz + 512);
    let buf = chunks.get(key);
    if (!buf && create) {
      buf = new Uint8Array(CHUNK_CELLS * CHUNK_CELLS);
      chunks.set(key, buf);
    }
    return buf;
  }

  function setCell(gx, gz, mask) {
    const cx = Math.floor(gx / CHUNK_CELLS);
    const cz = Math.floor(gz / CHUNK_CELLS);
    const lx = gx - cx * CHUNK_CELLS;
    const lz = gz - cz * CHUNK_CELLS;
    const buf = getChunk(cx, cz, true);
    buf[lz * CHUNK_CELLS + lx] |= mask;
  }

  function getCell(gx, gz) {
    const cx = Math.floor(gx / CHUNK_CELLS);
    const cz = Math.floor(gz / CHUNK_CELLS);
    const buf = getChunk(cx, cz, false);
    if (!buf) return 0;
    const lx = gx - cx * CHUNK_CELLS;
    const lz = gz - cz * CHUNK_CELLS;
    return buf[lz * CHUNK_CELLS + lx];
  }

  function stampDisc(x, z, radiusM, mask) {
    const r = Math.ceil(radiusM / CELL_M);
    const gx0 = Math.floor(x / CELL_M);
    const gz0 = Math.floor(z / CELL_M);
    const r2 = (radiusM / CELL_M) ** 2;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dz * dz <= r2) setCell(gx0 + dx, gz0 + dz, mask);
      }
    }
  }

  function stampBox(cx, cz, ux, uz, halfW, halfD, mask) {
    const pad = Math.abs(ux) * halfW + Math.abs(uz) * halfD;
    const padZ = Math.abs(uz) * halfW + Math.abs(ux) * halfD;
    const x0 = Math.floor((cx - pad) / CELL_M);
    const x1 = Math.floor((cx + pad) / CELL_M);
    const z0 = Math.floor((cz - padZ) / CELL_M);
    const z1 = Math.floor((cz + padZ) / CELL_M);
    const nx = -uz, nz = ux;
    for (let gz = z0; gz <= z1; gz++) {
      const pz = (gz + 0.5) * CELL_M - cz;
      for (let gx = x0; gx <= x1; gx++) {
        const px = (gx + 0.5) * CELL_M - cx;
        const u = Math.abs(px * ux + pz * uz);
        const v = Math.abs(px * nx + pz * nz);
        if (u <= halfW + CELL_M * 0.45 && v <= halfD + CELL_M * 0.45) {
          setCell(gx, gz, mask);
        }
      }
    }
  }

  function hasAnyBox(cx, cz, ux, uz, halfW, halfD, mask) {
    const padX = Math.abs(ux) * halfW + Math.abs(uz) * halfD;
    const padZ = Math.abs(uz) * halfW + Math.abs(ux) * halfD;
    const x0 = Math.floor((cx - padX) / CELL_M);
    const x1 = Math.floor((cx + padX) / CELL_M);
    const z0 = Math.floor((cz - padZ) / CELL_M);
    const z1 = Math.floor((cz + padZ) / CELL_M);
    const nx = -uz, nz = ux;
    for (let gz = z0; gz <= z1; gz++) {
      const pz = (gz + 0.5) * CELL_M - cz;
      for (let gx = x0; gx <= x1; gx++) {
        const px = (gx + 0.5) * CELL_M - cx;
        if (Math.abs(px * ux + pz * uz) <= halfW + 1.0 && Math.abs(px * nx + pz * nz) <= halfD + 1.0) {
          if (getCell(gx, gz) & mask) return true;
        }
      }
    }
    return false;
  }

  const _v0 = new THREE.Vector3();
  const _v1 = new THREE.Vector3();
  const _v2 = new THREE.Vector3();

  /** Stamp XZ triangle footprints from a loaded building tile Mesh (fast typed-array path). */
  function stampMeshXZ(mesh, mask = OCC_BUILDING) {
    const pos = mesh.geometry?.attributes?.position;
    if (!pos) return;
    const idx = mesh.geometry.index;
    const count = idx ? idx.count : pos.count;
    const iarr = idx ? idx.array : null;
    const mw = mesh.matrixWorld;
    const e = mw.elements;
    const { arr, stride, offset, normDiv } = unpackPosAccessor(pos);
    const fastAxis = pos.itemSize === 3 && Math.abs(e[1]) < 1e-6 && Math.abs(e[2]) < 1e-6 && Math.abs(e[8]) < 1e-6;
    const sx = e[0] / normDiv, sz = e[10] / normDiv, tx = e[12], tz = e[14];

    for (let i = 0; i + 2 < count; i += 3) {
      const ia = iarr ? iarr[i] : i;
      const ib = iarr ? iarr[i + 1] : i + 1;
      const ic = iarr ? iarr[i + 2] : i + 2;

      let x0, z0, x1, z1, x2, z2;
      if (fastAxis) {
        const a3 = ia * stride + offset, b3 = ib * stride + offset, c3 = ic * stride + offset;
        x0 = arr[a3] * sx + tx; z0 = arr[a3 + 2] * sz + tz;
        x1 = arr[b3] * sx + tx; z1 = arr[b3 + 2] * sz + tz;
        x2 = arr[c3] * sx + tx; z2 = arr[c3 + 2] * sz + tz;
      } else {
        _v0.fromBufferAttribute(pos, ia).applyMatrix4(mw);
        _v1.fromBufferAttribute(pos, ib).applyMatrix4(mw);
        _v2.fromBufferAttribute(pos, ic).applyMatrix4(mw);
        x0 = _v0.x; z0 = _v0.z; x1 = _v1.x; z1 = _v1.z; x2 = _v2.x; z2 = _v2.z;
      }

      const minX = x0 < x1 ? (x0 < x2 ? x0 : x2) : (x1 < x2 ? x1 : x2);
      const maxX = x0 > x1 ? (x0 > x2 ? x0 : x2) : (x1 > x2 ? x1 : x2);
      const minZ = z0 < z1 ? (z0 < z2 ? z0 : z2) : (z1 < z2 ? z1 : z2);
      const maxZ = z0 > z1 ? (z0 > z2 ? z0 : z2) : (z1 > z2 ? z1 : z2);
      if (maxX - minX > 180 || maxZ - minZ > 180) continue;

      const gx0 = Math.floor(minX / CELL_M), gx1 = Math.floor(maxX / CELL_M);
      const gz0 = Math.floor(minZ / CELL_M), gz1 = Math.floor(maxZ / CELL_M);
      if (gx1 - gx0 <= 2 && gz1 - gz0 <= 2) {
        for (let gz = gz0; gz <= gz1; gz++) for (let gx = gx0; gx <= gx1; gx++) setCell(gx, gz, mask);
      } else {
        const d00 = x1 - x0, d01 = z1 - z0, d10 = x2 - x0, d11 = z2 - z0;
        const denom = d00 * d11 - d01 * d10;
        if (Math.abs(denom) < 1e-4) continue;
        for (let gz = gz0; gz <= gz1; gz++) {
          const pz = (gz + 0.5) * CELL_M - z0;
          for (let gx = gx0; gx <= gx1; gx++) {
            const px = (gx + 0.5) * CELL_M - x0;
            const u = (px * d11 - pz * d10) / denom;
            const v = (d00 * pz - d01 * px) / denom;
            if (u >= -0.05 && v >= -0.05 && u + v <= 1.05) setCell(gx, gz, mask);
          }
        }
      }
    }
  }

  // Stamp all hero landmark clear/grounds radii immediately
  for (const lm of LANDMARKS) {
    const r = Math.max(lm.grounds || 0, lm.clear || 0);
    if (r <= 0) continue;
    const [lx, lz] = toLocal(lm.lng, lm.lat);
    stampDisc(lx, lz, r + 4, OCC_BUILDING | OCC_CLEAR);
  }

  function clearRectMask(x0, z0, x1, z1, clearBits) {
    const keepMask = ~clearBits;
    const gx0 = Math.floor(x0 / CELL_M), gx1 = Math.floor(x1 / CELL_M);
    const gz0 = Math.floor(z0 / CELL_M), gz1 = Math.floor(z1 / CELL_M);
    for (let gz = gz0; gz <= gz1; gz++) {
      const cz = Math.floor(gz / CHUNK_CELLS);
      const lz = gz - cz * CHUNK_CELLS;
      for (let gx = gx0; gx <= gx1; gx++) {
        const cx = Math.floor(gx / CHUNK_CELLS);
        const buf = getChunk(cx, cz, false);
        if (buf) buf[lz * CHUNK_CELLS + (gx - cx * CHUNK_CELLS)] &= keepMask;
      }
    }
  }

  return {
    getCell,
    setCell,
    stampDisc,
    stampBox,
    hasAnyBox,
    stampMeshXZ,
    clearRectMask,
    isOccupied: (x, z, mask = OCC_BUILDING | OCC_CLEAR | OCC_FILLER) =>
      (getCell(Math.floor(x / CELL_M), Math.floor(z / CELL_M)) & mask) !== 0,
  };
}
