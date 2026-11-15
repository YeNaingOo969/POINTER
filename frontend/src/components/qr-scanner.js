// Scan a QR code with the phone camera (owner mode, flowchart 3b: "Enter ticket code or scan QR").
// Uses the browser's own barcode reader (BarcodeDetector: Chrome / Edge on Android, Chrome OS,
// macOS), so no extra package. Where the browser has none (Safari, Firefox) the Scan button stays
// hidden and staff type the code instead. The camera stops as soon as a code is read or the
// dialog closes.
import { t } from '../i18n/i18n.js';
import { el } from '../lib/dom.js';

/** True when this browser can read QR codes from the camera. */
export async function canScanQr() {
  if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) return false;
  try {
    return (await window.BarcodeDetector.getSupportedFormats()).includes('qr_code');
  } catch {
    return false;
  }
}

/** Open the camera in a dialog; resolves to the text in the first QR code seen, or null if closed. */
export function scanQr() {
  return new Promise((resolve) => {
    const video = el('video', 'qr-scan__video');
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    const status = el('p', 'qr-scan__status', t('qr.starting'));
    const cancel = el('button', 'app-button app-button--dark', t('qr.cancel'));
    cancel.type = 'button';
    const dialog = el('dialog', 'qr-scan',
      el('p', 'qr-scan__title', t('qr.title')),
      el('div', 'qr-scan__frame', video, el('span', 'qr-scan__aim')),
      status, cancel);
    document.body.append(dialog);

    let stream = null;
    let timer = 0;
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      if (dialog.open) dialog.close();
      dialog.remove();
      resolve(value);
    };
    cancel.addEventListener('click', () => finish(null));
    dialog.addEventListener('cancel', () => finish(null)); // Esc
    dialog.showModal();

    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    const look = async () => {
      if (done) return;
      try {
        if (video.readyState >= 2) {
          const [hit] = await detector.detect(video);
          if (hit?.rawValue) return finish(hit.rawValue.trim());
        }
      } catch { /* a frame that couldn't be read: try the next one */ }
      timer = setTimeout(look, 250); // 4 checks a second is plenty and keeps the phone cool
    };

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        if (done) { s.getTracks().forEach((track) => track.stop()); return; }
        stream = s;
        video.srcObject = s;
        return video.play().then(() => { status.textContent = t('qr.hint'); look(); });
      })
      .catch(() => { status.textContent = t('qr.noCamera'); });
  });
}
