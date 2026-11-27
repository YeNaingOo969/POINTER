// 3D landmarks on the map: architecturally sculpted Three.js Myanmar pagodas (`pagodas-3d.js`),
// detailed Blender hero landmarks enhanced with sapphire curtain-wall glass + rooftop crowns/spires,
// camera-following 2048x2048 PCFSoftShadowMap (0ms when idle), and the "extras" (generated city,
// rooftop equipment/parapets, roadside infill, tropical trees, bus shelters, clouds, birds, walkers).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { maplibregl } from './map.js';
import { START_VIEW, LANDMARKS, LANDMARK_MIN_ZOOM } from './config.js';
import { createOccupancyGrid } from './city-occupancy.js';
import {
  createPagodaMaterials,
  buildShwedagonMonument,
  buildSuleMonument,
  buildBotataungMonument,
} from './pagodas-3d.js';

export const SUN_DIR = new THREE.Vector3(-0.75, 0.85, 0.65).normalize();

const MODERN_CROWN_IDS = new Set([
  'sule_shangri_la', 'sakura_tower', 'm_tower', 'junction_city', 'times_city',
  'myanmar_plaza', 'lotte', 'diamond_inya', 'melia', 'sedona', 'novotel_max', 'chatrium',
]);

/** Bake a procedural golden-hour sky + sun HDR environment map via PMREM (zero network requests). */
function buildSkyEnvMap(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  const skyGeo = new THREE.SphereGeometry(50, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 horizon = vec3(0.95, 0.82, 0.64);
        vec3 midSky  = vec3(0.62, 0.80, 0.97);
        vec3 zenith  = vec3(0.28, 0.56, 0.92);
        vec3 ground  = vec3(0.48, 0.43, 0.37);

        vec3 sky = h >= 0.0
          ? mix(horizon, mix(midSky, zenith, smoothstep(0.10, 0.68, h)), smoothstep(0.0, 0.24, h))
          : mix(horizon * 0.72, ground, smoothstep(0.0, -0.42, h));

        vec3 sunDir = normalize(vec3(-0.75, 0.85, 0.65));
        float sunDot = max(dot(d, sunDir), 0.0);
        sky += vec3(1.0, 0.82, 0.44) * pow(sunDot, 18.0) * 0.60;
        sky += vec3(1.0, 0.94, 0.78) * pow(sunDot, 110.0) * 3.5;

        gl_FragColor = vec4(sky, 1.0);
      }
    `,
  });
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  envScene.add(skyMesh);

  const rt = pmrem.fromScene(envScene, 0.03);
  skyGeo.dispose();
  skyMat.dispose();
  pmrem.dispose();
  return rt;
}

/** Procedural warm marble slab paving texture for plazas & stairs. */
function buildMarbleTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f4efe5';
  ctx.fillRect(0, 0, 512, 512);

  const tiles = 4;
  const step = 512 / tiles;
  for (let y = 0; y < tiles; y++) {
    for (let x = 0; x < tiles; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#f8f3ea' : '#ede6d7';
      ctx.fillRect(x * step + 2, y * step + 2, step - 4, step - 4);
    }
  }
  ctx.strokeStyle = 'rgba(186, 172, 148, 0.24)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 20; i++) {
    ctx.beginPath();
    const y0 = (i * 27) % 512;
    ctx.moveTo(0, y0);
    ctx.bezierCurveTo(170, y0 + ((i % 3) - 1) * 18, 340, y0 - ((i % 2) * 16), 512, (y0 + 22) % 512);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(164, 149, 126, 0.46)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= tiles; i++) {
    const p = i * step;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, 512); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(512, p); ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** Crisp 256x256 curtain-wall glazing map sampled tri-planarly onto modern skyscraper towers. */
function buildCurtainWallTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');

  const g = ctx.createLinearGradient(0, 0, 28, 256);
  g.addColorStop(0, '#5a94c2');
  g.addColorStop(0.38, '#2b618e');
  g.addColorStop(1, '#193d5d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle skylight interior office glow streaks
  ctx.fillStyle = 'rgba(218, 240, 255, 0.20)';
  ctx.fillRect(14, 24, 102, 42);
  ctx.fillStyle = 'rgba(255, 232, 185, 0.14)';
  ctx.fillRect(140, 24, 102, 42);

  // Crisp diagonal sunlight sheen
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.moveTo(0, 22); ctx.lineTo(130, 22); ctx.lineTo(42, 256); ctx.lineTo(0, 256);
  ctx.fill();

  // Slim metallic spandrel & mullions (keeps rich sapphire glass dominant!)
  ctx.fillStyle = '#2c3d4e';
  ctx.fillRect(0, 0, 256, 22);
  ctx.fillStyle = '#7e93a8';
  ctx.fillRect(0, 0, 6, 256);
  ctx.fillRect(125, 0, 6, 256);
  ctx.fillRect(250, 0, 6, 256);
  ctx.fillRect(0, 128, 256, 5);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** Neutral ribbed roof-tile texture. */
function buildRoofTileTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 16) {
    const g = ctx.createLinearGradient(x, 0, x + 16, 0);
    g.addColorStop(0, '#dadada');
    g.addColorStop(0.25, '#ffffff');
    g.addColorStop(0.85, '#efefef');
    g.addColorStop(1, '#cecece');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 16, 256);
  }
  ctx.strokeStyle = 'rgba(140, 140, 140, 0.26)';
  ctx.lineWidth = 1.5;
  for (let y = 0; y < 256; y += 32) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

// Material classification across all remaining 35 landmark GLBs
const GOLD_BRIGHT = new Set(['#E2AA3C', '#E3A73A', '#E8A54B', '#D9A441', '#F2DFA6']);
const GOLD_DARK   = new Set(['#B9842A', '#C08B2C', '#D69A36', '#C9A35A']);
const MARBLE_HEX  = new Set(['#EFE9DF', '#E8E1D4', '#F6EEDD', '#ECE9E2', '#F6F4EF', '#E6DED0', '#F1EDE4', '#D8D2C6', '#D6D0C4', '#CFC6B8', '#F3EEE6', '#F3EFE7']);
const HERITAGE_HEX = new Set(['#ECEFF1', '#F8F9FA', '#DADFE0', '#C9CCC8', '#F4EEE2', '#F4F1EA', '#EFE6D2', '#E4DCCB', '#F2EBDA', '#F7F5F0', '#F7F2E6', '#F1E9DC', '#E7E2D8', '#ECEEF0', '#F2F2EE']);
const SANDSTONE_HEX = new Set(['#E9D3AE', '#EBCB86', '#EFE3C8', '#C9A27A']);
const WOOD_HEX    = new Set(['#6B4428', '#B9895A', '#7A5A3E', '#6E5C4A', '#5B4436', '#4B3E35']);
const ROOF_HEX    = new Set(['#A8432E', '#D9826B', '#B9483E', '#D4845F', '#C55A4A', '#B7C9B1', '#8C3E2E', '#9A8F86', '#D9D2C4', '#9C3B2E', '#B23A3A', '#C54A3F', '#D2312B']);
const FOLIAGE_HEX = new Set(['#6F9A55', '#4F7F3F', '#679A4A', '#5FA052']);
const GLASS_LIGHT = new Set(['#8FB3C9', '#5F86A4', '#6F93AE', '#9EB8C4']);
const GLASS_DARK  = new Set(['#3A4651', '#3C4148', '#3E3A3A', '#5E5048']);
const BRICK_HEX   = new Set(['#C8653F', '#B4543E', '#C0603F']);
const ACCENT_HEX  = new Set(['#1D4FA0', '#2B4C7E', '#2F7D4F', '#3F6FB0', '#8C5BA6', '#E07A2E']);
const STEEL_HEX   = new Set(['#C8CDD3', '#9AA1A8', '#C9C4BA', '#5E5B57', '#F2EFE8', '#9AA4AD', '#6E7881', '#E2DCD1', '#9A958E', '#F6F3ED', '#D6D0C5', '#E2DDD3', '#A39C94']);

function classifyMaterial(name, lmId) {
  const key = (name || '').toUpperCase();
  if (lmId === 'karaweik') {
    if (key === '#D69A36') return 'karaweik-green-roof';
    if (key === '#F2DFA6') return 'heritage';
  }
  if (GOLD_BRIGHT.has(key)) return 'gold-bright';
  if (GOLD_DARK.has(key)) return 'gold-dark';
  if (FOLIAGE_HEX.has(key)) return 'foliage';
  if (GLASS_LIGHT.has(key)) return 'glass-light';
  if (GLASS_DARK.has(key)) return 'glass-dark';
  if (BRICK_HEX.has(key)) return 'brick';
  if (WOOD_HEX.has(key)) return 'wood';
  if (ROOF_HEX.has(key)) return 'roof';
  if (ACCENT_HEX.has(key)) return 'accent';
  if (SANDSTONE_HEX.has(key)) return 'sandstone';
  if (MARBLE_HEX.has(key)) return 'heritage';
  if (HERITAGE_HEX.has(key)) return 'heritage';
  if (STEEL_HEX.has(key)) return 'steel';
  return 'heritage';
}

function createMaterialUpgrader({ envMap, marbleTex, roofTileTex, curtainTex }) {
  const shared = new Map();

  return (oldMat, lmId) => {
    const role = classifyMaterial(oldMat.name, lmId);
    const hex = (oldMat.name || '').toUpperCase();
    const isStadium = lmId === 'aung_san_stadium' || lmId === 'thuwunna_stadium';
    const cacheKey = `${role}:${hex || oldMat.color?.getHexString() || 'default'}:${isStadium ? 'st' : 'g'}`;
    if (shared.has(cacheKey)) return shared.get(cacheKey);

    const mat = oldMat.clone();
    mat.envMap = envMap;

    let detailTex = null;
    if (role === 'gold-bright') {
      mat.color.set('#F0A212');
      mat.emissive.set('#5e3402');
      mat.emissiveIntensity = 0.22;
      mat.metalness = 0.50;
      mat.roughness = 0.24;
      mat.envMapIntensity = 0.95;
    } else if (role === 'gold-dark') {
      mat.color.set('#C2760A');
      mat.emissive.set('#452401');
      mat.emissiveIntensity = 0.18;
      mat.metalness = 0.45;
      mat.roughness = 0.30;
      mat.envMapIntensity = 0.80;
    } else if (role === 'karaweik-green-roof') {
      mat.color.set('#1E6142');
      mat.metalness = 0.10;
      mat.roughness = 0.42;
      mat.envMapIntensity = 0.45;
      detailTex = roofTileTex;
    } else if (role === 'roof') {
      if (hex === '#A8432E' || hex === '#B9483E' || hex === '#9C3B2E') mat.color.set('#AD3D29');
      else if (hex === '#D9826B') mat.color.set('#C45840');
      else if (hex === '#B7C9B1') mat.color.set('#7DA779');
      mat.metalness = 0.09;
      mat.roughness = 0.48;
      mat.envMapIntensity = 0.42;
      detailTex = roofTileTex;
    } else if (role === 'foliage') {
      mat.color.set('#589E4A');
      mat.metalness = 0.0;
      mat.roughness = 0.78;
      mat.envMapIntensity = 0.22;
    } else if (role === 'glass-light') {
      mat.color.set('#FFFFFF');
      mat.metalness = 0.34;
      mat.roughness = 0.12;
      mat.envMapIntensity = 0.95;
      detailTex = curtainTex;
    } else if (role === 'glass-dark') {
      mat.color.set('#283644');
      mat.metalness = 0.38;
      mat.roughness = 0.18;
      mat.envMapIntensity = 0.85;
    } else if (role === 'brick') {
      mat.color.set(hex === '#C0603F' && isStadium ? '#C45838' : '#C25E3A');
      mat.metalness = 0.02;
      mat.roughness = 0.76;
      mat.envMapIntensity = 0.24;
    } else if (role === 'wood') {
      mat.metalness = 0.04;
      mat.roughness = 0.64;
      mat.envMapIntensity = 0.28;
    } else if (role === 'accent') {
      mat.metalness = 0.18;
      mat.roughness = 0.34;
      mat.envMapIntensity = 0.58;
    } else if (role === 'steel') {
      mat.metalness = 0.24;
      mat.roughness = 0.50;
      mat.envMapIntensity = 0.50;
    } else if (role === 'sandstone') {
      mat.metalness = 0.02;
      mat.roughness = 0.72;
      mat.envMapIntensity = 0.26;
    } else {
      mat.metalness = 0.03;
      mat.roughness = 0.74;
      mat.envMapIntensity = 0.26;
    }

    const shaderTag = role.startsWith('gold') ? 'gold' : role === 'karaweik-green-roof' ? 'roof' : role;
    mat.onBeforeCompile = (shader) => {
      if (detailTex) shader.uniforms.uLmTex = { value: detailTex };

      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vLmLocal;\nvarying vec3 vLmWorld;\nvarying vec3 vLmNorm;')
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvLmLocal = transformed;\nvLmWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvLmNorm = normalize(mat3(modelMatrix) * objectNormal);',
        );

      let fragAdd = `
        #include <color_fragment>
        float lmGroundAO = mix(0.86, 1.0, smoothstep(0.0, 2.4, vLmLocal.y));
        diffuseColor.rgb *= lmGroundAO;
      `;

      if (shaderTag === 'gold') {
        fragAdd += `
        float plateBands = 0.96 + 0.04 * sin(vLmLocal.y * 4.2);
        diffuseColor.rgb *= plateBands;
        `;
      } else if (shaderTag === 'roof') {
        fragAdd += `
        float isRoofSlope = 1.0 - smoothstep(0.0, 0.35, abs(vLmNorm.y));
        vec3 rTex = texture2D(uLmTex, (vLmWorld.xz + vec2(vLmWorld.y * 0.4)) * 0.28).rgb;
        diffuseColor.rgb *= mix(vec3(1.0), rTex, 0.62 * (1.0 - isRoofSlope * 0.35));
        `;
      } else if (shaderTag === 'foliage') {
        fragAdd += `
        float dapple = 0.90 + 0.14 * sin(vLmWorld.x * 0.19) * cos(vLmWorld.z * 0.19);
        float sunCrown = smoothstep(-0.15, 0.85, vLmNorm.y);
        diffuseColor.rgb *= dapple;
        diffuseColor.rgb = mix(diffuseColor.rgb * vec3(0.82, 0.89, 0.85), diffuseColor.rgb * vec3(1.14, 1.16, 0.92), sunCrown);
        `;
      } else if (shaderTag === 'glass-light') {
        fragAdd += `
        // Tri-planar curtain-wall texture mapped per-bay onto modern glass skyscraper prisms
        float isWall = 1.0 - smoothstep(0.65, 0.90, abs(vLmNorm.y));
        float wallPos = abs(vLmNorm.x) > abs(vLmNorm.z) ? vLmLocal.z : vLmLocal.x;
        vec2 cUv = vec2(wallPos * 0.22, -vLmLocal.y / 3.6);
        vec3 cTex = texture2D(uLmTex, cUv).rgb;
        float topLift = smoothstep(8.0, 100.0, vLmLocal.y);
        cTex = mix(cTex, cTex * vec3(1.10, 1.14, 1.18), topLift * 0.45);
        diffuseColor.rgb = mix(vec3(0.32, 0.44, 0.56), cTex, isWall);
        `;
      } else if (shaderTag === 'brick') {
        fragAdd += `
        float course = 0.94 + 0.06 * sin(vLmLocal.y * 4.8);
        float mortar = smoothstep(0.88, 0.98, abs(sin(vLmLocal.y * 2.4)));
        diffuseColor.rgb = mix(diffuseColor.rgb * course, diffuseColor.rgb * 0.78, mortar * 0.28);
        `;
      } else if (shaderTag === 'heritage' || shaderTag === 'sandstone') {
        fragAdd += `
        float isWallH = 1.0 - smoothstep(0.65, 0.90, abs(vLmNorm.y));
        float band = 0.965 + 0.035 * sin(vLmLocal.y * 1.75);
        float sunFace = clamp(dot(vLmNorm, normalize(vec3(-0.75, 0.85, 0.65))) * 0.5 + 0.5, 0.0, 1.0);
        diffuseColor.rgb *= mix(1.0, band, isWallH);
        diffuseColor.rgb *= mix(vec3(0.94, 0.96, 1.02), vec3(1.04, 1.01, 0.97), sunFace * isWallH);
        `;
      }

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>\n${detailTex ? 'uniform sampler2D uLmTex;\n' : ''}varying vec3 vLmLocal;\nvarying vec3 vLmWorld;\nvarying vec3 vLmNorm;`,
        )
        .replace('#include <color_fragment>', fragAdd);
    };
    mat.customProgramCacheKey = () => `lm-pbr-v3-${shaderTag}`;
    shared.set(cacheKey, mat);
    return mat;
  };
}

