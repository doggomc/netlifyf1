import type { FeatureContext } from '../app';
import { $ } from '../services/dom';
export function init(ctx: FeatureContext) {
const { liteMotion, hex2rgb } = ctx;
/* ═══════════════ 22. SPEED-LINE CANVAS ═══════════════ */
(function initSpeedCanvas() {
  const canvas = $("speedCanvas");
  if (!canvas || liteMotion) return;
  const context = canvas.getContext('2d');
  if (!context) return;

  let width = 0;
  let height = 0;
  let parts = [];
  let rgb = [225, 6, 0];
  let resizeTimer = 0;
  let running = false;
  let lastFrame = 0;

  const targetFps = innerWidth < 768 || navigator.hardwareConcurrency <= 4 ? 30 : 36;
  const frameInterval = 1000 / targetFps;

  function readAccent(color = '') {
    rgb = hex2rgb(color || getComputedStyle(document.documentElement).getPropertyValue('--team').trim() || '#E10600');
  }

  function makeSprite(part) {
    const sprite = document.createElement('canvas');
    const spriteContext = sprite.getContext('2d');
    sprite.width = Math.ceil(part.len) + 2;
    sprite.height = Math.max(3, Math.ceil(part.w) + 2);
    const gradient = spriteContext.createLinearGradient(0, 0, sprite.width, 0);
    gradient.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
    gradient.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${part.a})`);
    spriteContext.strokeStyle = gradient;
    spriteContext.lineWidth = part.w;
    spriteContext.lineCap = 'round';
    spriteContext.beginPath();
    spriteContext.moveTo(1, sprite.height / 2);
    spriteContext.lineTo(sprite.width - 1, sprite.height / 2);
    spriteContext.stroke();
    return sprite;
  }

  function makePart() {
    const part: { x: number; y: number; len: number; sp: number; a: number; w: number; sprite?: HTMLCanvasElement } = {
      x: Math.random() * width,
      y: Math.random() * height,
      len: Math.random() * 90 + 20,
      sp: Math.random() * 1.6 + 0.35,
      a: Math.random() * 0.28 + 0.05,
      w: Math.random() * 1.3 + 0.25
    };
    part.sprite = makeSprite(part);
    return part;
  }

  function build() {
    const count = width < 768 ? 26 : 40;
    parts = Array.from({ length: count }, makePart);
  }

  /* The canvas covers the viewport and is redrawn on every frame, so its backing store is
     the single largest per-frame cost on the whole page: a full-screen clear plus one texture
     upload per frame, for a 55%-opacity decoration. Drawing into a half-resolution buffer and
     letting the compositor stretch it cuts that work by roughly four times; speed lines have no
     fine detail, so the difference is invisible. */
  function size() {
    const scale = Math.min(1, 900 / Math.max(1, innerWidth));
    width = canvas.width = Math.max(1, Math.round(innerWidth * scale));
    height = canvas.height = Math.max(1, Math.round(innerHeight * scale));
    readAccent();
    build();
  }

  function tick(now) {
    if (document.hidden) {
      running = false;
      return;
    }
    running = true;
    const elapsed = now - lastFrame;
    if (elapsed < frameInterval) {
      requestAnimationFrame(tick);
      return;
    }
    const speed = Math.min(2, elapsed / (1000 / 60));
    lastFrame = now - (elapsed % frameInterval);
    context.clearRect(0, 0, width, height);
    parts.forEach((part) => {
      part.x += part.sp * 2.4 * speed;
      if (part.x - part.len > width) {
        part.x = -part.len;
        part.y = Math.random() * height;
      }
      context.drawImage(part.sprite, Math.round(part.x - part.len), Math.round(part.y - part.sprite.height / 2));
    });
    requestAnimationFrame(tick);
  }

  function start() {
    if (!running && !document.hidden) {
      running = true;
      lastFrame = performance.now();
      requestAnimationFrame(tick);
    }
  }

  size();
  start();
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(size, 140);
  }, { passive: true });
  addEventListener('visibilitychange', start, { passive: true });
  addEventListener('freef1themechange', (event) => {
    readAccent((event as CustomEvent<{ color: string }>).detail?.color);
    parts.forEach((part) => {
      part.sprite = makeSprite(part);
    });
  });
})();


return {};
}
