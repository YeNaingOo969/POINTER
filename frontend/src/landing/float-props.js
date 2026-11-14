// Props beside the reviews, the deal and the business form drift a little against the scroll,
// so the pinned sections keep some depth. Desktop and phone; reduced motion skips it (landing.js).
import { gsap } from 'gsap';

export function floatProps() {
  const tweens = [...document.querySelectorAll('.prop--float')].map((prop) => {
    const speed = Number(prop.dataset.speed) || 1;
    return gsap.fromTo(prop, { y: 90 * speed, rotate: -8 * speed }, {
      y: -90 * speed, rotate: 8 * speed, ease: 'none',
      scrollTrigger: { trigger: prop.closest('section'), start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });
  return () => tweens.forEach((t) => { t.scrollTrigger?.kill(); t.kill(); });
}