/** Add stepped rooftop crown, parapet screen, penthouse core & spire onto tall boxy modern tower GLBs. */
function decorateModernTower(root, lmId, crownMats) {
  if (!MODERN_CROWN_IDS.has(lmId)) return;
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  if (size.y < 32 || size.x < 12 || size.z < 12) return;

  const topY = box.max.y;
  const w = Math.min(size.x, size.z) * 0.58;
  const d = Math.max(size.x, size.z) * 0.58;
  const rx = size.x >= size.z ? d : w;
  const rz = size.x >= size.z ? w : d;

  // Sleek glazed acoustic crown frame + dark mechanical bulkhead + twin skyline spires
  const crownWall = new THREE.Mesh(new THREE.BoxGeometry(rx * 0.88, 2.6, rz * 0.88), crownMats.crownGlass);
  crownWall.position.set(center.x, topY + 1.3, center.z);
  crownWall.castShadow = true;
  crownWall.receiveShadow = true;

  const core = new THREE.Mesh(new THREE.BoxGeometry(rx * 0.52, 3.2, rz * 0.52), crownMats.crownMetal);
  core.position.set(center.x, topY + 4.1, center.z);
  core.castShadow = true;
  core.receiveShadow = true;

  root.add(crownWall, core);

  if (size.y > 72) {
    const mastH = 11 + (size.y > 96 ? 5 : 0);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.42, mastH, 8), crownMats.crownMetal);
    mast.position.set(center.x, topY + 5.7 + mastH / 2, center.z);
    mast.castShadow = true;

    const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), crownMats.beacon);
    beacon.position.set(center.x, topY + 5.7 + mastH, center.z);
    root.add(mast, beacon);
  }
}

