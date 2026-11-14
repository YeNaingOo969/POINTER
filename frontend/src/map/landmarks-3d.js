// 3D landmarks on the map: detailed Blender models (scripts/blender/landmarks/*.py, built by
// `npm run build:landmarks`) drawn by Three.js inside MapLibre as one custom layer. Only the
// landmarks and bridges — no filler city (the blocky city was dropped on 2026-11-12).
// 610M budget: ~20 models, one shared renderer, models load lazily, everything is disposed.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { maplibregl } from './map.js';
import { START_VIEW, LANDMARKS, LANDMARK_MIN_ZOOM } from './config.js';

/**
 * @param {maplibregl.Map} map
 * @param {{ onLandmarks?: (spots) => void, extras?: Array<(ctx) => THREE.Object3D> }} [options]
 *   onLandmarks gets [{ lng, lat, radius, height, minZoom }] so place bubbles can float above;
 *   extras build more objects (flyovers) from { map, toLocal } and are added to the scene.
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

  let renderer, scene, camera;
  const group = new THREE.Group();

  const updateVisibility = () => {
    group.visible = map.getZoom() >= LANDMARK_MIN_ZOOM;
  };

  async function loadLandmarks() {
    const draco = new DRACOLoader().setWorkerLimit(1); // Draco-compressed models; one worker saves RAM
    const loader = new GLTFLoader().setDRACOLoader(draco);
    const spots = await Promise.all(LANDMARKS.map(async (lm) => {
      try {
        const gltf = await loader.loadAsync(lm.file);
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
      scene.add(new THREE.HemisphereLight(0xfff4e2, 0xb9c7a0, 2.0));
      const sun = new THREE.DirectionalLight(0xffe2b8, 2.2); // golden-hour sun from the south-west
      sun.position.set(-0.6, 1, 0.8);
      scene.add(sun, group);
      for (const build of extras) {
        const obj = build({ map, toLocal });
        if (obj) group.add(obj);
      }
      updateVisibility();
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: false });
      renderer.autoClear = false;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      loadLandmarks();
      map.on('zoom', updateVisibility);
    },

    render(_gl, options) {
      if (!group.visible) return;
      camera.projectionMatrix.fromArray(options.defaultProjectionData.mainMatrix).multiply(sceneToMercator);
      renderer.resetState();
      renderer.render(scene, camera);
    },

    onRemove() {
      map.off('zoom', updateVisibility);
      group.traverse((obj) => {
        if (!obj.isMesh) return;
        obj.geometry.dispose();
        (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach((m) => {
          m.map?.dispose();
          m.dispose();
        });
      });
      group.clear();
      renderer?.dispose();
    },
  };
  return layer;
}

/** Add the 3D landmarks under the map labels. */
export function addLandmarkLayer(map, options) {
  const firstLabel = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
  map.addLayer(createLandmarkLayer(map, options), firstLabel);
}
