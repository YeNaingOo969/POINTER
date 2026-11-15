// A YBS shelter at every bus stop (public/data/bus-stops.json, 1,749 stops placed on the kerb and
// turned to face their street by scripts/build-bus-stops.mjs). The model is the YCDC street shelter
// built in Blender (scripts/blender/props/ybs_shelter.py → public/models/props/ybs-shelter.glb):
// its parts are merged into one geometry with their colours as vertex colours and drawn as one
// InstancedMesh — one draw call. Only stops within NEAR_KM of the view are filled in (updated when
// the map stops moving), so a city-wide view doesn't draw 1,749 × 200 triangles.
// Used as an "extra" of the 3D landmark layer (landmarks-3d.js).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const NEAR_KM = 3;
const MIN_ZOOM = 14.5;
const MAX = 600;
const STREET_SIDE = 180; // the model's street side faces south (-Y in Blender)
const SCALE = 1.6;        // a real 5 m shelter is a speck at street zoom; drawn a little larger

/** All meshes of the model as one geometry, each part's material colour baked in. */
function mergedGeometry(scene) {
  const parts = [];
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    const c = o.material.color;
    const colors = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) colors.set([c.r, c.g, c.b], i);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    for (const key of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(key)) g.deleteAttribute(key);
    parts.push(g.index ? g.toNonIndexed() : g);
    o.geometry.dispose();
    o.material.dispose();
  });
  return mergeGeometries(parts);
}

/**
 * @param {{ map: maplibregl.Map, toLocal: (lng: number, lat: number) => [number, number] }} ctx
 * @returns {THREE.InstancedMesh} (fills in once the model and the stop list have loaded)
 */
export function busShelters({ map, toLocal }) {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
  const mesh = new THREE.InstancedMesh(new THREE.BufferGeometry(), material, MAX);
  mesh.count = 0;
  mesh.frustumCulled = false; // instances spread over a few kilometres
  let stops = [];             // [x, z, rotation] in local metres

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const one = new THREE.Vector3(SCALE, SCALE, SCALE);

  function update() {
    if (!stops.length) return;
    let n = 0;
    if (map.getZoom() >= MIN_ZOOM) {
      const c = map.getCenter();
      const [cx, cz] = toLocal(c.lng, c.lat);
      const r2 = (NEAR_KM * 1000) ** 2;
      for (const [x, z, rot] of stops) {
        if ((x - cx) ** 2 + (z - cz) ** 2 > r2) continue;
        q.setFromAxisAngle(up, rot);
        mesh.setMatrixAt(n++, m.compose(pos.set(x, 0, z), q, one));
        if (n === MAX) break;
      }
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    map.triggerRepaint();
  }

  Promise.all([
    new GLTFLoader().loadAsync('/models/props/ybs-shelter.glb'),
    fetch('/data/bus-stops.json').then((r) => r.json()),
  ])
    .then(([gltf, list]) => {
      mesh.geometry.dispose();
      mesh.geometry = mergedGeometry(gltf.scene);
      // heading = clockwise degrees of the street side; three.js turns counter-clockwise
      stops = list.map(([lng, lat, heading]) => [...toLocal(lng, lat), -THREE.MathUtils.degToRad((heading ?? 0) - STREET_SIDE)]);
      update();
      map.on('moveend', update);
      if (import.meta.env.DEV) window.__shelters = mesh; // debugging in the browser console
    })
    .catch((error) => console.error('Bus shelters failed to load', error));
  return mesh;
}
