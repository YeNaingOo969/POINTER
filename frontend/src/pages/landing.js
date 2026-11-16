// Entry script for index.html: the POINTER landing (quality bar v2, 2026-11-12). Ten sections, each
// in its own module under src/landing/. Motion only runs without prefers-reduced-motion; the CSS
// lays everything out statically otherwise.
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/pages/landing.css';
import { initI18n } from '../i18n/i18n.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { heroDive } from '../landing/hero.js';
import { aboutReveal } from '../landing/about.js';
import { mapStory } from '../landing/mapstory.js';
import { flyinFrames, flyinStory } from '../landing/flyin.js';
import { categories } from '../landing/categories.js';
import { reviewStory } from '../landing/reviews.js';
import { dealStory } from '../landing/deals.js';
import { ownersStatic, ownersAndEnding } from '../landing/owners.js';
import { floatProps } from '../landing/float-props.js';

gsap.registerPlugin(ScrollTrigger);
initI18n(); // English by default; small texts switch to Burmese (headlines stay English)

// The top bar turns light over light sections (marked data-nav="light").
document.querySelectorAll('[data-nav="light"]').forEach((section) => {
  ScrollTrigger.create({ trigger: section, start: 'top 60px', end: 'bottom 60px', toggleClass: { targets: '.site-nav', className: 'is-light' } });
});

ownersStatic();
flyinFrames(); // section 3a frame player (shows a still by itself with reduced motion)

const mm = gsap.matchMedia();
document.fonts.ready.then(() => {
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    const cleanups = [heroDive(), aboutReveal(), flyinStory(), mapStory(), categories(), reviewStory(), dealStory(), ownersAndEnding(), floatProps()];
    return () => cleanups.forEach((fn) => fn());
  });
  ScrollTrigger.refresh();
});
