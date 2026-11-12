// Section 5 — reviews you can trust: three review cards fan out of a stack, the stars fill,
// the heart pops (saved), the rating counts up and an owner reply unfolds under a review.
import { gsap } from 'gsap';

export function reviewStory() {
  const [front, middle, back] = gsap.utils.toArray('.rcard');
  const reply = document.querySelector('.rcard__reply');
  const num = document.querySelector('.rsum__num');
  const total = document.querySelector('.rsum__total');
  const counter = { rating: 0, count: 0 };

  gsap.set([front, middle, back], { zIndex: (i) => 3 - i, rotate: (i) => [-1, 2, -3][i], y: (i) => i * 10 });
  gsap.set(front.querySelectorAll('.rcard__stars i'), { scale: 0, autoAlpha: 0 });
  gsap.set(front.querySelector('.rcard__heart'), { scale: 0 });
  gsap.set(reply, { autoAlpha: 0, height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0 });

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: '.reviews', start: 'top bottom', end: 'bottom bottom', scrub: 0.8 },
  });

  tl.from('.reviews__copy > *', { y: 50, autoAlpha: 0, stagger: 0.03, duration: 0.12, ease: 'power2.out' }, 0.16)
    .from('.rstack', { y: 90, autoAlpha: 0, duration: 0.18, ease: 'power2.out' }, 0.12)
    // Fan out.
    .to(back, { xPercent: -62, y: 60, rotate: -11, duration: 0.14, ease: 'power2.inOut' }, 0.4)
    .to(middle, { xPercent: 42, y: 110, rotate: 7, duration: 0.14, ease: 'power2.inOut' }, 0.42)
    .to(front, { xPercent: -14, y: -6, rotate: -3, duration: 0.14, ease: 'power2.inOut' }, 0.44)
    // Stars fill one by one, then the heart pops: saved.
    .to(front.querySelectorAll('.rcard__stars i'), { scale: 1, autoAlpha: 1, stagger: 0.012, duration: 0.03, ease: 'back.out(4)' }, 0.55)
    .to(front.querySelector('.rcard__heart'), { scale: 1, duration: 0.04, ease: 'back.out(5)' }, 0.63)
    .to(counter, {
      rating: 4.8, count: 2318, duration: 0.2, ease: 'power1.out',
      onUpdate: () => { num.textContent = counter.rating.toFixed(1); total.textContent = Math.round(counter.count).toLocaleString('en-US'); },
    }, 0.5)
    // Owner reply unfolds under the café review, which comes forward.
    .to(middle, { zIndex: 4, y: 70, rotate: 2, xPercent: 30, duration: 0.08, ease: 'power2.out' }, 0.72)
    .to(reply, { autoAlpha: 1, height: 'auto', marginTop: '0.9rem', paddingTop: '0.7rem', paddingBottom: '0.7rem', duration: 0.1, ease: 'power2.out' }, 0.76)
    .to({}, { duration: 0.08 });

  return () => { tl.scrollTrigger?.kill(); tl.kill(); };
}
