// English / Burmese UI strings.
// Mark elements with data-i18n="key" (text) or data-i18n-attr="placeholder:key" (attributes).
import en from './en.json';
import my from './my.json';

const DICTIONARIES = { en, my };
const STORAGE_KEY = 'yg.lang';
const DEFAULT_LANG = 'en';

let currentLang = DEFAULT_LANG;

/** Read the saved language; storage can be unavailable in private mode. */
function loadLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved in DICTIONARIES ? saved : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

/** Look up a dotted key ("landing.title") in the current language, falling back to English. */
export function t(key) {
  const find = (dict) => key.split('.').reduce((node, part) => node?.[part], dict);
  return find(DICTIONARIES[currentLang]) ?? find(DICTIONARIES[DEFAULT_LANG]) ?? key;
}

/** Pick the right side of a bilingual { en, my } data field. */
export function localize(field) {
  if (field == null || typeof field === 'string') return field ?? '';
  return field[currentLang] || field[DEFAULT_LANG] || '';
}

export function getLang() {
  return currentLang;
}

/** Translate every marked element under root. */
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

export function setLang(lang) {
  if (!(lang in DICTIONARIES)) return;
  currentLang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* language just won't persist */
  }
  document.documentElement.lang = lang;
  applyTranslations();
  document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
}

export function initI18n() {
  currentLang = loadLang();
  document.documentElement.lang = currentLang;
  applyTranslations();
}
