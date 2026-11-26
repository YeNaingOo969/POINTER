// Generates separated, seamless WebP layers for the animated Yangon sunset login scene:
//   1. login-backdrop.webp    (1920x1080)    — cloudless sunset sky + Shwedagon/skyline + water behind boats
//   2. login-clouds.webp      (2560x460 RGBA) — whole painted foreground sunset clouds wrapped modulo 2560
//   3. login-clouds-back.webp (2560x460 RGBA) — softer distant painted cloud wisps wrapped modulo 2560
//   4. login-boat-left.webp   (tight RGBA)    — crisp wooden left boat + open canopy windows
//   5. login-boat-right.webp  (tight RGBA)    — crisp wooden right boat + paddle + open canopy windows
//   6. login-sky-mask.webp    (1920x1080 gray) — 1-channel sky occlusion mask protecting Shwedagon & skyline
//
// Run from frontend/: node scripts/build-login-scene.mjs
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const srcPath = path.join(root, 'public/images/landing/hero-river-1920.webp');
const cloudsSrcPath = path.join(root, 'public/images/landing/clouds-1920.webp');
const outDir = path.join(root, 'public/images/landing/login-scene');
fs.mkdirSync(outDir, { recursive: true });

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function distToPolyChain(x, y, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? clamp(((x - ax) * dx + (y - ay) * dy) / l2, 0, 1) : 0;
    const d = Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
    if (d < best) best = d;
  }
  return best;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

