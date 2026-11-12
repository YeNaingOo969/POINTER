// Section 2 — "What is POINTER?": the statement lights up word by word as you read it,
// then the three pillars open like windows (clip-path) with a slow inner zoom.
import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';

export function aboutReveal() {
  const split = new SplitText('.about__statement', { type: 'words', wordsClass: 'word' });

  gsap.to(split.words, {
    opacity: 1,
    stagger: 0.1,
    ease: 'none',
    scrollTrigger: { trigger: '.about__statement', start: 'top 82%', end: 'bottom 40%', scrub: 0.6 },
  });

  const tweens = gsap.utils.toArray('.pillar').map((pillar, i) => {
    const media = pillar.querySelector('.pillar__media');
    const img = media.querySelector('img');
    const words = pillar.querySelectorAll('.pillar__title, .pillar__text');

    // Inner parallax while the card crosses the screen.
    gsap.fromTo(img, { yPercent: -7 }, {
      yPercent: 7, ease: 'none',
      scrollTrigger: { trigger: pillar, start: 'top bottom', end: 'bottom top', scrub: true },
    });

    return gsap.timeline({
      delay: i * 0.12,
      scrollTrigger: { trigger: '.pillars', start: 'top 85%', toggleActions: 'play none none reverse' },
    })
      .fromTo(media, { clipPath: 'inset(100% 0% 0% 0% round 1.25rem)' }, { clipPath: 'inset(0% 0% 0% 0% round 1.25rem)', duration: 1.2, ease: 'expo.out' })
      .fromTo(img, { scale: 1.35 }, { scale: 1, duration: 1.6, ease: 'expo.out' }, '<')
      .from(words, { y: 26, autoAlpha: 0, stagger: 0.08, duration: 0.8, ease: 'power3.out' }, '<0.25');
  });

  return () => { tweens.forEach((t) => t.kill()); split.revert(); };
}
