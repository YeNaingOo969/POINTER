// Place search: an accessible combobox over the places already loaded for the map.
// Matches English and Burmese names, township and address. The list is small, so it filters in
// the browser; a PHP `places.php?q=` endpoint can replace this later without changing the UI.
import { localize, t } from '../i18n/i18n.js';

const MAX_RESULTS = 8;

/** Lower-case, accent-free text for matching ("Shwedagon" ~ "shwedagon"). */
const normal = (s) => (s ?? '').toString().normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();

function haystack(place) {
  return normal([place.name.en, place.name.my, place.township?.en, place.township?.my,
    place.address?.en, place.address?.my, ...(place.tags ?? [])].join(' '));
}

/** Best matches first: name starts with the query, then a word in it does, then anywhere. */
export function searchPlaces(places, query) {
  const q = normal(query).trim();
  if (!q) return [];
  return places
    .map((place) => {
      const names = [normal(place.name.en), normal(place.name.my)];
      let score = -1;
      if (names.some((n) => n.startsWith(q))) score = 3;
      else if (names.some((n) => n.split(/\s+/).some((w) => w.startsWith(q)))) score = 2;
      else if (haystack(place).includes(q)) score = 1;
      return { place, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || Number(b.place.isFeatured) - Number(a.place.isFeatured))
    .slice(0, MAX_RESULTS)
    .map((r) => r.place);
}

/**
 * Wire a search box: `form` holds an <input role="combobox"> and a <ul role="listbox">.
 * `onPick(place)` runs when a result is chosen (click, Enter).
 */
export function createPlaceSearch(form, places, { onPick }) {
  const input = form.querySelector('[role="combobox"]');
  const list = form.querySelector('[role="listbox"]');
  let results = [];
  let active = -1;

  function close() {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  }

  function render() {
    list.replaceChildren();
    if (!input.value.trim()) return close();
    if (!results.length) {
      const li = document.createElement('li');
      li.className = 'place-search__empty';
      li.textContent = t('search.noResults');
      list.append(li);
    }
    results.forEach((place, i) => {
      const li = document.createElement('li');
      li.id = `place-search-option-${i}`;
      li.className = 'place-search__option';
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(i === active));
      li.dataset.crowd = place.crowd?.level ?? 'unknown';
      const other = localize(place.name) === place.name.en ? place.name.my : place.name.en;
      li.innerHTML = `
        <span class="place-search__dot" aria-hidden="true"></span>
        <span class="place-search__text">
          <span class="place-search__name"></span>
          <span class="place-search__meta"></span>
        </span>`;
      li.querySelector('.place-search__name').textContent = localize(place.name);
      li.querySelector('.place-search__meta').textContent = [other, localize(place.township)].filter(Boolean).join(' · ');
      li.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus in the input
      li.addEventListener('click', () => pick(place));
      list.append(li);
    });
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    if (active >= 0) input.setAttribute('aria-activedescendant', `place-search-option-${active}`);
    else input.removeAttribute('aria-activedescendant');
  }

  function pick(place) {
    input.value = localize(place.name);
    close();
    input.blur();
    onPick(place);
  }

  input.addEventListener('input', () => {
    results = searchPlaces(places, input.value);
    active = results.length ? 0 : -1;
    render();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!results.length) return;
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
      render();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[active]) pick(results[active]);
    } else if (e.key === 'Escape') {
      if (!list.hidden) close();
      else input.value = '';
    }
  });
  input.addEventListener('focus', () => { if (input.value.trim()) render(); });
  input.addEventListener('blur', close);
  form.addEventListener('submit', (e) => e.preventDefault());
  document.addEventListener('langchange', () => { if (!list.hidden) render(); });

  return {
    /** Show a place's name in the box (e.g. after picking a pin on the map). */
    setValue(place) {
      input.value = place ? localize(place.name) : '';
    },
  };
}
