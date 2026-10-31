import { chromium } from 'playwright';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const b = await chromium.launch();
for (const slug of ['mexico-grand-prix', 'mexico-city-grand-prix']) {
  const ctx = await b.newContext({ userAgent: UA });
  const p = await ctx.newPage();
  const seen = [];
  p.on('request', (r) => {
    const u = r.url();
    if (/taifood-blog\.asia\/(fetch|api|embed\/api)/.test(u) || (r.method() === 'POST' && /taifood/.test(u))) {
      seen.push(`${r.method()} ${u.slice(0, 120)} | body=${(r.postData() || '').slice(0, 200)}`);
    }
  });
  p.on('response', async (r) => {
    const u = r.url();
    if (/taifood-blog\.asia\/(fetch|api)/.test(u)) {
      let body = '';
      try { body = (await r.text()).slice(0, 200); } catch {}
      seen.push(`  ^ ${r.status()} ${body}`);
    }
  });
  await p.goto(`https://taifood-blog.asia/embed/${slug}---qualifying-31387`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(7000);
  console.log('===', slug);
  console.log(seen.join('\n') || '  (no api calls seen)');
  await ctx.close();
}
await b.close();
