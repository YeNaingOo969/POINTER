// Route providers used by api.js. Pages never call these directly.
//
// Route = {
//   mode: 'walk' | 'car', source: 'ors' | 'preview',
//   distance: metres, duration: seconds,
//   coordinates: [[lng, lat], …],
//   steps: [{ instruction, distance, duration }]   (empty for previews)
// }
import { ORS_API_KEY } from './config.js';

// HeiGIT's current host (api.openrouteservice.org is being shut down, autumn 2026).
const ORS_URL = 'https://api.heigit.org/openrouteservice/v2/directions';
const PROFILE = { walk: 'foot-walking', car: 'driving-car' };

// Preview (no routing key): straight line × a typical street detour, at typical Yangon speeds.
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
