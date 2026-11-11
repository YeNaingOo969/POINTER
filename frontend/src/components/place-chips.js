// Status chips for a place: category, open / closed now, rating.
// Shared by the explore place card and the place detail page.
import { t } from '../i18n/i18n.js';
import { openStatus, todaysHours } from '../lib/opening-hours.js';
import { number } from '../lib/format.js';

/** Fill `container` with chips; `className` is the chip class (tone modifiers are added to it). */
export function renderChips(container, place, className) {
  container.replaceChildren();
  const chip = (text, tone) => {
    const el = document.createElement('span');
    el.className = tone ? `${className} ${className}--${tone}` : className;
    el.textContent = text;
    container.append(el);
  };
  const status = openStatus(place.openingHours);
  if (status.state === 'open') chip(`${t('card.openNow')} · ${t('card.until')} ${status.until}`, 'open');
  else if (status.state === 'closed') {
    // Closed: opens later today, already closed for the day, or not open at all today.
    const text = status.next ? `${t('card.closed')} · ${t('card.opensAt')} ${status.next}`
      : todaysHours(place.openingHours) ? t('card.closedNow') : t('card.closedToday');
    chip(text, 'closed');
  }
  if (place.rating) chip(`★ ${place.rating.average.toFixed(1)} (${number(place.rating.count)})`);
}
