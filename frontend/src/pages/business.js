// Entry script for business.html: the "Add your business" request (scope doc, section 4).
// A logged-in user fills in name, group, description, phone and opening hours, drops a pin on the
// map and adds one shop-front photo. An admin approves or rejects it (phase 3). One business per
// user: if a request already exists, its status is shown instead of the form.
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/components/brand.css';
import '../styles/components/app-top.css';
import '../styles/components/app-nav.css';
import '../styles/pages/business.css';
import { mountAppNav } from '../components/app-nav.js';
import { initI18n, t, categoryName } from '../i18n/i18n.js';
import { getSession, getCategories, getMyBusinessRequest, submitBusinessRequest } from '../api/api.js';
import { createMap, maplibregl } from '../map/map.js';
import { reveal } from '../lib/reveal.js';

initI18n();
mountAppNav(null);

const $ = (sel) => document.querySelector(sel);
const form = $('.biz-form');
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
let pin = null; // maplibregl.Marker once the user taps the map

let toastTimer = 0;
function toast(message) {
  const el = $('.biz-toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 4000);
}

// ---- Opening hours: one row per day ----

function buildHours() {
  const rows = $('.biz-hours__rows');
  rows.replaceChildren(...DAYS.map((day, i) => {
    const row = document.createElement('div');
    row.className = 'biz-hours__row';
    row.dataset.day = day;
    row.innerHTML = `
      <span class="biz-hours__day"></span>
      <input type="time" name="open-${day}" value="${i < 6 ? '09:00' : ''}" aria-label="" />
      <span aria-hidden="true">–</span>
      <input type="time" name="close-${day}" value="${i < 6 ? '18:00' : ''}" aria-label="" />
      <label class="biz-hours__closed"><input type="checkbox" name="closed-${day}" ${i === 6 ? 'checked' : ''} /> <span></span></label>`;
    const name = t(`days.${day}`);
    row.querySelector('.biz-hours__day').textContent = name;
    row.querySelector(`[name="open-${day}"]`).setAttribute('aria-label', `${name} ${t('business.opens')}`);
    row.querySelector(`[name="close-${day}"]`).setAttribute('aria-label', `${name} ${t('business.closes')}`);
    row.querySelector('.biz-hours__closed span').textContent = t('place.closed');
    const closed = row.querySelector(`[name="closed-${day}"]`);
    const sync = () => {
      row.classList.toggle('is-closed', closed.checked);
      row.querySelectorAll('input[type="time"]').forEach((input) => { input.disabled = closed.checked; });
    };
    closed.addEventListener('change', sync);
    sync();
    return row;
  }));
  form.querySelector('[data-action="copy-hours"]').addEventListener('click', () => {
    const [open, close, closed] = ['open', 'close', 'closed'].map((k) => form.elements[`${k}-mon`]);
    for (const day of DAYS.slice(1)) {
      form.elements[`open-${day}`].value = open.value;
      form.elements[`close-${day}`].value = close.value;
      form.elements[`closed-${day}`].checked = closed.checked;
      form.elements[`closed-${day}`].dispatchEvent(new Event('change'));
    }
  });
}

/** [{ day, open, close }] for the open days — saved as JSON text in places.open_hours. */
function readHours() {
  return DAYS
    .filter((day) => !form.elements[`closed-${day}`].checked)
    .map((day) => ({ day, open: form.elements[`open-${day}`].value, close: form.elements[`close-${day}`].value }));
}

// ---- Map pin ----

async function buildMap() {
  const map = await createMap($('#biz-map'));
  map.jumpTo({ pitch: 0, bearing: 0, zoom: 14.5 });
  const dot = document.createElement('div');
  dot.className = 'biz-pin';
  map.on('click', (e) => {
    // setLngLat before addTo: MapLibre can't place a marker that has no position yet.
    if (pin) pin.setLngLat(e.lngLat);
    else pin = new maplibregl.Marker({ element: dot, anchor: 'bottom', draggable: true }).setLngLat(e.lngLat).addTo(map);
    showError('location', '');
  });
}

// ---- Photo ----

function wirePhoto() {
  const input = form.elements.photo;
  const preview = $('.biz-photo__preview');
  input.addEventListener('change', () => {
    const file = input.files[0];
    showError('photo', '');
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) { showError('photo', t('business.errPhotoType')); input.value = ''; return; }
    if (file.size > MAX_PHOTO_BYTES) { showError('photo', t('business.errPhotoSize')); input.value = ''; return; }
    if (preview.src) URL.revokeObjectURL(preview.src);
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
    $('.biz-photo__empty').hidden = true;
  });
}