const { data: src, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width;
const H = info.height;

// ---- 1. Boat Cutouts ----

const leftHullPoly = [
  [79, 636], [112, 636], [128, 678], [142, 704], [160, 725], [198, 742],
  [255, 750], [312, 755], [420, 752], [525, 740], [598, 724], [648, 706],
  [682, 676], [705, 636], [712, 636], [699, 688], [681, 728], [652, 770],
  [612, 799], [538, 824], [435, 845], [335, 860], [262, 862], [232, 840],
  [188, 798], [150, 752], [118, 698], [92, 654], [80, 638],
];

const leftRoofPoly = [
  [298, 712], [322, 702], [358, 696], [412, 694], [492, 683], [562, 684],
  [600, 696], [582, 705], [480, 717], [420, 710], [368, 705], [316, 713],
];

const leftWindowPoly = [
  [310, 707], [435, 713], [578, 703], [578, 746], [440, 754], [310, 748],
];

const leftCushionBoxes = [
  [446, 730, 514, 756],
  [518, 724, 566, 748],
];

const leftRopeChains = [
  [[132, 696], [218, 705], [302, 705]],
  [[594, 693], [652, 685], [690, 677]],
  [[608, 714], [654, 700], [688, 680]],
];

const rightHullPoly = [
  [1093, 640], [1106, 640], [1120, 686], [1142, 712], [1184, 726],
  [1245, 740], [1345, 756], [1485, 771], [1596, 779], [1665, 770],
  [1728, 752], [1768, 728], [1794, 692], [1815, 642], [1838, 644],
  [1816, 698], [1775, 765], [1718, 829], [1644, 874], [1554, 885],
  [1435, 876], [1308, 854], [1202, 822], [1152, 786], [1124, 740],
  [1104, 686],
];

const rightRoofPoly = [
  [1218, 716], [1258, 705], [1335, 702], [1455, 712], [1565, 732],
  [1595, 745], [1570, 751], [1448, 738], [1222, 718],
];

const rightPaddlePoly = [
  [1586, 786], [1663, 727], [1656, 714], [1670, 707], [1681, 715],
  [1739, 665], [1749, 672], [1690, 723], [1690, 736], [1675, 736],
  [1597, 796],
];

const rightWindowPoly = [
  [1224, 712], [1448, 730], [1582, 738], [1580, 772], [1445, 760], [1224, 734],
];

const rightCushionBoxes = [
  [1488, 756, 1528, 774],
];

const rightRopeChains = [
  [[1106, 688], [1165, 700], [1220, 711]],
  [[1102, 692], [1106, 742], [1128, 796]],
];

function buildCrispBoat({ hullPoly, roofPoly, paddlePoly, windowPoly, cushionBoxes, ropeChains, bbox }) {
  const mask = new Uint8Array(W * H);

  for (let y = bbox.y0; y < bbox.y1; y++) {
    for (let x = bbox.x0; x < bbox.x1; x++) {
      const i = (y * W + x) * 4;
      const r = src[i], g = src[i + 1], b = src[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      if (pointInPoly(x + 0.5, y + 0.5, roofPoly) || (paddlePoly && pointInPoly(x + 0.5, y + 0.5, paddlePoly))) {
        mask[y * W + x] = 255;
        continue;
      }

      if (pointInPoly(x + 0.5, y + 0.5, windowPoly)) {
        let inCushion = false;
        for (const [cx0, cy0, cx1, cy1] of cushionBoxes) {
          if (x >= cx0 && x <= cx1 && y >= cy0 && y <= cy1 && (r - b) < 28) { inCushion = true; break; }
        }
        if (inCushion || lum < 78 || (lum < 105 && (r - b) < 36)) {
          mask[y * W + x] = 255;
        }
        continue;
      }

      if (pointInPoly(x + 0.5, y + 0.5, hullPoly)) {
        mask[y * W + x] = 255;
        continue;
      }

      for (const chain of ropeChains) {
        if (distToPolyChain(x + 0.5, y + 0.5, chain) <= 2.5 && lum < 96) {
          mask[y * W + x] = 255;
          break;
        }
      }
    }
  }

  const bw = bbox.x1 - bbox.x0;
  const bh = bbox.y1 - bbox.y0;
  const outBuf = Buffer.alloc(bw * bh * 4);
  const softMask = new Uint8Array(W * H);

  for (let y = bbox.y0; y < bbox.y1; y++) {
    for (let x = bbox.x0; x < bbox.x1; x++) {
      const c = mask[y * W + x] > 0 ? 1 : 0;
      const nCount =
        (mask[y * W + Math.max(0, x - 1)] > 0 ? 1 : 0) +
        (mask[y * W + Math.min(W - 1, x + 1)] > 0 ? 1 : 0) +
        (mask[Math.max(0, y - 1) * W + x] > 0 ? 1 : 0) +
        (mask[Math.min(H - 1, y + 1) * W + x] > 0 ? 1 : 0);

      const alpha = c ? (nCount === 0 ? 0 : (nCount < 3 ? 210 : 255)) : (nCount >= 3 ? 95 : 0);
      softMask[y * W + x] = alpha;
      const si = (y * W + x) * 4;
      const di = ((y - bbox.y0) * bw + (x - bbox.x0)) * 4;
      outBuf[di] = src[si];
      outBuf[di + 1] = src[si + 1];
      outBuf[di + 2] = src[si + 2];
      outBuf[di + 3] = alpha;
    }
  }
  return { mask: softMask, buf: outBuf, width: bw, height: bh, bbox };
}

const leftBbox = { x0: 74, y0: 632, x1: 716, y1: 866 };
const rightBbox = { x0: 1090, y0: 636, x1: 1842, y1: 889 };

const leftBoat = buildCrispBoat({
  hullPoly: leftHullPoly,
  roofPoly: leftRoofPoly,
  paddlePoly: null,
  windowPoly: leftWindowPoly,
  cushionBoxes: leftCushionBoxes,
  ropeChains: leftRopeChains,
  bbox: leftBbox,
});

const rightBoat = buildCrispBoat({
  hullPoly: rightHullPoly,
  roofPoly: rightRoofPoly,
  paddlePoly: rightPaddlePoly,
  windowPoly: rightWindowPoly,
  cushionBoxes: rightCushionBoxes,
  ropeChains: rightRopeChains,
  bbox: rightBbox,
});

// ---- 2. Remove static painted birds cleanly ----

const skyCleaned = Buffer.from(src);

function removeBirds(box, lumThreshold) {
  const birdMask = new Uint8Array(W * H);
  for (let y = box.y0; y < box.y1; y++) {
    for (let x = box.x0; x < box.x1; x++) {
      const idx = (y * W + x) * 4;
      const lum = (src[idx] + src[idx + 1] + src[idx + 2]) / 3;
      let sum = 0, cnt = 0;
      for (let dy = -12; dy <= 12; dy += 4) {
        for (let dx = -12; dx <= 12; dx += 4) {
          if (Math.abs(dx) < 6 && Math.abs(dy) < 6) continue;
          const si = ((y + dy) * W + (x + dx)) * 4;
          const sl = (src[si] + src[si + 1] + src[si + 2]) / 3;
          if (sl > 165) { sum += sl; cnt++; }
        }
      }
      const bgLum = cnt ? sum / cnt : 205;
      if (bgLum - lum > lumThreshold) {
        for (let oy = -2; oy <= 2; oy++) {
          for (let ox = -2; ox <= 2; ox++) {
            birdMask[(y + oy) * W + (x + ox)] = 1;
          }
        }
      }
    }
  }

  for (let y = box.y0 - 3; y < box.y1 + 3; y++) {
    let x = box.x0 - 3;
    while (x < box.x1 + 3) {
      if (!birdMask[y * W + x]) { x++; continue; }
      const start = x - 1;
      while (x < box.x1 + 10 && birdMask[y * W + x]) x++;
      const end = x;
      const iL = (y * W + start) * 4;
      const iR = (y * W + end) * 4;
      for (let px = start + 1; px < end; px++) {
        const t = (px - start) / (end - start);
        const hr = lerp(src[iL], src[iR], t);
        const hg = lerp(src[iL + 1], src[iR + 1], t);
        const hb = lerp(src[iL + 2], src[iR + 2], t);

        let ty = y - 1;
        while (ty > box.y0 - 15 && birdMask[ty * W + px]) ty--;
        let by = y + 1;
        while (by < box.y1 + 15 && birdMask[by * W + px]) by++;
        const tv = (y - ty) / Math.max(1, by - ty);
        const iT = (ty * W + px) * 4;
        const iB = (by * W + px) * 4;
        const vr = lerp(src[iT], src[iB], tv);
        const vg = lerp(src[iT + 1], src[iB + 1], tv);
        const vb = lerp(src[iT + 2], src[iB + 2], tv);

        const oi = (y * W + px) * 4;
        skyCleaned[oi] = Math.round(hr * 0.55 + vr * 0.45);
        skyCleaned[oi + 1] = Math.round(hg * 0.55 + vg * 0.45);
        skyCleaned[oi + 2] = Math.round(hb * 0.55 + vb * 0.45);
      }
    }
  }
}

removeBirds({ x0: 250, y0: 292, x1: 540, y1: 404 }, 14);
removeBirds({ x0: 1658, y0: 335, x1: 1705, y1: 368 }, 15);

// ---- 3. Build 1-Channel Sky Occlusion Mask (1 = open sky, 0 = Shwedagon/buildings/horizon) ----

const shwedagonPoly = [
  [1487, 224], [1495, 224], [1498, 258], [1508, 290], [1522, 355],
  [1548, 392], [1578, 438], [1586, 480], [1396, 480], [1408, 438],
  [1435, 392], [1462, 355], [1474, 290], [1482, 258],
];
const smallSpirePoly = [
  [1662, 386], [1670, 386], [1682, 435], [1686, 480], [1648, 480], [1652, 435],
];
const centralTowerPoly = [
  [1160, 378], [1174, 378], [1192, 422], [1196, 480], [1138, 480], [1142, 422],
];

const skyMask = Buffer.alloc(W * H);
const spireOnlyMask = Buffer.alloc(W * H);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (y > 460) {
      skyMask[y * W + x] = 0;
      continue;
    }
    let m = y < 340 ? 1 : clamp(1 - (y - 340) / 105, 0, 1);

    const hitTower =
      pointInPoly(x + 0.5, y + 0.5, shwedagonPoly) ||
      pointInPoly(x + 0.5, y + 0.5, smallSpirePoly) ||
      pointInPoly(x + 0.5, y + 0.5, centralTowerPoly);
    if (hitTower) {
      m = 0;
      spireOnlyMask[y * W + x] = 1;
    }

    if (y > 390) {
      const idx = (y * W + x) * 4;
      const lum = 0.299 * skyCleaned[idx] + 0.587 * skyCleaned[idx + 1] + 0.114 * skyCleaned[idx + 2];
      if (lum < 160) m = 0;
    }

    const sunDist = Math.hypot(x - 732, y - 488);
    if (sunDist < 115) {
      m *= clamp((sunDist - 70) / 45, 0, 1);
    }

    skyMask[y * W + x] = Math.round(m * 255);
  }
}

