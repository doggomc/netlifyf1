import { chromium } from 'playwright';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const b = await chromium.launch();
const ctx = await b.newContext({ userAgent: UA });
const p = await ctx.newPage();
await p.goto('https://taifood-blog.asia/embed/mexico-grand-prix---qualifying-31387', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(4000);
const candidates = [
  'mexico-grand-prix---qualifying-31387',
  'mexico-city-grand-prix---qualifying-31387',
  'mexico-grand-prix---race-31391',
  'mexico-city-grand-prix---race-31391',
  'united-states-grand-prix---race-31387',
  'usa-grand-prix---race-31387',
  'singapore-grand-prix---race-31387',
  'azerbaijan-grand-prix---race-31387',
];
const out = await p.evaluate(async (list) => {
  const res = [];
  for (const body of list) {
    try {
      const r = await fetch('/fetch', { method: 'POST', body: '\n' + body, headers: { 'Content-Type': 'text/plain' } });
      const t = (await r.text()).slice(0, 60).replace(/\s+/g, ' ');
      res.push(`${r.status} ${body} → ${t}`);
    } catch (e) { res.push(`ERR ${body} → ${String(e).slice(0, 40)}`); }
  }
  return res;
}, candidates);
console.log(out.join('\n'));
await b.close();
