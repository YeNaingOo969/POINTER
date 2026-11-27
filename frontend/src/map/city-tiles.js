// The generated city (npm run build:city): ordinary buildings from OpenStreetMap + filler lots,
// one Draco model per ~4 km tile (public/models/city/tiles.json), plus live roadside infill
// (`roadside-filler.js`) and lush tropical street/park trees (`urban-trees.js`).
// Uses shared diffuse + bump/roughness relief maps (`flipY = false` matching glTF UVs) and casts
// directional shadows while staying inside the integrated Radeon 610M memory budget.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { createOccupancyGrid, OCC_BUILDING, OCC_CLEAR } from './city-occupancy.js';
import { createRoadsideFiller } from './roadside-filler.js';
import { createUrbanTrees } from './urban-trees.js';
import { createRooftopProps } from './rooftop-props.js';

const LOAD_KM = 6.8;
const DROP_KM = 9.5;
const MIN_ZOOM = 13.0;
const MAX_CONCURRENT = 4;
const TEXTURES = ['apartment', 'shop', 'house', 'factory', 'roof_flat', 'roof_zinc', 'glass', 'parking'];

function enhanceCityMaterial(material, kind, envMap, camXZUniform) {
  if (envMap && material.isMeshStandardMaterial) material.envMap = envMap;
  const isFacade = kind === 'apartment' || kind === 'house' || kind === 'shop' || kind === 'glass';
  const isGlass = kind === 'glass';
  const isParking = kind === 'parking';
  const isCar = kind === 'car';

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCityCamXZ = camXZUniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vArchWorld;\nvarying vec3 vArchNorm;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvec4 archWp = modelMatrix * vec4(transformed, 1.0);\nvArchWorld = archWp.xyz;\nvArchNorm = normalize(mat3(modelMatrix) * objectNormal);',
      );

    let fragPatch = `
      #include <color_fragment>
      // Tight ground contact crease (0–2.8m) so low-rise houses stay sunny & distinct
      float ao = mix(0.84, 1.0, smoothstep(0.0, 2.8, vArchWorld.y));
      diffuseColor.rgb *= ao;
    `;

    if (!isParking && !isCar) {
      fragPatch += `
      // Synced directional sun contrast (-0.75, 0.85, 0.65) + crisp rooftop highlight
      float isRoof = smoothstep(0.65, 0.9, vArchNorm.y);
      float sunSide = clamp(dot(vArchNorm, normalize(vec3(-0.75, 0.85, 0.65))) * 0.5 + 0.5, 0.0, 1.0);
      diffuseColor.rgb *= mix(1.0, 1.06, isRoof);
      diffuseColor.rgb *= mix(vec3(0.93, 0.96, 1.02), vec3(1.05, 1.02, 0.97), sunSide * (1.0 - isRoof));
      `;
    }

    if (isFacade) {
      fragPatch += `
      #ifdef USE_MAP
        // Subtle per-bay architectural variation + sunlit interior warmth
        vec2 bayCell = floor(vMapUv + vec2(0.01));
        float bayHash = fract(sin(dot(bayCell + floor(vArchWorld.xz * 0.08), vec2(12.9898, 78.233))) * 43758.5453);
        diffuseColor.rgb *= mix(0.92, 1.07, bayHash);
        float glassMask = smoothstep(0.06, 0.22, diffuseColor.b - diffuseColor.r);
        if (bayHash > 0.76) {
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.12, 1.06, 0.90), glassMask * 0.45);
        }
      #endif
      `;
    }

    if (isGlass) {
      fragPatch += `
      // Rich sapphire sky graduation on tall curtain-wall facades
      float heightLift = smoothstep(6.0, 56.0, vArchWorld.y);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.32, 0.58, 0.80), heightLift * 0.24);
      `;
    }

    // Subtle aerial perspective past ~2.8km from camera so foreground stays crisp
    fragPatch += `
      float camDist = length(vArchWorld.xz - uCityCamXZ);
      float horizonHaze = smoothstep(2600.0, 6800.0, camDist);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.94, 0.91, 0.85), horizonHaze * 0.34);
    `;

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec2 uCityCamXZ;\nvarying vec3 vArchWorld;\nvarying vec3 vArchNorm;')
      .replace('#include <color_fragment>', fragPatch);
  };
  material.customProgramCacheKey = () => `city-arch-v2-${kind}`;
  return material;
}