const skyMaskSmooth = await sharp(skyMask, { raw: { width: W, height: H, channels: 1 } })
  .blur(2.2)
  .extractChannel(0)
  .raw()
  .toBuffer();

// ---- 4. Paint Seamless Cloudless Golden Sunset Sky onto `backdrop` ----
const SKY_H = 460;
const gw = 32, gh = 10;
const cellW = W / gw, cellH = SKY_H / gh;
const gridR = new Float32Array(gw * gh);
const gridG = new Float32Array(gw * gh);
const gridB = new Float32Array(gw * gh);
const gridN = new Float32Array(gw * gh);

for (let y = 0; y < SKY_H; y++) {
  for (let x = 0; x < W; x++) {
    if (spireOnlyMask[y * W + x] || skyMaskSmooth[y * W + x] < 90) continue;
    const i = (y * W + x) * 4;
    const r = skyCleaned[i], g = skyCleaned[i + 1], b = skyCleaned[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum > 180 && b > 144 && (r - b) < (78 + y * 0.11)) {
      const gx = Math.min(gw - 1, (x / cellW) | 0);
      const gy = Math.min(gh - 1, (y / cellH) | 0);
      const gi = gy * gw + gx;
      gridR[gi] += r; gridG[gi] += g; gridB[gi] += b; gridN[gi] += 1;
    }
  }
}