// ---- Validation + submit ----

function showError(field, message) {
  const el = form.querySelector(`.biz-error[data-for="${field}"]`);
  if (el) el.textContent = message;
}

function validate() {
  const f = form.elements;
  const errors = {};
  const name = f.name.value.trim();
  if (name.length < 2) errors.name = t('business.errName');
  if (!f.categoryId.value) errors.categoryId = t('business.errGroup');
  const description = f.description.value.trim();
  if (description.length < 10) errors.description = t('business.errDescription');
  if (!/^[0-9+ ()-]{6,20}$/.test(f.phone.value.trim())) errors.phone = t('business.errPhone');
  const address = f.address.value.trim();
  if (address.length < 5 || address.length > 200) errors.address = t('business.errAddress');
  const hours = readHours();
  if (!hours.length || hours.some((h) => !h.open || !h.close)) errors.hours = t('business.errHours');
  if (!pin) errors.location = t('business.errPin');
  if (!f.photo.files[0]) errors.photo = t('business.errPhoto');
  // Payment sent with the request (owner_upgrades row, checked by an admin).
  const paymentRef = f.paymentRef.value.trim();
  if (paymentRef.length < 4) errors.paymentRef = t('biz2.errRef');
  const proof = f.proof.files[0];
  if (!proof) errors.proof = t('biz2.errProof');
  else if (!PHOTO_TYPES.includes(proof.type) || proof.size > MAX_PHOTO_BYTES) errors.proof = t('business.errPhotoType');
  for (const key of ['name', 'categoryId', 'description', 'phone', 'address', 'hours', 'location', 'photo', 'paymentRef', 'proof']) showError(key, errors[key] ?? '');
  const plan = form.querySelector('input[name="months"]:checked');
  return Object.keys(errors).length ? null : {
    name, categoryId: Number(f.categoryId.value), description, phone: f.phone.value.trim(), address, openingHours: hours,
    months: Number(plan.value), amount: Number(plan.dataset.amount), paymentMethod: f.paymentMethod.value, paymentRef, proof,
  };
}

function showStatus(request) {
  form.hidden = true;
  const box = $('.biz-status');
  box.hidden = false;
  const badge = box.querySelector('.biz-status__badge');
  badge.className = `biz-status__badge is-${request.status}`;
  badge.textContent = t(`business.status_${request.status}`);
  box.querySelector('.biz-status__name').textContent = request.name;
  box.querySelector('.biz-status__text').textContent = t(`business.statusText_${request.status}`);
}

function wireSubmit() {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fields = validate();
    if (!fields) {
      form.querySelector('.biz-error:not(:empty)')?.closest('.biz-field')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const { lng, lat } = pin.getLngLat();
    const button = form.querySelector('.biz-submit');
    button.disabled = true;
    try {
      const request = await submitBusinessRequest({ ...fields, lat, lng, photo: form.elements.photo.files[0] });
      showStatus(request);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      if (error.status === 401) location.assign('/login.html?next=%2Fbusiness.html');
      toast(error.status === 409 ? t('business.errExists') : error.status === 422 ? error.message : t('auth.errGeneric'));
    } finally {
      button.disabled = false;
    }
  });
}

// ---- Start ----

async function start() {
  const { user } = await getSession();
  if (!user) {
    $('.biz-visitor').hidden = false;
    return;
  }
  const existing = await getMyBusinessRequest();
  if (existing && existing.status !== 'rejected') {
    showStatus(existing);
    return;
  }
  const categories = await getCategories();
  const select = form.elements.categoryId;
  for (const c of categories) select.add(new Option(categoryName(c), String(c.id)));
  buildHours();
  wirePhoto();
  wireSubmit();
  form.hidden = false;
  form.querySelectorAll('.biz-field').forEach((f, i) => { f.dataset.reveal = ''; f.style.setProperty('--i', String(i % 6)); });
  reveal();
  buildMap().catch((error) => {
    console.error(error);
    showError('location', t('explore.loadFailed'));
  });
}

start();
