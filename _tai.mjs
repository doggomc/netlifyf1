import { chromium } from 'playwright';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
const media = [];
page.on('response', (r) => { const u = r.url(); if (/m3u8|\.mp4|\.ts(\?|$)|\.mpd/.test(u)) media.push(`${r.status()} ${u.slice(0, 110)}`); });
page.on('requestfailed', (r) => { const u = r.url(); if (/m3u8|mp4|.ts/.test(u)) media.push('FAILED ' + u.slice(0, 90)); });
await page.goto('https://taifood-blog.asia/embed/mexico-grand-prix---qualifying-31387', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);
const st = await page.evaluate(() => {
  const walk = (root, out = []) => { for (const el of root.querySelectorAll('*')) { if (el.tagName === 'VIDEO') out.push({ t: +(el.currentTime||0).toFixed(1), paused: el.paused, rs: el.readyState, h: el.videoHeight, src: (el.currentSrc||'').slice(0,80) }); if (el.shadowRoot) walk(el.shadowRoot, out); } return out; };
  return { vids: walk(document), text: document.body.innerText.replace(/\s+/g,' ').slice(0, 160), iframes: [...document.querySelectorAll('iframe')].map(f => (f.src||'').slice(0,90)).slice(0,4) };
});
console.log(JSON.stringify(st, null, 1));
console.log('media:', media.slice(0, 8).join('\n       ') || 'none requested');
await page.screenshot({ path: '/home/user/_taifood.png' });
await b.close();
