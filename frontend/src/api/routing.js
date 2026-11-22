// Route providers used by api.js. Pages never call these directly.
//
// Route = {
//   mode: 'walk' | 'car', source: 'ors' | 'osrm' | 'preview',
//   distance: metres, duration: seconds,
//   coordinates: [[lng, lat], …],
//   steps: [{ instruction, distance, duration }]   (empty for previews)
// }
import { ORS_API_KEY } from './config.js';

// HeiGIT's current host (api.openrouteservice.org is being shut down, autumn 2026).
const ORS_URL = 'https://api.heigit.org/openrouteservice/v2/directions';
const PROFILE = { walk: 'foot-walking', car: 'driving-car' };

// Keyless fallback: FOSSGIS's public OSRM instances. No key / .env needed, so a fresh clone gives
// every user real road routes. It is a small demo service, so ORS is preferred when a key exists.
const OSRM_URL = 'https://routing.openstreetmap.de/routed-{profile}/route/v1/driving';
const OSRM_PROFILE = { walk: 'foot', car: 'car' };

// Preview (no routing service): straight line × a typical street detour, at typical Yangon speeds.
const DETOUR = 1.35;
const PREVIEW_KMH = { walk: 4.5, car: 18 };

/** Great-circle distance in metres between two [lng, lat] points. */
function haversine([lng1, lat1], [lng2, lat2]) {
  const rad = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2
    + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

/** OpenRouteService directions (needs VITE_ORS_API_KEY in .env). */
export async function orsRoute(from, to, mode) {
  const res = await fetch(`${ORS_URL}/${PROFILE[mode]}/geojson`, {
    method: 'POST',
    headers: { Authorization: ORS_API_KEY, 'Content-Type': 'application/json', Accept: 'application/geo+json' },
    body: JSON.stringify({ coordinates: [from, to], instructions: true, language: 'en', units: 'm' }),
  });
  if (!res.ok) throw new Error(`Route request failed: ${res.status}`);
  const feature = (await res.json()).features[0];
  const { summary = {}, segments = [] } = feature.properties;
  return {
    mode,
    source: 'ors',
    distance: summary.distance ?? 0,
    duration: summary.duration ?? 0,
    coordinates: feature.geometry.coordinates,
    steps: segments.flatMap((s) => s.steps).map(({ instruction, distance, duration }) => ({ instruction, distance, duration })),
  };
}

/** Turn OSRM's maneuver codes into a readable instruction (same shape as ORS steps). */
function osrmInstruction({ name = '', maneuver = {} } = {}) {
  const { type = 'turn', modifier } = maneuver;
  const street = name ? ` onto ${name}` : '';
  switch (type) {
    case 'depart': return `Head ${modifier || 'out'}${street}`;
    case 'arrive': return 'Arrive at destination';
    case 'continue':
    case 'new name': return `Continue${street}`;
    case 'roundabout':
    case 'rotary': return `At the roundabout, take the exit${street}`;
    case 'on ramp': return `Take the ramp${street}`;
    case 'off ramp': return `Take the exit${street}`;
    case 'merge': return `Merge${street}`;
    case 'fork': return `Take the fork${street}`;
    case 'end of road': return modifier ? `At the end of the road, turn ${modifier}${street}` : `At the end of the road${street}`;
    case 'turn':
    default: return modifier ? `Turn ${modifier}${street}` : `Continue${street}`;
  }
}

/** Keyless OpenStreetMap road routing (public FOSSGIS OSRM, CORS enabled). */
export async function osrmRoute(from, to, mode) {
  const coords = `${from.join(',')};${to.join(',')}`;
  const url = `${OSRM_URL.replace('{profile}', OSRM_PROFILE[mode])}/${coords}`
    + '?overview=full&geometries=geojson&steps=true';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Route request failed: ${res.status}`);
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error('No route');
  const route = data.routes[0];
  return {
    mode,
    source: 'osrm',
    distance: route.distance,
    duration: route.duration,
    coordinates: route.geometry?.coordinates ?? [from, to],
    steps: (route.legs ?? []).flatMap((leg) => leg.steps ?? []).map((step) => ({
      instruction: osrmInstruction(step),
      distance: step.distance,
      duration: step.duration,
    })),
  };
}

/**
 * Road route for every user: ORS when a key is configured, otherwise (or if ORS fails) the
 * keyless OSRM service. Only when both are unreachable do we fall back to a straight-line preview.
 */
export async function getRoute(from, to, mode) {
  if (ORS_API_KEY) {
    try {
      return await orsRoute(from, to, mode);
    } catch (error) {
      console.warn('ORS routing failed, trying keyless OSRM:', error);
    }
  }
  try {
    return await osrmRoute(from, to, mode);
  } catch (error) {
    console.warn('Keyless routing failed, showing a preview:', error);
  }
  return previewRoute(from, to, mode);
}

/** Straight-line estimate, clearly marked as a preview in the UI. */
export function previewRoute(from, to, mode) {
  const distance = haversine(from, to) * DETOUR;
  return Promise.resolve({
    mode,
    source: 'preview',
    distance,
    duration: (distance / 1000 / PREVIEW_KMH[mode]) * 3600,
    coordinates: [from, to],
    steps: [],
  });
}
