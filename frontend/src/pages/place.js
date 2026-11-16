// Entry script for place.html?id=<id>: one place in full — a slowly turning map of the spot as
// the hero (real photos only, none yet), about, hours, facts, call / directions, save, and reviews
// (write one, edit or delete your own; owners can't review their own shop).
// User actions ask visitors to log in first.
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/components/brand.css';
import '../styles/components/map-ui.css';
import '../styles/components/login-dialog.css';
import '../styles/pages/app.css';
import '../styles/components/app-nav.css';
import '../styles/pages/place.css';
import { mountAppNav } from '../components/app-nav.js';
import { initI18n, t, categoryName } from '../i18n/i18n.js';
import { getPlace, getReviews, addReview, updateReview, deleteReview, getSession, getMyPlace, setSaved, getPlacePosts, setBlocked } from '../api/api.js';
import { postCard } from '../components/post-card.js';
import { openReport } from '../components/report-dialog.js';
import { createMap, prefersReducedMotion } from '../map/map.js';
import { addPlaceMarkers } from '../map/place-markers.js';
import { weekHours } from '../lib/opening-hours.js';
import { dateInYangon, googleMapsUrl, number, stars } from '../lib/format.js';
import { renderChips } from '../components/place-chips.js';
import { reveal, revealList } from '../lib/reveal.js';
import { askToLogin } from '../components/login-dialog.js';

initI18n();
mountAppNav(null);

const $ = (sel) => document.querySelector(sel);
const placeId = new URLSearchParams(location.search).get('id');
let place = null;
let reviews = [];
let mine = { saved: false, reviewId: null };
let user = null; // logged-in user, or null for a visitor
let rating = 0; // chosen in the review form
let editingId = null; // id of the user's own review while the form edits it

// ---- Small helpers ----

