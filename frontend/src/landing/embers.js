// Floating golden dust over the hero art (a small 2D canvas, not WebGL).
// 610M budget: ≤ 48 particles, drawn at ≤ 30 fps, paused when off screen or the tab is hidden,
// and not started at all with reduced motion.
const MAX = 48;
const FRAME_MS = 1000 / 30;

export function embers(canvas) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(devicePixelRatio, 1.5);
  const parts = [];
  let w = 0, h = 0, raf = 0, last = 0, visible = true;

  function resize() {
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const spawn = (p = {}) => Object.assign(p, {
    x: Math.random() * w,
    y: h + Math.random() * h * 0.3,
    r: 0.6 + Math.random() * 2.2,
    vy: 6 + Math.random() * 16, // px per second, upwards
    sway: 8 + Math.random() * 18,
    phase: Math.random() * Math.PI * 2,
    life: 0,
  });

  function frame(t) {
    raf = requestAnimationFrame(frame);
    if (t - last < FRAME_MS) return;
    const dt = Math.min((t - last) / 1000, 0.1); // clamp after tab switches
    last = t;
    ctx.clearRect(0, 0, w, h);
    for (const p of parts) {
      p.life += dt;
      p.y -= p.vy * dt;
      const x = p.x + Math.sin(p.phase + p.life * 0.8) * p.sway;
      const fade = Math.min(1, p.life / 2) * Math.max(0, Math.min(1, p.y / (h * 0.5)));
      if (p.y < -10) spawn(p);
      ctx.globalAlpha = 0.55 * fade;
      ctx.fillStyle = '#ffd98a';
      ctx.beginPath();
      ctx.arc(x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const start = () => { if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };

  resize();
  for (let i = 0; i < MAX; i++) { const p = spawn(); p.y = Math.random() * h; parts.push(p); }
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); });
  io.observe(canvas);
  const onVis = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVis);
  addEventListener('resize', resize);
  start();

  return () => {
    stop();
    io.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    removeEventListener('resize', resize);
  };
}
