// Sections 7–10: for shop owners (the request form fills itself in, gets approved, tools
// unlock), owner plans (1 / 3 / 6 / 12 months, turning gold rim on the favourite), why it's free
// for users (the flywheel draws itself) and the finale (dusk Shwedagon + photo-filled wordmark).
import { gsap } from 'gsap';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(DrawSVGPlugin, SplitText);

/** Always on (also with reduced motion): the request form's text is filled in. */
export function ownersStatic() {
  document.querySelectorAll('.bform__field').forEach((f) => { f.textContent = f.dataset.type; });
}

function ownersStory() {
  const fields = gsap.utils.toArray('.bform__field');
  const steps = gsap.utils.toArray('.owners__steps li');
  const typed = fields.map(() => ({ n: 0 }));
  fields.forEach((f) => { f.textContent = ''; });

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '.owners', start: 'top bottom', end: 'bottom bottom', scrub: 0.8,
      onUpdate(st) {
        const p = st.progress;
        const step = p >= 0.74 ? 2 : p >= 0.6 ? 1 : 0;
        steps.forEach((li, i) => li.classList.toggle('is-on', i === step));
      },
    },
  });

  tl.from('.owners__copy > *', { y: 50, autoAlpha: 0, stagger: 0.03, duration: 0.12, ease: 'power2.out' }, 0.14)
    .from('.bform', { y: 120, rotate: 5, autoAlpha: 0, duration: 0.18, ease: 'power3.out' }, 0.12);

  // Type each field in turn.
  fields.forEach((field, i) => {
    const text = field.dataset.type;
    tl.to(typed[i], {
      n: text.length, duration: 0.05, ease: 'none',
      onUpdate: () => { field.textContent = text.slice(0, Math.round(typed[i].n)); },
      onStart: () => field.classList.add('is-typing'),
      onComplete: () => field.classList.remove('is-typing'),
      onReverseComplete: () => field.classList.remove('is-typing'),
    }, 0.34 + i * 0.05);
  });

  tl.from('.bform__pin i', { scale: 0, y: -20, duration: 0.03, ease: 'back.out(3)' }, 0.55)
    .to('.bform__photo img', { opacity: 1, duration: 0.03 }, 0.57)
    .to('.bform__send', { scale: 1.08, duration: 0.02, yoyo: true, repeat: 1 }, 0.59)
    // Approved.
    .fromTo('.bform__stamp', { scale: 2.6, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.05, ease: 'back.out(3)' }, 0.63)
    // Owner tools unlock.
    .to('.bform', { scale: 0.94, y: -10, duration: 0.06 }, 0.75)
    .from('.unlocks span', { y: 24, scale: 0.6, autoAlpha: 0, stagger: 0.015, duration: 0.05, ease: 'back.out(2.5)' }, 0.77)
    .to({}, { duration: 0.08 });

  return () => { tl.scrollTrigger?.kill(); tl.kill(); fields.forEach((f) => { f.textContent = f.dataset.type; }); };
}

function plansStory() {
  const tl = gsap.timeline({ scrollTrigger: { trigger: '.plans__cards', start: 'top 80%', toggleActions: 'play none none reverse' } })
    .from('.plan', { y: 80, autoAlpha: 0, stagger: 0.12, duration: 0.9, ease: 'expo.out' })
    .from('.plans__features li', { x: -14, autoAlpha: 0, stagger: 0.04, duration: 0.4, ease: 'power2.out' }, 0.3);
  const spin = gsap.to('.plan--premium', { '--spin': '360deg', duration: 8, ease: 'none', repeat: -1, paused: true });
  const io = new IntersectionObserver(([e]) => (e.isIntersecting ? spin.play() : spin.pause()));
  io.observe(document.querySelector('.plans'));
  return () => { tl.scrollTrigger?.kill(); tl.kill(); spin.kill(); io.disconnect(); };
}

function wheelStory() {
  gsap.set('.wheel__arc', { drawSVG: '0%' });
  const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: '.wheel', start: 'top 80%', end: 'bottom 45%', scrub: 0.8 } });
  const nodes = gsap.utils.toArray('.wheel__node');
  tl.from('.wheel__center', { scale: 0.6, autoAlpha: 0, duration: 0.2 }, 0)
    .from(nodes[0], { scale: 0.7, autoAlpha: 0, duration: 0.12, ease: 'back.out(2)' }, 0.05);
  gsap.utils.toArray('.wheel__arc').forEach((arc, i) => {
    tl.to(arc, { drawSVG: '100%', duration: 0.25 }, 0.15 + i * 0.27);
    if (nodes[i + 1]) tl.from(nodes[i + 1], { scale: 0.7, autoAlpha: 0, duration: 0.12, ease: 'back.out(2)' }, 0.36 + i * 0.27);
  });
  tl.from('.why__copy > *', { y: 40, autoAlpha: 0, stagger: 0.05, duration: 0.2 }, 0);
  return () => { tl.scrollTrigger?.kill(); tl.kill(); };
}

function finaleStory() {
  const title = new SplitText('.finale__title', { type: 'words,chars', charsClass: 'char' });
  gsap.set(title.chars, { display: 'inline-block' });
  const bg = gsap.fromTo('.finale__bg', { scale: 1.25, yPercent: -6 }, {
    scale: 1, yPercent: 4, ease: 'none',
    scrollTrigger: { trigger: '.finale', start: 'top bottom', end: 'bottom bottom', scrub: true },
  });
  const tl = gsap.timeline({ scrollTrigger: { trigger: '.finale', start: 'top 45%', toggleActions: 'play none none reverse' } })
    .from(title.chars, { yPercent: 110, autoAlpha: 0, stagger: 0.025, duration: 0.8, ease: 'back.out(1.6)' })
    .from('.finale__ctas > *', { y: 24, autoAlpha: 0, stagger: 0.1, duration: 0.6, ease: 'power3.out' }, 0.4);
  const word = gsap.fromTo('.finale__word', { letterSpacing: '0.12em', autoAlpha: 0.2 }, {
    letterSpacing: '-0.04em', autoAlpha: 1, ease: 'none',
    scrollTrigger: { trigger: '.finale__word', start: 'top bottom', end: 'bottom bottom', scrub: true },
  });
  return () => { [bg, word].forEach((t) => { t.scrollTrigger?.kill(); t.kill(); }); tl.scrollTrigger?.kill(); tl.kill(); title.revert(); };
}

export function ownersAndEnding() {
  const fns = [ownersStory(), plansStory(), wheelStory(), finaleStory()];
  return () => fns.forEach((fn) => fn());
}
