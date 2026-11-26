// 3D landmarks on the map: detailed Blender models (scripts/blender/landmarks/*.py, built by
// `npm run build:landmarks`) drawn by Three.js inside MapLibre as one custom layer, plus the
// "extras" (generated city, bus shelters, volumetric clouds, birds, people in parks).
//
// Visual polish (Radeon 610M budget):
// - Procedural Golden-Hour Sky PMREM environment map + ACES Filmic tone mapping so gilded pagodas
//   and curtain-wall glass towers catch realistic sky and sunlight reflections.
// - Material upgrades by architectural role (gold leaf, marble courtyards, roof tiles, lush
//   foliage, reflective glass, colonial brick) sharing ~7 compiled shader programs across 38 models.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { maplibregl } from './map.js';
import { START_VIEW, LANDMARKS, LANDMARK_MIN_ZOOM } from './config.js';

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
        // Rich sky dome for realistic reflections without washing out white stone or gold
        vec3 horizon = vec3(0.95, 0.82, 0.62);
        vec3 midSky  = vec3(0.68, 0.82, 0.96);
        vec3 zenith  = vec3(0.38, 0.64, 0.94);
        vec3 ground  = vec3(0.52, 0.47, 0.40);

        vec3 sky = h >= 0.0
          ? mix(horizon, mix(midSky, zenith, smoothstep(0.12, 0.72, h)), smoothstep(0.0, 0.26, h))
          : mix(horizon * 0.75, ground, smoothstep(0.0, -0.45, h));

        // Crisp sun disc + golden-hour specular lobe aligned with directional light (-0.85, 0.62, 0.75)
        vec3 sunDir = normalize(vec3(-0.85, 0.62, 0.75));
        float sunDot = max(dot(d, sunDir), 0.0);
        sky += vec3(1.0, 0.80, 0.42) * pow(sunDot, 20.0) * 0.65;
        sky += vec3(1.0, 0.93, 0.76) * pow(sunDot, 110.0) * 3.2;

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

/** Procedural warm marble slab paving texture for pagoda terraces & plazas. */
function buildMarbleTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f5f0e6';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle checkerboard warm stone tile variation
  const tiles = 4;
  const step = 512 / tiles;
  for (let y = 0; y < tiles; y++) {
    for (let x = 0; x < tiles; x++) {
      const shade = ((x + y) % 2 === 0) ? '#f8f4ec' : '#efe8da';
      ctx.fillStyle = shade;
      ctx.fillRect(x * step + 2, y * step + 2, step - 4, step - 4);
    }
  }
  // Fine stone veins
  ctx.strokeStyle = 'rgba(196, 184, 164, 0.20)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 18; i++) {
    ctx.beginPath();
    const y0 = (i * 29) % 512;
    ctx.moveTo(0, y0);
    ctx.bezierCurveTo(170, y0 + ((i % 3) - 1) * 18, 340, y0 - ((i % 2) * 16), 512, (y0 + 24) % 512);
    ctx.stroke();
  }
  // Crisp hairline mortar grid
  ctx.strokeStyle = 'rgba(176, 162, 140, 0.42)';
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

/** Neutral ribbed roof-tile texture (multiplied over terracotta/green/zinc roof hues). */
function buildRoofTileTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 16) {
    const g = ctx.createLinearGradient(x, 0, x + 16, 0);
    g.addColorStop(0, '#dedede');
    g.addColorStop(0.25, '#ffffff');
    g.addColorStop(0.85, '#f2f2f2');
    g.addColorStop(1, '#d2d2d2');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 16, 256);
  }
  ctx.strokeStyle = 'rgba(150, 150, 150, 0.22)';
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

// Material classification by the hex names exported from scripts/blender/landmarks/*.py
const GOLD_BRIGHT = new Set(['#E2AA3C', '#E3A73A', '#E8A54B']);
const GOLD_DARK   = new Set(['#B9842A', '#C08B2C', '#D69A36']);
const MARBLE_HEX  = new Set(['#EFE9DF', '#E8E1D4', '#F6EEDD', '#ECE9E2', '#F6F4EF', '#E6DED0', '#F1EDE4', '#D8D2C6', '#D6D0C4']);
const ROOF_HEX    = new Set(['#A8432E', '#D9826B', '#B9483E', '#D4845F', '#C55A4A', '#B7C9B1', '#8C3E2E', '#9A8F86', '#D9D2C4']);
const FOLIAGE_HEX = new Set(['#6F9A55', '#4F7F3F', '#679A4A', '#5FA052']);
const GLASS_LIGHT = new Set(['#8FB3C9', '#5F86A4', '#6F93AE', '#9EB8C4']);
const GLASS_DARK  = new Set(['#3A4651', '#3C4148', '#3E3A3A', '#5E5048', '#5B4436', '#4B3E35']);
const BRICK_HEX   = new Set(['#C8653F', '#B4543E']);

