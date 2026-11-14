// Small DOM helpers shared by the customer pages (home, deals, messages).
import { t } from '../i18n/i18n.js';

/** Build an element; children are text (always set as text, never HTML) or nodes. */
export function el(tag, className, ...children) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.append(...children.filter((c) => c != null && c !== false));
  return node;
}

let toastTimer = 0;
/** Short status message at the bottom of the page (role=status). */
export function toast(message) {
  let box = document.querySelector('.app-toast');
  if (!box) {
    box = el('p', 'app-toast');
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    document.body.append(box);
  }
  box.textContent = message;
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { box.hidden = true; }, 3500);
}

/** "5 h 20 min left" until an ISO time (null when it has passed). */
export function timeLeft(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const min = Math.ceil(ms / 60000);
  const h = Math.floor(min / 60);
  return h ? t('time.left').replace('{h}', h).replace('{m}', min % 60) : t('time.leftMin').replace('{m}', min);
}

/** "3 h ago" style age of an ISO time. */
export function ago(iso) {
  const min = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return t('time.minutes').replace('{n}', min);
  const h = Math.round(min / 60);
  if (h < 24) return t('time.hours').replace('{n}', h);
  return t('time.days').replace('{n}', Math.round(h / 24));
}
