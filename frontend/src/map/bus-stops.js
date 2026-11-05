// YBS (Yangon Bus Service) stops from OpenStreetMap (OpenMapTiles `poi` layer, class "bus"):
// small blue dots from zoom 15, English names from 16.5 (map labels can't shape Burmese), and a
// popup with both names on click. Added at runtime after the 3D city so the dots stay on top.
// Bus routes per stop are not in the tiles; they would need YBS route data later.
import { maplibregl } from './map.js';
import { getLang, t } from '../i18n/i18n.js';

const MIN_ZOOM = 15;
const BUS_BLUE = '#2f6fb7';
const filter = ['==', ['get', 'class'], 'bus'];
const englishName = ['coalesce', ['get', 'name:en'], ['get', 'name_en'], ['get', 'name:latin'], ''];

/** True when a map click landed on a bus stop (pages use it to keep their own UI open). */
export const clickedBusStop = (map, point) => map.queryRenderedFeatures(point, { layers: ['bus-stop'] }).length > 0;

export function addBusStops(map) {
  const firstLabel = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
  map.addLayer({
    id: 'bus-stop', type: 'circle', source: 'omt', 'source-layer': 'poi', filter, minzoom: MIN_ZOOM,
    paint: {
      'circle-color': BUS_BLUE,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 15, 4, 17, 7, 18.5, 10],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 15, 1.5, 18, 3],
      'circle-pitch-alignment': 'viewport', // stays round on a tilted map
    },
  }, firstLabel);
  map.addLayer({
    // A layer minzoom above 15 drops these labels (the tiles stop at z14), so the layer starts at 15
    // and the text only gets a size from 16.5.
    id: 'bus-stop-label', type: 'symbol', source: 'omt', 'source-layer': 'poi', filter, minzoom: MIN_ZOOM,
    layout: {
      'text-field': englishName,
      'text-font': ['Noto Sans Regular'],
      'text-size': ['step', ['zoom'], 0, 16.5, 11],
      'text-offset': [0, 1.1],
      'text-anchor': 'top',
      'text-optional': true,
    },
    paint: { 'text-color': BUS_BLUE, 'text-halo-color': '#ffffff', 'text-halo-width': 1.4 },
  });

  const popup = new maplibregl.Popup({ closeButton: true, offset: 10, className: 'bus-popup', maxWidth: '260px' });
  map.on('click', 'bus-stop', (e) => {
    const f = e.features[0];
    const my = f.properties.name || '';
    const en = f.properties['name:en'] || f.properties.name_en || '';
    const [first, second] = getLang() === 'my' ? [my || en, en] : [en || my, my];
    const el = document.createElement('div');
    el.innerHTML = '<p class="bus-popup__kind"></p><p class="bus-popup__name"></p><p class="bus-popup__alt"></p>';
    el.querySelector('.bus-popup__kind').textContent = t('bus.stop');
    el.querySelector('.bus-popup__name').textContent = first;
    el.querySelector('.bus-popup__alt').textContent = second !== first ? second : '';
    popup.setLngLat(f.geometry.coordinates).setDOMContent(el).addTo(map);
  });
  map.on('mouseenter', 'bus-stop', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'bus-stop', () => { map.getCanvas().style.cursor = ''; });
}
