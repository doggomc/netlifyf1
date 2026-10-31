import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{width:1440,height:1000} });
await page.route(/https?:\/\/(?!127\.0\.0\.1|localhost)[^/]+\/.*/, r=>r.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:'{"providers":{},"live_sources":[]}'}));
await page.route('**/api/site/updates', r=>r.fulfill({status:200,contentType:'text/event-stream',headers:{'Access-Control-Allow-Origin':'*'},body:'event: config\ndata: {"sources":{"disabled":[]},"streamWindow":{"active":true}}\n\n'}));
await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
await page.waitForTimeout(1200);
// intercept the row click to see hit-testing
const hit = await page.evaluate(()=>{
  const rows=[...document.querySelectorAll('.rp-row')];
  return rows.slice(0,3).map(r=>{ const b=r.getBoundingClientRect(); return {h:b.height,w:b.width,top:b.top,vis:getComputedStyle(r).visibility}; });
});
console.log('rows before nav (hidden view):', JSON.stringify(hit));
await page.locator('a[data-route="replays"]').first().click();
await page.waitForTimeout(1200);
await page.locator('.rp-row').first().click();
await page.waitForTimeout(3000);
// play the video inside ok.ru frame?
const fr = page.frames().find(f=>f.url().includes('ok.ru'));
console.log('ok frame attached:', !!fr);
if (fr) {
  const info = await fr.evaluate(()=>{
    const v=document.querySelector('video');
    return { hasVideo: !!v, paused: v? v.paused : null, readyState: v? v.readyState : null, src: v? (v.src||'').slice(0,40) : null,
             buttons: [...document.querySelectorAll('[class*=play]')].slice(0,3).map(b=>b.className) };
  });
  console.log('video state:', JSON.stringify(info));
}
await browser.close();
