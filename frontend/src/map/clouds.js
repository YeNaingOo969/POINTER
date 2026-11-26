// Realistic volumetric cumulus clouds drifting high over Yangon, with soft multi-lobe
// ground shadows sliding across the streets.
//
// Implementation: a tiny tileable 48×48×48 3D FBM noise texture baked once at startup (~12 ms),
// sampled by a single InstancedMesh raymarching shader (1 draw call for all clouds, 1 for shadows).
// Looks soft, billowing and three-dimensional from every tilt (0° top-down to 65° oblique),
// with golden-hour sunlit tops, cool sky-shaded undersides, and zero polygon facets.
import * as THREE from 'three';

const COUNT = 16;
const BOX = 6200;                        // metres; clouds wrap smoothly around the view
const WIND = [7.5, -3.2];                // metres per second, east and south
const SUN = [0.48, -0.42];               // ground shadow offset per metre of altitude (sun at SW)
const SHOW = [12.3, 13.0, 14.5, 15.2];   // zoom: fade in, full, start fade out, clear before 15.5 place close-ups

function hash3(x, y, z, period) {
  const px = ((x % period) + period) % period;
  const py = ((y % period) + period) % period;
  const pz = ((z % period) + period) % period;
  let n = (px * 374761393 + py * 668265263 + pz * 2147483647) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

const quintic = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;

function valueNoise3D(x, y, z, period) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const fx = quintic(x - xi);
  const fy = quintic(y - yi);
  const fz = quintic(z - zi);

  const c000 = hash3(xi, yi, zi, period);
  const c100 = hash3(xi + 1, yi, zi, period);
  const c010 = hash3(xi, yi + 1, zi, period);
  const c110 = hash3(xi + 1, yi + 1, zi, period);
  const c001 = hash3(xi, yi, zi + 1, period);
  const c101 = hash3(xi + 1, yi, zi + 1, period);
  const c011 = hash3(xi, yi + 1, zi + 1, period);
  const c111 = hash3(xi + 1, yi + 1, zi + 1, period);

  return lerp(
    lerp(lerp(c000, c100, fx), lerp(c010, c110, fx), fy),
    lerp(lerp(c001, c101, fx), lerp(c011, c111, fx), fy),
    fz,
  );
}

/** Bake a seamless 48^3 3D FBM noise texture (R = cumulus billows, G = fine wispy detail). */
function buildCloudNoise3D(size = 48) {
  const data = new Uint8Array(size * size * size * 4);
  let idx = 0;
  for (let z = 0; z < size; z++) {
    const nz = z / size;
    for (let y = 0; y < size; y++) {
      const ny = y / size;
      for (let x = 0; x < size; x++) {
        const nx = x / size;
        // Macro cumulus lobes (tileable periods 3, 6, 12)
        const low =
          valueNoise3D(nx * 3, ny * 3, nz * 3, 3) * 0.58 +
          valueNoise3D(nx * 6, ny * 6, nz * 6, 6) * 0.28 +
          valueNoise3D(nx * 12, ny * 12, nz * 12, 12) * 0.14;
        // High-frequency wispy erosion (periods 6, 12, 24)
        const high =
          valueNoise3D(nx * 6 + 1.7, ny * 6 + 3.1, nz * 6 + 0.9, 6) * 0.55 +
          valueNoise3D(nx * 12 + 4.3, ny * 12 + 2.2, nz * 12 + 5.1, 12) * 0.30 +
          valueNoise3D(nx * 24, ny * 24, nz * 24, 24) * 0.15;

        data[idx++] = Math.max(0, Math.min(255, Math.round(low * 255)));
        data[idx++] = Math.max(0, Math.min(255, Math.round(high * 255)));
        data[idx++] = 255;
        data[idx++] = 255;
      }
    }
  }
  const tex = new THREE.Data3DTexture(data, size, size, size);
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.wrapR = THREE.RepeatWrapping;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  return tex;
}