/** @param {{ map: maplibregl.Map, toLocal: (lng: number, lat: number) => [number, number], envMap?: THREE.Texture, markShadowsDirty?: Function, occupancy?: Object }} ctx */
export function cityTiles({ map, toLocal, envMap = null, markShadowsDirty, occupancy: sharedOcc = null }) {
  const group = new THREE.Group();
  const glbGroup = new THREE.Group();
  group.add(glbGroup);

  const occupancy = sharedOcc ?? createOccupancyGrid(toLocal);
  const camXZUniform = { value: new THREE.Vector2(0, 0) };
  const updateCamXZ = () => {
    const c = map.getCenter();
    const [cx, cz] = toLocal(c.lng, c.lat);
    camXZUniform.value.set(cx, cz);
  };
  updateCamXZ();
  map.on('move', updateCamXZ);

  const loaded = new Map(); // id -> THREE.Object3D | 'loading' | 'queued'
  let tiles = [];
  let inFlight = 0;

  const texLoader = new THREE.TextureLoader();
  const loadCityTex = (file, srgb) => {
    const t = texLoader.load(file, () => map.triggerRepaint());
    t.flipY = false; // glTF 2.0 UV spec: v=0 at top, v=1 at bottom
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  };

  const materials = Object.fromEntries(TEXTURES.map((name) => {
    const map_ = loadCityTex(`/models/city/tex/${name}.jpg`, true);
    if (name === 'glass' || name === 'roof_zinc') {
      const bump_ = loadCityTex(`/models/city/tex/${name}_bump.jpg`, false);
      const opts = name === 'glass'
        ? { map: map_, bumpMap: bump_, roughnessMap: bump_, bumpScale: 0.04, roughness: 0.90, metalness: 0.42, envMapIntensity: 1.05, vertexColors: true }
        : { map: map_, bumpMap: bump_, roughnessMap: bump_, bumpScale: 0.09, roughness: 0.62, metalness: 0.25, envMapIntensity: 0.55, vertexColors: true };
      return [name, enhanceCityMaterial(new THREE.MeshStandardMaterial(opts), name, envMap, camXZUniform)];
    }
    return [name, enhanceCityMaterial(new THREE.MeshLambertMaterial({ map: map_, vertexColors: true }), name, null, camXZUniform)];
  }));

  materials.car = enhanceCityMaterial(
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.26, metalness: 0.38, envMapIntensity: 0.80 }),
    'car',
    envMap,
    camXZUniform,
  );

  const filler = createRoadsideFiller({ map, toLocal, materials, occupancy, markShadowsDirty });
  const trees = createUrbanTrees({ map, toLocal, envMap, occupancy, markShadowsDirty });
  const rooftops = createRooftopProps({ roofFlatMat: materials.roof_flat, envMap });
  group.add(filler.group, trees.group, rooftops.group);

  const draco = new DRACOLoader().setWorkerLimit(2);
  const loader = new GLTFLoader().setDRACOLoader(draco);

  const km = (a, b) => {
    const [ax, az] = toLocal(a[0], a[1]);
    const [bx, bz] = toLocal(b[0], b[1]);
    return Math.hypot(ax - bx, az - bz) / 1000;
  };

  function drop(id) {
    const obj = loaded.get(id);
    loaded.delete(id);
    filler.onTileDropped(id);
    rooftops.removeForTile(id);
    if (!obj || obj === 'loading' || obj === 'queued') return;
    glbGroup.remove(obj);
    obj.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    markShadowsDirty?.();
  }

  async function load(tile) {
    loaded.set(tile.id, 'loading');
    inFlight++;
    try {
      const gltf = await loader.loadAsync(tile.file);
      if (loaded.get(tile.id) !== 'loading') return;

      const [x, z] = toLocal(tile.lng, tile.lat);
      gltf.scene.position.set(x, 0, z);
      gltf.scene.updateMatrixWorld(true);

      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        const old = o.material;
        const name = old?.name;
        o.material = materials[name] ?? old;
        if (o.material !== old) old?.dispose();
        o.castShadow = name !== 'parking' && name !== 'car' && name !== 'roof_flat' && name !== 'roof_zinc';
        o.receiveShadow = true;

        if (name && name !== 'car') {
          occupancy.stampMeshXZ(o, name === 'parking' ? OCC_CLEAR : OCC_BUILDING);
        }
      });

      glbGroup.add(gltf.scene);
      loaded.set(tile.id, gltf.scene);
      rooftops.addForTile(tile.id, gltf.scene);
      filler.onTileLoaded(tile);
      trees.refresh();
      markShadowsDirty?.();
      map.triggerRepaint();
    } catch (error) {
      console.error(`City tile ${tile.id} failed`, error);
      loaded.delete(tile.id);
    } finally {
      inFlight--;
      pumpQueue();
    }
  }

  const inViewRange = (tile, here, bounds) => {
    if (km(here, [tile.lng, tile.lat]) < LOAD_KM) return true;
    const b = bounds;
    return tile.lng + 0.025 >= b.getWest() && tile.lng - 0.025 <= b.getEast()
      && tile.lat + 0.025 >= b.getSouth() && tile.lat - 0.025 <= b.getNorth()
      && km(here, [tile.lng, tile.lat]) < DROP_KM - 0.8;
  };

  function pumpQueue() {
    if (!tiles.length || inFlight >= MAX_CONCURRENT) return;
    const c = map.getCenter();
    const here = [c.lng, c.lat];
    const bounds = map.getBounds();
    if (map.getZoom() < MIN_ZOOM) return;

    const candidates = tiles
      .filter((t) => loaded.get(t.id) === 'queued')
      .map((t) => ({ tile: t, d: km(here, [t.lng, t.lat]) }))
      .filter((x) => inViewRange(x.tile, here, bounds))
      .sort((a, b) => a.d - b.d);

    for (const { tile } of candidates) {
      if (inFlight >= MAX_CONCURRENT) break;
      load(tile);
    }
  }

  function update() {
    if (!tiles.length) return;
    const c = map.getCenter();
    const here = [c.lng, c.lat];
    const bounds = map.getBounds();
    const zoomedIn = map.getZoom() >= MIN_ZOOM;
    for (const tile of tiles) {
      const d = km(here, [tile.lng, tile.lat]);
      if (zoomedIn && inViewRange(tile, here, bounds) && !loaded.has(tile.id)) {
        loaded.set(tile.id, 'queued');
      } else if ((!zoomedIn || d > DROP_KM) && loaded.has(tile.id)) {
        drop(tile.id);
      }
    }
    pumpQueue();
  }

  fetch('/models/city/tiles.json')
    .then((r) => r.json())
    .then((list) => {
      tiles = list;
      update();
      map.on('moveend', update);
    })
    .catch((error) => console.error('City tile list failed', error));

  if (import.meta.env.DEV) window.__city = group;
  return group;
}
