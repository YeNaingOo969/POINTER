// 3D landmarks on the map: detailed Blender models (scripts/blender/landmarks/*.py, built by
// `npm run build:landmarks`) drawn by Three.js inside MapLibre as one custom layer, plus the
// "extras" (generated city, bus shelters, clouds, birds, people in parks).
// 610M budget: one shared renderer, models load lazily, everything is disposed.
//
// Animation: an extra may set `userData.tick(seconds)` and `userData.isActive()`. While one of
// them is active the layer asks MapLibre for a new frame at most 30 times a second; otherwise the
// map only redraws when it moves, as before. Nothing animates with reduced motion or in a hidden tab.
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
      // Light that keeps the city reading as light pastel boxes: a strong warm sky fill so shaded
      // faces never go charcoal, and a softer sun so the contrast stays gentle.
      scene.add(new THREE.HemisphereLight(0xfff8ec, 0xe8dfcb, 1.55));
      const sun = new THREE.DirectionalLight(0xffeacb, 1.75); // golden-hour sun low in the south-west
      sun.position.set(-0.85, 0.62, 0.75);
      // A cool fill from the opposite side so unlit faces keep their shape instead of going flat.
      const fill = new THREE.DirectionalLight(0xd6e4ff, 0.42);
      fill.position.set(0.7, 0.6, -0.9);
      scene.add(sun, fill, group);
      for (const build of extras) {
        const obj = build({ map, toLocal });
        if (!obj) continue;
        group.add(obj);
        if (obj.userData.tick) animated.push(obj);
      }
      if (animated.length && !reduceMotion) raf = requestAnimationFrame(loop);
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
  // 3D landmarks are decoration: if the style never finished loading (slow/blocked tiles,
  // GPU context reset), skip them so the rest of the map UI can still render.
  try {
    const firstLabel = map.getStyle()?.layers?.find((l) => l.type === 'symbol')?.id;
    map.addLayer(createLandmarkLayer(map, options), firstLabel);
  } catch (error) {
    console.warn('Map: 3D landmarks skipped (style not ready)', error);
  }
}
