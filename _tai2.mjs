import { chromium } from 'playwright';
const b = await chromium.launch();
// a real page, with the taifood page in an iframe exactly like the site does
const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
const media = [];
page.on('response', (r) => { const u = r.url(); if (/m3u8|\.mp4|\.ts(\?|$)/.test(u)) media.push(`${r.status()} ${u.slice(0, 100)}`); });
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  const f = document.createElement('iframe');
  f.src = 'https://taifood-blog.asia/embed/mexico-grand-prix---qualifying-31387';
  f.allow = 'autoplay *; fullscreen *; encrypted-media *; picture-in-picture *';
  f.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:9999;border:0;background:#000';
  document.body.appendChild(f);
});
await page.waitForTimeout(10000);
const fr = page.frames().find((f) => /taifood/.test(f.url()));
const probe = async (tag) => {
  const info = await fr.evaluate(() => {
    const walk = (root, out = []) => { for (const el of root.querySelectorAll('*')) { if (el.tagName === 'VIDEO') out.push({ t: +(el.currentTime||0).toFixed(1), paused: el.paused, h: el.videoHeight }); if (el.shadowRoot) walk(el.shadowRoot, out); } return out; };
    return { vids: walk(document), text: document.body.innerText.replace(/\s+/g,' ').slice(0, 120), iframes: document.querySelectorAll('iframe').length };
  });
  console.log(tag, JSON.stringify(info));
};
await probe('framed, no click ');
await page.mouse.click(640, 400);
await page.waitForTimeout(8000);
await probe('framed, after click');
console.log('media:', media.slice(0, 6).join(' | ') || 'none');
await b.close();
