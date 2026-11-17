// People (and a few dogs on walks) strolling in the parks near the view: inside the real park
// outlines from OpenStreetMap (public/data/parks.json, `node scripts/build-parks.mjs`). Each
// walker heads for a random spot in its park, then picks another. Three InstancedMeshes (bodies,
// heads, dogs) for everyone, so a few hundred walkers are 3 draw calls; only parks within
// NEAR_M of the view get walkers, and only from zoom 16. They're drawn about 3.5× life size so
// they can be seen. Used as an "extra" of the 3D layer (landmarks-3d.js).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const NEAR_M = 1600;
const MIN_ZOOM = 16;
const MAX_PEOPLE = 240;
const MAX_DOGS = 60;
const SCALE = 3.5;
const SPEED = 1.3 * SCALE;            // metres a second, in step with the bigger figures
const SHIRTS = [0xe8875a, 0x6c8ebf, 0xe8b04a, 0xd96c9a, 0x4fa38a, 0xb58bd6, 0xf2efe8, 0x5b6470, 0xc8553d];
const DOGS = [0x8a6a48, 0xd9c2a0, 0x3a3436, 0xf2ece2];

/** Person, about 1.7 m: legs + body (tinted per person); the head is its own mesh. */
function bodyGeometry() {
  const parts = [
    new THREE.BoxGeometry(0.3, 0.8, 0.22).translate(0, 0.4, 0),       // legs (longyi / trousers)
    new THREE.BoxGeometry(0.42, 0.62, 0.26).translate(0, 1.11, 0),    // body
  ];
  const g = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return g;
}

function dogGeometry() {
  const parts = [
    new THREE.BoxGeometry(0.22, 0.22, 0.6).translate(0, 0.38, 0),     // body
    new THREE.BoxGeometry(0.18, 0.2, 0.22).translate(0, 0.5, 0.36),   // head (front = +z)
    ...[[-0.08, 0.2], [0.08, 0.2], [-0.08, -0.2], [0.08, -0.2]].map(([x, z]) => new THREE.BoxGeometry(0.06, 0.28, 0.06).translate(x, 0.14, z)),
    new THREE.BoxGeometry(0.05, 0.05, 0.22).rotateX(-0.6).translate(0, 0.52, -0.36), // tail
  ];
  const g = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return g;
}

function inside(x, z, ring) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
}

/** A random point inside the park (falls back to its middle for odd shapes). */
function spotIn(park) {
  for (let k = 0; k < 30; k++) {
    const x = park.x0 + Math.random() * (park.x1 - park.x0);
    const z = park.z0 + Math.random() * (park.z1 - park.z0);
    if (inside(x, z, park.ring)) return [x, z];
  }
  return [park.cx, park.cz];
}

