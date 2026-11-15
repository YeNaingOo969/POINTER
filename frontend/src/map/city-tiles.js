// The generated city (npm run build:city): ordinary buildings from OpenStreetMap, one Draco model per
// ~4 km tile (public/models/city/tiles.json). Only tiles near the view are loaded; far ones are
// removed and their geometry freed, so memory stays flat while you pan (610M shares system RAM).
// The six facade/roof textures are loaded once and shared by every tile (the models carry none).
// Used as an "extra" of the 3D landmark layer (landmarks-3d.js).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

const LOAD_KM = 4.5;      // load tiles whose centre is this close to the view centre…
const DROP_KM = 7;        // …and drop them again past this
const MIN_ZOOM = 13.5;
const TEXTURES = ['apartment', 'shop', 'house', 'factory', 'roof_flat', 'roof_zinc'];

/** @param {{ map: maplibregl.Map, toLocal: (lng, lat) => [number, number] }} ctx */
export function cityTiles({ map, toLocal }) {
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
    return [name, new THREE.MeshStandardMaterial({ map: map_, vertexColors: true, roughness: 0.92 })];
  }));

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
      else if ((!zoomedIn || d > DROP_KM) && loaded.has(tile.id)) drop(tile.id);
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
