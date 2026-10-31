import { chromium } from 'playwright';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const b = await chromium.launch();
const ctx = await b.newContext({ userAgent: UA });
const p = await ctx.newPage();
await p.goto('https://taifood-blog.asia/embed/f1/2026/mexico/fp3_540pHD', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(3000);
const list = [
  'mexico-city-grand-prix---practice-3-31385SD',
  'mexico-city-grand-prix---practice-3-31385_540pHD',
  'mexico-city-grand-prix---practice-3-31385',
  'mexico-city-grand-prix---practice-3-31387SD',
];
const out = await p.evaluate(async (cands) => {
  const res = [];
  for (const body of cands) {
    try {
      const r = await fetch('/fetch', { method: 'POST', body: '\n' + body, headers: { 'Content-Type': 'text/plain' } });
      const t = await r.text();
      res.push(`${r.status} len=${t.length} ${body} → ${t.slice(0, 120).replace(/\s+/g, ' ')}`);
    } catch (e) { res.push(`ERR ${body} → ${String(e).slice(0, 50)}`); }
  }
  return res;
}, list);
console.log(out.join('\n'));
await b.close();
