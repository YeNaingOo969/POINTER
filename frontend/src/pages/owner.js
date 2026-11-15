// Entry script for owner.html — shop owner mode (flowcharts 3, 3a–3c): subscription check (renew
// when it has ended), check and use tickets at the counter, new posts and deals, manage posts
// (pin, edit, delete), reply to reviews, edit the place. Only for users with an approved shop.
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/components/brand.css';
import '../styles/components/app-top.css';
import '../styles/components/app-nav.css';
import '../styles/components/login-dialog.css';
import '../styles/pages/app.css';
import '../styles/pages/business.css';
import '../styles/pages/owner.css';
import { initI18n, t, categoryName } from '../i18n/i18n.js';
import {
  getSession, getOwnerDashboard, createPost, updatePost, setPostPinned, deletePost,
  checkTicket, confirmTicket, replyToReview, updateMyPlace, renewSubscription,
} from '../api/api.js';
import { USE_MOCK } from '../api/config.js';
import { mountAppNav } from '../components/app-nav.js';
import { askToLogin } from '../components/login-dialog.js';
import { canScanQr, scanQr } from '../components/qr-scanner.js';
import { el, toast, ago, timeLeft } from '../lib/dom.js';
import { dateInYangon, number, stars, timeInYangon } from '../lib/format.js';

initI18n();
mountAppNav(null);

const $ = (sel) => document.querySelector(sel);
let dash = null;

// ---- header and subscription ----

function renderHeader() {
  const { place, subscription, pending, stats } = dash;
  document.title = `${place.name} — ${t('owner.eyebrow')} — POINTER`;
  $('.owner-name').textContent = place.name;
  $('.owner-sub').textContent = categoryName(place.category);
  const sub = $('.owner-sub--sub');
  sub.textContent = subscription?.active
    ? `${t('owner.active').replace('{n}', subscription.daysLeft)} (${t('owner.until').replace('{d}', dateInYangon(subscription.expiresAt))})`
    : '';
  const banner = $('.owner-banner');
  banner.hidden = true;
  if (pending) {
    banner.hidden = false;
    banner.textContent = t('owner.pending');
  } else if (subscription?.active && subscription.daysLeft <= 7) {
    banner.hidden = false;
    banner.textContent = t('owner.soon').replace('{n}', subscription.daysLeft);
  }
  const s = $('.owner-stats');
  s.hidden = false;
  s.replaceChildren(...[
    [stats.posts, 'statPosts'], [stats.activeDeals, 'statDeals'], [stats.ticketsTaken, 'statTaken'],
    [stats.ticketsUsed, 'statUsed'], [stats.rating ? stats.rating.average.toFixed(1) : '–', 'statRating'],
  ].map(([n, key]) => el('div', null, el('dt', null, String(n)), el('dd', null, t(`owner.${key}`)))));

  const live = Boolean(subscription?.active);
  document.querySelectorAll('.owner-live').forEach((e) => { e.hidden = !live; });
  $('.owner-renew').hidden = live || Boolean(pending);
  // Renew is also offered when the subscription is about to end (then it isn't hidden yet).
  if (live && subscription.daysLeft <= 7 && !pending) $('.owner-renew').hidden = false;
  $('#renew-title').textContent = t(live ? 'owner.renew' : 'owner.hidden');
  $('.owner-renew > p').hidden = live;
}

// ---- 3b: tickets ----

function wireTicket() {
  const form = $('.owner-ticket__form');
  const box = $('.owner-ticket__result');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = form.code.value.trim();
    if (!code) return;
    const res = await checkTicket(code);
    const card = el('div', `owner-ticket__card is-${res.result}`, el('b', null, t(`owner.res_${res.result}`)));
    if (res.ticket) {
      card.append(
        el('p', null, res.post.discountText),
        el('p', 'app-muted', t('owner.takenBy').replace('{name}', res.ticket.userName ?? '—'), ` · ${timeInYangon(res.ticket.createdAt)}`,
          res.result === 'ok' ? ` · ${timeLeft(res.ticket.expiresAt) ?? ''}` : ''));
    }
    if (res.result === 'ok') {
      const use = el('button', 'app-button app-button--gold', t('owner.ticketUse'));
      use.type = 'button';
      use.addEventListener('click', async () => {
        use.disabled = true;
        try {
          await confirmTicket(code);
          card.className = 'owner-ticket__card is-done';
          card.replaceChildren(el('b', null, `✓ ${t('owner.res_done')}`), el('p', null, res.post.discountText));
          form.reset();
          load();
        } catch (error) {
          toast(t(`owner.res_${error.message}`) || error.message);
        }
      });
      card.append(use);
    }
    box.replaceChildren(card);
  });

  // Scan the QR on the customer's ticket (only where the browser can read QR codes).
  const scan = $('.owner-ticket__scan');
  canScanQr().then((ok) => {
    scan.hidden = !ok;
    if (ok) $('#ticket-hint').textContent = t('owner.ticketHintScan');
  });
  scan.addEventListener('click', async () => {
    const code = await scanQr();
    if (!code) return;
    form.code.value = code.toUpperCase();
    form.requestSubmit();
  });
}

// ---- 3a: posts ----

function wirePostForm() {
  const form = $('.owner-post-form');
  const discount = $('.owner-discount');
  form.addEventListener('change', () => { discount.hidden = form.type.value !== 'discount'; });
  // Default end: 3 days from now at 18:00 (local time of the browser).
  const d = new Date(Date.now() + 3 * 86400000);
  d.setHours(18, 0, 0, 0);
  form.expiresAt.value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = form.querySelector('.owner-error');
    err.textContent = '';
    const type = form.type.value;
    try {
      await createPost({
        type, content: form.content.value,
        discountText: type === 'discount' ? form.discountText.value : undefined,
        ticketLimit: type === 'discount' ? form.ticketLimit.value : undefined,
        expiresAt: type === 'discount' && form.expiresAt.value ? new Date(form.expiresAt.value).toISOString() : undefined,
      });
      form.content.value = '';
      form.discountText.value = '';
      toast(t('owner.posted'));
      load();
    } catch (error) {
      err.textContent = error.message;
    }
  });
}

