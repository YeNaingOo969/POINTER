// Animated Yangon golden-hour river scene for login.html:
//   - WebGL layer: perspective water ripples + golden sun glints + drifting volumetric sunset clouds
//     (masked behind the Shwedagon pagoda spire & distant skyline).
//   - Foreground 2D layer: buoyancy-synced wooden boats (bobbing & rolling to the exact wave phase)
//     and a natural dusk flock of articulated birds with realistic flap-and-glide cycles.
// Preserves the Radeon 610M budget (capped DPR, single shader pass, pauses when tab is hidden,
// and respects prefers-reduced-motion: reduce).
import sceneMeta from './login-scene-meta.json';

const GL_VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  vUv.y = 1.0 - vUv.y;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const GL_FRAG = `
precision mediump float;

uniform sampler2D uBackdrop;
uniform sampler2D uSkyMask;
uniform sampler2D uCloudsFore;
uniform sampler2D uCloudsBack;
uniform vec2 uResolution;
uniform vec2 uImageSize;
uniform vec2 uParallax;
uniform vec2 uSunPos;
uniform float uHorizonY;
uniform float uCloudBandHeight;
uniform float uCloudScaleX;
uniform float uTime;

varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(17.1, 31.7);
    a *= 0.5;
  }
  return v;
}

// Compute cover UV matching CSS object-fit: cover + object-position: 35% 50%,
// with slight 1.03 headroom so pointer parallax & wave distortion never expose border seams.
vec2 coverUv(vec2 screenUv) {
  float scale = max(uResolution.x / uImageSize.x, uResolution.y / uImageSize.y) * 1.03;
  vec2 scaledSize = uImageSize * scale;
  vec2 offset = (uResolution - scaledSize) * vec2(0.35, 0.5);
  vec2 px = screenUv * uResolution - offset - uParallax;
  return clamp(px / scaledSize, vec2(0.001), vec2(0.999));
}

void main() {
  vec2 baseUv = coverUv(vUv);
  float horizon = uHorizonY;

  // ---- 1. Animated perspective water below shoreline ----
  float waterFade = smoothstep(horizon - 0.002, horizon + 0.042, baseUv.y);
  vec2 waterUv = baseUv;
  float waveSlope = 0.0;

  if (waterFade > 0.001) {
    float depth = clamp((baseUv.y - horizon) / max(0.01, 1.0 - horizon), 0.0, 1.0);
    float perspV = 1.0 / (depth + 0.085);

    // Slow primary river swell (matches the JS boat buoyancy wave function!)
    float swellPhase = baseUv.x * 4.2 - uTime * 1.15;
    float crossPhase = baseUv.x * 7.8 + uTime * 0.85;
    float swell = sin(swellPhase) * 0.62 + sin(crossPhase) * 0.38;

    // Fine perspective horizontal water ripples
    float ripple1 = sin(perspV * 1.85 - uTime * 1.35 + baseUv.x * 5.2);
    float ripple2 = cos(perspV * 3.70 + uTime * 0.95 - baseUv.x * 10.5);
    float rippleMix = ripple1 * 0.65 + ripple2 * 0.35;

    float dispY = (swell * 0.0024 + rippleMix * 0.0036) * (0.28 + 0.72 * depth) * waterFade;
    float dispX = (cos(perspV * 1.6 + uTime * 0.8 + baseUv.y * 12.0) * 0.0018 + swell * 0.0012) * waterFade;

    waterUv.x = clamp(baseUv.x + dispX, 0.001, 0.999);
    // Clamp water sampling safely below shoreline so shore roofs/walls never bleed into ripples
    waterUv.y = clamp(baseUv.y + dispY, horizon + 0.001, 0.999);
    waveSlope = rippleMix * 0.55 + swell * 0.45;
  }

  vec3 col = texture2D(uBackdrop, waterUv).rgb;

  // Sun-path golden sparkles riding animated wave crests
  if (waterFade > 0.001) {
    float depth = clamp((baseUv.y - horizon) / max(0.01, 1.0 - horizon), 0.0, 1.0);
    float sunColumn = exp(-pow((baseUv.x - uSunPos.x) * 5.4, 2.0));
    float glint = smoothstep(0.32, 0.95, waveSlope) * (0.35 + 0.65 * depth);
    float shimmer = 0.055 + 0.22 * sunColumn;
    col += vec3(1.0, 0.84, 0.52) * (glint * shimmer * waterFade);
  }

  // ---- 2. Drifting painted sunset clouds moving left -> right behind Shwedagon spire ----
  float skyMask = texture2D(uSkyMask, baseUv).r;
  if (skyMask > 0.005 && baseUv.y < uCloudBandHeight) {
    float cloudVBase = clamp(baseUv.y / uCloudBandHeight, 0.002, 0.996);

    // Slow high-altitude sunset mist wisps moving gently left -> right
    float wisp = fbm(vec2(baseUv.x * 2.3 - uTime * 0.0065 + uParallax.x * 0.00010, baseUv.y * 4.5 + 0.7));
    float mistAlpha = smoothstep(0.45, 0.78, wisp) * 0.16 * skyMask;
    float sunProx = exp(-length((baseUv - uSunPos) * vec2(1.4, 2.2)));
    vec3 mistCol = mix(vec3(0.95, 0.72, 0.56), vec3(1.0, 0.92, 0.74), sunProx);
    col = mix(col, mistCol, mistAlpha);

    // Distant cloud layer (login-clouds-back.webp) moving slowly left -> right
    float backU = baseUv.x * uCloudScaleX - uTime * 0.0046 + uParallax.x * 0.00012;
    float backV = clamp(cloudVBase + sin(uTime * 0.22 + backU * 6.283) * 0.004, 0.002, 0.996);
    vec4 backCloud = texture2D(uCloudsBack, vec2(backU, backV));
    vec3 backCol = mix(backCloud.rgb, col * 0.65 + vec3(0.35, 0.22, 0.16), 0.24);
    col = mix(col, backCol, backCloud.a * skyMask * 0.78);

    // Foreground painted cloud layer (login-clouds.webp) moving steadily left -> right and wrapping seamlessly
    float foreU = baseUv.x * uCloudScaleX - uTime * 0.0092 + uParallax.x * 0.00022;
    float foreV = clamp(cloudVBase + sin(uTime * 0.30 + foreU * 6.283 + 1.4) * 0.005, 0.002, 0.996);
    vec4 foreCloud = texture2D(uCloudsFore, vec2(foreU, foreV));
    vec3 foreCol = mix(foreCloud.rgb, mistCol, 0.14);
    col = mix(col, foreCol, foreCloud.a * skyMask * 0.92);
  }

  gl_FragColor = vec4(col, 1.0);
}
`;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Shared horizontal surface wave height so boats pitch and heave in phase with the shader river. */
function riverSwell(u, time) {
  return Math.sin(u * 4.2 - time * 1.15) * 0.62 + Math.sin(u * 7.8 + time * 0.85) * 0.38;
}

