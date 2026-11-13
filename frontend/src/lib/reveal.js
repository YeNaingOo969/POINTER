// Scroll reveal for app pages (quality bar v2): elements marked data-reveal fade and rise in the
// first time they enter the screen. Optional --i on an element staggers it in a list.
// CSS lives in base.css; nothing is hidden unless this script runs (html.has-reveal), and
// reduced motion shows everything at once.

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let observer = null;

function getObserver() {
  if (observer) return observer;
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  return observer;
}

/** Watch every not-yet-shown [data-reveal] element under root (call again after rendering lists). */
export function reveal(root = document) {
  if (reduced() || !('IntersectionObserver' in window)) return;
  document.documentElement.classList.add('has-reveal');
  root.querySelectorAll('[data-reveal]:not(.is-in)').forEach((el) => getObserver().observe(el));
}

/** Mark a list's items for a staggered reveal, then watch them. */
export function revealList(items) {
  items.forEach((el, i) => {
    el.dataset.reveal = '';
    el.style.setProperty('--i', String(Math.min(i, 8)));
  });
  reveal();
}

/** Count a number up from 0 (used for stats); instant with reduced motion. */
export function countUp(el, to, duration = 900) {
  if (reduced() || !to) { el.textContent = String(to); return; }
  const start = performance.now();
  const step = (now) => {
    const p = Math.min((now - start) / duration, 1);
    el.textContent = String(Math.round(to * (1 - (1 - p) ** 3)));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
