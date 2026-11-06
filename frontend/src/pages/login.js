// Entry script for login.html: log in or create an account, then go back to ?next=.
// login.html#register opens on the "Create account" tab.
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/components/brand.css';
import '../styles/components/app-top.css';
import '../styles/pages/auth.css';
import { initI18n, getLang, setLang, t } from '../i18n/i18n.js';
import { getSession, login, logout, register } from '../api/api.js';
import { USE_MOCK } from '../api/config.js';

initI18n();

const $ = (sel, root = document) => root.querySelector(sel);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Where to go after logging in: a path on this site only (never another origin). */
const next = (() => {
  const value = new URLSearchParams(location.search).get('next');
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/explore.html';
})();

$('.app-top__lang').addEventListener('click', () => setLang(getLang() === 'my' ? 'en' : 'my'));
$('.auth__demo').hidden = !USE_MOCK;
$('.auth__continue').href = next;

// ---- Tabs ----

const tabs = [...document.querySelectorAll('.auth__tab')];
function showTab(id) {
  for (const tab of tabs) {
    const active = tab.id === id;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
  }
}
tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => showTab(tab.id));
  tab.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const other = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    showTab(other.id);
    other.focus();
  });
});
if (location.hash === '#register') showTab('tab-register');

// ---- Show / hide password ----

for (const button of document.querySelectorAll('.field__toggle')) {
  button.addEventListener('click', () => {
    const input = button.previousElementSibling;
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    button.dataset.i18n = showing ? 'auth.show' : 'auth.hide';
    button.textContent = t(button.dataset.i18n);
  });
}

// ---- Validation ----

function setError(input, key) {
  const box = document.getElementById(`${input.id}-error`);
  box.dataset.i18n = key ?? '';
  box.textContent = key ? t(key) : '';
  input.setAttribute('aria-invalid', String(Boolean(key)));
  const described = [input.getAttribute('aria-describedby')?.replace(box.id, '').trim(), key ? box.id : ''].filter(Boolean).join(' ');
  if (described) input.setAttribute('aria-describedby', described); else input.removeAttribute('aria-describedby');
}

/** Returns the i18n key of the first problem with a field, or null. */
function problem(input, form) {
  const value = input.value.trim();
  if (!value) return 'auth.errRequired';
  if (input.type === 'email' && !EMAIL.test(value)) return 'auth.errEmail';
  if (input.name === 'name' && (value.length < 2 || value.length > 100)) return 'auth.errName';
  if (form.id === 'register-form' && input.name === 'password' && input.value.length < 8) return 'auth.errPassword';
  if (input.name === 'confirm' && input.value !== form.elements.password.value) return 'auth.errMatch';
  return null;
}

function validate(form) {
  let first = null;
  for (const input of form.querySelectorAll('input')) {
    const key = problem(input, form);
    setError(input, key);
    if (key && !first) first = input;
  }
  first?.focus();
  return !first;
}

for (const input of document.querySelectorAll('.auth-form input')) {
  input.addEventListener('input', () => { if (input.getAttribute('aria-invalid') === 'true') setError(input, null); });
}

// ---- Submit ----

const ERRORS = { 401: 'auth.errWrong', 403: 'auth.errSuspended', 409: 'auth.errTaken' };

async function submit(form, action) {
  const alert = $('.auth-form__error', form);
  alert.textContent = '';
  if (!validate(form)) return;
  const button = $('.auth-form__submit', form);
  const label = button.dataset.i18n;
  button.disabled = true;
  button.textContent = t('auth.working');
  try {
    await action(Object.fromEntries(new FormData(form)));
    location.assign(next);
  } catch (error) {
    // 422 carries the server's own validation message; other codes have a translated one.
    alert.textContent = error.status === 422 ? error.message : t(ERRORS[error.status] ?? 'auth.errGeneric');
    button.disabled = false;
    button.textContent = t(label);
  }
}

$('#login-form').addEventListener('submit', (e) => {
  e.preventDefault();
  submit(e.target, ({ email, password }) => login({ email: email.trim(), password }));
});

$('#register-form').addEventListener('submit', (e) => {
  e.preventDefault();
  submit(e.target, ({ name, email, password }) => register({ name: name.trim(), email: email.trim(), password }));
});

// ---- Already logged in? ----

async function renderSession() {
  const { user } = await getSession();
  $('.auth__signed').hidden = !user;
  $('.auth__forms').hidden = Boolean(user);
  if (user) $('.auth__signed-name').textContent = user.name;
}

$('.auth__logout').addEventListener('click', async () => {
  await logout();
  renderSession();
});

renderSession();