function riverSlope(u, time) {
  return Math.cos(u * 4.2 - time * 1.15) * 4.2 * 0.62 + Math.cos(u * 7.8 + time * 0.85) * 7.8 * 0.38;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function createBirdsFlock() {
  // Two graceful aerial groups matching the dusk river illustration:
  //   - Left/center sunset flock (9 birds drifting gently rightward across the sky)
  //   - Right distant flock near Shwedagon (3 smaller birds gliding leftward)
  const specs = [
    // Main left-sky dusk flock (visible curved wings against the warm sunset)
    { u: 0.14, v: 0.31, scale: 1.18, speed: 0.0056, flapRate: 6.4, seed: 0.3, glideBias: 0.42, dir: 1, alpha: 0.88 },
    { u: 0.18, v: 0.27, scale: 1.08, speed: 0.0061, flapRate: 6.9, seed: 1.7, glideBias: 0.52, dir: 1, alpha: 0.84 },
    { u: 0.21, v: 0.33, scale: 0.88, speed: 0.0049, flapRate: 7.4, seed: 2.9, glideBias: 0.35, dir: 1, alpha: 0.74 },
    { u: 0.24, v: 0.25, scale: 1.38, speed: 0.0066, flapRate: 5.8, seed: 4.1, glideBias: 0.58, dir: 1, alpha: 0.92 },
    { u: 0.27, v: 0.29, scale: 0.98, speed: 0.0054, flapRate: 7.1, seed: 5.2, glideBias: 0.46, dir: 1, alpha: 0.82 },
    { u: 0.31, v: 0.27, scale: 0.92, speed: 0.0059, flapRate: 6.8, seed: 0.9, glideBias: 0.50, dir: 1, alpha: 0.78 },
    { u: 0.22, v: 0.35, scale: 0.82, speed: 0.0046, flapRate: 7.6, seed: 3.4, glideBias: 0.40, dir: 1, alpha: 0.70 },
    { u: 0.26, v: 0.34, scale: 0.94, speed: 0.0052, flapRate: 6.6, seed: 6.1, glideBias: 0.48, dir: 1, alpha: 0.76 },
    { u: 0.12, v: 0.24, scale: 0.84, speed: 0.0051, flapRate: 7.2, seed: 2.1, glideBias: 0.55, dir: 1, alpha: 0.72 },
    // Distant smaller birds drifting softly near the pagoda sky
    { u: 0.86, v: 0.31, scale: 0.78, speed: -0.0042, flapRate: 7.0, seed: 4.7, glideBias: 0.56, dir: -1, alpha: 0.78 },
    { u: 0.91, v: 0.28, scale: 0.64, speed: -0.0038, flapRate: 7.5, seed: 1.2, glideBias: 0.62, dir: -1, alpha: 0.66 },
    { u: 0.60, v: 0.21, scale: 0.74, speed: 0.0045, flapRate: 6.7, seed: 3.8, glideBias: 0.54, dir: 1, alpha: 0.68 },
  ];

  return specs.map((b) => ({
    ...b,
    baseV: b.v,
    cycleDuration: 5.2 + (b.seed % 3.1),
  }));
}

/**
 * Draw one articulated flying dusk bird silhouette with realistic cambered wings & sleek body.
 * Flaps naturally during part of its cycle and glides gracefully between wingbeats.
 */
function drawNaturalBird(ctx, x, y, pxScale, flapVal, dir, alpha, parallaxX) {
  const span = 12 * pxScale;
  const wingLift = flapVal * span * 0.58;
  const elbowLift = flapVal * span * 0.28 - span * 0.14;
  const bodyBounce = -flapVal * 1.1 * pxScale;

  ctx.save();
  ctx.translate(x + parallaxX, y + bodyBounce);
  ctx.scale(dir, 1);

  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#472d1f';

  // Streamlined dusk bird body + slight swept tail & beak
  ctx.beginPath();
  ctx.moveTo(span * 0.34, -0.4 * pxScale);
  ctx.quadraticCurveTo(span * 0.08, -1.6 * pxScale, -span * 0.36, 0.6 * pxScale);
  ctx.lineTo(-span * 0.44, 1.1 * pxScale);
  ctx.quadraticCurveTo(-span * 0.02, 1.5 * pxScale, span * 0.34, -0.4 * pxScale);
  ctx.closePath();
  ctx.fill();

  // Foreground wing (longer, sweeping cambered gull arc)
  ctx.beginPath();
  ctx.moveTo(span * 0.14, -0.4 * pxScale);
  ctx.quadraticCurveTo(-span * 0.06, elbowLift, -span * 0.72, wingLift);
  ctx.quadraticCurveTo(-span * 0.24, elbowLift + 1.8 * pxScale, -span * 0.08, 0.5 * pxScale);
  ctx.closePath();
  ctx.fill();

  // Far wing (foreshortened perspective silhouette)
  ctx.beginPath();
  ctx.moveTo(span * 0.06, -0.5 * pxScale);
  ctx.quadraticCurveTo(span * 0.28, elbowLift * 0.9 - span * 0.12, span * 0.62, wingLift * 0.92 - span * 0.06);
  ctx.quadraticCurveTo(span * 0.26, elbowLift * 0.8 + 1.1 * pxScale, 0, -0.1 * pxScale);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function initWebGL(canvas, backdropImg, skyMaskImg, cloudsForeImg, cloudsBackImg) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false });
  if (!gl) return null;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      gl.deleteShader(s);
      return null;
    }
    return s;
  };

  const vs = compile(gl.VERTEX_SHADER, GL_VERT);
  const fs = compile(gl.FRAGMENT_SHADER, GL_FRAG);
  if (!vs || !fs) return null;

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const makeTex = (unit, img, wrapRepeatX = false) => {
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapRepeatX ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    return tex;
  };

  const texBackdrop = makeTex(0, backdropImg, false);
  const texSkyMask = makeTex(1, skyMaskImg, false);
  const texCloudsFore = makeTex(2, cloudsForeImg, true);
  const texCloudsBack = makeTex(3, cloudsBackImg, true);

  gl.useProgram(prog);
  gl.uniform1i(gl.getUniformLocation(prog, 'uBackdrop'), 0);
  gl.uniform1i(gl.getUniformLocation(prog, 'uSkyMask'), 1);
  gl.uniform1i(gl.getUniformLocation(prog, 'uCloudsFore'), 2);
  gl.uniform1i(gl.getUniformLocation(prog, 'uCloudsBack'), 3);

  const locRes = gl.getUniformLocation(prog, 'uResolution');
  const locImgSize = gl.getUniformLocation(prog, 'uImageSize');
  const locParallax = gl.getUniformLocation(prog, 'uParallax');
  const locSunPos = gl.getUniformLocation(prog, 'uSunPos');
  const locHorizonY = gl.getUniformLocation(prog, 'uHorizonY');
  const locCloudBandH = gl.getUniformLocation(prog, 'uCloudBandHeight');
  const locCloudScaleX = gl.getUniformLocation(prog, 'uCloudScaleX');
  const locTime = gl.getUniformLocation(prog, 'uTime');

  gl.uniform2f(locImgSize, sceneMeta.width, sceneMeta.height);
  gl.uniform2f(locSunPos, sceneMeta.sun.x, sceneMeta.sun.y);
  gl.uniform1f(locHorizonY, sceneMeta.horizonY);
  gl.uniform1f(locCloudBandH, sceneMeta.clouds.bandHeightFrac);
  gl.uniform1f(locCloudScaleX, sceneMeta.width / sceneMeta.clouds.tileWidth);

  return {
    render(width, height, px, py, time) {
      gl.viewport(0, 0, width, height);
      gl.useProgram(prog);
      gl.uniform2f(locRes, width, height);
      gl.uniform2f(locParallax, px, py);
      gl.uniform1f(locTime, time);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    destroy() {
      gl.deleteTexture(texBackdrop);
      gl.deleteTexture(texSkyMask);
      gl.deleteTexture(texCloudsFore);
      gl.deleteTexture(texCloudsBack);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    },
  };
}