/** @param {{ map: maplibregl.Map, toLocal: (lng: number, lat: number) => [number, number] }} ctx */
export function walkers({ map, toLocal }) {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const bodies = new THREE.InstancedMesh(bodyGeometry(), mat, MAX_PEOPLE);
  const heads = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.14, 1).translate(0, 1.58, 0), new THREE.MeshLambertMaterial({ color: 0xc89670 }), MAX_PEOPLE);
  const dogs = new THREE.InstancedMesh(dogGeometry(), mat, MAX_DOGS);
  for (const mesh of [bodies, heads, dogs]) { mesh.count = 0; mesh.frustumCulled = false; }
  group.add(bodies, heads, dogs);

  let parks = [];
  let people = [];      // { park, x, z, tx, tz, phase, pause }
  let pets = [];        // { owner, side }
  const color = new THREE.Color();

  function populate() {
    people = [];
    pets = [];
    if (map.getZoom() >= MIN_ZOOM) {
      const c = map.getCenter();
      const [cx, cz] = toLocal(c.lng, c.lat);
      const near = parks.filter((p) => Math.hypot(p.cx - cx, p.cz - cz) < NEAR_M + p.reach);
      for (const park of near) {
        const n = Math.min(45, Math.max(3, Math.round(park.area / 2500)));
        for (let i = 0; i < n && people.length < MAX_PEOPLE; i++) {
          const [x, z] = spotIn(park);
          const [tx, tz] = spotIn(park);
          const who = { park, x, z, tx, tz, phase: Math.random() * 6.28, pause: 0, heading: 0 };
          people.push(who);
          bodies.setColorAt(people.length - 1, color.setHex(SHIRTS[(Math.random() * SHIRTS.length) | 0]));
          if (Math.random() < 0.22 && pets.length < MAX_DOGS) {
            pets.push({ owner: who, side: Math.random() < 0.5 ? -1 : 1 });
            dogs.setColorAt(pets.length - 1, color.setHex(DOGS[(Math.random() * DOGS.length) | 0]));
          }
        }
      }
    }
    bodies.count = heads.count = people.length;
    dogs.count = pets.length;
    if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
    if (dogs.instanceColor) dogs.instanceColor.needsUpdate = true;
    lastT = null;
    group.userData.tick(performance.now() / 1000, true);
    map.triggerRepaint();
  }

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const size = new THREE.Vector3(SCALE, SCALE, SCALE);
  let lastT = null;

  group.userData.isActive = () => people.length > 0;
  group.userData.tick = (t, force = false) => {
    if (!people.length && !force) return;
    const dt = lastT === null ? 0 : Math.min(t - lastT, 0.1);   // a hidden tab or a jump: no teleporting
    lastT = t;
    people.forEach((p, i) => {
      if (p.pause > 0) p.pause -= dt;
      else {
        const dx = p.tx - p.x, dz = p.tz - p.z;
        const d = Math.hypot(dx, dz);
        if (d < 1) {                                  // arrived: stand a moment, then a new spot
          [p.tx, p.tz] = spotIn(p.park);
          p.pause = Math.random() < 0.3 ? 2 + Math.random() * 4 : 0;
        } else {
          const step = Math.min(d, SPEED * dt);
          p.x += (dx / d) * step;
          p.z += (dz / d) * step;
          p.heading = Math.atan2(dx, dz);
        }
      }
      const walking = p.pause <= 0;
      const bob = walking ? Math.abs(Math.sin(t * 7 + p.phase)) * 0.12 * SCALE : 0;
      q.setFromAxisAngle(up, p.heading);
      m.compose(pos.set(p.x, bob, p.z), q, size);
      bodies.setMatrixAt(i, m);
      heads.setMatrixAt(i, m);
    });
    pets.forEach((d, i) => {
      const o = d.owner;
      const s = Math.sin(o.heading), c = Math.cos(o.heading);
      const side = d.side * 1.1 * SCALE;
      const ahead = 0.9 * SCALE;                     // a step ahead, beside the owner
      const bob = o.pause <= 0 ? Math.abs(Math.sin(t * 11 + o.phase)) * 0.08 * SCALE : 0;
      q.setFromAxisAngle(up, o.heading);
      dogs.setMatrixAt(i, m.compose(pos.set(o.x + s * ahead + c * side, bob, o.z + c * ahead - s * side), q, size));
    });
    bodies.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = dogs.instanceMatrix.needsUpdate = true;
  };

  fetch('/data/parks.json')
    .then((r) => r.json())
    .then((list) => {
      parks = list.map(({ ring, area }) => {
        const pts = ring.map(([lng, lat]) => toLocal(lng, lat));
        const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
        const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
        return { ring: pts, area, x0, x1, z0, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, reach: Math.hypot(x1 - x0, z1 - z0) / 2 };
      });
      populate();
      map.on('moveend', populate);
    })
    .catch((error) => console.error('Parks failed to load', error));

  if (import.meta.env.DEV) window.__walkers = { group, people: () => people.length, dogs: () => pets.length };
  return group;
}
