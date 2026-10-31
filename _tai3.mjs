import { chromium } from 'playwright';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const b = await chromium.launch();
const ctx = await b.newContext({ userAgent: UA, viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const media = [];
page.on('response', (r) => { const u = r.url(); if (/m3u8|\.mp4|\.ts(\?|$)/.test(u)) media.push(`${r.status()} ${u.slice(0, 100)}`); });
await page.goto('https://taifood-blog.asia/embed/mexico-grand-prix---qualifying-31387', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(10000);
const probe = async (tag) => console.log(tag, JSON.stringify(await page.evaluate(() => {
  const walk = (root, out = []) => { for (const el of root.querySelectorAll('*')) { if (el.tagName === 'VIDEO') out.push({ t: +(el.currentTime||0).toFixed(1), paused: el.paused, h: el.videoHeight }); if (el.shadowRoot) walk(el.shadowRoot, out); } return out; };
  return { vids: walk(document), text: document.body.innerText.replace(/\s+/g,' ').slice(0, 110), iframes: [...document.querySelectorAll('iframe')].map(f => (f.src||'').slice(0,80)).slice(0,3) };
})));
await probe('real UA, no click ');
await page.mouse.click(640, 400);
await page.waitForTimeout(8000);
await probe('real UA, clicked ');
console.log('media:', media.slice(0, 6).join(' | ') || 'none');
await b.close();
