// English / Burmese UI strings (scope doc: English is the default, users can switch to Burmese).
// Mark elements with data-i18n="key" (text), data-i18n-html="key" (our own strings with <b> only —
// never user data) or data-i18n-attr="placeholder:key" (attributes).
// Place names, addresses and what users write are shown as stored, in whatever language.
import en from './en.json';
import my from './my.json';

const DICTIONARIES = { en, my };
const STORAGE_KEY = 'pointer.lang';
const DEFAULT_LANG = 'en';

let currentLang = DEFAULT_LANG;

/** The saved language; storage can be unavailable in private mode. */
function loadLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved in DICTIONARIES ? saved : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

/** Look up a dotted key ("place.call") in the current language, falling back to English. */
export function t(key) {
  const find = (dict) => key.split('.').reduce((node, part) => node?.[part], dict);
  return find(DICTIONARIES[currentLang]) ?? find(DICTIONARIES[DEFAULT_LANG]) ?? key;
}

/** A category group's name in the current language (the database only stores English). */
export function categoryName(category) {
  if (!category) return '';
  const key = `cat.${category.icon}`;
  const name = t(key);
  return name === key ? category.name : name;
}

export const getLang = () => currentLang;

/** Fill every marked element under root. */
export function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-html]').forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    for (const pair of el.dataset.i18nAttr.split(',')) {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      el.setAttribute(attr, t(key));
    }
  });
}

/** Switch language. Pages render a lot of text from data, so the simplest correct refresh is a reload. */
export function setLang(lang) {
  if (!(lang in DICTIONARIES) || lang === currentLang) return;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* the choice just won't persist */
  }
  location.reload();
}

export function initI18n() {
  currentLang = loadLang();
  document.documentElement.lang = currentLang;
  applyTranslations();
  // Every [data-lang-toggle] button switches between English and Burmese.
  document.querySelectorAll('[data-lang-toggle]').forEach((button) => {
    button.addEventListener('click', () => setLang(currentLang === 'en' ? 'my' : 'en'));
  });
}
