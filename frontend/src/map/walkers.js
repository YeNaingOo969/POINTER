// People (and a few dogs on walks) strolling in the parks near the view: inside the real park
// outlines from OpenStreetMap (public/data/parks.json, `node scripts/build-parks.mjs`). Each
// walker heads for a random spot in its park, then picks another.
//
// Everyone really walks: legs and arms are their own InstancedMeshes and each instance swings
// around the hip / shoulder (the dog's legs too), so a few hundred figures with a stride still
// cost six draw calls. Only parks within NEAR_M of the view get walkers, and only from zoom 16.
// They're drawn about 3.5x life size so they can be seen. Used as an "extra" of the 3D layer
// (landmarks-3d.js).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const NEAR_M = 1600;
const MIN_ZOOM = 16;
const MAX_PEOPLE = 240;
const MAX_DOGS = 60;
const SCALE = 3.5;
const SPEED = 1.3 * SCALE;            // metres a second, in step with the bigger figures
const STRIDE = 7;                     // radians a second: one full left-right step about every 0.9 s
const SWING_LEG = 0.5;                // ~29 degrees at the hip
const SWING_ARM = 0.34;
const HIP_Y = 0.8;                    // metres, in the model's own (life-size) units
const SHOULDER_Y = 1.35;
const LEG_X = 0.1;                    // half the stance width
const ARM_X = 0.27;
const DOG_HIP_Y = 0.28;
const DOG_LEG_Z = 0.2;
const SHIRTS = [0xe8875a, 0x6c8ebf, 0xe8b04a, 0xd96c9a, 0x4fa38a, 0xb58bd6, 0xf2efe8, 0x5b6470, 0xc8553d];
const TROUSERS = [0x3f4a5a, 0x5a4636, 0x2f3b3a, 0x6b5b4a, 0x40485c, 0x7a4b3a];
const DOGS = [0x8a6a48, 0xd9c2a0, 0x3a3436, 0xf2ece2];

/** Torso from the hip up (the head is its own mesh so it can keep the skin colour). */
function torsoGeometry() {
  return new THREE.BoxGeometry(0.42, 0.62, 0.26).translate(0, 0.31, 0);
}

/** One leg, hanging from the hip: the pivot sits at the top so it can swing. */
function legGeometry() {
  return new THREE.BoxGeometry(0.16, 0.8, 0.2).translate(0, -0.4, 0);
}

/** One arm, hanging from the shoulder. */
function armGeometry() {
  return new THREE.BoxGeometry(0.12, 0.55, 0.14).translate(0, -0.275, 0);
}

/** Dog body, head and tail (the four legs are a separate mesh so they can move). */
function dogBodyGeometry() {
  const parts = [
    new THREE.BoxGeometry(0.22, 0.22, 0.6).translate(0, 0.38, 0),     // body
    new THREE.BoxGeometry(0.18, 0.2, 0.22).translate(0, 0.5, 0.36),   // head (front = +z)
    new THREE.BoxGeometry(0.05, 0.05, 0.22).rotateX(-0.6).translate(0, 0.52, -0.36), // tail
  ];
  const g = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return g;
}

