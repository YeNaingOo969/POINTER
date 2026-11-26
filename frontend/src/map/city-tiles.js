// The generated city (npm run build:city): ordinary buildings from OpenStreetMap, one Draco model per
// ~4 km tile (public/models/city/tiles.json). Only tiles near the view are loaded; far ones are
// removed and their geometry freed, so memory stays flat while you pan (610M shares system RAM).
// The facade/roof/car park textures are loaded once and shared by every tile (the models carry none).
// Used as an "extra" of the 3D landmark layer (landmarks-3d.js).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

const LOAD_KM = 4.5;      // load tiles whose centre is this close to the view centre…
const DROP_KM = 7;        // …and drop them again past this
const MIN_ZOOM = 13.5;
const TEXTURES = ['apartment', 'shop', 'house', 'factory', 'roof_flat', 'roof_zinc', 'glass', 'parking'];

/**
 * Architectural PBR + shader polish for city tiles:
 * - tight street-level contact AO (0–2.8 m) so 1–2 storey houses stay sunny and crisp
 * - warm sunlit roofs and gentle per-bay variation so rows of apartments never look stamped
 * - subtle sky reflections on glass curtain walls, zinc roofs and parked cars
 */
function enhanceCityMaterial(material, kind, envMap) {
  if (envMap) material.envMap = envMap;
  const isFacade = kind === 'apartment' || kind === 'house' || kind === 'shop' || kind === 'glass';
  const isGlass = kind === 'glass';
  const isParking = kind === 'parking';
  const isCar = kind === 'car';

  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vArchWorld;\nvarying vec3 vArchNorm;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvec4 archWp = modelMatrix * vec4(transformed, 1.0);\nvArchWorld = archWp.xyz;\nvArchNorm = normalize(mat3(modelMatrix) * objectNormal);',
      );

    let fragPatch = `
      #include <color_fragment>
      // Tight ground contact shadow (only kisses the bottom 2.8m instead of darkening short houses)
      float ao = mix(0.87, 1.0, smoothstep(0.0, 2.8, vArchWorld.y));
      diffuseColor.rgb *= ao;
    `;

    if (!isParking && !isCar) {
      fragPatch += `
      // Sunlit roof bounce + gentle shadow-side cool sky tint for crisp 3D depth
      float isRoof = smoothstep(0.65, 0.9, vArchNorm.y);
      float sunSide = clamp(dot(vArchNorm, normalize(vec3(-0.85, 0.62, 0.75))) * 0.5 + 0.5, 0.0, 1.0);
      diffuseColor.rgb *= mix(1.0, 1.07, isRoof);
      diffuseColor.rgb *= mix(vec3(0.95, 0.97, 1.02), vec3(1.04, 1.02, 0.98), sunSide * (1.0 - isRoof));
      `;
    }

    if (isFacade) {
      fragPatch += `
      #ifdef USE_MAP
        // Subtle per-bay architectural variation so adjacent apartment/office bays feel alive
        vec2 bayCell = floor(vMapUv + vec2(0.01));
        float bayHash = fract(sin(dot(bayCell + floor(vArchWorld.xz * 0.08), vec2(12.9898, 78.233))) * 43758.5453);
        diffuseColor.rgb *= mix(0.94, 1.06, bayHash);
        // Subtle warm interior life in a fraction of glass panes (never garish)
        float glassMask = smoothstep(0.08, 0.25, diffuseColor.b - diffuseColor.r);
        if (bayHash > 0.78) {
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.08, 1.04, 0.92), glassMask * 0.45);
        }
      #endif
      `;
    }

    if (isGlass) {
      fragPatch += `
      // Brighten upper curtain-wall stories slightly toward the sky
      float heightLift = smoothstep(4.0, 48.0, vArchWorld.y);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.76, 0.89, 0.98), heightLift * 0.22);
      `;
    }

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vArchWorld;\nvarying vec3 vArchNorm;')
      .replace('#include <color_fragment>', fragPatch);
  };
  material.customProgramCacheKey = () => `city-arch-${kind}`;
  return material;
}

