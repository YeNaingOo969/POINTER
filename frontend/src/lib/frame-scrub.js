// Scroll-driven frame sequence player (frames from `npm run build:flyin`; used by src/landing/flyin.js).
//
//   import { FrameScrub } from './lib/frame-scrub.js';
//   const scrub = new FrameScrub(canvas, '/video/scrub/flyin/', { trigger: '.flyin', end: 'bottom bottom', pin: false });
//   ...later: scrub.destroy();
//
// Memory: only a small window of decoded frames (ImageBitmap) is kept around the current one;
// the rest stay as compressed blobs (~20–60 KB each). 120 decoded 1280px frames would be ~440 MB,
// too much for an integrated GPU that shares system RAM.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const WINDOW = 8; // decoded frames kept on each side of the current frame

export class FrameScrub {
  constructor(canvas, baseUrl, { trigger = canvas, start = 'top top', end = '+=200%', pin = true } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    this.blobs = [];
    this.bitmaps = new Map();
    this.current = 0;
    this.destroyed = false;
    this.reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.ready = this.#init({ trigger, start, end, pin });
  }

  async #init(st) {
    this.manifest = await (await fetch(`${this.base}manifest.json`)).json();
    const { width, height, sizes } = this.manifest;
    // smallest set that still covers the canvas at up to 1.5× pixel density
    const need = this.canvas.clientWidth * Math.min(devicePixelRatio, 1.5);
    this.size = [...sizes].sort((a, b) => a - b).find((s) => s >= need) ?? Math.max(...sizes);
    this.canvas.width = Math.min(this.size, width);
    this.canvas.height = Math.round((this.canvas.width * height) / width);

    if (this.reduceMotion) {
      // No scrubbing: show one representative frame (the poster).
      const img = await createImageBitmap(await (await fetch(`${this.base}poster.webp`)).blob());
      this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
      img.close();
      return;
    }

    await this.#load(0);
    this.#draw(0);
    this.trigger = ScrollTrigger.create({
      ...st,
      scrub: true,
      onUpdate: (self) => this.#seek(Math.round(self.progress * (this.manifest.frames - 1))),
    });
    // download the rest in the background, in order
    for (let i = 1; i < this.manifest.frames && !this.destroyed; i++) await this.#load(i);
  }

  #url(i) {
    const frame = String(i + 1).padStart(this.manifest.pad, '0');
    return this.base + this.manifest.pattern.replace('{size}', this.size).replace('{frame}', frame);
  }

  async #load(i) {
    if (!this.blobs[i]) this.blobs[i] = await (await fetch(this.#url(i))).blob();
    return this.blobs[i];
  }

  async #bitmap(i) {
    if (!this.bitmaps.has(i)) this.bitmaps.set(i, createImageBitmap(await this.#load(i)));
    return this.bitmaps.get(i);
  }

  async #seek(i) {
    this.current = i;
    // free decoded frames outside the window
    for (const [k, p] of this.bitmaps) {
      if (Math.abs(k - i) > WINDOW) { this.bitmaps.delete(k); p.then((b) => b.close()); }
    }
    for (let k = Math.max(0, i - WINDOW); k <= Math.min(this.manifest.frames - 1, i + WINDOW); k++) this.#bitmap(k);
    this.#draw(i);
  }

  async #draw(i) {
    try {
      const bmp = await this.#bitmap(i);
      if (this.destroyed || i !== this.current) return; // a newer frame was requested meanwhile
      this.ctx.drawImage(bmp, 0, 0, this.canvas.width, this.canvas.height);
    } catch (err) {
      console.error('frame-scrub', err);
    }
  }

  destroy() {
    this.destroyed = true;
    this.trigger?.kill();
    for (const p of this.bitmaps.values()) p.then((b) => b.close());
    this.bitmaps.clear();
    this.blobs = [];
  }
}
