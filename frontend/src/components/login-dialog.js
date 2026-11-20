// "Log in to continue" dialog for visitor clicks on user actions (review, save, check in, report).
// The main button goes to login.html and comes back here afterwards; while the API is mocked,
// "Continue as demo user" also signs in a demo account without leaving the page.
import { t } from '../i18n/i18n.js';
import { loginDemo, loginDemoOwner, loginDemoAdmin } from '../api/api.js';
import { USE_MOCK } from '../api/config.js';

let dialog;

function build() {
  dialog = document.createElement('dialog');
  dialog.className = 'login-dialog';
  dialog.innerHTML = `
    <form method="dialog" class="login-dialog__body">
      <h2 class="login-dialog__title" data-i18n="login.title"></h2>
      <p class="login-dialog__text" data-i18n="login.text"></p>
      <div class="login-dialog__actions">
        <a class="login-dialog__login" data-i18n="login.go"></a>
        ${USE_MOCK ? '<button class="login-dialog__demo" value="demo" data-i18n="login.demo"></button>' : ''}
        ${USE_MOCK ? '<button class="login-dialog__demo" value="owner" data-i18n="login.demoOwner"></button>' : ''}
        ${USE_MOCK ? '<button class="login-dialog__demo" value="admin">Demo admin</button>' : ''}
        <button class="login-dialog__cancel" value="cancel" data-i18n="login.cancel"></button>
      </div>
      ${USE_MOCK ? '<p class="login-dialog__note" data-i18n="login.note"></p>' : ''}
    </form>`;
  document.body.append(dialog);
}

function translate() {
  dialog.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
}

/** Ask a visitor to log in. Resolves to the session after a demo login, or null if cancelled. */
export function askToLogin() {
  if (!dialog) build();
  translate();
  const next = location.pathname + location.search;
  dialog.querySelector('.login-dialog__login').href = `/login.html?next=${encodeURIComponent(next)}`;
  return new Promise((resolve) => {
    dialog.addEventListener('close', async () => {
      const value = dialog.returnValue;
      resolve(value === 'demo' ? await loginDemo() : value === 'owner' ? await loginDemoOwner(1) : value === 'admin' ? await loginDemoAdmin() : null);
    }, { once: true });
    dialog.showModal();
    dialog.querySelector('.login-dialog__login').focus();
  });
}
