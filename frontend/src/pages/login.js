// Entry script for login.html: log in, register with regex + email OTP verification,
// or continue with Google, then return to ?next=.
// login.html#register opens on the "Create account" tab.
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/components/brand.css';
import '../styles/components/app-top.css';
import '../styles/pages/auth.css';
import { getLang, initI18n, t } from '../i18n/i18n.js';
import { getSession, googleLogin, login, logout, sendRegisterOtp, verifyRegisterOtp } from '../api/api.js';
import { GOOGLE_CLIENT_ID, USE_MOCK } from '../api/config.js';
import { embers } from '../landing/embers.js';

initI18n();
const stopEmbers = embers(document.querySelector('.auth-bg__embers'));
addEventListener('pagehide', stopEmbers);

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const encoder = new TextEncoder();

// Strict email regex matching backend include/auth_helpers.php
const EMAIL_LOCAL = /^[a-zA-Z0-9](?:[a-zA-Z0-9._%+\-]{0,62}[a-zA-Z0-9])?$/;
const EMAIL_DOMAIN = /^[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
const NAME_REGEX = /^[\p{L}\p{M}0-9][\p{L}\p{M}0-9\s'.\-]{1,99}$/u;

const PASSWORD_RULES = [
  { key: 'length',  test: (v) => v.length >= 8 && encoder.encode(v).length <= 72 },
  { key: 'upper',   test: (v) => /[A-Z]/.test(v) },
  { key: 'lower',   test: (v) => /[a-z]/.test(v) },
  { key: 'number',  test: (v) => /[0-9]/.test(v) },
  { key: 'special', test: (v) => /[^A-Za-z0-9\s]/.test(v) },
];

const EMAIL_TYPOS = new Set([
  'gmial.com', 'gmal.com', 'gamil.com', 'gnail.com', 'gmail.con', 'gmail.co',
  'yaho.com', 'yahoo.con', 'outlok.com', 'hotmal.com', 'hotmail.con',
]);

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'yopmail.com', '10minutemail.com', 'guerrillamail.com',
  'guerrillamailblock.com', 'sharklasers.com', 'tempmail.com', 'temp-mail.org',
  'trashmail.com', 'fakeinbox.com', 'maildrop.cc', 'getnada.com',
  'dispostable.com', 'throwawaymail.com', 'mintemail.com', 'mohmal.com',
  'emailondeck.com', 'burnermail.io', 'tempail.com', 'tmpmail.org',
  'tmpmail.net', 'mailnesia.com', 'example.com', 'example.org', 'example.net',
]);

function isValidEmail(value) {
  if (!value || value.length > 150) return false;
  const parts = value.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  return !local.includes('..') && EMAIL_LOCAL.test(local) && EMAIL_DOMAIN.test(domain);
}

function emailProblem(value, strict = false) {
  if (!isValidEmail(value)) return 'auth.errEmail';
  if (!strict) return null;
  const domain = value.split('@')[1].toLowerCase();
  const tld = domain.slice(domain.lastIndexOf('.') + 1);
  if (['test', 'invalid', 'example', 'local', 'localhost'].includes(tld) || DISPOSABLE_DOMAINS.has(domain)) {
    return 'auth.errEmailDisposable';
  }
  if (EMAIL_TYPOS.has(domain)) {
    return 'auth.errEmailTypo';
  }
  return null;
}

function isValidName(value) {
  return value.length >= 2 && value.length <= 100 && NAME_REGEX.test(value) && /\p{L}/u.test(value);
}

/** Where to go after logging in: a path on this site only (never another origin). */
const next = (() => {
  const value = new URLSearchParams(location.search).get('next');
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/explore.html';
})();

$('.auth__demo').hidden = !USE_MOCK;
$('.auth__continue').href = next;

// ---- State ----

let pendingRegistration = null;
let resendTimer = 0;
let resendSeconds = 0;
let googleInitialized = false;
let activeGoogleClientId = GOOGLE_CLIENT_ID;
let sessionDbError = '';

// ---- Tabs ----

const tabs = $$('.auth__tab');
const intro = $('.auth__intro');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