function classifyMaterial(name, lmId) {
  const key = (name || '').toUpperCase();
  if (GOLD_BRIGHT.has(key)) return 'gold-bright';
  if (GOLD_DARK.has(key)) return 'gold-dark';
  if (FOLIAGE_HEX.has(key)) return 'foliage';
  if (GLASS_LIGHT.has(key)) return 'glass-light';
  if (GLASS_DARK.has(key)) return 'glass-dark';
  if (BRICK_HEX.has(key)) return 'brick';
  if (ROOF_HEX.has(key)) return 'roof';
  if (MARBLE_HEX.has(key)) {
    // Only pagoda courtyards/terraces get bright marble sheen; modern towers keep clean concrete slabs
    if (lmId === 'shwedagon' || lmId === 'sule' || lmId === 'botataung') return 'marble';
    return 'stone';
  }
  return 'stucco';
}

function createMaterialUpgrader({ envMap, marbleTex, roofTileTex }) {
  const shared = new Map();

  return (oldMat, lmId) => {
    const role = classifyMaterial(oldMat.name, lmId);
    const cacheKey = `${role}:${oldMat.name || oldMat.color?.getHexString() || 'default'}`;
    if (shared.has(cacheKey)) return shared.get(cacheKey);

    const mat = oldMat.clone();
    mat.envMap = envMap;

    let detailTex = null;
    if (role === 'gold-bright') {
      mat.color.set('#E9A825');
      mat.metalness = 0.62;
      mat.roughness = 0.26;
      mat.envMapIntensity = 0.95;
    } else if (role === 'gold-dark') {
      mat.color.set('#C48018');
      mat.metalness = 0.54;
      mat.roughness = 0.34;
      mat.envMapIntensity = 0.78;
    } else if (role === 'marble') {
      mat.color.set('#EDE6D8');
      mat.metalness = 0.03;
      mat.roughness = 0.56;
      mat.envMapIntensity = 0.28;
      detailTex = marbleTex;
    } else if (role === 'roof') {
      const hex = (oldMat.name || '').toUpperCase();
      if (hex === '#A8432E' || hex === '#B9483E') mat.color.set('#B44630');
      else if (hex === '#B7C9B1') mat.color.set('#96BA92');
      mat.metalness = 0.08;
      mat.roughness = 0.50;
      mat.envMapIntensity = 0.38;
      detailTex = roofTileTex;
    } else if (role === 'foliage') {
      const hex = (oldMat.name || '').toUpperCase();
      if (hex === '#6F9A55') mat.color.set('#649D44');
      else if (hex === '#4F7F3F') mat.color.set('#4C8638');
      else if (hex === '#679A4A') mat.color.set('#73AD50');
      mat.metalness = 0.0;
      mat.roughness = 0.78;
      mat.envMapIntensity = 0.22;
    } else if (role === 'glass-light') {
      const hex = (oldMat.name || '').toUpperCase();
      mat.color.set(hex === '#5F86A4' || hex === '#6F93AE' ? '#436E8F' : '#5D92B8');
      mat.metalness = 0.34;
      mat.roughness = 0.18;
      mat.envMapIntensity = 0.85;
    } else if (role === 'glass-dark') {
      mat.color.set('#303D4A');
      mat.metalness = 0.32;
      mat.roughness = 0.22;
      mat.envMapIntensity = 0.72;
    } else if (role === 'brick') {
      mat.color.set('#C8633C');
      mat.metalness = 0.02;
      mat.roughness = 0.76;
      mat.envMapIntensity = 0.24;
    } else {
      mat.metalness = 0.02;
      mat.roughness = 0.76;
      mat.envMapIntensity = 0.24;
    }

    const shaderTag = role.startsWith('gold') ? 'gold' : role;
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
        // Soft ground contact shadow without darkening taller spires
        float lmGroundAO = mix(0.87, 1.0, smoothstep(0.0, 2.4, vLmLocal.y));
        diffuseColor.rgb *= lmGroundAO;
      `;

      if (shaderTag === 'gold') {
        fragAdd += `
        // Warm golden-hour gleam + delicate horizontal gold-plate ring shimmer on tall stupas
        float spireLift = smoothstep(4.0, 85.0, vLmLocal.y);
        float plateBands = 0.965 + 0.035 * sin(vLmLocal.y * 3.6);
        diffuseColor.rgb *= plateBands;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.10, 1.05, 0.92), spireLift * 0.65);
        `;
      } else if (shaderTag === 'marble') {
        fragAdd += `
        // World-space marble tile paving on horizontal courtyard slabs only
        float isDeck = smoothstep(0.72, 0.92, vLmNorm.y);
        vec3 slabTex = texture2D(uLmTex, vLmWorld.xz * 0.07).rgb;
        diffuseColor.rgb *= mix(vec3(1.0), slabTex, isDeck);
        `;
      } else if (shaderTag === 'roof') {
        fragAdd += `
        // Subtle architectural roof-tile ribbing along sloped eaves
        float isRoofSlope = 1.0 - smoothstep(0.0, 0.35, abs(vLmNorm.y));
        vec3 rTex = texture2D(uLmTex, (vLmWorld.xz + vec2(vLmWorld.y * 0.4)) * 0.28).rgb;
        diffuseColor.rgb *= mix(vec3(1.0), rTex, 0.55 * (1.0 - isRoofSlope * 0.4));
        `;
      } else if (shaderTag === 'foliage') {
        fragAdd += `
        // Dappled sunlit tropical canopy variation so hills & trees read lush and natural
        float dapple = 0.90 + 0.14 * sin(vLmWorld.x * 0.17) * cos(vLmWorld.z * 0.17)
                     + 0.07 * sin(vLmWorld.y * 0.45 + vLmWorld.x * 0.25);
        float sunCrown = smoothstep(-0.15, 0.85, vLmNorm.y);
        diffuseColor.rgb *= dapple;
        diffuseColor.rgb = mix(diffuseColor.rgb * vec3(0.84, 0.90, 0.86), diffuseColor.rgb * vec3(1.12, 1.14, 0.92), sunCrown);
        `;
      } else if (shaderTag === 'glass-light') {
        fragAdd += `
        // Architectural floor-by-floor spandrel lines on reflective tower curtain walls
        float floorBand = smoothstep(0.78, 0.96, abs(sin(vLmLocal.y * (3.14159 / 3.8))));
        float isWall = 1.0 - smoothstep(0.65, 0.90, abs(vLmNorm.y));
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.72, floorBand * isWall * 0.48);
        `;
      } else if (shaderTag === 'brick') {
        fragAdd += `
        // Subtle heritage masonry courses on colonial brickwork
        float course = 0.95 + 0.05 * sin(vLmLocal.y * 4.5);
        diffuseColor.rgb *= course;
        `;
      }

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>\n${detailTex ? 'uniform sampler2D uLmTex;\n' : ''}varying vec3 vLmLocal;\nvarying vec3 vLmWorld;\nvarying vec3 vLmNorm;`,
        )
        .replace('#include <color_fragment>', fragAdd);
    };
    mat.customProgramCacheKey = () => `lm-pbr-${shaderTag}`;
    shared.set(cacheKey, mat);
    return mat;
  };
}

