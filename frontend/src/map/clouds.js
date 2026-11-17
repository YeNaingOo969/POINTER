// Soft low-poly clouds drifting over the city, with their shadows sliding across the streets.
// One cloud shape (puffs merged into one geometry) drawn as one InstancedMesh, the shadows as a
// second one: 2 draw calls for the whole sky. The clouds live in a 9 km square that follows the
// view, so there are always some around; they fade out when you zoom in close (they'd block the
// street) and when you zoom far out. Used as an "extra" of the 3D layer (landmarks-3d.js).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const COUNT = 18;
const BOX = 6000;                 // metres; clouds wrap around inside this square around the view
const WIND = [7, -3];             // metres per second, east and south (a breeze from the south-west)
const SUN = [-0.6, 0.8];          // ground offset of a shadow per metre of height (sun from the SW)
const SHOW = [12.5, 13.2, 14.6, 15.3]; // zoom: fade in from, fully in, start fading out, gone (closer in they fog the streets)

/** A puffy cloud: a few flattened low-poly spheres of different sizes, about 1 unit across. */
function cloudGeometry() {
  const puffs = [
    [0, 0, 0, 0.55], [0.5, -0.05, 0.1, 0.42], [-0.5, -0.08, -0.05, 0.4],
    [0.15, 0.22, -0.2, 0.38], [-0.2, 0.15, 0.25, 0.35], [0.85, -0.12, -0.05, 0.28], [-0.85, -0.14, 0.1, 0.26],
  ].map(([x, y, z, r]) => new THREE.IcosahedronGeometry(r, 1).scale(1, 0.62, 0.85).translate(x, y, z));
  const g = mergeGeometries(puffs);
  puffs.forEach((p) => p.dispose());
  return g;
}

/** Round soft shadow texture (dark centre fading to nothing). */
function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, 'rgba(40,40,60,1)');
  grad.addColorStop(0.55, 'rgba(40,40,60,0.55)');
  grad.addColorStop(1, 'rgba(40,40,60,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Deterministic 0..1 random, so the sky looks the same on every visit. */
function rand(seed) {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

/** @param {{ map: maplibregl.Map, toLocal: (lng: number, lat: number) => [number, number] }} ctx */
export function clouds({ map, toLocal }) {
  const group = new THREE.Group();
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xfff1e2, emissiveIntensity: 0.55, flatShading: true, transparent: true, opacity: 0.96 });
  const cloudMesh = new THREE.InstancedMesh(cloudGeometry(), cloudMat, COUNT);
  const shadowTex = shadowTexture();
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.22, depthWrite: false });
  const shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const shadowMesh = new THREE.InstancedMesh(shadowGeo, shadowMat, COUNT);
  shadowMesh.renderOrder = 1;
  cloudMesh.frustumCulled = shadowMesh.frustumCulled = false; // instances move around the whole view
  group.add(shadowMesh, cloudMesh);

  // Each cloud: start position in the box, height, size, stretch and turn.
  const sky = Array.from({ length: COUNT }, (_, i) => ({
    x: rand(i + 1) * BOX, z: rand(i + 101) * BOX,
    y: 180 + rand(i + 201) * 120,
    size: 110 + rand(i + 301) * 130,
    stretch: 1.2 + rand(i + 401) * 0.9,
    turn: rand(i + 501) * Math.PI,
  }));

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const wrap = (v, centre) => centre + ((((v - centre + BOX / 2) % BOX) + BOX) % BOX) - BOX / 2;

  const fade = () => {
    const z = map.getZoom();
    const [a, b, c, d] = SHOW;
    if (z <= a || z >= d) return 0;
    return z < b ? (z - a) / (b - a) : z > c ? (d - z) / (d - c) : 1;
  };

  group.userData.isActive = () => fade() > 0;
  group.userData.tick = (t) => {
    const f = fade();
    group.visible = f > 0;
    if (!f) return;
    cloudMat.opacity = 0.96 * f;
    shadowMat.opacity = 0.22 * f;
    const c = map.getCenter();
    const [cx, cz] = toLocal(c.lng, c.lat);
    sky.forEach((s, i) => {
      const x = wrap(s.x + WIND[0] * t, cx);
      const z = wrap(s.z + WIND[1] * t, cz);
      q.setFromAxisAngle(up, s.turn);
      cloudMesh.setMatrixAt(i, m.compose(pos.set(x, s.y, z), q, scale.set(s.size * s.stretch, s.size, s.size)));
      shadowMesh.setMatrixAt(i, m.compose(pos.set(x + SUN[0] * s.y, 1.5, z + SUN[1] * s.y), q, scale.set(s.size * s.stretch * 1.6, 1, s.size * 1.3)));
    });
    cloudMesh.instanceMatrix.needsUpdate = true;
    shadowMesh.instanceMatrix.needsUpdate = true;
  };
  group.userData.tick(0); // place them once, also for reduced motion (then they just stay)

  if (import.meta.env.DEV) window.__clouds = group;
  return group;
}
