// Route panel inside the place card: choose a start (my location or another place) and a mode,
// then show distance, time and turn-by-turn steps; the line itself is drawn by route-layer.js.
import { getLang, localize, t } from '../i18n/i18n.js';
import { getRoute } from '../api/api.js';
import { MAX_BOUNDS } from '../map/config.js';

const MY_LOCATION = '__me';

function formatDistance(m) {
  return m < 1000 ? `${Math.round(m / 10) * 10} ${t('route.m')}` : `${(m / 1000).toFixed(1)} ${t('route.km')}`;
}

function formatDuration(s) {
  const min = Math.max(1, Math.round(s / 60));
  if (min < 60) return `${min} ${t('route.min')}`;
  return `${Math.floor(min / 60)} ${t('route.h')} ${min % 60} ${t('route.min')}`;
}

const insideYangon = ([lng, lat]) =>
  lng >= MAX_BOUNDS[0][0] && lng <= MAX_BOUNDS[1][0] && lat >= MAX_BOUNDS[0][1] && lat <= MAX_BOUNDS[1][1];

function myLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('unsupported'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve([pos.coords.longitude, pos.coords.latitude]),
      reject,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}

/**
 * @param {HTMLElement} root  the .route-panel element
 * @param {object[]} places   all places (start choices)
 * @param {{ onRoute(route): void, onClear(): void }} handlers
 */
export function createRoutePanel(root, places, { onRoute, onClear }) {
  const from = root.querySelector('.route-panel__from');
  const modes = [...root.querySelectorAll('.route-panel__mode')];
  const summary = root.querySelector('.route-panel__summary');
  const note = root.querySelector('.route-panel__note');
  const steps = root.querySelector('.route-panel__steps');
  let destination = null;
  let mode = 'walk';
  let lastRoute = null;
  let request = 0;

  function fillStarts() {
    const chosen = from.value;
    from.replaceChildren();
    const option = (value, label) => {
      const o = document.createElement('option');
      o.value = value;
      o.textContent = label;
      from.append(o);
    };
    option('', t('route.chooseStart'));
    option(MY_LOCATION, t('route.myLocation'));
    [...places]
      .filter((p) => p.slug !== destination?.slug)
      .sort((p, q) => localize(p.name).localeCompare(localize(q.name), getLang()))
      .forEach((p) => option(p.slug, localize(p.name)));
    from.value = [...from.options].some((o) => o.value === chosen) ? chosen : '';
  }

  function renderRoute() {
    const route = lastRoute;
    steps.replaceChildren();
    if (!route) return;
    summary.textContent = `${formatDuration(route.duration)} · ${formatDistance(route.distance)}`;
    note.textContent = route.source === 'preview' ? t('route.previewNote') : '';
    note.hidden = route.source !== 'preview';
    for (const step of route.steps) {
      const li = document.createElement('li');
      li.textContent = step.instruction;
      const d = document.createElement('span');
      d.className = 'route-panel__step-distance';
      d.textContent = step.distance ? formatDistance(step.distance) : '';
      li.append(d);
      steps.append(li);
    }
  }

  async function update() {
    const id = ++request;
    lastRoute = null;
    steps.replaceChildren();
    note.hidden = true;
    if (!destination || !from.value) {
      summary.textContent = '';
      onClear();
      return;
    }
    summary.textContent = t('route.finding');
    try {
      let start;
      if (from.value === MY_LOCATION) {
        start = await myLocation().catch(() => { throw new Error('location'); });
        if (!insideYangon(start)) throw new Error('outside');
      } else {
        const p = places.find((x) => x.slug === from.value);
        start = [p.location.lng, p.location.lat];
      }
      const end = [destination.location.lng, destination.location.lat];
      const route = await getRoute(start, end, mode);
      if (id !== request) return; // a newer request replaced this one
      lastRoute = route;
      renderRoute();
      onRoute(route);
    } catch (error) {
      if (id !== request) return;
      const key = { location: 'route.noLocation', outside: 'route.outside' }[error.message] ?? 'route.failed';
      summary.textContent = t(key);
      onClear();
    }
  }

  from.addEventListener('change', update);
  modes.forEach((button) => button.addEventListener('click', () => {
    mode = button.dataset.mode;
    modes.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    update();
  }));
  root.querySelector('.route-panel__clear').addEventListener('click', () => {
    from.value = '';
    update();
  });
  document.addEventListener('langchange', () => {
    fillStarts();
    renderRoute();
  });

  return {
    /** New destination: reset the panel (no route until a start is chosen). */
    setDestination(place) {
      destination = place;
      request++;
      lastRoute = null;
      fillStarts();
      from.value = '';
      summary.textContent = '';
      note.hidden = true;
      steps.replaceChildren();
    },
  };
}
