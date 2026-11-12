// Place card: the quick summary shown when a place is picked on the map or in search.
// Desktop: a floating card at the bottom left. Phone: a bottom sheet (see place-card.css).
// Shows only what the database stores: name, category, hours, rating, address, YBS lines, facilities.
import { t, categoryName } from '../i18n/i18n.js';
import { todaysHours } from '../lib/opening-hours.js';
import { googleMapsUrl } from '../lib/format.js';
import { renderChips } from './place-chips.js';

/**
 * @param {HTMLElement} root  the <section class="place-card"> element
 * @param {{ onClose?: () => void }} [options]
 */
export function createPlaceCard(root, { onClose } = {}) {
  let current = null;
  const $ = (sel) => root.querySelector(sel);

  function render() {
    const place = current;
    if (!place) return;
    $('.place-card__eyebrow').textContent = categoryName(place.category);
    $('.place-card__title').textContent = place.name;

    renderChips($('.place-card__chips'), place, 'place-card__chip');

    // Facts: hours today, address, bus lines, facilities (each only when known).
    const facts = $('.place-card__facts');
    facts.replaceChildren();
    const fact = (label, value) => {
      if (!value) return;
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = label;
      dd.textContent = value;
      facts.append(dt, dd);
    };
    fact(t('card.hoursToday'), todaysHours(place.openingHours) ?? (place.openingHours?.length ? t('card.closedToday') : null));
    fact(t('card.address'), place.address);
    fact(t('card.ybsLines'), place.ybsLines?.join(', '));
    fact(t('card.facilities'), place.facilities?.join(' · '));

    $('.place-card__directions').href = googleMapsUrl(place.location);
    $('.place-card__details').href = `/place.html?id=${place.id}`;
  }

  function show(place) {
    current = place;
    render();
    root.hidden = false;
    root.dataset.id = place.id;
  }

  function hide() {
    if (!current) return;
    current = null;
    root.hidden = true;
    delete root.dataset.id;
  }

  $('.place-card__close').addEventListener('click', () => {
    hide();
    onClose?.();
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hide();
      onClose?.();
    }
  });

  return { show, hide, get place() { return current; } };
}
