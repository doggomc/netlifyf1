import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{width:1440,height:1000} });
await page.route(/https?:\/\/(?!127\.0\.0\.1|localhost)[^/]+\/.*/, r=>r.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:'{"providers":{},"live_sources":[]}'}));
await page.route('**/api/site/updates', r=>r.fulfill({status:200,contentType:'text/event-stream',headers:{'Access-Control-Allow-Origin':'*'},body:'event: config\ndata: {"sources":{"disabled":[]},"streamWindow":{"active":true}}\n\n'}));
await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
await page.waitForTimeout(1200);
await page.locator('a[data-route="replays"]').first().click();
await page.waitForTimeout(1500);
console.log('view:', await page.evaluate(()=>document.querySelector('#viewReplays')?.hidden));
await page.locator('.rp-row').first().scrollIntoViewIfNeeded();
await page.locator('.rp-row').first().click();
await page.waitForTimeout(1500);
console.log(await page.evaluate(()=>{
  const p=document.querySelector('#replayPlayer');
  const cs=getComputedStyle(p);
  const f=document.querySelector('#replayFrameBox iframe');
  const fs=f?getComputedStyle(f):null;
  return { hidden:p.hidden, opacity:cs.opacity, display:cs.display, cls:p.className,
           frame: f? f.src.slice(0,50):'none', frameOpacity: fs? fs.opacity:null, frameH: f? f.getBoundingClientRect().height:0,
           inView: p.getBoundingClientRect().top };
}));
await browser.close();