/** A front or back pair of dog legs, hanging from the same hip line. */
function dogLegGeometry() {
  const parts = [-0.08, 0.08].map((x) => new THREE.BoxGeometry(0.06, 0.28, 0.06).translate(x, -0.14, 0));
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
  const bodies = new THREE.InstancedMesh(torsoGeometry(), mat, MAX_PEOPLE);
  const heads = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.14, 1).translate(0, 0.78, 0), new THREE.MeshLambertMaterial({ color: 0xc89670 }), MAX_PEOPLE);
  const legs = new THREE.InstancedMesh(legGeometry(), mat, MAX_PEOPLE * 2);
  const arms = new THREE.InstancedMesh(armGeometry(), mat, MAX_PEOPLE * 2);
  const dogs = new THREE.InstancedMesh(dogBodyGeometry(), mat, MAX_DOGS);
  const dogLegs = new THREE.InstancedMesh(dogLegGeometry(), mat, MAX_DOGS * 2);
  const meshes = [bodies, heads, legs, arms, dogs, dogLegs];
  for (const mesh of meshes) { mesh.count = 0; mesh.frustumCulled = false; }
  group.add(...meshes);

  let parks = [];
  let people = [];      // { park, x, z, tx, tz, phase, pause, heading }
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
          const k = people.length - 1;
          bodies.setColorAt(k, color.setHex(SHIRTS[(Math.random() * SHIRTS.length) | 0]));
          arms.setColorAt(k * 2, color);
          arms.setColorAt(k * 2 + 1, color);
          legs.setColorAt(k * 2, color.setHex(TROUSERS[(Math.random() * TROUSERS.length) | 0]));
          legs.setColorAt(k * 2 + 1, color);
          if (Math.random() < 0.22 && pets.length < MAX_DOGS) {
            pets.push({ owner: who, side: Math.random() < 0.5 ? -1 : 1 });
            const d = pets.length - 1;
            dogs.setColorAt(d, color.setHex(DOGS[(Math.random() * DOGS.length) | 0]));
            dogLegs.setColorAt(d * 2, color);
            dogLegs.setColorAt(d * 2 + 1, color);
          }
        }
      }
    }
    bodies.count = heads.count = people.length;
    legs.count = arms.count = people.length * 2;
    dogs.count = pets.length;
    dogLegs.count = pets.length * 2;
    for (const mesh of meshes) if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    lastT = null;
    group.userData.tick(performance.now() / 1000, true);
    map.triggerRepaint();
  }

  const m = new THREE.Matrix4();
  const rx = new THREE.Matrix4();
  const size = new THREE.Vector3(SCALE, SCALE, SCALE);
  let lastT = null;

  /** One part's matrix: heading, then its own swing / lean, then the scale, at (x, y, z). */
  function place(x, y, z, heading, swing) {
    m.makeRotationY(heading);
    rx.makeRotationX(swing);
    m.multiply(rx);
    m.scale(size);
    m.setPosition(x, y, z);
    return m;
  }

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
      const stride = t * STRIDE + p.phase;
      const bob = walking ? Math.abs(Math.sin(stride)) * 0.1 * SCALE : 0;
      const lean = walking ? 0.06 : 0;                // a slight forward lean while walking
      const hip = HIP_Y * SCALE + bob;
      const shoulder = SHOULDER_Y * SCALE + bob;
      const h = p.heading;
      const ch = Math.cos(h), sh = Math.sin(h);
      const swing = walking ? Math.sin(stride) : 0;

      bodies.setMatrixAt(i, place(p.x, hip, p.z, h, lean));
      heads.setMatrixAt(i, place(p.x, hip, p.z, h, lean));

      for (let s = 0; s < 2; s++) {
        const dir = s === 0 ? -1 : 1;                 // -1 = the left side
        const ox = LEG_X * dir;
        const ax = ARM_X * dir;
        // The two legs are half a step apart; each arm swings against its own leg.
        legs.setMatrixAt(i * 2 + s, place(p.x + ox * ch, hip, p.z - ox * sh, h, swing * dir * SWING_LEG));
        arms.setMatrixAt(i * 2 + s, place(p.x + ax * ch, shoulder, p.z - ax * sh, h, -swing * dir * SWING_ARM));
      }
    });
    pets.forEach((d, i) => {
      const o = d.owner;
      const s = Math.sin(o.heading), c = Math.cos(o.heading);
      const side = d.side * 1.1 * SCALE;
      const ahead = 0.9 * SCALE;                     // a step ahead, beside the owner
      const walking = o.pause <= 0;
      const step = t * 11 + o.phase;
      const bob = walking ? Math.abs(Math.sin(step)) * 0.06 * SCALE : 0;
      const x = o.x + s * ahead + c * side;
      const z = o.z + c * ahead - s * side;
      const hip = DOG_HIP_Y * SCALE + bob;
      const swing = walking ? Math.sin(step) * 0.45 : 0;
      dogs.setMatrixAt(i, place(x, hip, z, o.heading, 0));
      for (let k = 0; k < 2; k++) {
        const oz = (k === 0 ? DOG_LEG_Z : -DOG_LEG_Z) * SCALE;
        dogLegs.setMatrixAt(i * 2 + k, place(x + oz * s, hip, z + oz * c, o.heading, k === 0 ? swing : -swing));
      }
    });
    for (const mesh of meshes) mesh.instanceMatrix.needsUpdate = true;
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