for (let pass = 0; pass < 8; pass++) {
  const nR = new Float32Array(gridR), nG = new Float32Array(gridG), nB = new Float32Array(gridB), nN = new Float32Array(gridN);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const gi = gy * gw + gx;
      if (gridN[gi] > 10) continue;
      let sr = 0, sg = 0, sb = 0, sn = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = gx + dx, ny = gy + dy;
          if (nx < 0 || nx >= gw || ny < 0 || ny >= gh) continue;
          const ni = ny * gw + nx;
          if (gridN[ni] > 0) {
            sr += gridR[ni] / gridN[ni];
            sg += gridG[ni] / gridN[ni];
            sb += gridB[ni] / gridN[ni];
            sn += 1;
          }
        }
      }
      if (sn > 0) { nR[gi] = sr / sn; nG[gi] = sg / sn; nB[gi] = sb / sn; nN[gi] = 1; }
    }
  }
  gridR.set(nR); gridG.set(nG); gridB.set(nB); gridN.set(nN);
}

for (let i = 0; i < gw * gh; i++) {
  if (gridN[i] > 0) {
    gridR[i] /= gridN[i]; gridG[i] /= gridN[i]; gridB[i] /= gridN[i]; gridN[i] = 1;
  }
}
for (let pass = 0; pass < 2; pass++) {
  const sR = new Float32Array(gridR), sG = new Float32Array(gridG), sB = new Float32Array(gridB);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      let sr = 0, sg = 0, sb = 0, wsum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = clamp(gx + dx, 0, gw - 1), ny = clamp(gy + dy, 0, gh - 1);
          const wt = (dx === 0 && dy === 0) ? 4 : 1;
          const ni = ny * gw + nx;
          sr += gridR[ni] * wt; sg += gridG[ni] * wt; sb += gridB[ni] * wt; wsum += wt;
        }
      }
      const gi = gy * gw + gx;
      sR[gi] = sr / wsum; sG[gi] = sg / wsum; sB[gi] = sb / wsum;
    }
  }
  gridR.set(sR); gridG.set(sG); gridB.set(sB);
}

function sampleClearSky(x, y) {
  const fx = clamp(x / cellW - 0.5, 0, gw - 1.001);
  const fy = clamp(y / cellH - 0.5, 0, gh - 1.001);
  const x0 = fx | 0, y0 = fy | 0, x1 = Math.min(gw - 1, x0 + 1), y1 = Math.min(gh - 1, y0 + 1);
  const tx = fx - x0, ty = fy - y0;
  const bilerp = (arr) => lerp(
    lerp(arr[y0 * gw + x0], arr[y0 * gw + x1], tx),
    lerp(arr[y1 * gw + x0], arr[y1 * gw + x1], tx),
    ty,
  );
  return [bilerp(gridR), bilerp(gridG), bilerp(gridB)];
}

const backdrop = Buffer.from(skyCleaned);
for (let y = 0; y < SKY_H; y++) {
  for (let x = 0; x < W; x++) {
    const [cr, cg, cb] = sampleClearSky(x, y);
    const si = (y * W + x) * 4;
    const m = skyMaskSmooth[y * W + x] / 255;
    if (m > 0.004) {
      backdrop[si]     = clamp(Math.round(lerp(backdrop[si], cr, m)), 0, 255);
      backdrop[si + 1] = clamp(Math.round(lerp(backdrop[si + 1], cg, m)), 0, 255);
      backdrop[si + 2] = clamp(Math.round(lerp(backdrop[si + 2], cb, m)), 0, 255);
    }
  }
}

