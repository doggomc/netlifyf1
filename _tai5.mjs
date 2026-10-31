import { chromium } from 'playwright';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const b = await chromium.launch();
const ctx = await b.newContext({ userAgent: UA });
const page = await ctx.newPage();
// exactly what the site does today: a frame with allow=..., no sandbox, on our origin
await page.route('**/__probe', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: `<!doctype html><body style="margin:0;background:#111">
  <iframe id="f" src="https://taifood-blog.asia/embed/mexico-grand-prix---qualifying-31387"
    allow="autoplay *; encrypted-media *; fullscreen *; picture-in-picture *"
    referrerpolicy="no-referrer" allowfullscreen
    style="width:100vw;height:100vh;border:0"></iframe></body>` }));
await page.goto('http://127.0.0.1:4173/__probe', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);
const fr = page.frames().find((f) => /taifood/.test(f.url()));
if (!fr) { console.log('no taifood frame'); }
else {
  console.log('framed text:', (await fr.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 160));
  console.log('referrer seen by taifood:', await fr.evaluate(() => document.referrer || '(empty)'));
  console.log('in a frame?', await fr.evaluate(() => { try { return window.self !== window.top; } catch (e) { return 'cross-origin'; } }));
}
// and the same page top-level, so we know whether the gate is framing or something else
const p2 = await ctx.newPage();
await p2.goto('https://taifood-blog.asia/embed/mexico-grand-prix---qualifying-31387', { waitUntil: 'domcontentloaded' });
await p2.waitForTimeout(9000);
console.log('top-level text :', (await p2.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 160));
await b.close();