/** The big greeting follows the tab ("Welcome back." / "Join POINTER."), with a short cross-fade. */
function setGreeting(kind) {
  const apply = () => {
    for (const [sel, key] of [['.auth__title', `auth.title${kind}`], ['.auth__lede', `auth.lede${kind}`]]) {
      const node = $(sel);
      node.dataset.i18n = key;
      node.textContent = t(key);
    }
    intro.classList.remove('is-switching');
  };
  if (reduceMotion.matches || $('.auth__title').dataset.i18n === `auth.title${kind}`) return apply();
  intro.classList.add('is-switching');
  setTimeout(apply, 220);
}

function showTab(id) {
  const isRegister = id === 'tab-register';
  for (const tab of tabs) {
    const active = tab.id === id;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
  }
  $('#register-otp-form').hidden = true;
  $('#auth-google-section').hidden = false;
  if (!sessionDbError) $('#google-setup-notice').hidden = true;
  $('.auth__tabs').dataset.active = isRegister ? 'register' : 'login';
  setGreeting(isRegister ? 'Register' : 'Login');
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
addEventListener('hashchange', () => {
  if (location.hash === '#register') showTab('tab-register');
  else if (location.hash === '#login') showTab('tab-login');
});

// ---- Show / hide password ----

for (const button of $$('.field__toggle')) {
  button.addEventListener('click', () => {
    const input = button.parentElement.querySelector('input');
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    button.dataset.i18n = showing ? 'auth.show' : 'auth.hide';
    button.textContent = t(button.dataset.i18n);
  });
}

// ---- Live password regex checklist & confirm match ----

const registerPwInput = $('#register-password');
const registerConfirmInput = $('#register-confirm');
const pwMeter = $('.pw-meter');
const pwStrengthText = $('#pw-strength-text');
const confirmMatchEl = $('#register-confirm-match');

function updatePasswordChecklist(value) {
  let metCount = 0;
  for (const rule of PASSWORD_RULES) {
    const met = rule.test(value);
    if (met) metCount += 1;
    const item = $(`.pw-rule[data-rule="${rule.key}"]`);
    if (item) item.dataset.met = String(met);
  }

  let level = 0;
  let key = 'auth.pwStrengthIdle';
  if (value.length > 0) {
    if (metCount <= 2 || value.length < 8) {
      level = 1;
      key = 'auth.pwStrengthWeak';
    } else if (metCount === 3) {
      level = 2;
      key = 'auth.pwStrengthFair';
    } else if (metCount === 4) {
      level = 3;
      key = 'auth.pwStrengthGood';
    } else {
      level = 4;
      key = 'auth.pwStrengthStrong';
    }
  }
  pwMeter.dataset.level = String(level);
  pwStrengthText.dataset.i18n = key;
  pwStrengthText.textContent = t(key);
}

function updateConfirmMatch() {
  const pw = registerPwInput.value;
  const confirm = registerConfirmInput.value;
  if (!confirm) {
    confirmMatchEl.hidden = true;
    confirmMatchEl.textContent = '';
    delete confirmMatchEl.dataset.state;
    return;
  }
  const matches = pw === confirm;
  const key = matches ? 'auth.matchOk' : 'auth.matchNo';
  confirmMatchEl.hidden = false;
  confirmMatchEl.dataset.state = matches ? 'ok' : 'no';
  confirmMatchEl.dataset.i18n = key;
  confirmMatchEl.textContent = t(key);
}

registerPwInput.addEventListener('input', () => {
  updatePasswordChecklist(registerPwInput.value);
  updateConfirmMatch();
});
registerConfirmInput.addEventListener('input', updateConfirmMatch);
updatePasswordChecklist(registerPwInput.value);

// ---- Validation ----

function setError(input, key) {
  const box = document.getElementById(`${input.id}-error`);
  if (!box) return;
  box.dataset.i18n = key ?? '';
  box.textContent = key ? t(key) : '';
  input.setAttribute('aria-invalid', String(Boolean(key)));
  const described = [input.getAttribute('aria-describedby')?.replace(box.id, '').trim(), key ? box.id : ''].filter(Boolean).join(' ');
  if (described) input.setAttribute('aria-describedby', described); else input.removeAttribute('aria-describedby');
}

/** Returns the i18n key of the first problem with a field, or null. */
function problem(input, form) {
  const raw = input.value;
  const value = raw.trim();
  if (!value) return 'auth.errRequired';
  if (input.type === 'email') {
    const emailErr = emailProblem(value, form.id === 'register-form');
    if (emailErr) return emailErr;
  }
  if (input.name === 'name') {
    if (value.length < 2 || value.length > 100) return 'auth.errName';
    if (!isValidName(value)) return 'auth.errNameFormat';
  }
  if (form.id === 'register-form' && input.name === 'password') {
    if (encoder.encode(raw).length > 72) return 'auth.errPasswordBytes';
    if (!PASSWORD_RULES.every((r) => r.test(raw))) return 'auth.errPasswordStrong';
  }
  if (input.name === 'confirm' && raw !== form.elements.password.value) return 'auth.errMatch';
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

for (const input of $$('.auth-form input:not(.otp-box)')) {
  input.addEventListener('input', () => {
    if (input.getAttribute('aria-invalid') === 'true') setError(input, null);
  });
  if (input.type === 'email') {
    input.addEventListener('blur', () => {
      if (input.value.trim()) setError(input, problem(input, input.form));
    });
  }
}

// ---- OTP Step 2 ----

const otpForm = $('#register-otp-form');
const otpBoxes = $$('.otp-box', otpForm);
const otpResendBtn = $('#otp-resend-btn');
const otpDevBanner = $('#otp-dev-banner');
const otpDevCode = $('#otp-dev-code');

function getOtpCode() {
  return otpBoxes.map((b) => b.value.trim()).join('');
}

function setOtpError(messageOrKey, isRaw = false) {
  const box = $('#otp-code-error');
  box.dataset.i18n = isRaw ? '' : (messageOrKey ?? '');
  box.textContent = messageOrKey ? (isRaw ? messageOrKey : t(messageOrKey)) : '';
  const invalid = Boolean(messageOrKey);
  otpBoxes.forEach((b) => b.setAttribute('aria-invalid', String(invalid)));
}

function fillOtpDigits(startIndex, digits) {
  const clean = digits.replace(/\D/g, '');
  if (!clean) return;
  let idx = startIndex;
  for (const ch of clean) {
    if (idx >= otpBoxes.length) break;
    otpBoxes[idx].value = ch;
    otpBoxes[idx].dataset.filled = 'true';
    idx += 1;
  }
  setOtpError(null);
  $('.auth-form__error', otpForm).textContent = '';
  const nextFocus = Math.min(idx, otpBoxes.length - 1);
  otpBoxes[nextFocus].focus();
}

otpBoxes.forEach((box, index) => {
  box.addEventListener('input', (e) => {
    const digits = e.target.value.replace(/\D/g, '');
    if (digits.length > 1) {
      e.target.value = '';
      fillOtpDigits(index, digits);
      return;
    }
    e.target.value = digits;
    e.target.dataset.filled = String(Boolean(digits));
    setOtpError(null);
    $('.auth-form__error', otpForm).textContent = '';
    if (digits && index < otpBoxes.length - 1) {
      otpBoxes[index + 1].focus();
    }
  });

  box.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace') {
      if (box.value) {
        box.value = '';
        box.dataset.filled = 'false';
      } else if (index > 0) {
        otpBoxes[index - 1].value = '';
        otpBoxes[index - 1].dataset.filled = 'false';
        otpBoxes[index - 1].focus();
      }
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpBoxes[index - 1].focus();
      e.preventDefault();
    } else if (e.key === 'ArrowRight' && index < otpBoxes.length - 1) {
      otpBoxes[index + 1].focus();
      e.preventDefault();
    }
  });

  box.addEventListener('paste', (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
    if (!pasted) return;
    fillOtpDigits(pasted.length >= otpBoxes.length ? 0 : index, pasted);
  });

  box.addEventListener('focus', () => box.select());
});