// ---- 5. Assemble Whole Painted Sunset Clouds into Toroidal Looping Strip (`2560x460`) ----
// Uses genuine transparent painted sunset clouds from `public/images/landing/clouds-1920.webp`
// so every cloud puff has whole smooth edges (zero clipping, zero contour holes, seamless loop!).

async function extractCleanPuff(left, top, width, height, cleanupFn = null) {
  const { data } = await sharp(cloudsSrcPath)
    .extract({ left, top, width, height })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (cleanupFn) cleanupFn(data, width, height);
  return { data, width, height };
}

async function resizePuff(puff, targetW, flipX = false, opacity = 1) {
  const targetH = Math.max(1, Math.round(puff.height * (targetW / puff.width)));
  let pipeline = sharp(puff.data, { raw: { width: puff.width, height: puff.height, channels: 4 } })
    .resize(targetW, targetH, { fit: 'fill' });
  if (flipX) pipeline = pipeline.flop();
  const { data } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (opacity < 1) {
    for (let i = 3; i < data.length; i += 4) {
      data[i] = Math.round(data[i] * opacity);
    }
  }
  return { data, width: targetW, height: targetH };
}

// Clean Puff A (clear tiny bottom neighbor dots cleanly)
const puffA = await extractCleanPuff(48, 158, 526, 235, (d, pw, ph) => {
  for (let y = ph - 45; y < ph; y++) {
    for (let x = pw - 60; x < pw; x++) d[(y * pw + x) * 4 + 3] = 0;
    for (let x = 0; x < 35; x++) d[(y * pw + x) * 4 + 3] = 0;
  }
});

// Clean Puff B: mirror its unclipped fluffy left shoulder symmetrically across the cut right side so both tails taper naturally!
const puffB = await extractCleanPuff(1290, 255, 365, 152, (d, pw, ph) => {
  const copy = Uint8Array.from(d);
  for (let y = 0; y < ph; y++) {
    for (let x = 220; x < pw; x++) {
      const mirrorX = clamp(pw - 1 - x + 36, 0, pw - 1);
      const t = smoothstep(220, 295, x);
      const si = (y * pw + mirrorX) * 4;
      const di = (y * pw + x) * 4;
      d[di]     = Math.round(lerp(copy[di], copy[si], t));
      d[di + 1] = Math.round(lerp(copy[di + 1], copy[si + 1], t));
      d[di + 2] = Math.round(lerp(copy[di + 2], copy[si + 2], t));
      d[di + 3] = Math.round(lerp(copy[di + 3], copy[si + 3], t));
    }
  }
});

// Clean Puff C (trim upper-left overhang & smoothly dissolve bottom flat edge)
const puffC = await extractCleanPuff(408, 372, 392, 86, (d, pw, ph) => {
  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      const i = (y * pw + x) * 4 + 3;
      if (y < 24 && x < 120) d[i] = 0;
      const botFade = smoothstep(ph - 3, ph - 32, y);
      const sideFade = smoothstep(0, 24, x) * smoothstep(pw, pw - 24, x);
      d[i] = Math.round(d[i] * botFade * sideFade);
    }
  }
});

const TILE_W = 2048;
const TILE_H = 512; // Power-of-two dimensions allow hardware GL_REPEAT wrapping with zero seam

function drawWrappedSprite(canvas, sprite, dstX, dstY) {
  const { data: sd, width: sw, height: sh } = sprite;
  for (let sy = 0; sy < sh; sy++) {
    const dy = dstY + sy;
    if (dy < 0 || dy >= TILE_H) continue;
    for (let sx = 0; sx < sw; sx++) {
      const si = (sy * sw + sx) * 4;
      const sa = sd[si + 3] / 255;
      if (sa <= 0.002) continue;

      const dx = (((dstX + sx) % TILE_W) + TILE_W) % TILE_W;
      const di = (dy * TILE_W + dx) * 4;
      const da = canvas[di + 3] / 255;
      const outA = sa + da * (1 - sa);
      if (outA > 0) {
        canvas[di]     = clamp(Math.round((sd[si] * sa + canvas[di] * da * (1 - sa)) / outA), 0, 255);
        canvas[di + 1] = clamp(Math.round((sd[si + 1] * sa + canvas[di + 1] * da * (1 - sa)) / outA), 0, 255);
        canvas[di + 2] = clamp(Math.round((sd[si + 2] * sa + canvas[di + 2] * da * (1 - sa)) / outA), 0, 255);
        canvas[di + 3] = clamp(Math.round(outA * 255), 0, 255);
      }
    }
  }
}

