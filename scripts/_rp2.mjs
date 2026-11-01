import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{width:1440,height:1000} });
await page.route(/https?:\/\/(?!127\.0\.0\.1|localhost)[^/]+\/.*/, r=>r.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:'{"providers":{},"live_sources":[]}'}));
await page.route('**/api/site/updates', r=>r.fulfill({status:200,contentType:'text/event-stream',headers:{'Access-Control-Allow-Origin':'*'},body:'event: config\ndata: {"sources":{"disabled":[]},"streamWindow":{"active":true}}\n\n'}));
await page.goto('http://127.0.0.1:4173/replays',{waitUntil:'domcontentloaded'});
await page.waitForTimeout(1500);
// is the view actually visible?
console.log('view hidden?', await page.evaluate(()=>document.querySelector('#viewReplays')?.hidden));
console.log('list children:', await page.evaluate(()=>document.querySelector('#replayList')?.children.length));
console.log('first row html:', (await page.evaluate(()=>document.querySelector('#replayList')?.innerHTML||'')).slice(0,300));
const row = page.locator('.rp-row').first();
await row.scrollIntoViewIfNeeded();
await row.click();
await page.waitForTimeout(1200);
console.log('panel hidden after click:', await page.evaluate(()=>document.querySelector('#replayPlayer')?.hidden));
console.log('panel rect:', await page.evaluate(()=>{const p=document.querySelector('#replayPlayer'); const r=p.getBoundingClientRect(); return {h:r.height,w:r.width,display:getComputedStyle(p).display};}));
await browser.close();
