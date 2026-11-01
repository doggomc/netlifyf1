import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{width:1440,height:1000} });
await page.route(/https?:\/\/(?!127\.0\.0\.1|localhost|ok\.ru|yandex|mycdn|vd3888)[^/]+\/.*/, r=>r.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:'{"providers":{},"live_sources":[]}'}));
await page.route('**/api/site/updates', r=>r.fulfill({status:200,contentType:'text/event-stream',headers:{'Access-Control-Allow-Origin':'*'},body:'event: config\ndata: {"sources":{"disabled":[]},"streamWindow":{"active":true}}\n\n'}));
await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
await page.waitForTimeout(1000);
await page.locator('a[data-route="replays"]').first().click();
await page.waitForTimeout(1000);
await page.locator('.rp-row').first().click();
await page.waitForTimeout(8000);
const fr = page.frames().find(f=>f.url().includes('ok.ru'));
// try clicking the native play button inside the frame
if (fr) {
  const clicked = await fr.evaluate(()=>{
    const btn = document.querySelector('.vp-controls_play, [data-role="play"], .vp_play, video');
    if (btn) { btn.click?.(); return btn.className || btn.tagName; }
    return 'nothing';
  }).catch(e=>'ERR '+e.message);
  console.log('clicked:', clicked);
}
await page.waitForTimeout(4000);
const state = fr ? await fr.evaluate(()=>{
  const v=document.querySelector('video');
  return v ? {paused:v.paused, t:v.currentTime, ready:v.readyState, src:v.src.slice(0,60)} : {noVideo:true};
}).catch(e=>({err:e.message})) : 'no frame';
console.log('after click:', JSON.stringify(state));
await page.screenshot({path:'/tmp/replay2.png'});
await browser.close();