/** @param {{ map: maplibregl.Map, toLocal: (lng: number, lat: number) => [number, number], envMap?: THREE.Texture }} ctx */
export function cityTiles({ map, toLocal, envMap = null }) {
  const group = new THREE.Group();
  const loaded = new Map(); // id -> THREE.Object3D | 'loading'
  let tiles = [];

  const texLoader = new THREE.TextureLoader();
  const materials = Object.fromEntries(TEXTURES.map((name) => {
    const map_ = texLoader.load(`/models/city/tex/${name}.jpg`, () => map.triggerRepaint());
    map_.colorSpace = THREE.SRGBColorSpace;
    map_.wrapS = THREE.RepeatWrapping;
    map_.wrapT = THREE.RepeatWrapping;
    map_.anisotropy = 4;

    const opts = { map: map_, vertexColors: true };
    if (name === 'glass') {
      opts.roughness = 0.22;
      opts.metalness = 0.28;
      opts.envMapIntensity = 0.72;
    } else if (name === 'roof_zinc') {
      opts.roughness = 0.48;
      opts.metalness = 0.22;
      opts.envMapIntensity = 0.45;
    } else if (name === 'roof_flat') {
      opts.roughness = 0.88;
      opts.metalness = 0.02;
      opts.envMapIntensity = 0.22;
    } else if (name === 'parking') {
      opts.roughness = 0.94;
      opts.metalness = 0.0;
      opts.envMapIntensity = 0.12;
    } else {
      opts.roughness = 0.82;
      opts.metalness = 0.03;
      opts.envMapIntensity = 0.26;
    }

    return [name, enhanceCityMaterial(new THREE.MeshStandardMaterial(opts), name, envMap)];
  }));
  materials.car = enhanceCityMaterial(
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.35, envMapIntensity: 0.75 }),
    'car',
    envMap,
  );

  const draco = new DRACOLoader().setWorkerLimit(1);
  const loader = new GLTFLoader().setDRACOLoader(draco);

  const km = (a, b) => {
    const [ax, az] = toLocal(a[0], a[1]);
    const [bx, bz] = toLocal(b[0], b[1]);
    return Math.hypot(ax - bx, az - bz) / 1000;
  };

  function drop(id) {
    const obj = loaded.get(id);
    loaded.delete(id);
    if (!obj || obj === 'loading') return;
    group.remove(obj);
    obj.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); // materials/textures are shared
  }

  async function load(tile) {
    loaded.set(tile.id, 'loading');
    try {
      const gltf = await loader.loadAsync(tile.file);
      if (loaded.get(tile.id) !== 'loading') return; // dropped while loading
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        const old = o.material;
        o.material = materials[old.name] ?? old;
        if (o.material !== old) old.dispose();
      });
      const [x, z] = toLocal(tile.lng, tile.lat);
      gltf.scene.position.set(x, 0, z);
      group.add(gltf.scene);
      loaded.set(tile.id, gltf.scene);
      map.triggerRepaint();
    } catch (error) {
      console.error(`City tile ${tile.id} failed`, error);
      loaded.delete(tile.id);
    }
  }

  function update() {
    if (!tiles.length) return;
    const c = map.getCenter();
    const here = [c.lng, c.lat];
    const zoomedIn = map.getZoom() >= MIN_ZOOM;
    for (const tile of tiles) {
      const d = km(here, [tile.lng, tile.lat]);
      if (zoomedIn && d < LOAD_KM && !loaded.has(tile.id)) load(tile);
      else if ((!zoomedIn || d > DROP_KM) && loaded.has(tile.id)) drop(tile);
    }
  }

  fetch('/models/city/tiles.json')
    .then((r) => r.json())
    .then((list) => { tiles = list; update(); })
    .catch((error) => console.error('City tiles list failed', error));
  map.on('moveend', update);
  if (import.meta.env.DEV) window.__city = { loaded, group };
  return group;
}
