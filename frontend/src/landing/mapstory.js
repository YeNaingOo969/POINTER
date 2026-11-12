// Section 3 — "Our own map": the map card tilts up into view, pins pop in, a category filter
// dims the rest, and the walking route draws itself to a tea house. One scrubbed timeline.
import { gsap } from 'gsap';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';

gsap.registerPlugin(DrawSVGPlugin);

const STEP_AT = [0, 0.5, 0.68]; // timeline progress where copy steps 2 and 3 take over

export function mapStory() {
  const steps = [...document.querySelectorAll('.mapstory__step')];
  const foodChip = document.querySelector('.chip[data-cat="food"]');
  let current = 0;

  const showStep = (next) => {
    if (next === current) return;
    const dir = next > current ? 1 : -1;
    const from = steps[current];
    const to = steps[next];
    current = next;
    gsap.to(from, { autoAlpha: 0, y: -24 * dir, duration: 0.35, ease: 'power2.in', overwrite: true });
    gsap.fromTo(to, { autoAlpha: 0, y: 28 * dir }, { autoAlpha: 1, y: 0, duration: 0.6, delay: 0.15, ease: 'power3.out', overwrite: true });
    steps.forEach((s) => s.classList.toggle('is-active', s === to));
    foodChip.classList.toggle('is-on', next >= 1);
  };
  gsap.set(steps.slice(1), { autoAlpha: 0 });

  gsap.set('.mpin', { scale: 0, autoAlpha: 0 });
  gsap.set('.mpin b', { autoAlpha: 0, y: 6 });
  gsap.set(['.route-line', '.route-glow'], { drawSVG: '0%' });

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '.mapstory',
      start: 'top bottom',
      end: 'bottom bottom',
      scrub: 0.8,
      onUpdate(st) {
        const p = st.progress;
        showStep(p >= STEP_AT[2] ? 2 : p >= STEP_AT[1] ? 1 : 0);
      },
    },
  });

  tl.fromTo('.mapframe', { rotateX: 32, scale: 0.84, y: 90 }, { rotateX: 0, scale: 1, y: 0, duration: 0.24, ease: 'power2.out' }, 0.04)
    .from('.mapstory__copy', { x: -40, autoAlpha: 0, duration: 0.14, ease: 'power2.out' }, 0.14)
    // Pins pop in from their tips, a few at a time.
    .to('.mpin', { scale: 1, autoAlpha: 1, duration: 0.05, ease: 'back.out(3)', stagger: { each: 0.007, from: 'random' } }, 0.3)
    .to('.mpin b', { autoAlpha: 1, y: 0, duration: 0.04, stagger: 0.02 }, 0.42)
    // Step 2: filter to Food & drink.
    .from('.chip', { y: -16, autoAlpha: 0, duration: 0.04, stagger: 0.008 }, 0.48)
    .to('.mpin:not([data-cat="food"])', { autoAlpha: 0.22, scale: 0.8, duration: 0.05 }, 0.53)
    .to('.mpin[data-cat="food"]', { scale: 1.25, duration: 0.05, ease: 'back.out(3)' }, 0.53)
    // Step 3: route from "you" to the tea house.
    .to('.mpin[data-cat="food"]:not(.mpin--target)', { autoAlpha: 0.22, scale: 0.8, duration: 0.04 }, 0.68)
    .to('.mpin--target', { scale: 1.45, duration: 0.05, ease: 'back.out(3)' }, 0.68)
    .to('.mpin--target b', { autoAlpha: 0, duration: 0.03 }, 0.68) // the card below names it
    .fromTo('.you-dot', { autoAlpha: 0, scale: 0 }, { autoAlpha: 1, scale: 1, duration: 0.04, ease: 'back.out(3)' }, 0.69)
    .to(['.route-glow', '.route-line'], { drawSVG: '100%', duration: 0.14, ease: 'power1.inOut' }, 0.71)
    .fromTo('.minicard', { x: 40, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.07, ease: 'power3.out' }, 0.84)
    .to({}, { duration: 0.06 });

  return () => { tl.scrollTrigger?.kill(); tl.kill(); };
}
