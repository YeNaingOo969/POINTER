// "Log in to continue" dialog for visitor clicks on user actions (review, save, check in, report).
// Login is simulated until login.html (M5): "Continue as demo user" signs in a demo account.
import { t } from '../i18n/i18n.js';
import { loginDemo } from '../api/api.js';

let dialog;

function build() {
  dialog = document.createElement('dialog');
  dialog.className = 'login-dialog';
  dialog.innerHTML = `
    <form method="dialog" class="login-dialog__body">
      <h2 class="login-dialog__title" data-i18n="login.title"></h2>
      <p class="login-dialog__text" data-i18n="login.text"></p>
      <div class="login-dialog__actions">
        <button class="login-dialog__demo" value="demo" data-i18n="login.demo"></button>
        <button class="login-dialog__cancel" value="cancel" data-i18n="login.cancel"></button>
      </div>
      <p class="login-dialog__note" data-i18n="login.note"></p>
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
  return new Promise((resolve) => {
    dialog.addEventListener('close', async () => {
      resolve(dialog.returnValue === 'demo' ? await loginDemo() : null);
    }, { once: true });
    dialog.showModal();
    dialog.querySelector('.login-dialog__demo').focus();
  });
}
