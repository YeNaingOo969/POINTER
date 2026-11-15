// Names of the city's shops, malls, hotels, hospitals, temples, schools, banks… — every named point
// of interest in the OpenStreetMap tiles (OpenMapTiles `poi` layer), so the map reads like a real
// city map and not only our listed places. A small dot coloured by kind plus the English name
// (map labels can't shape Burmese); a click shows both names. Important ones (low `rank`) win when
// labels collide. Our own place bubbles are HTML markers and always stay on top.
import { maplibregl } from './map.js';
import { t } from '../i18n/i18n.js';

const MIN_ZOOM = 15;
const englishName = ['coalesce', ['get', 'name:en'], ['get', 'name_en'], ['get', 'name:latin'], ''];
// Bus stops have their own layer (bus-stops.js); unnamed points are skipped.
const filter = ['all', ['!=', ['get', 'class'], 'bus'], ['!=', englishName, '']];
const colour = ['match', ['get', 'class'],
  ['restaurant', 'fast_food', 'cafe', 'bar', 'beer', 'ice_cream', 'bakery'], '#d9773a',
  ['shop', 'grocery', 'clothing_store', 'shoe', 'jewelry', 'mobile_phone', 'hardware', 'furniture', 'department_store', 'alcohol_shop'], '#c4558a',
  ['lodging'], '#4f78c4',
  ['hospital', 'doctors', 'dentist', 'pharmacy'], '#3e9a6e',
  ['place_of_worship'], '#a87a1e',
  ['school', 'college', 'library', 'kindergarten', 'university'], '#7d63b8',
  '#6f7480'];

export function addPoiLabels(map) {
  const firstLabel = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
  map.addLayer({
    id: 'poi-dot', type: 'circle', source: 'omt', 'source-layer': 'poi', filter, minzoom: MIN_ZOOM,
    paint: {
      'circle-color': colour,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 15, 2.5, 18, 5],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 1.2,
      'circle-pitch-alignment': 'viewport',
    },
  }, firstLabel);
  map.addLayer({
    id: 'poi-label', type: 'symbol', source: 'omt', 'source-layer': 'poi', filter, minzoom: MIN_ZOOM,
    layout: {
      'text-field': englishName,
      'text-font': ['Noto Sans Regular'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 15, 10, 18, 12.5],
      'text-max-width': 8,
      'text-offset': [0, 0.7],
      'text-anchor': 'top',
      'symbol-sort-key': ['coalesce', ['get', 'rank'], 99],
    },
    paint: { 'text-color': colour, 'text-halo-color': '#ffffff', 'text-halo-width': 1.4 },
  }, firstLabel);

  const popup = new maplibregl.Popup({ closeButton: true, offset: 8, className: 'bus-popup', maxWidth: '260px' });
  map.on('click', 'poi-dot', (e) => {
    const f = e.features[0];
    const my = f.properties.name || '';
    const en = f.properties['name:en'] || f.properties.name_en || f.properties['name:latin'] || '';
    const el = document.createElement('div');
    el.innerHTML = '<p class="bus-popup__kind"></p><p class="bus-popup__name"></p><p class="bus-popup__alt"></p>';
    el.querySelector('.bus-popup__kind').textContent = t('map.poi');
    el.querySelector('.bus-popup__name').textContent = en || my;
    el.querySelector('.bus-popup__alt').textContent = my !== (en || my) ? my : '';
    popup.setLngLat(f.geometry.coordinates).setDOMContent(el).addTo(map);
  });
  map.on('mouseenter', 'poi-dot', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'poi-dot', () => { map.getCanvas().style.cursor = ''; });
}

/** True when a map click landed on a point of interest (pages use it to keep their own UI open). */
export const clickedPoi = (map, point) => map.queryRenderedFeatures(point, { layers: ['poi-dot'] }).length > 0;
