// Route line on the map: white casing + gold line (dashed for straight-line previews), with
// A (start) and B (destination) markers. Drawn above the 3D city so it is never hidden.
import { maplibregl } from './map.js';

const SOURCE = 'route';
const OVERVIEW_PITCH = 20;
const EMPTY = { type: 'FeatureCollection', features: [] };
const width = (pairs) => ['interpolate', ['exponential', 1.5], ['zoom'], ...pairs.flat()];

function endMarker(label) {
  const el = document.createElement('div');
  el.className = `route-end route-end--${label.toLowerCase()}`;
  el.textContent = label;
  el.setAttribute('aria-hidden', 'true');
  return new maplibregl.Marker({ element: el, anchor: 'center' });
}

export function addRouteLayer(map) {
  const firstLabel = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
  map.addSource(SOURCE, { type: 'geojson', data: EMPTY });
  const lineLayout = { 'line-cap': 'round', 'line-join': 'round' };
  map.addLayer({
    id: 'route-casing', type: 'line', source: SOURCE, layout: lineLayout,
    paint: { 'line-color': '#ffffff', 'line-width': width([[11, 5], [15, 11], [18, 22]]), 'line-opacity': 0.95 },
  }, firstLabel);
  map.addLayer({
    id: 'route-line', type: 'line', source: SOURCE, layout: lineLayout,
    filter: ['!=', ['get', 'source'], 'preview'],
    paint: { 'line-color': '#e8b04a', 'line-width': width([[11, 3], [15, 7], [18, 15]]) },
  }, firstLabel);
  map.addLayer({
    id: 'route-preview', type: 'line', source: SOURCE, layout: { 'line-join': 'round' },
    filter: ['==', ['get', 'source'], 'preview'],
    paint: { 'line-color': '#e8b04a', 'line-width': width([[11, 3], [15, 7], [18, 15]]), 'line-dasharray': [1.2, 1.2] },
  }, firstLabel);

  const a = endMarker('A');
  const b = endMarker('B');

  return {
    /** Draw a route and fit the camera to it, keeping `padding` clear (the card). */
    show(route, padding) {
      map.getSource(SOURCE).setData({
        type: 'Feature',
        properties: { source: route.source },
        geometry: { type: 'LineString', coordinates: route.coordinates },
      });
      const first = route.coordinates[0];
      const last = route.coordinates[route.coordinates.length - 1];
      a.setLngLat(first).addTo(map);
      b.setLngLat(last).addTo(map);
      const bounds = route.coordinates.reduce((bb, c) => bb.extend(c), new maplibregl.LngLatBounds(first, first));
      // cameraForBounds adds the map's own padding to the one given, so set the card padding on
      // the map first and only ask for a small margin on top of it. A tilted view crops the far
      // end, so the overview looks down more steeply (like Google Maps' route overview).
      map.setPadding(padding);
      const camera = map.cameraForBounds(bounds, { padding: 36, maxZoom: 16.5, bearing: map.getBearing() });
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (camera) map.easeTo({ ...camera, pitch: OVERVIEW_PITCH, duration: reduce ? 0 : 900 });
    },
    clear() {
      map.getSource(SOURCE)?.setData(EMPTY);
      a.remove();
      b.remove();
    },
  };
}
