// "Report" dialog (flowchart 2a): pick a reason, add a note, send to the admins (reports table).
// Works for a place, post, review, user or message: openReport('place', 20).
import { t } from '../i18n/i18n.js';
import { submitReport } from '../api/api.js';
import { el, toast } from '../lib/dom.js';

let dialog;
const REASONS = ['wrongInfo', 'closed', 'rude', 'other'];

/** Resolves true when a report was sent. Logged-in users only (the caller checks). */
export function openReport(targetType, targetId) {
  if (!dialog) {
    dialog = el('dialog', 'login-dialog report-dialog');
    document.body.append(dialog);
  }
  const form = el('form', 'login-dialog__body');
  form.method = 'dialog';
  const choices = el('div', 'report-dialog__reasons', ...REASONS.map((r, i) => {
    const input = el('input');
    input.type = 'radio';
    input.name = 'reason';
    input.value = r;
    input.checked = i === 0;
    return el('label', null, input, ` ${t(`report.${r}`)}`);
  }));
  const note = el('textarea', null);
  note.rows = 3;
  note.maxLength = 255;
  note.placeholder = t('report.placeholder');
  const send = el('button', 'login-dialog__login', t('report.send'));
  send.value = 'send';
  const cancel = el('button', 'login-dialog__cancel', t('report.cancel'));
  cancel.value = 'cancel';
  form.append(
    el('h2', 'login-dialog__title', t('report.title')),
    el('p', 'login-dialog__text', t('report.text')),
    choices, note,
    el('div', 'login-dialog__actions', send, cancel));
  dialog.replaceChildren(form);
  return new Promise((resolve) => {
    dialog.addEventListener('close', async () => {
      if (dialog.returnValue !== 'send') return resolve(false);
      const reason = `${t(`report.${form.reason.value}`)}${note.value.trim() ? ` — ${note.value.trim()}` : ''}`;
      try {
        await submitReport({ targetType, targetId, reason });
        toast(t('report.thanks'));
        resolve(true);
      } catch (error) {
        console.error(error);
        resolve(false);
      }
    }, { once: true });
    dialog.showModal();
  });
}
