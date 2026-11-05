// Shared formatting for place data (place card, detail page). Times are shown in Yangon time.
import { getLang, t } from '../i18n/i18n.js';

/** Google Maps directions to a place (approved "Open in Google Maps" deep link). */
export const googleMapsUrl = ({ lat, lng }) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

/** "17:40" in Yangon time. */
export const timeInYangon = (iso) => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Yangon', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).format(new Date(iso));

/** "28 Oct 2026" in the UI language, Yangon date. */
export const dateInYangon = (iso) => new Intl.DateTimeFormat(getLang() === 'my' ? 'my-MM' : 'en-GB', {
  timeZone: 'Asia/Yangon', day: 'numeric', month: 'short', year: 'numeric',
}).format(new Date(iso));

/** Numbers in the UI language (Burmese digits in Burmese). */
export const number = (n) => new Intl.NumberFormat(getLang() === 'my' ? 'my-MM' : 'en-US').format(n);

/** "Locals Free · Visitors 10,000 MMK", or null when there is no fee info. */
export function fee(entryFee) {
  if (!entryFee) return null;
  const { local, foreigner, currency } = entryFee;
  const part = (amount) => (amount ? `${number(amount)} ${currency}` : t('card.free'));
  if (local === foreigner) return part(local);
  return `${t('card.local')} ${part(local)} · ${t('card.foreigner')} ${part(foreigner)}`;
}

/** "★★★★☆" for a 1–5 rating (rounded). */
export const stars = (rating) => '★★★★★'.slice(0, Math.round(rating)) + '☆☆☆☆☆'.slice(0, 5 - Math.round(rating));
