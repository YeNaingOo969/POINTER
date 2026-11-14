// Entry script for deals.html (flowchart 2b): every active discount post, sorted by "ending soon"
// or "newest" and filtered by category group. A visitor who taps "Get a ticket" is asked to log
// in; a user gets a ticket (one per deal, two hours) and can show it any time.
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/components/brand.css';
import '../styles/components/app-top.css';
import '../styles/components/app-nav.css';
import '../styles/components/login-dialog.css';
import '../styles/pages/app.css';
import { initI18n, t, categoryName } from '../i18n/i18n.js';
import { getDeals, getCategories, getMyTicket, takeTicket } from '../api/api.js';
import { USE_MOCK } from '../api/config.js';
import { mountAppNav } from '../components/app-nav.js';
import { askToLogin } from '../components/login-dialog.js';
import { openTicket } from '../components/ticket-dialog.js';
import { el, toast, timeLeft } from '../lib/dom.js';
import { number } from '../lib/format.js';
import { revealList } from '../lib/reveal.js';

initI18n();
mountAppNav('deals');

const $ = (sel) => document.querySelector(sel);
const state = { sort: 'ending', group: null };
const highlight = Number(new URLSearchParams(location.search).get('post')) || null;

/** Get or show this deal's ticket; visitors log in first. */
async function ticketFor(deal, button) {
  button.disabled = true;
  try {
    let ticket = await getMyTicket(deal.id);
    if (!ticket) ticket = await takeTicket(deal.id);
    openTicket(ticket, deal);
    button.textContent = t('deals.show');
  } catch (error) {
    if (error.status === 401) {
      if (await askToLogin()) return ticketFor(deal, button);
    } else if (error.status === 410) {
      toast(t('ticket.endedErr'));
      load();
    } else {
      console.error(error);
      toast(t('deals.loadFailed'));
    }
  } finally {
    button.disabled = false;
  }
}

function dealCard(deal) {
  const li = el('li', 'deal-card');
  li.dataset.cat = deal.place.category?.group ?? 'other';
  if (deal.id === highlight) li.classList.add('is-highlight');
  const shop = el('a', null, deal.place.name);
  shop.href = `/place.html?id=${deal.place.id}`;
  const used = deal.ticketsTaken / (deal.ticketsTaken + deal.ticketsLeft);
  const bar = el('div', 'deal-card__bar', el('i', null));
  bar.firstChild.style.width = `${Math.round(used * 100)}%`;
  const ends = el('span', null);
  ends.append(t('deals.endsIn').split('{t}')[0], el('b', null, timeLeft(deal.expiresAt) ?? ''), t('deals.endsIn').split('{t}')[1] ?? '');
  const get = el('button', 'app-button app-button--gold', t('deals.get'));
  get.type = 'button';
  get.addEventListener('click', () => ticketFor(deal, get));
  getMyTicket(deal.id).then((ticket) => { if (ticket) get.textContent = t('deals.show'); }).catch(() => {});
  const route = el('a', 'app-button', t('deals.directions'));
  route.href = `/explore.html?place=${deal.place.id}`;
  li.append(
    el('p', 'deal-card__shop', shop, ' · ', categoryName(deal.place.category)),
    el('p', 'deal-card__offer', deal.discountText),
    el('p', 'deal-card__text', deal.content),
    el('p', 'deal-card__meta', ends, el('span', null, t('deals.left').replace('{n}', number(deal.ticketsLeft)))),
    bar,
    el('div', 'deal-card__actions', get, route));
  return li;
}

async function load() {
  try {
    const deals = await getDeals(state);
    $('.deal-grid').replaceChildren(...deals.map(dealCard));
    $('.deals-empty').hidden = deals.length > 0;
    revealList([...document.querySelectorAll('.deal-card')]);
    if (highlight) document.querySelector('.deal-card.is-highlight')?.scrollIntoView({ block: 'center' });
  } catch (error) {
    console.error(error);
    $('.deals-empty').hidden = false;
    $('.deals-empty').textContent = t('deals.loadFailed');
  }
}

function chip(label, pressed, onClick, cat) {
  const b = el('button', 'app-chip', label);
  b.type = 'button';
  b.setAttribute('aria-pressed', String(pressed));
  if (cat) b.dataset.cat = cat;
  b.addEventListener('click', onClick);
  return b;
}

async function start() {
  $('.app-demo').hidden = !USE_MOCK;
  const sortBox = $('.deals-sort');
  const renderSort = () => sortBox.replaceChildren(
    chip(t('deals.ending'), state.sort === 'ending', () => { state.sort = 'ending'; renderSort(); load(); }),
    chip(t('deals.newest'), state.sort === 'newest', () => { state.sort = 'newest'; renderSort(); load(); }));
  renderSort();
  const categories = await getCategories();
  const groupBox = $('.deals-groups');
  const renderGroups = () => groupBox.replaceChildren(
    chip(t('deals.all'), !state.group, () => { state.group = null; renderGroups(); load(); }),
    ...categories.map((c) => chip(categoryName(c), state.group === c.group, () => { state.group = c.group; renderGroups(); load(); }, c.group)));
  renderGroups();
  await load();
}

start();
