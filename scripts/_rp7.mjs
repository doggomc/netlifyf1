import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{width:1440,height:1000} });
await page.route(/https?:\/\/(?!127\.0\.0\.1|localhost|ok\.ru|yandex)[^/]+\/.*/, r=>r.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:'{"providers":{},"live_sources":[]}'}));
await page.route('**/api/site/updates', r=>r.fulfill({status:200,contentType:'text/event-stream',headers:{'Access-Control-Allow-Origin':'*'},body:'event: config\ndata: {"sources":{"disabled":[]},"streamWindow":{"active":true}}\n\n'}));
await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
await page.waitForTimeout(1000);
await page.locator('a[data-route="replays"]').first().click();
await page.waitForTimeout(1200);
await page.locator('.rp-row').first().click();
await page.waitForTimeout(6000);
const fr = page.frames().find(f=>f.url().includes('ok.ru'));
console.log('frame url:', fr ? fr.url().slice(0,60) : 'NONE');
const info = fr ? await fr.evaluate(()=>{
  const v=document.querySelector('video');
  return { text: document.body.innerText.replace(/\s+/g,' ').slice(0,100), video: !!v,
           paused: v?v.paused:null, ready: v?v.readyState:null, src:(v&&v.src||'').slice(0,50), dur: v?v.duration:null };
}).catch(e=>({err:e.message})) : null;
console.log('frame info:', JSON.stringify(info));
// scroll into view & screenshot
await page.locator('#replayPlayer').scrollIntoViewIfNeeded();
await page.screenshot({ path: '/tmp/replay.png' });
console.log('screenshot saved');
await browser.close();