/**
 * @param {maplibregl.Map} map
 * @param {{ onLandmarks?: (spots) => void, extras?: Array<(ctx) => THREE.Object3D> }} [options]
 *   onLandmarks gets [{ lng, lat, radius, height, minZoom }] so place bubbles can float above;
 *   extras build more objects (flyovers) from { map, toLocal, envMap, getCameraLocal } and are added to the scene.
 */
export function createLandmarkLayer(map, { onLandmarks, extras = [] } = {}) {
  const origin = maplibregl.MercatorCoordinate.fromLngLat(START_VIEW.center, 0);
  const metre = origin.meterInMercatorCoordinateUnits();
  // Local metres: x east, z south (mercator y grows southward), y up.
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

  let renderer, scene, camera, envTarget, marbleTex, roofTileTex;
  const group = new THREE.Group();
  const animated = [];             // extras with userData.tick
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf = 0;
  let lastFrame = 0;
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    if (document.hidden || now - lastFrame < 33) return;       // ~30 fps is plenty for drifting things
    if (!group.visible || !animated.some((o) => o.visible && (o.userData.isActive?.() ?? true))) return;
    lastFrame = now;
    map.triggerRepaint();
  };

  const updateVisibility = () => {
    group.visible = map.getZoom() >= LANDMARK_MIN_ZOOM;
  };

  async function loadLandmarks(upgradeMaterial) {
    const draco = new DRACOLoader().setWorkerLimit(1); // Draco-compressed models; one worker saves RAM
    const loader = new GLTFLoader().setDRACOLoader(draco);
    const spots = await Promise.all(LANDMARKS.map(async (lm) => {
      try {
        const gltf = await loader.loadAsync(lm.file);
        gltf.scene.traverse((obj) => {
          if (!obj.isMesh) return;
          if (Array.isArray(obj.material)) {
            obj.material = obj.material.map((m) => upgradeMaterial(m, lm.id));
          } else if (obj.material) {
            const old = obj.material;
            obj.material = upgradeMaterial(old, lm.id);
            if (obj.material !== old) old.dispose();
          }
        });
        const [x, z] = toLocal(lm.lng, lm.lat);
        gltf.scene.position.set(x, 0, z);
        gltf.scene.rotation.y = -THREE.MathUtils.degToRad(lm.rotation);
        group.add(gltf.scene);
        map.triggerRepaint();
        const height = new THREE.Box3().setFromObject(gltf.scene).max.y;
        if (lm.noLift) return null; // bridges: no place bubble stands on them
        return { lng: lm.lng, lat: lm.lat, radius: Math.max(lm.grounds, 40), height, minZoom: LANDMARK_MIN_ZOOM };
      } catch (error) {
        console.error(`Landmark ${lm.id} failed to load`, error);
        return null;
      }
    }));
    draco.dispose(); // frees the decoder worker once every model is in
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
      renderer.toneMappingExposure = 0.96;

      envTarget = buildSkyEnvMap(renderer);
      scene.environment = envTarget.texture;
      marbleTex = buildMarbleTexture();
      roofTileTex = buildRoofTileTexture();
      const upgradeMaterial = createMaterialUpgrader({
        envMap: envTarget.texture,
        marbleTex,
        roofTileTex,
      });

      // Balanced golden-hour daylight: crisp directional contrast without blowing out white stone or gold
      scene.add(new THREE.HemisphereLight(0xfff6e8, 0xd4c3ab, 0.85));
      const sun = new THREE.DirectionalLight(0xffe6b8, 1.45);
      sun.position.set(-0.85, 0.62, 0.75);
      const fill = new THREE.DirectionalLight(0xc4d8ff, 0.40);
      fill.position.set(0.7, 0.6, -0.9);
      scene.add(sun, fill, group);

      for (const build of extras) {
        try {
          const obj = build({ map, toLocal, envMap: envTarget.texture, getCameraLocal });
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
      loadLandmarks(upgradeMaterial);
      map.on('zoom', updateVisibility);
    },

    render(_gl, options) {
      if (!group.visible) return;
      camera.projectionMatrix.fromArray(options.defaultProjectionData.mainMatrix).multiply(sceneToMercator);
      updateCameraLocal();
      const t = reduceMotion ? 0 : performance.now() / 1000;
      for (const obj of animated) obj.userData.tick(t);
      renderer.resetState();
      renderer.render(scene, camera);
    },

    onRemove() {
      cancelAnimationFrame(raf);
      map.off('zoom', updateVisibility);
      group.traverse((obj) => {
        if (!obj.isMesh) return;
        obj.geometry.dispose();
        (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach((m) => {
          m?.map?.dispose();
          m?.dispose();
        });
      });
      group.clear();
      envTarget?.dispose();
      marbleTex?.dispose();
      roofTileTex?.dispose();
      renderer?.dispose();
    },
  };
  return layer;
}

/** Add the 3D landmarks under the map labels. */
export function addLandmarkLayer(map, options) {
  // 3D landmarks are decoration: if the style never finished loading (slow/blocked tiles,
  // GPU context reset), skip them so the rest of the map UI can still render.
  try {
    const firstLabel = map.getStyle()?.layers?.find((l) => l.type === 'symbol')?.id;
    map.addLayer(createLandmarkLayer(map, options), firstLabel);
  } catch (error) {
    console.warn('Map: 3D landmarks skipped (style not ready)', error);
  }
}
