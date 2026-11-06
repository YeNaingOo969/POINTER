// Entry script for place.html?id=<slug>: one place in full — a slowly turning 3D map of the spot
// as the hero (real photos only, none yet), hours, facts, crowd, reviews, save and check-in.
// User actions ask visitors to log in first (simulated until login.html, M5).
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/components/brand.css';
import '../styles/components/map-ui.css';
import '../styles/components/login-dialog.css';
import '../styles/pages/place.css';
import { initI18n, getLang, setLang, localize, t } from '../i18n/i18n.js';
import {
  getPlace, getReviews, addReview, getSession, getMyPlace, setSaved, checkIn, reportCrowd,
} from '../api/api.js';
import { createMap, prefersReducedMotion } from '../map/map.js';
import { addCityLayer } from '../map/city-3d.js';
import { addPlaceMarkers } from '../map/place-markers.js';
import { weekHours } from '../lib/opening-hours.js';
import { dateInYangon, fee, googleMapsUrl, number, stars } from '../lib/format.js';
import { renderChips } from '../components/place-chips.js';
import { askToLogin } from '../components/login-dialog.js';

initI18n();

const $ = (sel) => document.querySelector(sel);
const slug = new URLSearchParams(location.search).get('id');
let place = null;
let reviews = [];
let mine = { saved: false, checkedInAt: null };
let rating = 0; // chosen in the review form

$('.place-top__lang').addEventListener('click', () => setLang(getLang() === 'my' ? 'en' : 'my'));

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
  const { user } = await getSession();
  if (user) return user;
  const session = await askToLogin();
  if (session?.user) mine = await getMyPlace(place.id); // their saved / checked-in state
  return session?.user ?? null;
}

// ---- Rendering ----

function renderHeader() {
  document.title = `${localize(place.name)} — POINTER`;
  $('.place-hero__eyebrow').textContent = localize(place.township);
  $('.place-hero__title').textContent = localize(place.name);
  $('.place-hero__alt').textContent = getLang() === 'my' ? place.name.en : place.name.my;
  renderChips($('.place-hero__chips'), place, 'place-chip');
  $('.place-about').textContent = localize(place.description);
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
  const fact = (label, value, href) => {
    if (!value) return;
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = label;
    if (href) {
      const a = document.createElement('a');
      a.href = href;
      a.textContent = value;
      if (!href.startsWith('tel:')) Object.assign(a, { target: '_blank', rel: 'noopener' });
      dd.append(a);
    } else {
      dd.textContent = value;
    }
    dl.append(dt, dd);
  };
  const { contact = {} } = place;
  fact(t('card.entry'), fee(place.entryFee));
  fact(t('place.price'), place.priceLevel ? t(`place.price${place.priceLevel}`) : null);
  fact(t('card.address'), localize(place.address));
  fact(t('place.phone'), contact.phone, contact.phone && `tel:${contact.phone.replace(/\s+/g, '')}`);
  fact(t('place.website'), contact.website && new URL(contact.website).hostname, contact.website);
  fact(t('place.facebook'), contact.facebook && 'Facebook', contact.facebook);
}

function renderActions() {
  $('.place-actions__directions').href = googleMapsUrl(place.location);
  $('.place-actions__map').href = `/explore.html?place=${encodeURIComponent(place.slug)}`;
  const save = $('.place-actions__save');
  save.textContent = mine.saved ? `♥ ${t('place.saved')}` : `♡ ${t('place.save')}`;
  save.setAttribute('aria-pressed', String(mine.saved));
  const check = $('.place-actions__checkin');
  check.textContent = mine.checkedInAt ? `✓ ${t('place.checkedIn')}` : t('place.checkIn');
  check.title = mine.checkedInAt ? dateInYangon(mine.checkedInAt) : '';
  check.disabled = Boolean(mine.checkedInAt);
}

function renderCrowd() {
  const crowd = place.crowd;
  $('.place-crowd__current').textContent = crowd
    ? `${t(`crowd.${crowd.level}`)} · ${number(crowd.reports)} ${t('place.reports')}`
    : t('place.noCrowd');
  document.querySelectorAll('.place-crowd__buttons [data-level]').forEach((b) => {
    b.setAttribute('aria-pressed', String(crowd?.level === b.dataset.level));
  });
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
    list.append(li);
  }
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
  renderCrowd();
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

  $('.place-actions__checkin').addEventListener('click', async () => {
    if (!(await currentUser()) || mine.checkedInAt) return;
    mine.checkedInAt = (await checkIn(place.id)).checkedInAt;
    renderActions();
    toast(t('place.checkInToast'));
  });

  document.querySelectorAll('.place-crowd__buttons [data-level]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!(await currentUser())) return;
      place.crowd = await reportCrowd(place.id, button.dataset.level);
      renderCrowd();
      renderChips($('.place-hero__chips'), place, 'place-chip');
      toast(t('place.crowdThanks'));
    });
  });

  const form = $('.review-form');
  $('.place-reviews__write').addEventListener('click', async () => {
    if (!(await currentUser())) return;
    form.hidden = false;
    renderActions();
    form.querySelector('textarea').focus();
  });
  form.querySelector('[data-action="cancel"]').addEventListener('click', () => { form.hidden = true; });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = form.elements.text.value.trim();
    if (!rating || !text) return;
    let review;
    try {
      review = await addReview(place.id, { rating, text });
    } catch (error) {
      toast(t(error.status === 409 ? 'place.alreadyReviewed' : 'auth.errGeneric'));
      return;
    }
    reviews = [review, ...reviews];
    form.reset();
    rating = 0;
    form.hidden = true;
    renderReviews();
    renderStarPicker();
    toast(t('place.reviewThanks'));
  });
}

// ---- Hero map: the place in 3D, turning slowly while it is on screen ----

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
  markers.select(place.slug);
  addCityLayer(map, {
    clearings: [{ ...place.location, radius: place.isFeatured ? 45 : 28 }],
    onLandmarks: (spots) => markers.liftAbove(spots),
  });

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

// ---- Start ----

async function start() {
  try {
    if (!slug) throw new Error('No place id');
    place = await getPlace(slug);
  } catch {
    $('.place-hero').hidden = true;
    $('.place-missing').hidden = false;
    return;
  }
  [reviews, mine] = await Promise.all([getReviews(place.id), getMyPlace(place.id)]);
  $('.place-main').hidden = false;
  renderAll();
  wireActions();
  document.addEventListener('langchange', renderAll);
  startHeroMap().catch((error) => console.error('Hero map failed', error));
}

start();
