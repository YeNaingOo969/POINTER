// Entry script for home.html (flowchart 2): a greeting, the seven category groups, deals ending
// soon and the latest posts from shops. Visitors see the same page with a "Discover Yangon" title.
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/components/brand.css';
import '../styles/components/app-top.css';
import '../styles/components/app-nav.css';
import '../styles/pages/app.css';
import { initI18n, t, categoryName } from '../i18n/i18n.js';
import { getSession, getHome, getCategories } from '../api/api.js';
import { USE_MOCK } from '../api/config.js';
import { mountAppNav } from '../components/app-nav.js';
import { postCard } from '../components/post-card.js';
import { el, timeLeft } from '../lib/dom.js';
import { number } from '../lib/format.js';
import { revealList } from '../lib/reveal.js';

initI18n();
mountAppNav('home');

const $ = (sel) => document.querySelector(sel);

function dealTile(deal) {
  const a = el('a', 'deal-card');
  a.href = `/deals.html?post=${deal.id}`;
  a.dataset.cat = deal.place.category?.group ?? 'other';
  a.style.textDecoration = 'none';
  a.style.color = 'inherit';
  a.append(
    el('p', 'deal-card__shop', el('b', null, deal.place.name)),
    el('p', 'deal-card__offer', deal.discountText),
    el('p', 'deal-card__meta',
      el('span', null, t('deals.endsIn').replace('{t}', timeLeft(deal.expiresAt) ?? '')),
      el('span', null, t('deals.left').replace('{n}', number(deal.ticketsLeft)))));
  return el('li', null, a);
}

async function start() {
  $('.app-demo').hidden = !USE_MOCK;
  try {
    const [{ user }, home, categories] = await Promise.all([getSession(), getHome(), getCategories()]);
    if (user) {
      $('.app-hero__title').replaceChildren(t('home.hello'), ' ', el('span', 'home-name', user.name));
    }
    $('.home-groups').replaceChildren(...categories.map((c) => {
      const a = el('a', 'app-chip', categoryName(c));
      a.href = `/explore.html?group=${c.group}`;
      a.dataset.cat = c.group;
      return a;
    }));
    $('.home-deals').replaceChildren(...home.deals.map(dealTile));
    $('.home-posts').replaceChildren(...home.posts.map((p) => postCard(p)));
    $('.home-empty').hidden = home.posts.length > 0;
    revealList([...document.querySelectorAll('.home-deals .deal-card, .home-posts .post-card')]);
  } catch (error) {
    console.error(error);
    $('.home-empty').hidden = false;
    $('.home-empty').textContent = t('home.loadFailed');
  }
}

start();
