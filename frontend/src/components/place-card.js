// Place card: the quick summary shown when a place is picked on the map or in search.
// Desktop: a floating card at the bottom left. Phone: a bottom sheet (see place-card.css).
// Only team-independent fields for now; categories and moods come once the team agrees them.
import { getLang, localize, t } from '../i18n/i18n.js';
import { todaysHours } from '../lib/opening-hours.js';
import { fee, googleMapsUrl } from '../lib/format.js';
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
    const other = getLang() === 'my' ? place.name.en : place.name.my;
    $('.place-card__eyebrow').textContent = localize(place.township);
    $('.place-card__title').textContent = localize(place.name);
    $('.place-card__alt').textContent = other;
    $('.place-card__desc').textContent = localize(place.description);

    renderChips($('.place-card__chips'), place, 'place-card__chip');

    // Facts: hours today, entry, address.
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
    fact(t('card.entry'), fee(place.entryFee));
    fact(t('card.address'), localize(place.address));

    $('.place-card__directions').href = googleMapsUrl(place.location);
    $('.place-card__details').href = `/place.html?id=${encodeURIComponent(place.slug)}`;
  }

  function show(place) {
    current = place;
    render();
    root.hidden = false;
    root.dataset.slug = place.slug;
  }

  function hide() {
    if (!current) return;
    current = null;
    root.hidden = true;
    delete root.dataset.slug;
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
  document.addEventListener('langchange', render);

  return { show, hide, get place() { return current; } };
}
