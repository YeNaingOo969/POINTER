// Flocks of birds circling over the green and the water: Shwedagon hill, Kandawgyi, Inya Lake,
// People's Park and Maha Bandula Park. Every bird is an instance of one small V-shaped mesh
// (one draw call for all of them); the wings flap in the vertex shader, so moving them costs
// only one matrix per bird per frame. Birds are drawn bigger than life (a real one would be a
// speck) and only from zoom 14.8. Used as an "extra" of the 3D layer (landmarks-3d.js).
import * as THREE from 'three';

const FLOCKS = [ // [lng, lat, birds, circle radius m, height m]
  [96.14959, 16.79834, 9, 150, 150],   // Shwedagon (its hill and spire are tall)
  [96.16450, 16.79190, 10, 260, 70],   // Kandawgyi Lake
  [96.15300, 16.84800, 10, 300, 70],   // Inya Lake
  [96.14400, 16.79550, 7, 170, 60],    // People's Park
  [96.16040, 16.77320, 5, 80, 55],     // Maha Bandula Park
];
const SPAN = 10.5;             // graceful wingspan in metres at zoom 16; shrinks gently as you zoom in
                               // so flocks read like natural egrets/gulls over the lakes and parks
const SHOW = [14.8, 15.3];     // zoom: fade in from, fully in

/** A bird from above: body and two wings, wing tips at |x| = 0.5. */
function birdGeometry() {
  const v = [
    // left wing (tip, front root, back root)
    -0.5, 0, 0.05, 0, 0, -0.12, 0, 0, 0.12,
    // right wing
    0.5, 0, 0.05, 0, 0, 0.12, 0, 0, -0.12,
    // body (a thin diamond along z)
    0, 0.01, -0.3, -0.06, 0.01, 0, 0.06, 0.01, 0,
    0, 0.01, 0.25, 0.06, 0.01, 0, -0.06, 0.01, 0,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

/** Deterministic 0..1 random. */
const rand = (seed) => { const x = Math.sin(seed * 91.7) * 43758.5453; return x - Math.floor(x); };

/** @param {{ map: maplibregl.Map, toLocal: (lng: number, lat: number) => [number, number] }} ctx */
export function birds({ map, toLocal }) {
  const all = [];
  FLOCKS.forEach(([lng, lat, n, radius, height], f) => {
    const [cx, cz] = toLocal(lng, lat);
    for (let i = 0; i < n; i++) {
      const s = f * 100 + i;
      all.push({
        cx, cz,
        r: radius * (0.65 + rand(s) * 0.5),
        h: height + rand(s + 7) * 30,
        speed: (0.06 + rand(s + 13) * 0.05) * (f % 2 ? -1 : 1), // radians a second; flocks turn both ways
        start: (i / n) * Math.PI * 2 + rand(s + 19) * 0.6,
        bob: rand(s + 23) * 6,
      });
    }
  });

  // Wing flap in the vertex shader: lift the wing tips by |x| × sin(time + phase).
  const uniforms = { uTime: { value: 0 } };
  const material = new THREE.MeshLambertMaterial({ color: 0xf7f3ea, emissive: 0xdfd8ca, emissiveIntensity: 0.25, side: THREE.DoubleSide, transparent: true });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute float aPhase;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed.y += abs(position.x) * 0.9 * sin(uTime * 9.0 + aPhase);`);
  };
  const geometry = birdGeometry();
  const phase = new Float32Array(all.length).map((_, i) => rand(i + 500) * Math.PI * 2);
  geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
  const mesh = new THREE.InstancedMesh(geometry, material, all.length);
  mesh.frustumCulled = false;

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();

  const fade = () => THREE.MathUtils.clamp((map.getZoom() - SHOW[0]) / (SHOW[1] - SHOW[0]), 0, 1);
  mesh.userData.isActive = () => fade() > 0;
  mesh.userData.tick = (t) => {
    const f = fade();
    mesh.visible = f > 0;
    if (!f) return;
    material.opacity = f;
    uniforms.uTime.value = t;
    const span = SPAN * THREE.MathUtils.clamp(2 ** ((16 - map.getZoom()) * 0.6), 0.45, 1.3);
    scale.set(span, span, span);
    all.forEach((b, i) => {
      const a = b.start + b.speed * t;
      pos.set(b.cx + Math.cos(a) * b.r, b.h + Math.sin(t * 0.5 + b.bob) * 4, b.cz + Math.sin(a) * b.r);
      // face along the circle (tangent), banked a little into the turn
      e.set(0, -a + (b.speed > 0 ? Math.PI : 0), 0.25 * Math.sign(b.speed), 'YXZ');
      mesh.setMatrixAt(i, m.compose(pos, q.setFromEuler(e), scale));
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  mesh.userData.tick(0);

  if (import.meta.env.DEV) window.__birds = mesh;
  return mesh;
}