// Foreground cloud layer (`login-clouds.webp`)
const cloudsFore = Buffer.alloc(TILE_W * TILE_H * 4);
const forePlacements = [
  { sprite: await resizePuff(puffA, 460, false, 0.90), x: 60,   y: 18 },
  { sprite: await resizePuff(puffC, 340, false, 0.80), x: 380,  y: 235 },
  { sprite: await resizePuff(puffB, 310, true,  0.84), x: 740,  y: 112 },
  { sprite: await resizePuff(puffA, 420, true,  0.90), x: 1080, y: 26 },
  { sprite: await resizePuff(puffC, 350, true,  0.82), x: 1440, y: 222 },
  { sprite: await resizePuff(puffB, 330, false, 0.88), x: 1740, y: 120 },
];
for (const p of forePlacements) {
  drawWrappedSprite(cloudsFore, p.sprite, p.x, p.y);
}

// Distant background cloud layer (`login-clouds-back.webp`)
const cloudsBack = Buffer.alloc(TILE_W * TILE_H * 4);
const backPlacements = [
  { sprite: await resizePuff(puffB, 280, false, 0.56), x: 210,  y: 162 },
  { sprite: await resizePuff(puffA, 320, true,  0.54), x: 580,  y: 44 },
  { sprite: await resizePuff(puffC, 300, false, 0.52), x: 960,  y: 245 },
  { sprite: await resizePuff(puffB, 290, true,  0.56), x: 1320, y: 148 },
  { sprite: await resizePuff(puffA, 310, false, 0.54), x: 1680, y: 36 },
];
for (const p of backPlacements) {
  drawWrappedSprite(cloudsBack, p.sprite, p.x, p.y);
}

// ---- 6. Infill water cleanly behind foreground boats on `backdrop` ----
function pingPongCoord(val, lo, hi) {
  const span = Math.max(1, hi - lo);
  const rel = ((val - lo) % (span * 2) + span * 2) % (span * 2);
  return lo + (rel <= span ? rel : span * 2 - rel);
}

function infillWaterClean(boatMask, bbox, cleanRange) {
  const pad = 5;
  const hole = new Uint8Array(W * H);
  for (let y = bbox.y0; y < bbox.y1; y++) {
    for (let x = bbox.x0; x < bbox.x1; x++) {
      if (boatMask[y * W + x] > 12) {
        for (let dy = -pad; dy <= pad; dy++) {
          for (let dx = -pad; dx <= pad; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < W && ny >= 634 && ny < H) hole[ny * W + nx] = 1;
          }
        }
      }
    }
  }

  for (let y = Math.max(634, bbox.y0 - pad); y < Math.min(H, bbox.y1 + pad); y++) {
    let cR = 0, cG = 0, cB = 0, cN = 0;
    for (let cx = cleanRange[0]; cx <= cleanRange[1]; cx += 4) {
      const ci = (y * W + cx) * 4;
      cR += src[ci]; cG += src[ci + 1]; cB += src[ci + 2]; cN++;
    }
    cR /= Math.max(1, cN); cG /= Math.max(1, cN); cB /= Math.max(1, cN);

    let x = Math.max(0, bbox.x0 - pad);
    const limitX = Math.min(W, bbox.x1 + pad);
    while (x < limitX) {
      if (!hole[y * W + x]) { x++; continue; }
      const segStart = x;
      while (x < limitX && hole[y * W + x]) x++;
      const segEnd = x - 1;
      const segLen = Math.max(1, segEnd - segStart + 1);

      const pickBorder = (startX, step) => {
        let br = 0, bg = 0, bb = 0, bc = 0;
        for (let k = 1; k <= 10; k++) {
          const sx = clamp(startX + k * step, 0, W - 1);
          if (!hole[y * W + sx]) {
            const i = (y * W + sx) * 4;
            br += src[i]; bg += src[i + 1]; bb += src[i + 2]; bc++;
          }
        }
        return bc ? [br / bc, bg / bc, bb / bc] : [cR, cG, cB];
      };
      const [rL, gL, bL] = pickBorder(segStart, -1);
      const [rR, gR, bR] = pickBorder(segEnd, 1);

      for (let px = segStart; px <= segEnd; px++) {
        const t = (px - segStart) / segLen;
        const smoothT = t * t * (3 - 2 * t);
        const baseR = lerp(rL, rR, smoothT);
        const baseG = lerp(gL, gR, smoothT);
        const baseB = lerp(bL, bR, smoothT);

        const sampleX = Math.round(pingPongCoord(px * 0.65 + y * 0.2, cleanRange[0], cleanRange[1]));
        const si = (y * W + sampleX) * 4;
        const deltaR = (src[si] - cR) * 0.35;
        const deltaG = (src[si + 1] - cG) * 0.35;
        const deltaB = (src[si + 2] - cB) * 0.35;

        const r = clamp(Math.round(baseR + deltaR), 0, 255);
        const g = clamp(Math.round(baseG + deltaG), 0, 255);
        const b = clamp(Math.round(baseB + deltaB), 0, 255);

        const edgeDist = Math.min(px - segStart, segEnd - px);
        const blend = edgeDist >= 4 ? 1 : edgeDist / 4;
        const oi = (y * W + px) * 4;
        backdrop[oi]     = Math.round(lerp(backdrop[oi], r, blend));
        backdrop[oi + 1] = Math.round(lerp(backdrop[oi + 1], g, blend));
        backdrop[oi + 2] = Math.round(lerp(backdrop[oi + 2], b, blend));
      }
    }
  }
}

