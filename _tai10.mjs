import { chromium } from 'playwright';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const b = await chromium.launch();
const ctx = await b.newContext({ userAgent: UA, viewport: { width: 1280, height: 720 } });
const variants = [
  'f1/2026/mexico/fp3_540pHD',
  'f1/2026/mexico/fp3',
  'f1/2026/mexico/fp3_1080pHD',
  'f1/2026/mexico/fp3HD',
  'f1/2026/mexico/qualifying',
];
for (const v of variants) {
  const p = await ctx.newPage();
  const media = [];
  p.on('response', (r) => { const u = r.url(); if (/m3u8|\.mp4|\.ts(\?|$)/.test(u)) media.push(`${r.status()} ${u.slice(0, 70)}`); });
  await p.goto(`https://taifood-blog.asia/embed/${v}`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(7000);
  const st = await p.evaluate(() => {
    const walk = (root, out = []) => { for (const el of root.querySelectorAll('*')) { if (el.tagName === 'VIDEO') out.push({ t: +(el.currentTime || 0).toFixed(1), paused: el.paused, h: el.videoHeight }); if (el.shadowRoot) walk(el.shadowRoot, out); } return out; };
    return { vids: walk(document), text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 90), frames: document.querySelectorAll('iframe').length };
  });
  console.log(v.padEnd(26), JSON.stringify(st), 'media:', media[0] || 'none');
  await p.close();
}
await b.close();
