// The ticket a customer shows at the counter (flowchart 2b): shop, offer, a big code, when it stops
// working (created_at + 2 h), a live Yangon clock so staff can see it isn't a screenshot, and links
// to the route and the shop. Used by Deals, Home and My account.
import { t } from '../i18n/i18n.js';
import { timeInYangon } from '../lib/format.js';
import { el, timeLeft } from '../lib/dom.js';

let dialog;
let clock = 0;

/**
 * @param {{ code: string, status: string, expiresAt: string }} ticket
 * @param {{ discountText: string, place: { id: number, name: string } }} post
 */
export function openTicket(ticket, post) {
  if (!dialog) {
    dialog = el('dialog', 'ticket-dialog');
    document.body.append(dialog);
    dialog.addEventListener('close', () => clearInterval(clock));
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  }
  const now = el('dd', null);
  const left = el('dd', null);
  const state = el('span', 'ticket__state', t(`ticket.${ticket.status}`));
  state.dataset.state = ticket.status;
  const close = el('button', 'app-button app-button--dark', t('ticket.close'));
  close.type = 'button';
  close.addEventListener('click', () => dialog.close());
  const route = el('a', 'app-button', t('deals.directions'));
  route.href = `/explore.html?place=${post.place.id}`;
  const shop = el('a', 'app-button', t('deals.openPlace'));
  shop.href = `/place.html?id=${post.place.id}`;

  const meta = el('dl', 'ticket__meta',
    el('div', null, el('dt', null, t('ticket.validUntil')), el('dd', null, timeInYangon(ticket.expiresAt))),
    el('div', null, el('dt', null, t('ticket.now')), now),
    el('div', null, el('dt', null, '⏱'), left));
  dialog.replaceChildren(el('div', 'ticket',
    el('p', 'ticket__label', `POINTER · ${t('ticket.title')}`),
    el('p', 'ticket__shop', post.place.name),
    el('p', 'ticket__offer', post.discountText),
    el('p', 'ticket__code', ticket.code),
    state,
    meta,
    el('p', 'ticket__note', t('ticket.note')),
    el('div', 'ticket__actions', route, shop, close)));

  const tick = () => {
    now.textContent = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Yangon', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date());
    left.textContent = ticket.status === 'active' ? (timeLeft(ticket.expiresAt) ?? t('ticket.expired')) : '—';
  };
  tick();
  clearInterval(clock);
  clock = setInterval(tick, 1000);
  dialog.showModal();
  close.focus();
}