function startResendCooldown(seconds = 60) {
  clearInterval(resendTimer);
  resendSeconds = Math.max(0, Math.round(seconds));
  const paint = () => {
    if (resendSeconds <= 0) {
      clearInterval(resendTimer);
      otpResendBtn.disabled = false;
      otpResendBtn.dataset.i18n = 'auth.otpResend';
      otpResendBtn.textContent = t('auth.otpResend');
      return;
    }
    otpResendBtn.disabled = true;
    otpResendBtn.dataset.i18n = '';
    otpResendBtn.textContent = t('auth.otpResendWait').replace('{s}', String(resendSeconds));
  };
  paint();
  if (resendSeconds > 0) {
    resendTimer = setInterval(() => {
      resendSeconds -= 1;
      paint();
    }, 1000);
  }
}

function showOtpStep(email, res) {
  $('#register-form').hidden = true;
  $('#auth-google-section').hidden = true;
  otpForm.hidden = false;
  $('.auth-otp__email').textContent = email;
  $('.auth-form__error', otpForm).textContent = '';
  setOtpError(null);

  otpBoxes.forEach((b) => {
    b.value = '';
    b.dataset.filled = 'false';
  });

  if (res?.devCode) {
    otpDevBanner.hidden = false;
    otpDevCode.textContent = res.devCode;
  } else {
    otpDevBanner.hidden = true;
    otpDevCode.textContent = '';
  }

  startResendCooldown(res?.resendCooldown ?? 60);
  otpBoxes[0].focus();
}

