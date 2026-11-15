// A small 3D shelter at every YBS bus stop in OpenStreetMap (public/data/bus-stops.json, 1,749 stops,
// from assets/raw/osm/city/bus-stops.json). One shelter shape drawn as a single InstancedMesh, so all
// of them cost one draw call. Used as an "extra" of the 3D landmark layer (landmarks-3d.js).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Box with one flat colour baked in as vertex colours. */
function part(w, h, d, x, y, z, color) {
  const g = new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  const c = new THREE.Color(color);
  const colors = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) colors.set([c.r, c.g, c.b], i);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

/** Shelter about 3.4 m wide: blue roof, white back panel with an ad box, two posts and a bench. */
function shelterGeometry() {
  return mergeGeometries([
    part(3.6, 0.16, 1.8, 0, 2.7, 0.15, 0x2f6fa8),   // roof
    part(3.4, 1.9, 0.08, 0, 1.45, -0.7, 0xf2f2ee),  // back panel
    part(1.1, 1.5, 0.12, 1.1, 1.5, -0.62, 0xe8b04a), // ad box (POINTER gold)
    part(0.1, 2.6, 0.1, -1.6, 1.3, -0.6, 0x5a5f66),  // posts
    part(0.1, 2.6, 0.1, 1.6, 1.3, -0.6, 0x5a5f66),
    part(2.6, 0.08, 0.4, 0, 0.45, -0.35, 0x8a6a48),  // bench
  ]);
}

/**
 * @param {{ toLocal: (lng: number, lat: number) => [number, number] }} ctx
 * @returns {THREE.InstancedMesh} (fills in once the stop list has loaded)
 */
export function busShelters({ toLocal }) {
  const geometry = shelterGeometry();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
  const mesh = new THREE.InstancedMesh(geometry, material, 2000);
  mesh.count = 0;
  mesh.frustumCulled = false; // instances spread over the whole city
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  fetch('/data/bus-stops.json')
    .then((r) => r.json())
    .then((stops) => {
      stops.slice(0, 2000).forEach(([lng, lat], i) => {
        const [x, z] = toLocal(lng, lat);
        // No road direction in the data: a stable pseudo-random turn per stop.
        q.setFromAxisAngle(up, ((i * 2654435761) % 360) * (Math.PI / 180));
        mesh.setMatrixAt(i, m.compose(pos.set(x, 0, z), q, one));
      });
      mesh.count = Math.min(stops.length, 2000);
      if (import.meta.env.DEV) window.__shelters = mesh; // debugging in the browser console
      mesh.instanceMatrix.needsUpdate = true;
    })
    .catch((error) => console.error('Bus stops failed to load', error));
  return mesh;
}
