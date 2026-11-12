// Section 4 — seven categories. Desktop: the section pins and the panels slide sideways; each
// panel that reaches the centre sets data-cat on the section, and CSS melts the background and
// ink colour into that group's palette (ref 017). Props drift at their own speed for depth.
// Phones: plain vertical panels with the same colour change.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function categories() {
  const section = document.querySelector('.cats');
  const track = section.querySelector('.cats__track');
  const panels = gsap.utils.toArray('.cat', section);
  const dots = gsap.utils.toArray('.cats__dots li', section);

  const setCat = (panel) => {
    const cat = panel.dataset.cat;
    section.dataset.cat = cat;
    dots.forEach((d) => d.classList.toggle('is-on', d.dataset.cat === cat));
  };
  setCat(panels[0]);

  const mm = gsap.matchMedia();
  mm.add('(min-width: 821px)', () => {
    const distance = () => track.scrollWidth - innerWidth;
    const slide = gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: { trigger: section, pin: true, scrub: 0.8, end: () => `+=${distance()}`, invalidateOnRefresh: true },
    });

    panels.forEach((panel) => {
      ScrollTrigger.create({
        trigger: panel, containerAnimation: slide, start: 'left 55%', end: 'right 55%',
        onToggle: (st) => st.isActive && setCat(panel),
      });
      // Arch photo drifts a little against the slide.
      gsap.fromTo(panel.querySelector('.cat__arch img'), { xPercent: 8 }, {
        xPercent: -8, ease: 'none',
        scrollTrigger: { trigger: panel, containerAnimation: slide, start: 'left right', end: 'right left', scrub: true },
      });
      // Props: near ones move faster than the panel, far ones slower.
      panel.querySelectorAll('.prop').forEach((prop) => {
        const speed = Number(prop.dataset.speed) || 1;
        gsap.fromTo(prop, { x: 260 * speed, rotate: 12 * speed }, {
          x: -260 * speed, rotate: -12 * speed, ease: 'none',
          scrollTrigger: { trigger: panel, containerAnimation: slide, start: 'left right', end: 'right left', scrub: true },
        });
      });
      // Big name rises in as the panel arrives.
      gsap.from(panel.querySelectorAll('.cat__num, .cat__name, .cat__text, .cat__examples'), {
        y: 60, autoAlpha: 0, stagger: 0.06, ease: 'power3.out',
        scrollTrigger: { trigger: panel, containerAnimation: slide, start: 'left 75%', end: 'left 35%', scrub: true },
      });
    });
    return () => slide.scrollTrigger?.kill();
  });

  mm.add('(max-width: 820px)', () => {
    panels.forEach((panel) => {
      ScrollTrigger.create({ trigger: panel, start: 'top 55%', end: 'bottom 55%', onToggle: (st) => st.isActive && setCat(panel) });
      panel.querySelectorAll('.prop').forEach((prop) => {
        gsap.fromTo(prop, { y: 80 * (Number(prop.dataset.speed) || 1) }, {
          y: -80 * (Number(prop.dataset.speed) || 1), ease: 'none',
          scrollTrigger: { trigger: panel, start: 'top bottom', end: 'bottom top', scrub: true },
        });
      });
    });
  });

  return () => mm.revert();
}