$('#otp-dev-fill').addEventListener('click', () => {
  const code = otpDevCode.textContent.trim();
  if (code) fillOtpDigits(0, code);
});

$('#otp-back-btn').addEventListener('click', () => {
  clearInterval(resendTimer);
  otpForm.hidden = true;
  $('#register-form').hidden = false;
  $('#auth-google-section').hidden = false;
  $('#register-email').focus();
});

otpResendBtn.addEventListener('click', async () => {
  if (!pendingRegistration || otpResendBtn.disabled) return;
  const alert = $('.auth-form__error', otpForm);
  alert.textContent = '';
  otpResendBtn.disabled = true;
  try {
    const res = await sendRegisterOtp({ ...pendingRegistration, resend: true });
    showOtpStep(pendingRegistration.email, res);
  } catch (error) {
    alert.textContent = error.status === 422 || error.status === 429
      ? error.message
      : t(ERRORS[error.status] ?? 'auth.errGeneric');
    otpResendBtn.disabled = false;
  }
});

// ---- Submit ----

const ERRORS = {
  401: 'auth.errWrong',
  403: 'auth.errSuspended',
  409: 'auth.errTaken',
  429: 'auth.errRateLimit',
};

function finishAuthRedirect(res) {
  if (res?.user?.role === 'admin') {
    location.assign('/admin/dashboard.html');
    return;
  }
  location.assign(next);
}

async function submit(form, action, skipValidation = false) {
  const alert = $('.auth-form__error', form);
  alert.textContent = '';
  if (!skipValidation && !validate(form)) return;
  const button = $('.auth-form__submit', form);
  const label = button.dataset.i18n;
  button.disabled = true;
  button.textContent = t('auth.working');
  try {
    const res = await action(Object.fromEntries(new FormData(form)));
    return res;
  } catch (error) {
    alert.textContent = error.status === 422 || error.status === 429 || error.status === 502 || error.status === 503
      ? error.message
      : t(ERRORS[error.status] ?? 'auth.errGeneric');
  } finally {
    button.disabled = false;
    button.textContent = t(label);
  }
  return null;
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const res = await submit(e.target, ({ email, password }) => login({ email: email.trim(), password }));
  if (res?.user) finishAuthRedirect(res);
});

$('#register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const payload = {
    name: form.elements.name.value.trim(),
    email: form.elements.email.value.trim().toLowerCase(),
    password: form.elements.password.value,
  };
  const res = await submit(form, () => sendRegisterOtp(payload));
  if (res?.ok) {
    pendingRegistration = payload;
    showOtpStep(payload.email, res);
  }
});

otpForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!pendingRegistration) return;
  const code = getOtpCode();
  if (!/^\d{6}$/.test(code)) {
    setOtpError('auth.errOtp');
    const firstEmpty = otpBoxes.find((b) => !b.value) ?? otpBoxes[0];
    firstEmpty.focus();
    return;
  }
  setOtpError(null);
  const res = await submit(
    otpForm,
    () => verifyRegisterOtp({ email: pendingRegistration.email, code }),
    true,
  );
  if (res?.user) finishAuthRedirect(res);
});

// ---- Google Sign-In ----

const googleSlot = $('#google-btn-slot');
const googleFallbackBtn = $('#google-fallback-btn');
const googleNotice = $('#google-setup-notice');

async function handleGoogleCredential(response) {
  googleNotice.hidden = true;
  if (!response?.credential) return;
  try {
    const res = await googleLogin({ credential: response.credential });
    if (res?.user) finishAuthRedirect(res);
  } catch (error) {
    googleNotice.hidden = false;
    googleNotice.textContent = error.status === 403
      ? t('auth.errSuspended')
      : (error.message || t('auth.googleError'));
  }
}

function loadGoogleIdentityScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-google-gsi]');
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    const hl = getLang() === 'my' ? 'my' : 'en';
    script.src = `https://accounts.google.com/gsi/client?hl=${hl}`;
    script.async = true;
    script.defer = true;
    script.dataset.googleGsi = '1';
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  });
}

async function setupGoogleSignIn(clientId) {
  activeGoogleClientId = clientId || GOOGLE_CLIENT_ID || '';
  if (!activeGoogleClientId) {
    googleSlot.hidden = true;
    googleFallbackBtn.hidden = false;
    return;
  }
  try {
    await loadGoogleIdentityScript();
    if (!window.google?.accounts?.id) return;
    if (!googleInitialized) {
      window.google.accounts.id.initialize({
        client_id: activeGoogleClientId,
        callback: handleGoogleCredential,
        auto_select: false,
      });
      googleInitialized = true;
    }
    const measured = Math.floor(googleSlot.parentElement.getBoundingClientRect().width);
    const width = Math.min(396, Math.max(240, measured || 340));
    googleSlot.innerHTML = '';
    window.google.accounts.id.renderButton(googleSlot, {
      type: 'standard',
      theme: 'filled_black',
      size: 'large',
      shape: 'pill',
      text: 'continue_with',
      width,
    });
    googleSlot.hidden = false;
    googleFallbackBtn.hidden = true;
  } catch {
    // Offline or script blocked — keep fallback button
    googleSlot.hidden = true;
    googleFallbackBtn.hidden = false;
  }
}

googleFallbackBtn.addEventListener('click', async () => {
  googleNotice.hidden = true;
  if (USE_MOCK) {
    googleFallbackBtn.disabled = true;
    try {
      const res = await googleLogin({ credential: 'mock-google-token' });
      if (res?.user) finishAuthRedirect(res);
    } finally {
      googleFallbackBtn.disabled = false;
    }
    return;
  }
  if (activeGoogleClientId) {
    await setupGoogleSignIn(activeGoogleClientId);
    if (!googleSlot.hidden) return;
    googleNotice.hidden = false;
    googleNotice.textContent = t('auth.googleLoadFailed');
    return;
  }
  googleNotice.hidden = false;
  googleNotice.textContent = t('auth.googleNotConfigured');
});

// ---- Already logged in? ----

async function renderSession() {
  const session = await getSession();
  const user = session?.user;
  sessionDbError = session?.dbError || '';
  if (sessionDbError) {
    googleNotice.hidden = false;
    googleNotice.textContent = sessionDbError;
  }
  $('.auth__signed').hidden = !user;
  $('.auth__forms').hidden = Boolean(user);
  if (user) {
    $('.auth__signed-name').textContent = user.name;
    setGreeting('Login');
    if (user.role === 'admin') {
      const cont = $('.auth__continue');
      cont.href = '/admin/dashboard.html';
      cont.textContent = 'Go to Admin Dashboard →';
    }
    return;
  }
  setupGoogleSignIn(session?.googleClientId);
}

$('.auth__logout').addEventListener('click', async () => {
  await logout();
  renderSession();
});

renderSession();
