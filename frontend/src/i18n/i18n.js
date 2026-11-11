// UI strings (English). Every visible string lives in en.json so wording is changed in one place.
// Mark elements with data-i18n="key" (text) or data-i18n-attr="placeholder:key" (attributes).
import en from './en.json';

/** Look up a dotted key ("landing.title"); falls back to the key itself. */
export function t(key) {
  return key.split('.').reduce((node, part) => node?.[part], en) ?? key;
}

/** Fill every marked element under root. */
export function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    for (const pair of el.dataset.i18nAttr.split(',')) {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      el.setAttribute(attr, t(key));
    }
  });
}

export function initI18n() {
  document.documentElement.lang = 'en';
  applyTranslations();
}
