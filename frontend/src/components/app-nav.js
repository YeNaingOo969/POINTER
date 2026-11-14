// App navigation for the customer pages: Home · Map · Deals · Messages · Account as glass pills
// (top centre on desktop, a tab bar at the bottom on phones), plus a notification bell with an
// unread badge and a drop-down list. Mount it once per page: mountAppNav('deals').
import { t } from '../i18n/i18n.js';
import { getSession, getNotifications, markNotificationsRead } from '../api/api.js';

// Small line icons (24 × 24, stroke only).
const ICON = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M10 20v-5h4v5"/>',
  map: '<path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4z"/><path d="M9 4v13M15 6.5v13"/>',
  deals: '<path d="M3 12V4h8l10 10-8 8L3 12z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
  messages: '<path d="M4 5h16v11H9l-5 4V5z"/>',
  account: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4.5 4.5-6 8-6s6.5 1.5 8 6"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
};
const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;

const TABS = [
  ['home', '/home.html'],
  ['map', '/explore.html'],
  ['deals', '/deals.html'],
  ['messages', '/messages.html'],
  ['account', '/account.html'],
];

/** Where a notification leads. */
function linkFor(n) {
  switch (n.type) {
    case 'new_deal': return `/deals.html?post=${n.refId}`;
    case 'message': return '/messages.html';
    case 'review_reply': return '/account.html#reviews-title';
    case 'request_approved':
    case 'request_rejected': return '/account.html#business-title';
    default: return '/account.html';
  }
}

function ago(iso) {
  const min = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return t('time.minutes').replace('{n}', min);
  const h = Math.round(min / 60);
  if (h < 24) return t('time.hours').replace('{n}', h);
  return t('time.days').replace('{n}', Math.round(h / 24));
}

/**
 * @param {'home'|'map'|'deals'|'messages'|'account'|null} active
 * @param {{ bottom?: boolean }} [opts]  bottom: keep the tabs at the bottom on desktop too (map page)
 */
export async function mountAppNav(active, { bottom = false } = {}) {
  const nav = document.createElement('nav');
  nav.className = 'app-tabs';
  nav.setAttribute('aria-label', t('nav.label'));
  for (const [key, href] of TABS) {
    const a = document.createElement('a');
    a.className = 'app-tabs__link';
    a.href = href;
    a.innerHTML = `${svg(key)}<span></span>`;
    a.querySelector('span').textContent = t(`nav.${key}`);
    if (key === active) a.setAttribute('aria-current', 'page');
    nav.append(a);
  }
  if (bottom) nav.classList.add('app-tabs--bottom');
  document.body.append(nav);
  document.body.classList.add('has-app-tabs');

  // Bell: only for logged-in users.
  const { user } = await getSession().catch(() => ({ user: null }));
  if (!user) return;
  const top = document.querySelector('.app-top');
  if (!top) return; // pages with their own top bar (the map) keep their account button
  const wrap = document.createElement('div');
  wrap.className = 'notif';
  wrap.innerHTML = `
    <button class="app-top__pill notif__bell" type="button" aria-expanded="false">${svg('bell')}<b class="notif__badge" hidden></b></button>
    <div class="notif__panel" role="dialog" hidden>
      <p class="notif__title"></p>
      <ul class="notif__list"></ul>
      <p class="notif__empty" hidden></p>
    </div>`;
  const lang = top.querySelector('[data-lang-toggle]');
  top.insertBefore(wrap, lang);
  const bell = wrap.querySelector('.notif__bell');
  const panel = wrap.querySelector('.notif__panel');
  bell.setAttribute('aria-label', t('notif.title'));
  wrap.querySelector('.notif__title').textContent = t('notif.title');
  wrap.querySelector('.notif__empty').textContent = t('notif.empty');

  let items = await getNotifications().catch(() => []);
  const render = () => {
    const unread = items.filter((n) => !n.isRead).length;
    const badge = wrap.querySelector('.notif__badge');
    badge.hidden = unread === 0;
    badge.textContent = String(unread);
    wrap.querySelector('.notif__empty').hidden = items.length > 0;
    wrap.querySelector('.notif__list').replaceChildren(...items.map((n) => {
      const li = document.createElement('li');
      li.className = n.isRead ? 'notif__item' : 'notif__item is-unread';
      const a = document.createElement('a');
      a.href = linkFor(n);
      const text = document.createElement('span');
      text.textContent = t(`notif.${n.type}`);
      const time = document.createElement('small');
      time.textContent = ago(n.createdAt);
      a.append(text, time);
      li.append(a);
      return li;
    }));
  };
  render();

  const close = () => { panel.hidden = true; bell.setAttribute('aria-expanded', 'false'); };
  bell.addEventListener('click', async (e) => {
    e.stopPropagation();
    const open = panel.hidden;
    panel.hidden = !open;
    bell.setAttribute('aria-expanded', String(open));
    if (open && items.some((n) => !n.isRead)) {
      await markNotificationsRead();
      setTimeout(() => { items = items.map((n) => ({ ...n, isRead: true })); render(); }, 1500);
    }
  });
  document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}
