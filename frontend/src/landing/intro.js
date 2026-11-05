// Landing intro: the team's POINTER logo builds itself part by part (arc sweeps in, the stupa
// rises, the star flares, the letters land, the rules draw out), then opens onto the hero.
// Plays once per browser session; Skip ends it; reduced motion skips it entirely.
// The parts come from the traced SVG (npm run build:logo): #arc #stupa #star #letters #rules #tagline.
import gsap from 'gsap';

const SEEN_KEY = 'pointer.introSeen';
const SVG_NS = 'http://www.w3.org/2000/svg';

function alreadySeen() {
  try { return sessionStorage.getItem(SEEN_KEY) === '1'; } catch { return false; }
}
function markSeen() {
  try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* plays again next time */ }
}

/** A clip rectangle over a part's box, so the part can be wiped in. */
function clipRect(svg, part, id) {
  const box = part.getBBox();
  let defs = svg.querySelector('defs');
  if (!defs) defs = svg.insertBefore(document.createElementNS(SVG_NS, 'defs'), svg.firstChild);
  const clip = document.createElementNS(SVG_NS, 'clipPath');
  clip.id = id;
  const rect = document.createElementNS(SVG_NS, 'rect');
  for (const [k, v] of Object.entries({ x: box.x - 4, y: box.y - 4, width: box.width + 8, height: box.height + 8 })) rect.setAttribute(k, v);
  clip.append(rect);
  defs.append(clip);
  part.setAttribute('clip-path', `url(#${id})`);
  return { rect, box };
}

/** Resolves when the page behind should start its own entrance. */
export async function playIntro(intro) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Dev only: /?capture keeps the intro paused at the start and exposes the timeline as
  // window.__intro, so a script can seek it frame by frame (used to export the GIF).
  const capture = import.meta.env.DEV && new URLSearchParams(location.search).has('capture');
  if (!intro || (!capture && (reduce || alreadySeen()))) {
    intro?.remove();
    return;
  }
  document.documentElement.style.overflow = 'hidden'; // no scrolling under the intro

  let svg;
  try {
    const res = await fetch('/images/brand/pointer-logo.svg');
    intro.querySelector('.intro__logo').innerHTML = await res.text();
    svg = intro.querySelector('svg');
  } catch {
    svg = null;
  }

  const finish = () => {
    markSeen();
    document.documentElement.style.overflow = '';
  };

  if (!svg) {
    intro.remove();
    finish();
    return;
  }

  const part = (id) => svg.querySelector(`#${id}`);
  const arc = clipRect(svg, part('arc'), 'intro-arc');
  const stupa = clipRect(svg, part('stupa'), 'intro-stupa');
  const letters = [...part('letters').children];

  return new Promise((resolve) => {
    const tl = gsap.timeline({
      paused: capture,
      defaults: { ease: 'power3.out' },
      onComplete: () => { intro.remove(); finish(); },
    });
    if (capture) {
      window.__intro = tl;
      intro.querySelector('.intro__skip').hidden = true;
    }
    gsap.set(arc.rect, { attr: { width: 0 } });
    gsap.set(stupa.rect, { attr: { y: stupa.box.y + stupa.box.height + 4, height: 0 } });
    gsap.set(part('star'), { scale: 0, rotate: -120, transformOrigin: '50% 50%' });
    gsap.set(letters, { y: 40, opacity: 0 });
    gsap.set(part('rules'), { scaleX: 0, transformOrigin: '50% 50%' });
    gsap.set(part('tagline'), { opacity: 0, letterSpacing: '6px' });

    tl.to(arc.rect, { attr: { width: arc.box.width + 8 }, duration: 1.1, ease: 'power2.inOut' })
      .to(stupa.rect, { attr: { y: stupa.box.y - 4, height: stupa.box.height + 8 }, duration: 0.9 }, 0.35)
      .from(part('stupa'), { y: 14, duration: 0.9 }, 0.35)
      .to(part('star'), { scale: 1, rotate: 0, duration: 0.7, ease: 'back.out(2.2)' }, 0.95)
      .to(letters, { y: 0, opacity: 1, duration: 0.7, stagger: 0.06 }, 1.05)
      .to(part('rules'), { scaleX: 1, duration: 0.8, ease: 'power2.inOut' }, 1.45)
      .to(part('tagline'), { opacity: 1, letterSpacing: '0.5px', duration: 0.9 }, 1.6)
      .to(part('star'), { scale: 1.35, duration: 0.25, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 2.3)
      .add(() => resolve(), 2.75) // the hero starts its entrance under the fading intro
      .to(intro, { opacity: 0, duration: 0.8, ease: 'power2.inOut' }, 2.75)
      .to(intro.querySelector('.intro__logo'), { scale: 1.08, filter: 'blur(6px)', duration: 0.8, ease: 'power2.in' }, 2.75);

    intro.querySelector('.intro__skip').addEventListener('click', () => {
      resolve();
      tl.progress(1);
    }, { once: true });
  });
}