/** Organic multi-lobe cloud shadow texture matching the cumulus footprint. */
function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 192;
  const ctx = c.getContext('2d');
  const lobes = [
    [96, 96, 56, 0.55],
    [66, 92, 42, 0.42],
    [126, 98, 44, 0.44],
    [92, 74, 38, 0.38],
    [104, 114, 36, 0.35],
    [48, 102, 28, 0.25],
    [144, 92, 26, 0.25],
  ];
  for (const [x, y, r, alpha] of lobes) {
    const grad = ctx.createRadialGradient(x, y, r * 0.08, x, y, r);
    grad.addColorStop(0, `rgba(42, 52, 74, ${alpha})`);
    grad.addColorStop(0.55, `rgba(42, 52, 74, ${alpha * 0.42})`);
    grad.addColorStop(1, 'rgba(42, 52, 74, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Deterministic 0..1 random, so the sky looks consistent on every visit. */
function rand(seed) {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

const CLOUD_VERT = /* glsl */ `
uniform vec3 uCameraPos;
out vec3 vOriginObj;
out vec3 vDirObj;
out float vSeed;

void main() {
  vec4 worldPos = instanceMatrix * vec4(position, 1.0);
  mat4 invM = inverse(instanceMatrix);
  vOriginObj = (invM * vec4(uCameraPos, 1.0)).xyz;
  vDirObj = position - vOriginObj;
  vSeed = float(gl_InstanceID);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const CLOUD_FRAG = /* glsl */ `
precision highp float;
precision highp sampler3D;

uniform sampler3D uNoise;
uniform float uOpacity;
uniform float uTime;

in vec3 vOriginObj;
in vec3 vDirObj;
in float vSeed;
out vec4 fragColor;

vec2 intersectBox(vec3 ro, vec3 rd) {
  vec3 invD = 1.0 / (rd + vec3(1e-6));
  vec3 t0 = (-0.5 - ro) * invD;
  vec3 t1 = ( 0.5 - ro) * invD;
  vec3 tMin = min(t0, t1);
  vec3 tMax = max(t0, t1);
  float tNear = max(max(tMin.x, tMin.y), tMin.z);
  float tFar  = min(min(tMax.x, tMax.y), tMax.z);
  return vec2(max(tNear, 0.0), tFar);
}

float cloudDensity(vec3 p, vec3 seedOff) {
  // Multi-lobe organic cumulus envelope inside [-0.5, 0.5]^3
  float dMain  = length(p * vec3(2.15, 2.55, 2.25));
  float dLeft  = length((p - vec3(-0.20, -0.05,  0.07)) * vec3(2.65, 3.00, 2.75));
  float dRight = length((p - vec3( 0.21, -0.04, -0.06)) * vec3(2.55, 2.95, 2.65));
  float dCrown = length((p - vec3( 0.02,  0.12,  0.02)) * vec3(2.65, 2.60, 2.75));
  float dTail  = length((p - vec3(-0.08, -0.07, -0.14)) * vec3(2.90, 3.30, 2.90));
  float lobe = min(min(dMain, dLeft), min(min(dRight, dCrown), dTail));

  // Flat cumulus base + soft billowing domes well inside box bounds
  float heightProfile = smoothstep(-0.42, -0.16, p.y) * smoothstep(0.49, 0.06, p.y);
  float boxFade = smoothstep(0.49, 0.30, max(abs(p.x), max(abs(p.y), abs(p.z))));
  float envelope = smoothstep(1.06, 0.18, lobe) * heightProfile * boxFade;
  if (envelope <= 0.002) return 0.0;

  // Drift noise subtly for living gentle billowing
  vec3 uvw = p * vec3(0.95, 1.20, 0.95) + seedOff + vec3(uTime * 0.004, 0.0, uTime * 0.002);
  vec2 n = texture(uNoise, uvw).rg;
  float shape = envelope * 1.65 - (1.0 - n.x) * 0.44 - (1.0 - n.y) * 0.16;
  return clamp(smoothstep(0.06, 0.72, shape), 0.0, 1.0);
}

void main() {
  vec3 rd = normalize(vDirObj);
  vec2 hit = intersectBox(vOriginObj, rd);
  if (hit.x >= hit.y) discard;

  float span = hit.y - hit.x;
  const int STEPS = 16;
  float dt = span / float(STEPS);

  // Screen-space interleaved gradient noise dithering eliminates raymarch banding
  float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  vec3 seedOff = vec3(
    fract(sin(vSeed * 19.31) * 43758.5),
    fract(sin(vSeed * 47.17) * 23421.6),
    fract(sin(vSeed * 83.73) * 19283.4)
  );

  // High sunlit tropical daylight with cool sky-blue shaded undersides
  vec3 sunDir = normalize(vec3(-0.42, 0.84, 0.34));
  float cosTheta = max(dot(rd, sunDir), 0.0);
  float silverLining = pow(cosTheta, 5.0) * 0.22;

  float transmittance = 1.0;
  vec3 accumColor = vec3(0.0);

  for (int i = 0; i < STEPS; i++) {
    float t = hit.x + (float(i) + jitter) * dt;
    vec3 p = vOriginObj + rd * t;
    float dens = cloudDensity(p, seedOff);

    if (dens > 0.003) {
      // 2-tap directional sun self-shadowing
      float shadowDens =
        cloudDensity(p + sunDir * 0.09, seedOff) +
        cloudDensity(p + sunDir * 0.21, seedOff) * 0.7;
      float lightEnergy = exp(-shadowDens * 1.55);
      // Warm sunlit crest vs noticeable periwinkle-blue shaded underside (reads clearly over cream ground)
      float topMix = clamp((p.y + 0.34) * 1.4, 0.0, 1.0);
      vec3 shadowCol = mix(vec3(0.75, 0.83, 0.94), vec3(0.89, 0.93, 0.98), topMix);
      vec3 litCol = vec3(1.0, 0.996, 0.985) + vec3(1.0, 0.92, 0.78) * silverLining;
      vec3 sampleCol = mix(shadowCol, litCol, clamp(lightEnergy * 0.78 + topMix * 0.28, 0.0, 1.0));

      float stepAlpha = 1.0 - exp(-dens * dt * 16.5);
      accumColor += transmittance * sampleCol * stepAlpha;
      transmittance *= (1.0 - stepAlpha);
      if (transmittance < 0.02) break;
    }
  }

  float alpha = (1.0 - transmittance) * uOpacity;
  if (alpha < 0.008) discard;
  fragColor = vec4(accumColor / max(1.0 - transmittance, 1e-4), alpha);
}
`;

/** @param {{ map: maplibregl.Map, toLocal: (lng: number, lat: number) => [number, number], getCameraLocal?: () => THREE.Vector3 }} ctx */
export function clouds({ map, toLocal, getCameraLocal }) {
  const group = new THREE.Group();
  const noiseTex = buildCloudNoise3D(48);

  const cloudMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: CLOUD_VERT,
    fragmentShader: CLOUD_FRAG,
    uniforms: {
      uNoise: { value: noiseTex },
      uCameraPos: { value: new THREE.Vector3(0, 1500, 1000) },
      uOpacity: { value: 0.90 },
      uTime: { value: 0 },
    },
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    depthTest: true,
  });

  const cloudGeo = new THREE.BoxGeometry(1, 1, 1);
  const cloudMesh = new THREE.InstancedMesh(cloudGeo, cloudMat, COUNT);
  const shadowTex = shadowTexture();
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.13, depthWrite: false });
  const shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const shadowMesh = new THREE.InstancedMesh(shadowGeo, shadowMat, COUNT);
  shadowMesh.renderOrder = 1;
  cloudMesh.renderOrder = 2;
  cloudMesh.frustumCulled = shadowMesh.frustumCulled = false;
  group.add(shadowMesh, cloudMesh);

  // Each cloud: start position in the box, altitude (well above Shwedagon 150 m), dimensions, turn
  const sky = Array.from({ length: COUNT }, (_, i) => ({
    x: rand(i + 1) * BOX,
    z: rand(i + 101) * BOX,
    y: 230 + rand(i + 201) * 140,
    w: 380 + rand(i + 301) * 340,
    h: 130 + rand(i + 351) * 80,
    d: 290 + rand(i + 401) * 240,
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
    cloudMat.uniforms.uOpacity.value = 0.94 * f;
    cloudMat.uniforms.uTime.value = t;
    if (getCameraLocal) {
      cloudMat.uniforms.uCameraPos.value.copy(getCameraLocal());
    }
    shadowMat.opacity = 0.20 * f;
    const c = map.getCenter();
    const [cx, cz] = toLocal(c.lng, c.lat);
    sky.forEach((s, i) => {
      const x = wrap(s.x + WIND[0] * t, cx);
      const z = wrap(s.z + WIND[1] * t, cz);
      q.setFromAxisAngle(up, s.turn);
      cloudMesh.setMatrixAt(i, m.compose(pos.set(x, s.y, z), q, scale.set(s.w, s.h, s.d)));
      shadowMesh.setMatrixAt(i, m.compose(pos.set(x + SUN[0] * s.y, 1.5, z + SUN[1] * s.y), q, scale.set(s.w * 0.78, 1, s.d * 0.78)));
    });
    cloudMesh.instanceMatrix.needsUpdate = true;
    shadowMesh.instanceMatrix.needsUpdate = true;
  };
  group.userData.tick(0);

  if (import.meta.env.DEV) window.__clouds = group;
  return group;
}