infillWaterClean(leftBoat.mask, leftBbox, [755, 1020]);
infillWaterClean(rightBoat.mask, rightBbox, [810, 1060]);

// ---- 7. Write outputs + metadata ----
await sharp(backdrop, { raw: { width: W, height: H, channels: 4 } })
  .removeAlpha()
  .webp({ quality: 90 })
  .toFile(path.join(outDir, 'login-backdrop.webp'));

await sharp(cloudsFore, { raw: { width: TILE_W, height: TILE_H, channels: 4 } })
  .webp({ quality: 90, alphaQuality: 95 })
  .toFile(path.join(outDir, 'login-clouds.webp'));

await sharp(cloudsBack, { raw: { width: TILE_W, height: TILE_H, channels: 4 } })
  .webp({ quality: 88, alphaQuality: 92 })
  .toFile(path.join(outDir, 'login-clouds-back.webp'));

await sharp(leftBoat.buf, { raw: { width: leftBoat.width, height: leftBoat.height, channels: 4 } })
  .webp({ quality: 92, alphaQuality: 96 })
  .toFile(path.join(outDir, 'login-boat-left.webp'));

await sharp(rightBoat.buf, { raw: { width: rightBoat.width, height: rightBoat.height, channels: 4 } })
  .webp({ quality: 92, alphaQuality: 96 })
  .toFile(path.join(outDir, 'login-boat-right.webp'));

await sharp(skyMaskSmooth, { raw: { width: W, height: H, channels: 1 } })
  .webp({ quality: 88 })
  .toFile(path.join(outDir, 'login-sky-mask.webp'));

const meta = {
  width: W,
  height: H,
  clouds: {
    file: '/images/landing/login-scene/login-clouds.webp',
    backFile: '/images/landing/login-scene/login-clouds-back.webp',
    tileWidth: TILE_W,
    tileHeight: TILE_H,
    bandHeightFrac: TILE_H / H,
  },
  sun: { x: 732 / W, y: 488 / H },
  horizonY: 633 / H,
  boats: [
    {
      file: '/images/landing/login-scene/login-boat-left.webp',
      x: leftBbox.x0 / W,
      y: leftBbox.y0 / H,
      w: leftBoat.width / W,
      h: leftBoat.height / H,
      pivotX: 0.45,
      pivotY: 0.88,
      waveAmpY: 0.0042,
      rockAmpRad: 0.017,
      phase: 0.0,
    },
    {
      file: '/images/landing/login-scene/login-boat-right.webp',
      x: rightBbox.x0 / W,
      y: rightBbox.y0 / H,
      w: rightBoat.width / W,
      h: rightBoat.height / H,
      pivotX: 0.55,
      pivotY: 0.88,
      waveAmpY: 0.0036,
      rockAmpRad: 0.014,
      phase: 1.8,
    },
  ],
};
fs.writeFileSync(path.join(root, 'src/pages/login-scene-meta.json'), JSON.stringify(meta, null, 2) + '\n');
console.log('Generated clean painted clouds loops + cloudless backdrop:', outDir);
