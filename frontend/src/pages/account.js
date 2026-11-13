// Entry script for account.html (My account): the logged-in user's saved places, reviews and their
// business (request status, or a link to add one). Deal tickets join in phase 2.
// Visitors get a "log in" message instead.
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/components/brand.css';
import '../styles/components/app-top.css';
import '../styles/pages/account.css';
import { initI18n, t, categoryName } from '../i18n/i18n.js';
import { getSession, getMySaves, getMyReviews, getMyBusinessRequest, setSaved, deleteReview, logout } from '../api/api.js';
import { USE_MOCK } from '../api/config.js';
import { dateInYangon, number, stars } from '../lib/format.js';
import { reveal, revealList, countUp } from '../lib/reveal.js';

initI18n();

const $ = (sel) => document.querySelector(sel);
const data = { saves: [], reviews: [], business: null };

let toastTimer = 0;
function toast(message) {
  const el = $('.account-toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
}

const placeLink = (place) => `/place.html?id=${place.id}`;

/** Build an element from a tag, class and children (text is always set as text, never HTML). */
function el(tag, className, ...children) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.append(...children.filter((c) => c != null));
  return node;
}

// ---- Rendering ----

function renderStats() {
  const counts = { saved: data.saves.length, reviews: data.reviews.length };
  for (const n of document.querySelectorAll('[data-stat]')) {
    if (n.dataset.counted) n.textContent = number(counts[n.dataset.stat]);
    else { n.dataset.counted = '1'; countUp(n, counts[n.dataset.stat]); }
  }
  for (const p of document.querySelectorAll('[data-empty]')) p.hidden = counts[p.dataset.empty] > 0;
}

function renderSaves() {
  $('.account-places').replaceChildren(...data.saves.map(({ place }) => {
    const unsave = el('button', 'account-chip-button', t('account.unsave'));
    unsave.type = 'button';
    unsave.addEventListener('click', async () => {
      unsave.disabled = true;
      await setSaved(place.id, false);
      data.saves = data.saves.filter((s) => s.place.id !== place.id);
      renderSaves();
      renderStats();
      toast(t('place.unsavedToast'));
    });
    const link = el('a', 'account-place__link', el('span', 'account-place__name', place.name), el('span', 'account-place__town', categoryName(place.category) || place.address));
    link.href = placeLink(place);
    const item = el('li', 'account-place', link, unsave);
    item.dataset.cat = place.category?.icon ?? 'other';
    return item;
  }));
  revealList([...$('.account-places').children]);
}

/** My business: the request's status, or an invitation to add one. */
function renderBusiness() {
  const box = $('.account-business');
  const r = data.business;
  if (!r) {
    const add = el('a', 'account-button account-button--gold', t('account.bizAdd'));
    add.href = '/business.html';
    box.replaceChildren(el('p', 'account-business__text', t('account.bizNone')), add);
    return;
  }
  const status = el('span', `account-status account-status--${r.status}`, t(`account.biz${r.status[0].toUpperCase()}${r.status.slice(1)}`));
  box.replaceChildren(
    el('div', 'account-business__head', el('b', 'account-business__name', r.name), status),
    el('p', 'account-business__meta', `${t('account.bizSent')} ${dateInYangon(r.createdAt)}`),
  );
}

function renderReviews() {
  $('.account-reviews').replaceChildren(...data.reviews.map((review) => {
    const remove = el('button', 'account-chip-button', t('account.delete'));
    remove.type = 'button';
    remove.addEventListener('click', async () => {
      if (!confirm(t('account.confirmDelete'))) return;
      remove.disabled = true;
      await deleteReview(review.id);
      data.reviews = data.reviews.filter((r) => r.id !== review.id);
      renderReviews();
      renderStats();
      toast(t('account.deleted'));
    });
    const place = el('a', 'account-review__place', review.place.name);
    place.href = placeLink(review.place);
    const rating = el('span', 'account-review__stars', stars(review.rating));
    rating.setAttribute('aria-label', `${review.rating} ${t('place.outOf5')}`);
    return el('li', 'account-review',
      el('div', 'account-review__head', place, rating),
      el('p', 'account-review__text', review.text),
      el('div', 'account-review__foot', el('span', 'account-review__date', dateInYangon(review.createdAt)), remove));
  }));
  revealList([...$('.account-reviews').children]);
}

function renderAll() {
  renderStats();
  renderSaves();
  renderReviews();
  renderBusiness();
  document.querySelectorAll('.account-section').forEach((s) => { s.dataset.reveal = ''; });
  reveal();
}

// ---- Load ----

async function start() {
  try {
    const { user } = await getSession();
    if (!user) {
      $('.account-hero__title').hidden = true;
      $('.account-visitor').hidden = false;
      return;
    }
    $('.account-hero__name').textContent = user.name;
    [data.saves, data.reviews, data.business] = await Promise.all([getMySaves(), getMyReviews(), getMyBusinessRequest()]);
    $('.account-stats').hidden = false;
    $('.account-hero__logout').hidden = false;
    $('.account-main').hidden = false;
    $('.account-demo').hidden = !USE_MOCK;
    renderAll();
  } catch (error) {
    console.error(error);
    $('.account-error').hidden = false;
  }
}

$('.account-hero__logout').addEventListener('click', async () => {
  await logout();
  location.assign('/login.html?next=%2Faccount.html');
});

start();
