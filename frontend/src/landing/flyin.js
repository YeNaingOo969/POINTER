// Section 3a — fly-in: a camera move over our own 3D Yangon (rendered in Blender,
// scripts/blender/film/flyin.py), played frame by frame as you scroll, so it runs forwards and
// backwards with the page. The caption rises in, then the shot fades into the map section.
// With reduced motion the frame player shows one still (the last frame) and nothing moves.
import { gsap } from 'gsap';
import { FrameScrub } from '../lib/frame-scrub.js';

/** Frame player: runs with and without reduced motion (it handles both itself). */
export function flyinFrames() {
  const canvas = document.querySelector('.flyin__canvas');
  if (!canvas) return () => {};
  const scrub = new FrameScrub(canvas, '/video/scrub/flyin/', { trigger: '.flyin', start: 'top top', end: 'bottom bottom', pin: false });
  return () => scrub.destroy();
}

/** Caption and fade-out, scrubbed with the same scroll. */
export function flyinStory() {
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: '.flyin', start: 'top top', end: 'bottom bottom', scrub: 0.6 },
  });
  // The caption is already up when the section arrives (the flat map behind it is calm), then
  // lifts away as the camera starts to dive.
  tl.to('.flyin__copy', { y: -60, autoAlpha: 0, duration: 0.14, ease: 'power1.in' }, 0.3)
    .to('.flyin__stage', { '--veil': 0, duration: 0.2 }, 0.3)
    .to('.flyin__shade', { autoAlpha: 1, duration: 0.12 }, 0.88);
  return () => { tl.scrollTrigger?.kill(); tl.kill(); };
}
