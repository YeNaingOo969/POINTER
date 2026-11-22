// Entry script for explore.html: the pastel map with place bubbles, a category filter, search,
// place card and routes. 3D layer: Blender landmarks, the generated city (OSM footprints, loaded
// by tile near the view) and bus stop shelters.
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/components/brand.css';
import '../styles/components/map-ui.css';
import '../styles/components/place-search.css';
import '../styles/components/place-card.css';
import '../styles/components/app-nav.css';
import '../styles/pages/explore.css';
import { mountAppNav } from '../components/app-nav.js';
import { initI18n, t, categoryName } from '../i18n/i18n.js';
import { getPlaces, getCategories } from '../api/api.js';
import { createMap, moveCamera } from '../map/map.js';
import { addPlaceMarkers } from '../map/place-markers.js';
import { addLandmarkLayer } from '../map/landmarks-3d.js';
import { busShelters } from '../map/bus-shelters.js';
import { cityTiles } from '../map/city-tiles.js';
import { clouds } from '../map/clouds.js';
import { birds } from '../map/birds.js';
import { walkers } from '../map/walkers.js';
import { createPlaceSearch } from '../components/place-search.js';
import { createPlaceCard } from '../components/place-card.js';
import { createRoutePanel } from '../components/route-panel.js';
import { addRouteLayer } from '../map/route-layer.js';
import { addBusStops, clickedBusStop } from '../map/bus-stops.js';
import { addPoiLabels, clickedPoi } from '../map/poi-labels.js';

initI18n();
mountAppNav('map', { bottom: true });

const container = document.getElementById('map');
const status = document.querySelector('.explore-status');
const phone = window.matchMedia('(max-width: 640px)');

function showStatus(message) {
  status.textContent = message;
  status.hidden = !message;
}

container.addEventListener('map:contextlost', () => showStatus(t('explore.contextLost')));
container.addEventListener('map:contextrestored', () => showStatus(''));

/** Keep the picked place clear of the card: beside it on desktop, above it on phones. */
const cardPadding = () => (phone.matches
  ? { top: 220, bottom: Math.round(window.innerHeight * 0.62) + 24, left: 24, right: 24 } // top: room for the search bar, chips and a lifted bubble
  : { top: 80, bottom: 40, left: 380, right: 80 });

async function start() {
  try {
    const [map, places, categories] = await Promise.all([createMap(container), getPlaces(), getCategories()]);
    if (import.meta.env.DEV) window.__map = map; // for debugging in the browser console

    let search;
    const NO_PADDING = { top: 0, bottom: 0, left: 0, right: 0 };
    function closePlace() {
      markers.select(null);
      routeLayer.clear();
      card.hide();
      search.setValue(null);
      map.easeTo({ padding: NO_PADDING, duration: 300 });
    }
    const card = createPlaceCard(document.querySelector('.place-card'), { onClose: closePlace });

    function openPlace(place) {
      markers.select(place.id);
      routeLayer.clear();
      routePanel.setDestination(place);
      card.show(place);
      search.setValue(place);
      moveCamera(map, {
        center: [place.location.lng, place.location.lat],
        zoom: Math.max(map.getZoom(), 15.5),
        padding: cardPadding(),
      });
    }

    const markers = addPlaceMarkers(map, places, { onSelect: openPlace });
    search = createPlaceSearch(document.querySelector('.place-search'), places, { onPick: openPlace });
    // These add MapLibre layers, which need a loaded style. If tiles never arrive (timeout in
    // createMap), skip the decoration instead of taking the whole UI down with it.
    let routeLayer = { show() {}, clear() {} };
    try {
      // 3D landmarks (Blender models); bubbles of places on them float above their tops.
      addLandmarkLayer(map, { onLandmarks: (spots) => markers.liftAbove(spots), extras: [cityTiles, busShelters, clouds, birds, walkers] });
      addPoiLabels(map); // names of the city's shops, malls, hotels… (under the bus stops)
      addBusStops(map); // after the 3D landmarks, so the stops stay visible
      routeLayer = addRouteLayer(map); // after the 3D landmarks, so the line draws on top
    } catch (error) {
      console.warn('Map: decorative layers skipped (style not ready)', error);
    }
    createCategoryFilter(document.querySelector('.cat-filter'), categories, (group) => {
      markers.filter(group);
      if (card.place && group && card.place.category?.group !== group) closePlace();
    });
    // explore.html?group=food (from Home) starts with that group selected.
    const startGroup = new URLSearchParams(location.search).get('group');
    document.querySelector(`.cat-filter__chip[data-cat="${startGroup}"]`)?.click();
    const routePanel = createRoutePanel(document.querySelector('.route-panel'), places, {
      onRoute: (route) => routeLayer.show(route, cardPadding()),
      onClear: () => routeLayer.clear(),
    });
    map.on('click', (e) => { if (card.place && !clickedBusStop(map, e.point) && !clickedPoi(map, e.point)) closePlace(); });

    // explore.html?place=<id> (from the detail page's "View on the map") opens that place.
    const linked = places.find((p) => String(p.id) === new URLSearchParams(location.search).get('place'));
    if (linked) openPlace(linked);
  } catch (error) {
    console.error(error);
    showStatus(t('explore.loadFailed'));
  }
}

/** "All" + one chip per category group; `onChange(group | null)`. */
function createCategoryFilter(nav, categories, onChange) {
  for (const c of categories) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'cat-filter__chip';
    chip.dataset.cat = c.group;
    chip.setAttribute('aria-pressed', 'false');
    chip.textContent = categoryName(c);
    nav.append(chip);
  }
  nav.addEventListener('click', (e) => {
    const chip = e.target.closest('.cat-filter__chip');
    if (!chip) return;
    const group = chip.getAttribute('aria-pressed') === 'true' && chip.dataset.cat ? '' : chip.dataset.cat;
    nav.querySelectorAll('.cat-filter__chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.cat === group)));
    onChange(group || null);
  });
}

start();
