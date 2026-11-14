// Entry script for messages.html (flowchart 2c): conversations with shops on the left, the open
// chat on the right (one at a time on phones). messages.html?with=<user id> opens or starts a chat
// (the place page's Message button). A first message is a request until the shop accepts; nobody
// can message across a block.
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/components/brand.css';
import '../styles/components/app-top.css';
import '../styles/components/app-nav.css';
import '../styles/components/login-dialog.css';
import '../styles/pages/app.css';
import '../styles/pages/messages.css';
import { initI18n, t } from '../i18n/i18n.js';
import { getSession, getConversations, getMessages, sendMessage, acceptMessageRequest } from '../api/api.js';
import { mountAppNav } from '../components/app-nav.js';
import { askToLogin } from '../components/login-dialog.js';
import { el, ago, toast } from '../lib/dom.js';
import { timeInYangon } from '../lib/format.js';

initI18n();
mountAppNav('messages');

const $ = (sel) => document.querySelector(sel);
let user = null;
let openId = Number(new URLSearchParams(location.search).get('with')) || null;

async function renderList() {
  const list = await getConversations();
  $('.msg-list').replaceChildren(...list.map((c) => {
    const b = el('button', 'msg-list__item');
    b.type = 'button';
    if (c.other.id === openId) b.setAttribute('aria-current', 'true');
    b.append(
      el('span', 'msg-list__avatar', c.other.name.trim()[0]),
      el('span', 'msg-list__text',
        el('b', null, c.other.name),
        el('span', 'msg-list__last', c.last.senderId === user.id ? `${t('msg.you')}: ${c.last.body}` : c.last.body)),
      el('span', 'msg-list__side', el('small', null, ago(c.last.createdAt)), c.unread ? el('i', 'msg-list__unread', String(c.unread)) : null));
    b.addEventListener('click', () => open(c.other.id));
    return el('li', null, b);
  }));
  $('.msg-empty').hidden = list.length > 0 || openId != null;
}

async function open(id) {
  openId = id;
  history.replaceState(null, '', `?with=${id}`);
  document.body.classList.add('is-chat-open');
  const chat = await getMessages(id);
  const head = $('.msg-chat__head');
  const back = el('button', 'msg-chat__back', `← ${t('msg.back')}`);
  back.type = 'button';
  back.addEventListener('click', () => { document.body.classList.remove('is-chat-open'); openId = null; history.replaceState(null, '', location.pathname); renderList(); });
  const shop = chat.other.placeId ? el('a', 'app-link', t('msg.openShop')) : null;
  if (shop) shop.href = `/place.html?id=${chat.other.placeId}`;
  head.replaceChildren(back, el('b', null, chat.other.name), shop);

  $('.msg-chat__log').replaceChildren(...chat.messages.map((m) => {
    const mine = m.senderId === user.id;
    const time = el('time', null, timeInYangon(m.createdAt));
    time.dateTime = m.createdAt;
    return el('li', mine ? 'msg-bubble is-mine' : 'msg-bubble', el('p', null, m.body), time);
  }));
  const note = $('.msg-chat__note');
  note.hidden = !(chat.blocked || chat.status === 'request');
  note.textContent = chat.blocked ? t('msg.blocked') : t('msg.request');
  // A request someone sent me: I can accept it (shop owners get these from customers).
  const theirs = chat.status === 'request' && chat.messages.some((m) => m.senderId === id);
  if (theirs && !chat.blocked) {
    const accept = el('button', 'app-button app-button--gold', t('owner.accept'));
    accept.type = 'button';
    accept.addEventListener('click', async () => { await acceptMessageRequest(id); toast(t('owner.accepted')); open(id); });
    note.replaceChildren(t('msg.request'), ' ', accept);
  }
  $('.msg-form').hidden = chat.blocked;
  $('.msg-chat').hidden = false;
  $('.msg-pick').hidden = true;
  $('.msg-chat__log').lastElementChild?.scrollIntoView({ block: 'end' });
  renderList();
}

async function start() {
  ({ user } = await getSession());
  if (!user) {
    const session = await askToLogin();
    if (!session) { location.href = '/explore.html'; return; }
    user = session.user;
  }
  $('.msg-form textarea').placeholder = t('msg.placeholder');
  $('.msg-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const box = $('.msg-form textarea');
    if (!box.value.trim() || !openId) return;
    try {
      await sendMessage(openId, box.value);
      box.value = '';
      open(openId);
    } catch (error) {
      toast(error.status === 403 ? t('msg.errBlocked') : t('msg.errSend'));
    }
  });
  $('.msg-form textarea').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('.msg-form').requestSubmit(); }
  });
  await renderList();
  if (openId) open(openId);
}

start();