function postItem(post) {
  const card = el('article', 'post-card owner-post');
  card.dataset.cat = post.place.category?.group ?? 'other';
  const tags = el('div', 'deal-card__meta');
  if (post.isPinned) tags.append(el('span', 'post-card__tag', `📌 ${t('posts.pinned')}`));
  tags.append(el('span', post.type === 'discount' ? 'post-card__tag post-card__tag--deal' : 'post-card__tag', t(post.type === 'discount' ? 'posts.discount' : 'posts.normal')));
  if (post.ended) tags.append(el('span', 'post-card__tag', t('owner.ended')));
  card.append(tags);
  if (post.type === 'discount') {
    card.append(el('p', 'deal-card__offer', post.discountText));
    card.append(el('p', 'deal-card__meta',
      el('span', null, t('owner.tickets').replace('{taken}', number(post.ticketsTaken)).replace('{limit}', number(post.ticketLimit))),
      el('span', null, post.ended ? t('owner.ended') : t('deals.endsIn').replace('{t}', timeLeft(post.expiresAt) ?? ''))));
  }
  const text = el('p', 'post-card__text', post.content);
  card.append(text, el('time', null, ago(post.createdAt)));

  const pin = el('button', 'account-chip-button', t(post.isPinned ? 'owner.unpin' : 'owner.pin'));
  const edit = el('button', 'account-chip-button', t('owner.edit'));
  const del = el('button', 'account-chip-button owner-danger', t('owner.delete'));
  [pin, edit, del].forEach((b) => { b.type = 'button'; });
  pin.addEventListener('click', async () => { await setPostPinned(post.id, !post.isPinned); load(); });
  del.addEventListener('click', async () => {
    if (!confirm(t('owner.deleteConfirm'))) return;
    await deletePost(post.id);
    toast(t('owner.deleted'));
    load();
  });
  edit.addEventListener('click', () => {
    const box = el('textarea', null);
    box.value = post.content;
    box.rows = 3;
    const save = el('button', 'app-button app-button--gold', t('owner.save'));
    save.type = 'button';
    save.addEventListener('click', async () => {
      try { await updatePost(post.id, { content: box.value }); load(); } catch (error) { toast(error.message); }
    });
    text.replaceWith(el('div', 'owner-form', box, save));
    edit.disabled = true;
  });
  card.append(el('div', 'deal-card__actions', pin, edit, del));
  return card;
}

// ---- 3c: reviews and place ----

function reviewItem(r) {
  const li = el('li', 'owner-review');
  li.append(
    el('div', 'owner-review__head', el('b', null, r.user.name), el('span', 'owner-review__stars', stars(r.rating)), el('small', 'app-muted', dateInYangon(r.createdAt))),
    el('p', null, r.text));
  const form = el('form', 'owner-form owner-review__form');
  const box = el('textarea', null);
  box.rows = 2;
  box.maxLength = 600;
  box.placeholder = t('owner.replyPlaceholder');
  box.value = r.ownerReply ?? '';
  const send = el('button', 'app-button', t('owner.reply'));
  form.append(el('label', null, el('span', null, t('owner.yourReply')), box), send);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await replyToReview(r.id, box.value); toast(t('owner.replied')); } catch (error) { toast(error.message); }
  });
  li.append(form);
  return li;
}

function renderPlaceForm() {
  const form = $('.owner-place-form');
  form.description.value = dash.place.description ?? '';
  form.phone.value = dash.place.phone ?? '';
  $('.owner-view').href = `/place.html?id=${dash.place.id}`;
}

function wirePlaceForm() {
  const form = $('.owner-place-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = form.querySelector('.owner-error');
    err.textContent = '';
    try {
      await updateMyPlace({ description: form.description.value, phone: form.phone.value.trim() });
      toast(t('owner.placeSaved'));
    } catch (error) {
      err.textContent = error.message;
    }
  });
}

function wireRenew() {
  const form = $('.owner-renew__form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = form.querySelector('.owner-error');
    err.textContent = '';
    const plan = form.querySelector('input[name="months"]:checked');
    try {
      await renewSubscription({ months: plan.value, amount: plan.dataset.amount, paymentMethod: form.paymentMethod.value,
        paymentRef: form.paymentRef.value, proof: form.proof.files[0] });
      load();
    } catch (error) {
      err.textContent = error.message;
    }
  });
}

// ---- load ----

async function load() {
  dash = await getOwnerDashboard();
  renderHeader();
  $('.owner-posts').replaceChildren(...dash.posts.map(postItem));
  $('.owner-posts__empty').hidden = dash.posts.length > 0;
  $('.owner-reviews').replaceChildren(...dash.reviews.map(reviewItem));
  $('.owner-reviews__empty').hidden = dash.reviews.length > 0;
  renderPlaceForm();
}

async function start() {
  let { user } = await getSession();
  if (!user) {
    const session = await askToLogin();
    if (!session) { location.href = '/home.html'; return; }
    user = session.user;
  }
  try {
    await load();
  } catch (error) {
    if (error.status === 403) { $('.owner-none').hidden = false; $('.owner-name').textContent = t('owner.eyebrow'); return; }
    throw error;
  }
  $('.owner-main').hidden = false;
  $('.app-demo').hidden = !USE_MOCK;
  wireTicket();
  wirePostForm();
  wirePlaceForm();
  wireRenew();
}

start();
