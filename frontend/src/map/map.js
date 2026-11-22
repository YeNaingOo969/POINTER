// Create the Explore map. Everything map-wide (style, camera limits, controls, GPU care)
// lives here so pages only call createMap().
import * as maplibregl from 'maplibre-gl'; // v6 is ESM-only, no default export
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre 6 builds its worker URL at runtime, which the bundler can't see, so the worker
// would be missing from production builds. Import it as an asset and hand MapLibre the URL.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

maplibregl.setWorkerUrl(workerUrl);
import { buildMapStyle } from './style.js';
import {
  START_VIEW, MAX_BOUNDS, MIN_ZOOM, MAX_ZOOM, MAX_PITCH, MAX_PIXEL_RATIO,
} from './config.js';

export const prefersReducedMotion =() => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Move the camera; jumps instead of flying when the user prefers reduced motion. */
export function moveCamera(map, view) {
  if (prefersReducedMotion()) map.jumpTo(view);
  else map.flyTo({ ...view, speed: 0.9, curve: 1.3, essential: true });
}

/**
 * Create the pastel map inside `container`.
 * Resolves once the style has loaded, so callers can add layers and markers right away.
 */
export function createMap(container) {
  const map = new maplibregl.Map({
    container,
    style: buildMapStyle(),
    ...START_VIEW,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    maxPitch: MAX_PITCH,
    maxBounds: MAX_BOUNDS,
    pixelRatio: Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO),
    antialias: false, // MSAA is expensive on integrated GPUs; the pastel style hides jaggies
    fadeDuration: prefersReducedMotion() ? 0 : 200,
    attributionControl: { compact: true },
    dragRotate: true,
    pitchWithRotate: true,
  });

  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');

  // Phones: start with the map credits folded into the (i) button. Open, they cover the zoom
  // buttons and the bottom of the map; one tap on (i) shows them.
  if (window.matchMedia('(max-width: 640px)').matches) {
    map.once('load', () => {
      const credits = container.querySelector('.maplibregl-ctrl-attrib');
      credits?.classList.remove('maplibregl-compact-show');
      credits?.removeAttribute('open');
    });
  }

  // If the GPU drops the context (sleep, driver reset), tell the user instead of freezing.
  const canvas = map.getCanvas();
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    container.dispatchEvent(new CustomEvent('map:contextlost', { bubbles: true }));
  });
  canvas.addEventListener('webglcontextrestored', () => {
    container.dispatchEvent(new CustomEvent('map:contextrestored', { bubbles: true }));
  });

  // The UI must never depend on tiles finishing: slow/blocked tile servers, a GPU context
  // reset or a style that never fires 'load' would otherwise freeze the whole page in
  // Promise.all (see explore.js). Resolve on 'load', but fall back to a short timeout.
  return new Promise((resolve) => {
    let settled = false;
    const finish = (reason) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (reason) console.warn('Map: continuing without a full tile load', reason);
      resolve(map);
    };
    const timer = setTimeout(() => finish('load timed out'), 4000);
    map.once('load', () => finish());
    map.once('error', (e) => {
      if (!map.loaded()) finish(e.error ?? e);
    });
  });
}

export { maplibregl };
