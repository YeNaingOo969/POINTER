// Entry script for passport.html: the logged-in user's saved places, check-in stamps (Food
// Passport) and reviews. Visitors get a "log in" message instead.
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/components/brand.css';
import '../styles/components/app-top.css';
import '../styles/pages/passport.css';
import { initI18n, t } from '../i18n/i18n.js';
import { getSession, getMySaves, getMyCheckIns, getMyReviews, setSaved, deleteReview, logout } from '../api/api.js';
import { USE_MOCK } from '../api/config.js';
import { dateInYangon, number, stars } from '../lib/format.js';

initI18n();

const $ = (sel) => document.querySelector(sel);
const data = { saves: [], checkIns: [], reviews: [] };

let toastTimer = 0;
function toast(message) {
  const el = $('.passport-toast');
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
  const counts = { saved: data.saves.length, stamps: data.checkIns.length, reviews: data.reviews.length };
  for (const n of document.querySelectorAll('[data-stat]')) n.textContent = number(counts[n.dataset.stat]);
  for (const p of document.querySelectorAll('[data-empty]')) p.hidden = counts[p.dataset.empty] > 0;
}

function renderSaves() {
  $('.passport-places').replaceChildren(...data.saves.map(({ place }) => {
    const unsave = el('button', 'passport-chip-button', t('passport.unsave'));
    unsave.type = 'button';
    unsave.addEventListener('click', async () => {
      unsave.disabled = true;
      await setSaved(place.id, false);
      data.saves = data.saves.filter((s) => s.place.id !== place.id);
      renderSaves();
      renderStats();
      toast(t('place.unsavedToast'));
    });
    const link = el('a', 'passport-place__link', el('span', 'passport-place__name', place.name), el('span', 'passport-place__town', place.category?.name ?? place.address));
    link.href = placeLink(place);
    return el('li', 'passport-place', link, unsave);
  }));
}

function renderStamps() {
  $('.passport-stamps').replaceChildren(...data.checkIns.map(({ place, checkedInAt }, i) => {
    const stamp = el('a', 'stamp',
      el('span', 'stamp__mark', 'POINTER'),
      el('span', 'stamp__name', place.name),
      el('span', 'stamp__date', dateInYangon(checkedInAt)));
    stamp.href = placeLink(place);
    stamp.style.setProperty('--tilt', `${[-4, 3, -2, 5, -5, 2][i % 6]}deg`);
    return el('li', null, stamp);
  }));
}

function renderReviews() {
  $('.passport-reviews').replaceChildren(...data.reviews.map((review) => {
    const remove = el('button', 'passport-chip-button', t('passport.delete'));
    remove.type = 'button';
    remove.addEventListener('click', async () => {
      if (!confirm(t('passport.confirmDelete'))) return;
      remove.disabled = true;
      await deleteReview(review.id);
      data.reviews = data.reviews.filter((r) => r.id !== review.id);
      renderReviews();
      renderStats();
      toast(t('passport.deleted'));
    });
    const place = el('a', 'passport-review__place', review.place.name);
    place.href = placeLink(review.place);
    const rating = el('span', 'passport-review__stars', stars(review.rating));
    rating.setAttribute('aria-label', `${review.rating} ${t('place.outOf5')}`);
    return el('li', 'passport-review',
      el('div', 'passport-review__head', place, rating),
      el('p', 'passport-review__text', review.text),
      el('div', 'passport-review__foot', el('span', 'passport-review__date', dateInYangon(review.createdAt)), remove));
  }));
}

function renderAll() {
  renderStats();
  renderSaves();
  renderStamps();
  renderReviews();
}

// ---- Load ----

async function start() {
  try {
    const { user } = await getSession();
    if (!user) {
      $('.passport-hero__title').hidden = true;
      $('.passport-visitor').hidden = false;
      return;
    }
    $('.passport-hero__name').textContent = user.name;
    [data.saves, data.checkIns, data.reviews] = await Promise.all([getMySaves(), getMyCheckIns(), getMyReviews()]);
    $('.passport-stats').hidden = false;
    $('.passport-hero__logout').hidden = false;
    $('.passport-main').hidden = false;
    $('.passport-demo').hidden = !USE_MOCK;
    renderAll();
  } catch (error) {
    console.error(error);
    $('.passport-error').hidden = false;
  }
}

$('.passport-hero__logout').addEventListener('click', async () => {
  await logout();
  location.assign('/login.html?next=%2Fpassport.html');
});

start();
