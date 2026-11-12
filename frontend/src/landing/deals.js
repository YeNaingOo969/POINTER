// Section 6 — deals and tickets: a shop's discount post slides in, its directions link turns
// gold, a ticket prints out with the post code and a live Yangon clock, and the owner's
// "code matches" stamp lands. Copy changes in three steps as you scroll.
import { gsap } from 'gsap';

const yangon = (date, withSeconds) => date.toLocaleTimeString('en-GB', {
  timeZone: 'Asia/Yangon', hour: '2-digit', minute: '2-digit', ...(withSeconds ? { second: '2-digit' } : {}),
});

/** Live clock on the ticket, only ticking while the section is on screen. */
function liveTicketClock() {
  const clock = document.querySelector('.ticket__clock');
  document.querySelector('.ticket__until').textContent = yangon(new Date(Date.now() + 2 * 3600e3));
  let timer = 0;
  const tick = () => { clock.textContent = yangon(new Date(), true); };
  const io = new IntersectionObserver(([entry]) => {
    clearInterval(timer);
    if (entry.isIntersecting) { tick(); timer = setInterval(tick, 1000); }
  });
  io.observe(document.querySelector('.deals'));
  return () => { io.disconnect(); clearInterval(timer); };
}

export function dealStory() {
  const steps = gsap.utils.toArray('.deals__step');
  const link = document.querySelector('.dpost__link');
  let current = 0;
  const showStep = (next) => {
    if (next === current) return;
    const dir = next > current ? 1 : -1;
    gsap.to(steps[current], { autoAlpha: 0, y: -24 * dir, duration: 0.35, ease: 'power2.in', overwrite: true });
    gsap.fromTo(steps[next], { autoAlpha: 0, y: 28 * dir }, { autoAlpha: 1, y: 0, duration: 0.6, delay: 0.15, ease: 'power3.out', overwrite: true });
    steps.forEach((s, i) => s.classList.toggle('is-active', i === next));
    current = next;
  };
  gsap.set(steps.slice(1), { autoAlpha: 0 });
  gsap.set('.ticket', { autoAlpha: 0, y: -40, scaleY: 0.15 });

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '.deals', start: 'top bottom', end: 'bottom bottom', scrub: 0.8,
      onUpdate(st) {
        const p = st.progress;
        showStep(p >= 0.7 ? 2 : p >= 0.46 ? 1 : 0);
        link.classList.toggle('is-gold', p >= 0.47);
      },
    },
  });

  tl.from('.deals__copy', { x: -40, autoAlpha: 0, duration: 0.12, ease: 'power2.out' }, 0.16)
    .from('.dpost', { y: 120, rotate: -8, autoAlpha: 0, duration: 0.18, ease: 'power3.out' }, 0.12)
    // Ticket prints out of the post.
    .to('.dpost', { scale: 0.94, autoAlpha: 0.6, duration: 0.1 }, 0.56)
    .to('.ticket', { autoAlpha: 1, y: 0, scaleY: 1, rotate: 4, duration: 0.14, ease: 'back.out(1.6)' }, 0.5)
    // At the counter: the ticket comes forward and the owner's stamp lands.
    .to('.ticket', { scale: 1.08, rotate: -2, xPercent: -12, duration: 0.1, ease: 'power2.out' }, 0.72)
    .fromTo('.ticket__stamp', { scale: 2.4, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.05, ease: 'back.out(3)' }, 0.8)
    .to({}, { duration: 0.08 });

  const stopClock = liveTicketClock();
  return () => { tl.scrollTrigger?.kill(); tl.kill(); stopClock(); };
}
