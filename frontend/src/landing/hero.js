// Section 1 — hero: one scroll-scrubbed shot that dives from above the clouds, past the floating
// Shwedagon, down into the city. Layers are flat WebP images moved with transforms only (no
// WebGL), so it stays light on the Radeon 610M.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

const $ = (sel) => document.querySelector(sel);
const stage = $('.dive__stage');

/** Slow idle bob of the island, paused while the hero is off screen. */
function floatIsland() {
  const tween = gsap.to('.dive__float', { y: -16, duration: 3.2, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  ScrollTrigger.create({ trigger: '.dive', start: 'top bottom', end: 'bottom top', onToggle: (st) => tween.paused(!st.isActive) });
  return tween;
}

/** Pointer parallax through CSS custom properties, so it never fights the scroll transforms. */
function pointerDepth() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return () => {};
  const proxy = { x: 0, y: 0 };
  const apply = () => {
    stage.style.setProperty('--px', proxy.x.toFixed(3));
    stage.style.setProperty('--py', proxy.y.toFixed(3));
  };
  const toX = gsap.quickTo(proxy, 'x', { duration: 0.9, ease: 'power3.out', onUpdate: apply });
  const toY = gsap.quickTo(proxy, 'y', { duration: 0.9, ease: 'power3.out', onUpdate: apply });
  const onMove = (e) => {
    toX((e.clientX / innerWidth) * 2 - 1);
    toY((e.clientY / innerHeight) * 2 - 1);
  };
  addEventListener('pointermove', onMove, { passive: true });
  return () => removeEventListener('pointermove', onMove);
}

function dive() {
  const word = new SplitText('.dive__wordmark span', { type: 'chars', charsClass: 'char' });
  const title = new SplitText('.dive__title', { type: 'words,chars', charsClass: 'char' });

  gsap.set('.dive__clouds--back', { yPercent: 42, scale: 1.05 });
  gsap.set('.dive__clouds--front', { yPercent: 70, scaleX: -1.5, scaleY: 1.5 });
  gsap.set('.dive__landing', { autoAlpha: 0 });

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: '.dive', start: 'top top', end: 'bottom bottom', scrub: 0.9 },
  });

  tl.to('.dive__intro', { autoAlpha: 0, y: 24, duration: 0.06 }, 0)
    // The wordmark peels away letter by letter as we start to fall.
    .to(word.chars, { yPercent: -60, autoAlpha: 0, stagger: { each: 0.012, from: 'center' }, duration: 0.16, ease: 'power2.in' }, 0.04)
    .to('.dive__sky', { scale: 1.3, yPercent: -10, duration: 0.55 }, 0)
    .to('.dive__sky', { autoAlpha: 0, duration: 0.1 }, 0.48)
    // The island drifts up, then shoots out of the top of the frame.
    .to('.dive__island', { yPercent: -18, scale: 1.12, duration: 0.24, ease: 'sine.in' }, 0)
    .to('.dive__island', { yPercent: -150, scale: 1.35, duration: 0.24, ease: 'power2.in' }, 0.24)
    // Clouds rise past the camera and cover the cut to the city.
    .to('.dive__clouds--back', { yPercent: -15, scale: 1.9, duration: 0.36, ease: 'sine.inOut' }, 0.14)
    .to('.dive__clouds--front', { yPercent: -25, scaleX: -2.7, scaleY: 2.7, duration: 0.36, ease: 'sine.inOut' }, 0.16)
    // …then clear out of the top, uncovering the city.
    .to('.dive__clouds--back', { yPercent: -240, scale: 2.3, autoAlpha: 0, duration: 0.2, ease: 'power1.in' }, 0.5)
    .to('.dive__clouds--front', { yPercent: -260, scaleX: -3, scaleY: 3, autoAlpha: 0, duration: 0.2, ease: 'power1.in' }, 0.52)
    .fromTo('.dive__city', { autoAlpha: 0, scale: 1.4 }, { autoAlpha: 1, scale: 1.12, duration: 0.3, ease: 'power1.out' }, 0.42)
    .to('.dive__city', { scale: 1, duration: 0.28, ease: 'power1.out' }, 0.72)
    .fromTo(stage, { '--vignette': 0 }, { '--vignette': 1, duration: 0.25 }, 0.45)
    // Landing: the headline types itself up from below.
    .set('.dive__landing', { autoAlpha: 1 }, 0.72)
    .from(title.chars, { yPercent: 110, autoAlpha: 0, stagger: 0.008, duration: 0.12, ease: 'back.out(1.6)' }, 0.73)
    .from(['.dive__lede', '.dive__landing .dive__cta'], { y: 30, autoAlpha: 0, stagger: 0.04, duration: 0.1, ease: 'power2.out' }, 0.84)
    .to({}, { duration: 0.06 }); // short hold at the end of the shot

  return () => { tl.scrollTrigger?.kill(); tl.kill(); word.revert(); title.revert(); };
}

/** Hero dive + idle island bob + pointer depth; returns one cleanup. */
export function heroDive() {
  const fns = [dive(), pointerDepth()];
  const bob = floatIsland();
  return () => { fns.forEach((fn) => fn()); bob.kill(); };
}
