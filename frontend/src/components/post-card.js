// A shop post as a card (Home feed, place page): shop name with its group colour, a tag (Pinned /
// Deal / News), the text, an optional image and its age. Deals link to deals.html?post=<id>.
import { t, categoryName } from '../i18n/i18n.js';
import { el, ago } from '../lib/dom.js';

/** @param {object} post  Post from the API (with `place`) @param {{ showShop?: boolean }} [opts] */
export function postCard(post, { showShop = true } = {}) {
  const card = el('article', 'post-card');
  card.dataset.cat = post.place.category?.group ?? 'other';
  if (showShop) {
    const shop = el('a', null, post.place.name);
    shop.href = `/place.html?id=${post.place.id}`;
    card.append(el('p', 'post-card__shop', shop, ' · ', categoryName(post.place.category)));
  }
  const tags = el('div', 'deal-card__meta');
  if (post.isPinned) tags.append(el('span', 'post-card__tag', `📌 ${t('posts.pinned')}`));
  tags.append(el('span', post.type === 'discount' ? 'post-card__tag post-card__tag--deal' : 'post-card__tag',
    t(post.type === 'discount' ? 'posts.discount' : 'posts.normal')));
  card.append(tags);
  if (post.type === 'discount') card.append(el('p', 'deal-card__offer', post.discountText));
  card.append(el('p', 'post-card__text', post.content));
  if (post.imageUrl) {
    const img = el('img', 'post-card__img');
    img.src = post.imageUrl;
    img.alt = '';
    img.loading = 'lazy';
    card.append(img);
  }
  const time = el('time', null, ago(post.createdAt));
  time.dateTime = post.createdAt;
  card.append(time);
  if (post.type === 'discount') {
    const go = el('a', 'app-button app-button--gold', t('deals.get'));
    go.href = `/deals.html?post=${post.id}`;
    card.append(el('div', 'deal-card__actions', go));
  }
  return card;
}