let toastTimer = 0;
function toast(message) {
  const el = $('.place-toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
}

/** The logged-in user, asking a visitor to log in first; null if they decline. */
async function currentUser() {
  if (user) return user;
  const session = await askToLogin();
  if (session?.user) {
    user = session.user;
    mine = await getMyPlace(place.id); // their saved state and own review
    renderActions();
    renderReviews();
  }
  return user;
}

// ---- Rendering ----

function renderHeader() {
  document.title = `${place.name} — POINTER`;
  $('.place-hero__eyebrow').textContent = categoryName(place.category);
  $('.place-hero__title').textContent = place.name;
  renderChips($('.place-hero__chips'), place, 'place-chip');
  $('.place-about__text').textContent = place.description ?? '';
  $('.place-about').hidden = !place.description;
}

function renderHours() {
  const week = weekHours(place.openingHours);
  const body = $('.place-hours tbody');
  body.replaceChildren();
  $('.place-hours').hidden = !week;
  $('.place-hours__unknown').hidden = Boolean(week);
  for (const { day, today, hours } of week ?? []) {
    const tr = document.createElement('tr');
    if (today) tr.className = 'is-today';
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = today ? `${t(`days.${day}`)} · ${t('place.today')}` : t(`days.${day}`);
    const td = document.createElement('td');
    td.textContent = hours ?? t('place.closed');
    tr.append(th, td);
    body.append(tr);
  }
}

function renderFacts() {
  const dl = $('.place-facts');
  dl.replaceChildren();
  const fact = (label, value) => {
    if (!value) return;
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = label;
    dd.textContent = value;
    dl.append(dt, dd);
  };
  fact(t('card.address'), place.address);
}

function renderActions() {
  $('.place-actions__directions').href = googleMapsUrl(place.location);
  $('.place-actions__map').href = `/explore.html?place=${place.id}`;
  const save = $('.place-actions__save');
  save.textContent = mine.saved ? `♥ ${t('place.saved')}` : `♡ ${t('place.save')}`;
  save.setAttribute('aria-pressed', String(mine.saved));
  const call = $('.place-actions__call');
  call.hidden = !place.phone;
  if (place.phone) {
    call.href = `tel:${place.phone.replace(/\s+/g, '')}`;
    call.title = place.phone;
  }
  const ownShop = Boolean(user && place.ownerId === user.id);
  // Message and Block only for shops with an owner (public places are run by the admin).
  const msg = $('.place-actions__message');
  msg.hidden = !place.ownerId || ownShop;
  msg.href = `/messages.html?with=${place.ownerId}`;
  $('.place-actions__block').hidden = !place.ownerId || ownShop;
  $('.place-reviews__own').hidden = !ownShop;
  const write = $('.place-reviews__write');
  write.hidden = ownShop;
  write.textContent = t(mine.reviewId ? 'place.editReview' : 'place.writeReview');
}

function renderReviews() {
  $('.place-reviews__average').textContent = place.rating ? place.rating.average.toFixed(1) : '–';
  $('.place-reviews__stars').textContent = place.rating ? stars(place.rating.average) : '';
  $('.place-reviews__count').textContent = place.rating ? `${number(place.rating.count)} ${t('place.ratings')}` : '';

  const list = $('.review-list');
  list.replaceChildren();
  $('.review-list__empty').hidden = reviews.length > 0;
  for (const r of reviews) {
    const li = document.createElement('li');
    li.className = 'review';
    li.innerHTML = `
      <div class="review__head">
        <span class="review__avatar" aria-hidden="true"></span>
        <span class="review__name"></span>
        <span class="review__stars"></span>
        <time class="review__date"></time>
      </div>
      <p class="review__text"></p>`;
    li.querySelector('.review__avatar').textContent = r.user.name.trim()[0]?.toUpperCase() ?? '?';
    li.querySelector('.review__name').textContent = r.user.name;
    const s = li.querySelector('.review__stars');
    s.textContent = stars(r.rating);
    s.setAttribute('aria-label', `${r.rating} ${t('place.outOf5')}`);
    const time = li.querySelector('.review__date');
    time.dateTime = r.createdAt;
    time.textContent = dateInYangon(r.createdAt);
    li.querySelector('.review__text').textContent = r.text;
    if (r.ownerReply) {
      const reply = document.createElement('div');
      reply.className = 'review__reply';
      const label = document.createElement('b');
      label.textContent = t('place.ownerReply');
      const text = document.createElement('p');
      text.textContent = r.ownerReply;
      reply.append(label, text);
      li.append(reply);
    }
    if (r.updatedAt) time.textContent += ` · ${t('place.edited')}`;
    if (user && r.user.id === user.id) {
      li.classList.add('review--mine');
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'review__edit';
      edit.textContent = t('place.edit');
      edit.addEventListener('click', () => openForm(r));
      li.querySelector('.review__head').append(edit);
    }
    list.append(li);
  }
  revealList([...list.children]);
}

function renderStarPicker() {
  const box = $('.review-form__stars');
  box.replaceChildren();
  for (let n = 1; n <= 5; n++) {
    const label = document.createElement('label');
    label.className = 'review-form__star';
    label.innerHTML = '<input type="radio" name="rating" required /><span aria-hidden="true">★</span>';
    const input = label.querySelector('input');
    input.value = String(n);
    input.checked = n === rating;
    input.setAttribute('aria-label', `${n} ${t('place.outOf5')}`);
    input.addEventListener('change', () => { rating = n; paintStars(); });
    box.append(label);
  }
  paintStars();
}

function paintStars() {
  document.querySelectorAll('.review-form__star').forEach((el, i) => el.classList.toggle('is-on', i < rating));
}

function renderAll() {
  renderHeader();
  renderHours();
  renderFacts();
  renderActions();
  renderReviews();
  renderStarPicker();
}

// ---- Actions ----

function wireActions() {
  $('.place-actions__save').addEventListener('click', async () => {
    if (!(await currentUser())) return;
    mine.saved = (await setSaved(place.id, !mine.saved)).saved;
    renderActions();
    toast(mine.saved ? t('place.savedToast') : t('place.unsavedToast'));
  });

  const form = $('.review-form');
  $('.place-reviews__write').addEventListener('click', async () => {
    if (!(await currentUser())) return;
    if (place.ownerId === user.id) return;
    openForm(reviews.find((r) => r.id === mine.reviewId) ?? null);
  });
  form.querySelector('[data-action="cancel"]').addEventListener('click', closeForm);
  form.querySelector('[data-action="delete"]').addEventListener('click', async () => {
    if (!editingId || !window.confirm(t('account.confirmDelete'))) return;
    await deleteReview(editingId);
    reviews = reviews.filter((r) => r.id !== editingId);
    mine.reviewId = null;
    closeForm();
    renderActions();
    renderReviews();
    toast(t('account.deleted'));
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = form.elements.text.value.trim();
    if (!rating || !text) return;
    try {
      if (editingId) {
        const updated = await updateReview(editingId, { rating, text });
        reviews = reviews.map((r) => (r.id === editingId ? updated : r));
        toast(t('place.reviewUpdated'));
      } else {
        const review = await addReview(place.id, { rating, text });
        reviews = [review, ...reviews];
        mine.reviewId = review.id;
        toast(t('place.reviewThanks'));
      }
    } catch (error) {
      const key = { 409: 'place.alreadyReviewed', 403: 'place.ownShop' }[error.status] ?? 'auth.errGeneric';
      toast(t(key));
      return;
    }
    closeForm();
    renderActions();
    renderReviews();
  });
}

/** Open the review form, empty for a new review or filled in to edit your own. */
function openForm(review) {
  const form = $('.review-form');
  editingId = review?.id ?? null;
  rating = review?.rating ?? 0;
  form.elements.text.value = review?.text ?? '';
  form.querySelector('.review-form__title').textContent = t(review ? 'place.editReview' : 'place.writeReview');
  form.querySelector('[type="submit"]').textContent = t(review ? 'place.saveChanges' : 'place.postReview');
  form.querySelector('[data-action="delete"]').hidden = !review;
  renderStarPicker();
  form.hidden = false;
  form.querySelector('textarea').focus();
}

function closeForm() {
  const form = $('.review-form');
  form.reset();
  form.hidden = true;
  editingId = null;
  rating = 0;
  renderStarPicker();
}

// ---- Hero map: the place, turning slowly while it is on screen ----

async function startHeroMap() {
  const container = $('#place-map');
  const map = await createMap(container);
  const { lng, lat } = place.location;
  map.jumpTo({ center: [lng, lat], zoom: 16.4, pitch: 58, bearing: -20 });
  // Decorative: the page scrolls over it, so no zoom or drag.
  for (const handler of ['scrollZoom', 'dragPan', 'dragRotate', 'touchZoomRotate', 'doubleClickZoom', 'keyboard']) {
    map[handler].disable();
  }
  const markers = addPlaceMarkers(map, [place], { onSelect() {} });
  markers.select(place.id);

  if (prefersReducedMotion()) return;
  let visible = true;
  const turn = () => {
    if (visible && !document.hidden) map.easeTo({ bearing: map.getBearing() + 40, duration: 20000, easing: (x) => x });
  };
  map.on('moveend', turn);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) turn();
    else map.stop();
  }).observe(container);
  document.addEventListener('visibilitychange', () => (document.hidden ? map.stop() : turn()));
  turn();
}