/**
 * Mount the dynamic Yangon river scene (rippling water, synced rocking boats, drifting clouds,
 * and flying birds) inside `.auth-bg`. Returns a cleanup function.
 */
export function mountLoginScene(container) {
  if (!container) return () => {};
  const glCanvas = container.querySelector('.auth-bg__gl');
  const fgCanvas = container.querySelector('.auth-bg__fg');
  const fallbackImg = container.querySelector('.auth-bg__art');
  if (!glCanvas || !fgCanvas) return () => {};

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const ctx = fgCanvas.getContext('2d');

  let destroyed = false;
  let raf = 0;
  let glRunner = null;
  let backdropImg = null;
  let skyMaskImg = null;
  let cloudsForeImg = null;
  let cloudsBackImg = null;
  let boatImgs = [];
  const flock = createBirdsFlock();

  // Viewport geometry + pointer parallax smoothing
  let vw = container.clientWidth || innerWidth;
  let vh = container.clientHeight || innerHeight;
  let dpr = Math.min(devicePixelRatio || 1, 1.75);
  let targetPx = 0;
  let targetPy = 0;
  let curPx = 0;
  let curPy = 0;

  function resize() {
    vw = container.clientWidth || innerWidth;
    vh = container.clientHeight || innerHeight;
    dpr = Math.min(devicePixelRatio || 1, 1.75);

    glCanvas.width = Math.max(1, Math.round(vw * dpr));
    glCanvas.height = Math.max(1, Math.round(vh * dpr));
    fgCanvas.width = Math.max(1, Math.round(vw * dpr));
    fgCanvas.height = Math.max(1, Math.round(vh * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function coverRect(parallaxX, parallaxY) {
    const scale = Math.max(vw / sceneMeta.width, vh / sceneMeta.height) * 1.03;
    const drawW = sceneMeta.width * scale;
    const drawH = sceneMeta.height * scale;
    const offsetX = (vw - drawW) * 0.35 + parallaxX;
    const offsetY = (vh - drawH) * 0.5 + parallaxY;
    return { drawW, drawH, offsetX, offsetY, scale };
  }

  function draw2DFallback(rect, time) {
    if (!backdropImg) return;
    ctx.drawImage(backdropImg, rect.offsetX, rect.offsetY, rect.drawW, rect.drawH);
    // Scroll clouds left -> right cleanly if falling back to 2D canvas
    if (cloudsForeImg) {
      const tileDrawW = rect.drawW * (sceneMeta.clouds.tileWidth / sceneMeta.width);
      const bandDrawH = rect.drawH * sceneMeta.clouds.bandHeightFrac;
      const shift = ((time * 0.0092) % 1) * tileDrawW;
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.drawImage(cloudsForeImg, rect.offsetX + shift, rect.offsetY, tileDrawW, bandDrawH);
      ctx.drawImage(cloudsForeImg, rect.offsetX + shift - tileDrawW, rect.offsetY, tileDrawW, bandDrawH);
      ctx.restore();
    }
    // Subtle shimmer wave stripes below horizon if WebGL isn't available
    const horScreenY = rect.offsetY + rect.drawH * sceneMeta.horizonY;
    const bandH = Math.max(1, rect.drawH * (1 - sceneMeta.horizonY));
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, horScreenY, vw, bandH);
    ctx.clip();
    for (let i = 0; i < 18; i++) {
      const f = i / 18;
      const y = horScreenY + f * f * bandH;
      const shimmerX = rect.offsetX + rect.drawW * sceneMeta.sun.x + Math.sin(time * 1.4 + i) * 16;
      const w = (40 + f * 90);
      ctx.fillStyle = `rgba(255, 224, 152, ${0.06 * Math.max(0, Math.sin(time * 1.8 + i * 0.9))})`;
      ctx.fillRect(shimmerX - w * 0.5, y, w, 2 + f * 3);
    }
    ctx.restore();
  }

  function renderFrame(ms) {
    const time = reducedMotion ? 0 : ms * 0.001;

    // Smooth pointer parallax
    curPx += (targetPx - curPx) * 0.08;
    curPy += (targetPy - curPy) * 0.08;

    const bgParallaxX = curPx * 8;
    const bgParallaxY = curPy * 5;
    const rect = coverRect(bgParallaxX, bgParallaxY);

    ctx.clearRect(0, 0, vw, vh);

    if (glRunner) {
      glRunner.render(glCanvas.width, glCanvas.height, bgParallaxX * dpr, bgParallaxY * dpr, time);
    } else {
      draw2DFallback(rect, time);
    }

    // ---- Draw swaying wooden boats synced to the underlying river wave ----
    for (let i = 0; i < sceneMeta.boats.length; i++) {
      const b = sceneMeta.boats[i];
      const img = boatImgs[i];
      if (!img) continue;

      const uCenter = b.x + b.w * 0.5;
      const waveVal = riverSwell(uCenter, time);
      const slopeVal = riverSlope(uCenter, time);

      // Heave up/down with surface height; roll gently according to horizontal wave slope
      const heavePx = waveVal * rect.drawH * (b.waveAmpY * 1.35);
      const swayX = Math.sin(time * 0.65 + b.phase) * 1.8 * rect.scale;
      const angle = clamp(slopeVal * 0.0028, -0.026, 0.026);

      const bx = rect.offsetX + b.x * rect.drawW + curPx * 4.5 + swayX;
      const by = rect.offsetY + b.y * rect.drawH + curPy * 2.5 + heavePx;
      const bw = b.w * rect.drawW;
      const bh = b.h * rect.drawH;

      const pivotPxX = bx + bw * b.pivotX;
      const pivotPxY = by + bh * b.pivotY;

      // Soft warm waterline shadow anchoring hull smoothly into shimmering water
      ctx.save();
      ctx.translate(pivotPxX, pivotPxY + 3 * rect.scale - heavePx * 0.35);
      ctx.rotate(angle * 0.35);
      const grad = ctx.createRadialGradient(0, 0, bw * 0.05, 0, 0, bw * 0.44);
      grad.addColorStop(0, 'rgba(38, 22, 12, 0.30)');
      grad.addColorStop(0.65, 'rgba(48, 28, 14, 0.14)');
      grad.addColorStop(1, 'rgba(48, 28, 14, 0)');
      ctx.fillStyle = grad;
      ctx.scale(1, 0.16);
      ctx.beginPath();
      ctx.arc(0, 0, bw * 0.44, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Boat hull + canopy swaying around buoyancy pivot
      ctx.save();
      ctx.translate(pivotPxX, pivotPxY);
      ctx.rotate(angle);
      ctx.drawImage(img, -bw * b.pivotX, -bh * b.pivotY, bw, bh);
      ctx.restore();
    }

    // ---- Draw flying dusk flock with natural wingbeat + soar rhythm ----
    for (const bird of flock) {
      let u = bird.u + time * bird.speed;
      // Wrap continuously across sky margin [-0.08 .. 1.08]
      u = ((((u + 0.08) % 1.16) + 1.16) % 1.16) - 0.08;
      const thermalY = Math.sin(time * 0.48 + bird.seed * 1.7) * 0.008;
      const x = rect.offsetX + u * rect.drawW;
      const y = rect.offsetY + (bird.baseV + thermalY) * rect.drawH;

      // Alternate between natural wingbeats and outstretched glide
      const cyclePos = ((time + bird.seed * 1.3) % bird.cycleDuration) / bird.cycleDuration;
      let flapVal;
      if (cyclePos < bird.glideBias) {
        // Calm glide with subtle wind flex
        flapVal = -0.32 + Math.sin(time * 1.6 + bird.seed) * 0.12;
      } else {
        // Smooth asymmetric wingbeats (smooth transition out of glide)
        const beatPhase = (cyclePos - bird.glideBias) / (1 - bird.glideBias);
        const envelope = Math.sin(beatPhase * Math.PI);
        const beat = Math.sin(time * bird.flapRate + bird.seed * 2.1);
        flapVal = -0.25 + beat * 0.95 * (0.45 + 0.55 * envelope);
      }

      drawNaturalBird(
        ctx,
        x,
        y,
        bird.scale * rect.scale,
        flapVal,
        bird.dir,
        bird.alpha,
        curPx * 10 * bird.scale,
      );
    }
  }

  let startTime = 0;
  function tick(now) {
    if (destroyed) return;
    raf = requestAnimationFrame(tick);
    if (!startTime) startTime = now;
    renderFrame(now - startTime);
  }

  const startLoop = () => {
    if (destroyed || reducedMotion || raf || document.hidden) return;
    raf = requestAnimationFrame(tick);
  };
  const stopLoop = () => {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };

  const onPointerMove = (e) => {
    targetPx = (e.clientX / Math.max(1, innerWidth)) * 2 - 1;
    targetPy = (e.clientY / Math.max(1, innerHeight)) * 2 - 1;
  };
  const onVisChange = () => {
    if (document.hidden) stopLoop();
    else startLoop();
  };

  resize();
  addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', onVisChange);
  if (finePointer && !reducedMotion) {
    addEventListener('pointermove', onPointerMove, { passive: true });
  }

  Promise.all([
    loadImage('/images/landing/login-scene/login-backdrop.webp'),
    loadImage('/images/landing/login-scene/login-sky-mask.webp'),
    loadImage(sceneMeta.clouds.file),
    loadImage(sceneMeta.clouds.backFile),
    ...sceneMeta.boats.map((b) => loadImage(b.file)),
  ])
    .then(([bd, sm, cf, cb, ...boats]) => {
      if (destroyed) return;
      backdropImg = bd;
      skyMaskImg = sm;
      cloudsForeImg = cf;
      cloudsBackImg = cb;
      boatImgs = boats;
      glRunner = initWebGL(glCanvas, backdropImg, skyMaskImg, cloudsForeImg, cloudsBackImg);
      if (glRunner) {
        glCanvas.hidden = false;
      }
      fgCanvas.hidden = false;
      renderFrame(0);
      if (fallbackImg) {
        fallbackImg.classList.add('is-live');
      }
      startLoop();
    })
    .catch(() => {
      // Keep static hero-river <img> fallback intact on network/decode error
    });

  return () => {
    destroyed = true;
    stopLoop();
    removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', onVisChange);
    if (finePointer && !reducedMotion) {
      removeEventListener('pointermove', onPointerMove);
    }
    glRunner?.destroy();
  };
}
