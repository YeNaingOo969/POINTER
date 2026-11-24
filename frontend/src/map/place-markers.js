// Place markers: HTML speech-bubble pins on the map (HTML, so any script in a name renders
// correctly). The line under the name says whether the place is open now.
import { maplibregl } from './map.js';
import { t } from '../i18n/i18n.js';
import { openStatus } from '../lib/opening-hours.js';
import { isFeatured } from '../lib/featured.js';

// Below this zoom, non-featured places show as dots only.
const NAMES_ZOOM = 14.8;
const EARTH_CIRCUMFERENCE_M = 40075016.686;

/** Build the marker element for one place. */
function markerElement(place) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = isFeatured(place) ? 'place-pin is-featured' : 'place-pin';
  el.dataset.id = place.id;
  el.dataset.open = openStatus(place.openingHours).state;
  el.dataset.cat = place.category?.group ?? 'other';
  el.innerHTML = `
    <span class="place-pin__bubble">
      <span class="place-pin__dot" aria-hidden="true"></span>
      <span class="place-pin__text">
        <span class="place-pin__name"></span>
        <span class="place-pin__meta"></span>
      </span>
    </span>
    <span class="place-pin__ring" aria-hidden="true"></span>`;
  return el;
}

/** Name, plus "Open now" / "Closed" (nothing when the hours are unknown). */
function renderTexts(el, place) {
  const { state } = openStatus(place.openingHours);
  const status = state === 'open' ? t('card.openNow') : state === 'closed' ? t('card.closed') : '';
  el.querySelector('.place-pin__name').textContent = place.name;
  el.querySelector('.place-pin__meta').textContent = status;
  el.setAttribute('aria-label', status ? `${place.name} — ${status}` : place.name);
}

/**
 * Add a marker per place. `onSelect(place)` runs when one is clicked.
 * Returns { select(id), filter(categoryIcon | null), liftAbove(spots), remove() }.
 */
export function addPlaceMarkers(map, places, { onSelect } = {}) {
  const entries = places.map((place, i) => {
    const el = markerElement(place);
    el.style.setProperty('--i', String(i)); // staggers the pop-in
    renderTexts(el, place);
    el.addEventListener('click', (event) => {
      event.stopPropagation();
      onSelect?.(place);
    });
    const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([place.location.lng, place.location.lat])
      .addTo(map);
    return { place, el, marker };
  });

  // HTML markers don't get MapLibre's label collision, so two bubbles can overlap when places sit
  // close together. After each camera move, keep the highest-priority bubbles (selected, featured,
  // open) and shrink the rest to their dot; hover/focus still opens the full bubble.
  const COLLIDE_MARGIN = 4;
  const intersects = (a, b) => a.left < b.right + COLLIDE_MARGIN && a.right + COLLIDE_MARGIN > b.left
    && a.top < b.bottom + COLLIDE_MARGIN && a.bottom + COLLIDE_MARGIN > b.top;
  const priority = ({ el }) => (el.classList.contains('is-selected') ? 0
    : el.classList.contains('is-featured') ? 1
      : el.dataset.open === 'open' ? 2 : 3);
  const hasText = (el) => getComputedStyle(el.querySelector('.place-pin__text')).display !== 'none';
  let declutterFrame = 0;
  function declutter() {
    const live = entries.filter(({ el }) => !el.hidden && el.offsetParent !== null);
    // Measure the full bubbles first; a previous pass may have shrunk some of them.
    live.forEach(({ el }) => el.classList.remove('is-collided', 'is-collided-dot'));
    const items = live
      .filter(({ el }) => hasText(el))
      .map(({ el }) => ({ el, rect: el.querySelector('.place-pin__bubble').getBoundingClientRect(), rank: priority({ el }) }))
      .sort((a, b) => a.rank - b.rank);
    const kept = [];
    for (const item of items) {
      if (kept.some((rect) => intersects(rect, item.rect))) {
        item.el.classList.add('is-collided');
        // A dot is much narrower than a named bubble; keep it only when it no longer collides.
        // A dot still covered by a kept bubble is hidden: it would only look like a dead target.
        const dot = item.el.querySelector('.place-pin__bubble').getBoundingClientRect();
        if (kept.some((rect) => intersects(rect, dot))) item.el.classList.add('is-collided-dot');
        else kept.push(dot);
      } else {
        kept.push(item.rect);
      }
    }
  }
  function scheduleDeclutter() {
    if (declutterFrame) return;
    declutterFrame = requestAnimationFrame(() => {
      declutterFrame = 0;
      declutter();
    });
  }

  // Zoomed out, only featured places show their names (the rest become dots) to avoid a pile
  // of overlapping bubbles downtown.
  const container = map.getContainer();
  const onZoom = () => container.classList.toggle('is-zoomed-out', map.getZoom() < NAMES_ZOOM);
  map.on('zoom', onZoom);
  map.on('moveend', scheduleDeclutter);
  map.on('resize', scheduleDeclutter);
  onZoom();
  scheduleDeclutter();

  // Places standing on a 3D landmark float their bubble above its top instead of covering it.
  const lifted = [];
  const onLiftView = () => {
    const zoom = map.getZoom();
    const tilt = Math.sin((map.getPitch() * Math.PI) / 180);
    for (const { marker, place, spot } of lifted) {
      const metresPerPixel = (EARTH_CIRCUMFERENCE_M * Math.cos((place.location.lat * Math.PI) / 180)) / (512 * 2 ** zoom);
      const px = zoom >= spot.minZoom ? (spot.height / metresPerPixel) * tilt : 0;
      marker.setOffset([0, -Math.round(px)]);
    }
  };

  return {
    select(id) {
      entries.forEach(({ el, place }) => el.classList.toggle('is-selected', place.id === id));
      scheduleDeclutter();
    },
    /** Show only one category group (its `group` key, e.g. 'food'); null shows every place. */
    filter(group) {
      entries.forEach(({ el, place }, i) => {
        const show = !group || (place.category?.group ?? 'other') === group;
        clearTimeout(el.hideTimer);
        el.style.setProperty('--i', String(i % 12));
        if (show) {
          el.hidden = false;
          requestAnimationFrame(() => el.classList.remove('is-out'));
        } else {
          el.classList.add('is-out'); // shrink first, then leave the tab order
          el.hideTimer = setTimeout(() => {
            el.hidden = true;
            scheduleDeclutter();
          }, 260);
        }
      });
      scheduleDeclutter();
    },
    /** `spots`: [{ lng, lat, radius (m), height (m), minZoom }] of landmarks drawn on the map. */
    liftAbove(spots) {
      lifted.length = 0;
      for (const entry of entries) {
        const { lat, lng } = entry.place.location;
        const kx = 111320 * Math.cos((lat * Math.PI) / 180);
        const spot = spots.find((s) => Math.hypot((s.lng - lng) * kx, (s.lat - lat) * 110574) <= s.radius);
        if (spot) lifted.push({ ...entry, spot });
      }
      map.on('zoom', onLiftView);
      map.on('pitch', onLiftView);
      onLiftView();
      scheduleDeclutter();
    },
    remove() {
      cancelAnimationFrame(declutterFrame);
      map.off('zoom', onZoom);
      map.off('moveend', scheduleDeclutter);
      map.off('resize', scheduleDeclutter);
      map.off('zoom', onLiftView);
      map.off('pitch', onLiftView);
      entries.forEach(({ marker }) => marker.remove());
    },
  };
}