/** The hero map drifts slower than the page as you scroll (cheap: one transform per frame). */
function heroParallax() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const map = $('.place-hero__map');
  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = Math.min(window.scrollY, window.innerHeight);
      map.style.translate = `0 ${(y * 0.35).toFixed(1)}px`;
      ticking = false;
    });
  }, { passive: true });
}

// ---- Start ----

/** Report the place; block its owner (their shop then disappears for this user). Users only. */
function wireReportAndBlock() {
  const needUser = async () => user ?? ((await askToLogin())?.user ?? null);
  $('.place-actions__report').addEventListener('click', async () => {
    if (!(user = await needUser())) return;
    openReport('place', place.id);
  });
  $('.place-actions__block').addEventListener('click', async () => {
    if (!(user = await needUser())) return;
    if (!confirm(t('act.blockConfirm'))) return;
    await setBlocked(place.ownerId, true);
    toast(t('act.blocked'));
    setTimeout(() => { location.href = '/explore.html'; }, 1600);
  });
}

async function start() {
  try {
    if (!placeId) throw new Error('No place id');
    place = await getPlace(placeId);
  } catch {
    $('.place-hero').hidden = true;
    $('.place-missing').hidden = false;
    return;
  }
  // The place itself is enough to show the page: if reviews, the user's save state or the posts
  // can't be loaded (an endpoint not built yet, a network hiccup), show the page without them.
  const [r, m, s, p] = await Promise.allSettled([getReviews(place.id), getMyPlace(place.id), getSession(), getPlacePosts(place.id)]);
  const or = (res, fallback, what) => {
    if (res.status === 'fulfilled') return res.value;
    console.warn(`Place page: ${what} not loaded`, res.reason);
    return fallback;
  };
  reviews = or(r, [], 'reviews');
  mine = or(m, { saved: false, reviewId: null }, 'save state');
  ({ user } = or(s, { user: null }, 'session'));
  const posts = or(p, [], 'posts');
  $('.place-posts').hidden = posts.length === 0;
  $('.place-posts__list').replaceChildren(...posts.map((p) => postCard(p, { showShop: false })));
  $('.place-main').hidden = false;
  renderAll();
  document.body.classList.add('is-ready'); // hero text rises in (CSS)
  document.querySelectorAll('.place-section, .place-panel').forEach((el) => { el.dataset.reveal = ''; });
  reveal();
  heroParallax();
  wireActions();
  wireReportAndBlock();
  startHeroMap().catch((error) => console.error('Hero map failed', error));
}

start();