/**
 * @param {maplibregl.Map} map
 * @param {{ onLandmarks?: (spots) => void, extras?: Array<(ctx) => THREE.Object3D> }} [options]
 */
export function createLandmarkLayer(map, { onLandmarks, extras = [] } = {}) {
  const origin = maplibregl.MercatorCoordinate.fromLngLat(START_VIEW.center, 0);
  const metre = origin.meterInMercatorCoordinateUnits();
  const toLocal = (lng, lat) => [
    ((180 + lng) / 360 - origin.x) / metre,
    ((180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360 - origin.y) / metre,
  ];
  const sceneToMercator = new THREE.Matrix4()
    .makeTranslation(origin.x, origin.y, origin.z)
    .scale(new THREE.Vector3(metre, -metre, metre))
    .multiply(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2));

  const camLocal = new THREE.Vector3(0, 1800, 1200);
  const invProj = new THREE.Matrix4();
  const camVec4 = new THREE.Vector4();
  const getCameraLocal = () => camLocal;
  const updateCameraLocal = () => {
    invProj.copy(camera.projectionMatrix).invert();
    camVec4.set(0, 0, 1, 0).applyMatrix4(invProj);
    if (Math.abs(camVec4.w) > 1e-8) {
      camLocal.set(camVec4.x / camVec4.w, camVec4.y / camVec4.w, camVec4.z / camVec4.w);
    }
  };

  let renderer, scene, camera, sun, shadowFloor, envTarget, marbleTex, roofTileTex, curtainTex;
  const group = new THREE.Group();
  const animated = [];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf = 0;
  let lastFrame = 0;
  let shadowDirty = true;
  let lastShadowX = Infinity;
  let lastShadowZ = Infinity;
  let lastShadowSpan = 0;
  let lastShadowBakeMs = 0;

  const markShadowsDirty = () => { shadowDirty = true; };

  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    if (document.hidden || map.isMoving()) return;
    if (now - lastFrame < 33) return;
    if (!group.visible || !animated.some((o) => o.visible && (o.userData.isActive?.() ?? true))) return;
    lastFrame = now;
    map.triggerRepaint();
  };

  const updateVisibility = () => {
    group.visible = map.getZoom() >= LANDMARK_MIN_ZOOM;
  };

  function syncShadowCamera(force = false) {
    if (!sun || !shadowFloor) return;
    const now = performance.now();
    if (!force && (now - lastShadowBakeMs < 280 || map.isMoving() || map.isZooming() || map.isRotating())) return;
    const c = map.getCenter();
    const zoom = map.getZoom();
    const [cx, cz] = toLocal(c.lng, c.lat);
    const span = zoom >= 15.6 ? 420 : zoom >= 14.6 ? 680 : 940;
    const step = (2 * span) / 1024;
    const sx = Math.round(cx / step) * step;
    const sz = Math.round(cz / step) * step;

    if (force || Math.hypot(sx - lastShadowX, sz - lastShadowZ) > 22 || Math.abs(span - lastShadowSpan) > 40) {
      lastShadowX = sx;
      lastShadowZ = sz;
      lastShadowSpan = span;

      sun.target.position.set(sx, 0, sz);
      sun.position.set(sx + SUN_DIR.x * 750, SUN_DIR.y * 750, sz + SUN_DIR.z * 750);
      sun.shadow.camera.left = -span;
      sun.shadow.camera.right = span;
      sun.shadow.camera.top = span;
      sun.shadow.camera.bottom = -span;
      sun.shadow.camera.near = 60;
      sun.shadow.camera.far = 1750;
      sun.shadow.camera.updateProjectionMatrix();
      sun.target.updateMatrixWorld();
      sun.updateMatrixWorld();

      shadowFloor.position.set(sx, 0.04, sz);
      shadowFloor.scale.setScalar((span * 2.4) / 2400);
      shadowDirty = true;
    }
  }

  async function loadLandmarks(upgradeMaterial, pagodaMats, crownMats) {
    const draco = new DRACOLoader().setWorkerLimit(1);
    const loader = new GLTFLoader().setDRACOLoader(draco);
    const pagodaBuilders = {
      shwedagon: () => buildShwedagonMonument(pagodaMats),
      sule: () => buildSuleMonument(pagodaMats),
      botataung: () => buildBotataungMonument(pagodaMats),
    };

    const spots = await Promise.all(LANDMARKS.map(async (lm) => {
      try {
        let modelRoot;
        if (pagodaBuilders[lm.id]) {
          modelRoot = pagodaBuilders[lm.id]();
        } else {
          const gltf = await loader.loadAsync(lm.file);
          const isGroundFlat = lm.id === 'flyovers';
          gltf.scene.traverse((obj) => {
            if (!obj.isMesh) return;
            obj.castShadow = !isGroundFlat;
            obj.receiveShadow = true;
            if (Array.isArray(obj.material)) {
              obj.material = obj.material.map((m) => upgradeMaterial(m, lm.id));
            } else if (obj.material) {
              const old = obj.material;
              obj.material = upgradeMaterial(old, lm.id);
              if (obj.material !== old) old.dispose();
            }
          });
          decorateModernTower(gltf.scene, lm.id, crownMats);
          modelRoot = gltf.scene;
        }

        const [x, z] = toLocal(lm.lng, lm.lat);
        modelRoot.position.set(x, 0, z);
        modelRoot.rotation.y = -THREE.MathUtils.degToRad(lm.rotation);
        group.add(modelRoot);
        markShadowsDirty();
        map.triggerRepaint();
        const height = new THREE.Box3().setFromObject(modelRoot).max.y;
        if (lm.noLift) return null;
        return { lng: lm.lng, lat: lm.lat, radius: Math.max(lm.grounds, 40), height, minZoom: LANDMARK_MIN_ZOOM };
      } catch (error) {
        console.error(`Landmark ${lm.id} failed to load`, error);
        return null;
      }
    }));
    draco.dispose();
    onLandmarks?.(spots.filter(Boolean));
  }

  const layer = {
    id: 'landmarks-3d',
    type: 'custom',
    renderingMode: '3d',

    onAdd(_map, gl) {
      camera = new THREE.Camera();
      scene = new THREE.Scene();

      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: false });
      renderer.autoClear = false;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.98;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.shadowMap.autoUpdate = false;

      envTarget = buildSkyEnvMap(renderer);
      scene.environment = envTarget.texture;
      marbleTex = buildMarbleTexture();
      roofTileTex = buildRoofTileTexture();
      curtainTex = buildCurtainWallTexture();
      const upgradeMaterial = createMaterialUpgrader({
        envMap: envTarget.texture,
        marbleTex,
        roofTileTex,
        curtainTex,
      });
      const pagodaMats = createPagodaMaterials({ envMap: envTarget.texture });
      const sharedOccupancy = createOccupancyGrid(toLocal);
      const crownMats = {
        crownGlass: new THREE.MeshStandardMaterial({
          color: 0x2a618f, metalness: 0.35, roughness: 0.14, envMap: envTarget.texture, envMapIntensity: 0.95,
        }),
        crownMetal: new THREE.MeshStandardMaterial({
          color: 0x677582, metalness: 0.45, roughness: 0.38, envMap: envTarget.texture, envMapIntensity: 0.70,
        }),
        beacon: new THREE.MeshStandardMaterial({
          color: 0xffffff, emissive: 0xffe4a0, emissiveIntensity: 1.0, roughness: 0.2,
        }),
      };

      scene.add(new THREE.HemisphereLight(0xfff5e4, 0xd1bfa5, 0.84));
      sun = new THREE.DirectionalLight(0xffe7bd, 1.48);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.bias = -0.00055;
      sun.shadow.normalBias = 0.32;

      const fill = new THREE.DirectionalLight(0xc2d8ff, 0.40);
      fill.position.set(0.7, 0.6, -0.9);

      const floorGeo = new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2);
      const floorMat = new THREE.ShadowMaterial({
        color: 0x241d34,
        opacity: 0.22,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      shadowFloor = new THREE.Mesh(floorGeo, floorMat);
      shadowFloor.receiveShadow = true;
      shadowFloor.castShadow = false;
      shadowFloor.renderOrder = -1;

      scene.add(sun, sun.target, fill, shadowFloor, group);
      syncShadowCamera();

      for (const build of extras) {
        try {
          const obj = build({
            map,
            toLocal,
            envMap: envTarget.texture,
            getCameraLocal,
            markShadowsDirty,
            pagodaMats,
            occupancy: sharedOccupancy,
          });
          if (!obj) continue;
          group.add(obj);
          if (obj.userData.tick) animated.push(obj);
        } catch (err) {
          console.error('Map 3D extra failed:', err);
        }
      }
      if (animated.length && !reduceMotion) raf = requestAnimationFrame(loop);
      updateVisibility();
      renderer.resetState();
      loadLandmarks(upgradeMaterial, pagodaMats, crownMats);
      map.on('zoom', updateVisibility);
      map.on('moveend', () => { syncShadowCamera(true); map.triggerRepaint(); });
    },

    render(_gl, options) {
      if (!group.visible) return;
      camera.projectionMatrix.fromArray(options.defaultProjectionData.mainMatrix).multiply(sceneToMercator);
      updateCameraLocal();
      syncShadowCamera(false);

      const t = reduceMotion ? 0 : performance.now() / 1000;
      for (const obj of animated) obj.userData.tick(t);

      if (shadowDirty) {
        renderer.shadowMap.needsUpdate = true;
        shadowDirty = false;
        lastShadowBakeMs = performance.now();
      }
      renderer.resetState();
      renderer.render(scene, camera);
    },

    onRemove() {
      cancelAnimationFrame(raf);
      map.off('zoom', updateVisibility);
      shadowFloor?.geometry.dispose();
      shadowFloor?.material.dispose();
      group.traverse((obj) => {
        if (!obj.isMesh) return;
        obj.geometry.dispose();
        (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach((m) => {
          m?.map?.dispose();
          m?.bumpMap?.dispose();
          m?.roughnessMap?.dispose();
          m?.dispose();
        });
      });
      group.clear();
      envTarget?.dispose();
      marbleTex?.dispose();
      roofTileTex?.dispose();
      curtainTex?.dispose();
      renderer?.dispose();
    },
  };
  return layer;
}

/** Add the 3D landmarks under the map labels. */
export function addLandmarkLayer(map, options) {
  try {
    const firstLabel = map.getStyle()?.layers?.find((l) => l.type === 'symbol')?.id;
    map.addLayer(createLandmarkLayer(map, options), firstLabel);
  } catch (error) {
    console.error('Map: 3D landmarks failed to initialize', error);
  }
}
