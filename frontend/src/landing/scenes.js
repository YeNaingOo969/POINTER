// Scroll scenes for the landing page (GSAP ScrollTrigger). Each chapter gets one clear move:
//   hero      — video drifts in and the title lines part as you leave
//   01        — a small framed timelapse opens to full screen (pinned)
//   02        — the panels slide sideways (pinned, desktop); stacked on phones
//   03        — Save / Check in / Review stamps fly in over the river
//   finale    — from the plane window, the camera dives into the city (pinned)
// Reduced motion: no scroll effects at all; content is laid out statically by landing.css.
// The art itself drifts with a CSS animation (.art), so tweens here move wrappers, never .art.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { number } from '../lib/format.js';

gsap.registerPlugin(ScrollTrigger);

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The hero's own entrance, played when the intro opens (or straight away). */
export function heroEntrance() {
  if (reduceMotion()) return;
  gsap.timeline({ defaults: { ease: 'power4.out' } })
    .from('.hero__parallax', { scale: 1.2, duration: 2.8, ease: 'power2.out' }, 0)
    .from('.hero__embers', { opacity: 0, duration: 2 }, 0.6)
    .from('.hero__line > span', { yPercent: 115, duration: 1.3, stagger: 0.12 }, 0.1)
    .from(['.hero__kicker', '.hero__lede', '.hero__cta'], { y: 28, opacity: 0, duration: 1, stagger: 0.1, ease: 'power3.out' }, 0.45)
    .from(['.nav', '.hero__meta', '.hero__scroll'], { opacity: 0, duration: 1, ease: 'power2.out' }, 0.8);
}

/** Count a stat up from 0 the first time it scrolls into view (digits follow the language). */
function countUp(el) {
  const target = Number(el.dataset.count);
  const state = { v: 0 };
  ScrollTrigger.create({
    trigger: el,
    start: 'top 85%',
    once: true,
    onEnter: () => gsap.to(state, {
      v: target, duration: 1.4, ease: 'power2.out',
      onUpdate: () => { el.textContent = number(Math.round(state.v)); },
    }),
  });
}

/** Fade-and-rise reveal for text blocks as they enter. */
function reveal(targets) {
  for (const el of gsap.utils.toArray(targets)) {
    gsap.from(el, {
      y: 48, opacity: 0, duration: 1.1, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%' },
    });
  }
}

/** The hero art leans gently towards the pointer (mouse/trackpad only). */
export function heroParallax() {
  if (reduceMotion() || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const layer = document.querySelector('.hero__parallax');
  const x = gsap.quickTo(layer, 'x', { duration: 1.2, ease: 'power3.out' });
  const y = gsap.quickTo(layer, 'y', { duration: 1.2, ease: 'power3.out' });
  document.querySelector('.hero').addEventListener('pointermove', (e) => {
    x((e.clientX / innerWidth - 0.5) * -24);
    y((e.clientY / innerHeight - 0.5) * -16);
  });
}

export function scrollScenes() {
  if (reduceMotion()) return;

  document.querySelectorAll('.stats__n').forEach(countUp);
  reveal(['.discover__head > *', '.panel__title', '.panel__text', '.enjoy__content > :not(.stamps)']);

  // Gold progress line along the top.
  gsap.to('.progress__bar', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });

  // Hero: leave with depth — media drifts, the title lines part, the content lifts away.
  gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } })
    .to('.hero__media', { scale: 1.12, yPercent: 10, ease: 'none' }, 0)
    .to('.hero__line:nth-child(1)', { xPercent: -8, ease: 'none' }, 0)
    .to('.hero__line:nth-child(3)', { xPercent: 8, ease: 'none' }, 0)
    .to('.hero__content', { yPercent: -14, opacity: 0, ease: 'none' }, 0)
    .to(['.hero__meta', '.hero__scroll'], { opacity: 0, ease: 'none', duration: 0.3 }, 0);

  const mm = gsap.matchMedia();
  mm.add({ desktop: '(min-width: 900px)', phone: '(max-width: 899px)' }, ({ conditions }) => {
    // 01: the framed timelapse opens to full screen while the section is pinned.
    gsap.from('.explore__text > *', {
      y: 40, opacity: 0, stagger: 0.1, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: '.chapter--explore', start: 'top 70%' },
    });
    gsap.timeline({
      scrollTrigger: { trigger: '.explore__stage', start: 'top top', end: '+=130%', scrub: 0.6, pin: true },
    })
      .to('.explore__frame', { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'power1.inOut', duration: 1 }, 0)
      .to('.explore__shade', { opacity: 1, ease: 'none', duration: 0.5 }, 0.45);

    // 02: sideways track on desktop, with each image drifting inside its frame.
    const track = document.querySelector('.discover__track');
    if (conditions.desktop) {
      const distance = () => track.scrollWidth - innerWidth;
      const slide = gsap.to(track, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: '.chapter--discover', start: 'top top', end: () => `+=${distance()}`,
          scrub: 0.6, pin: true, invalidateOnRefresh: true,
        },
      });
      for (const media of track.querySelectorAll('.panel__media > *')) {
        gsap.fromTo(media, { xPercent: -6 }, {
          xPercent: 6, ease: 'none',
          scrollTrigger: { trigger: media.parentElement, containerAnimation: slide, start: 'left right', end: 'right left', scrub: true },
        });
      }
    } else {
      for (const media of track.querySelectorAll('.panel__media > *')) {
        gsap.fromTo(media, { yPercent: -6 }, {
          yPercent: 6, ease: 'none',
          scrollTrigger: { trigger: media.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
        });
      }
    }
  });

  // 03: the tea shop slowly settles; the stamps land one by one, each at its own angle.
  gsap.fromTo('.enjoy__media', { scale: 1.1 }, {
    scale: 1, ease: 'none',
    scrollTrigger: { trigger: '.chapter--enjoy', start: 'top bottom', end: 'bottom top', scrub: true },
  });
  gsap.from('.stamp', {
    y: 90, opacity: 0, rotate: (i) => [-14, 10, -8][i % 3], scale: 0.8, stagger: 0.15,
    ease: 'back.out(1.6)',
    scrollTrigger: { trigger: '.stamps', start: 'top 92%', end: 'top 55%', scrub: 0.8 },
  });

  // Finale: from the plane window the camera dives towards the city, slightly turning, while the
  // text lands. (No blur filter: animating it on a full-screen 4K image is too heavy for the 610M.)
  gsap.timeline({
    scrollTrigger: { trigger: '.finale__stage', start: 'top top', end: '+=220%', pin: true, scrub: 0.5 },
  })
    .fromTo('.finale__art', { scale: 1, rotate: 0 }, { scale: 2.1, rotate: -3, ease: 'power2.in', duration: 1 }, 0)
    .from('.finale__content > *', { y: 70, opacity: 0, stagger: 0.08, duration: 0.25, ease: 'power2.out' }, 0.45);
}

/** Text length changes with the language, so pinned distances must be measured again. */
export const refreshScenes = () => ScrollTrigger.refresh();
