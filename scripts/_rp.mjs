import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{width:1440,height:1000} });
const errs=[]; const frames=[];
page.on('pageerror', e=>errs.push(e.message));
page.on('console', m=>{ if(m.type()==='error') errs.push('console: '+m.text().slice(0,120)); });
page.on('request', r=>{ if(r.url().includes('ok.ru')||r.url().includes('replay')) frames.push(r.url().slice(0,80)); });
await page.route(/https?:\/\/(?!127\.0\.0\.1|localhost)[^/]+\/.*/, async (route) => {
  const u = route.request().url();
  if (u.includes('ok.ru')) return route.abort('blockedbyclient');
  return route.fulfill({status:200, contentType:'application/json', headers:{'Access-Control-Allow-Origin':'*'}, body:'{"providers":{},"live_sources":[]}'});
});
await page.route('**/api/site/updates', r=>r.fulfill({status:200,contentType:'text/event-stream',headers:{'Access-Control-Allow-Origin':'*'},body:'event: config\ndata: {"sources":{"disabled":[]},"streamWindow":{"active":true}}\n\n'}));
await page.goto('http://127.0.0.1:4173/replays',{waitUntil:'domcontentloaded'});
await page.waitForTimeout(2000);
const rows = await page.locator('.rp-row').count();
console.log('rows:', rows);
if (rows) {
  await page.locator('.rp-row').first().click();
  await page.waitForTimeout(1500);
  console.log('panel hidden?', await page.evaluate(()=>document.querySelector('#replayPlayer')?.hidden));
  console.log('frame html:', (await page.evaluate(()=>document.querySelector('#replayFrameBox')?.innerHTML || '')).slice(0,150));
  console.log('empty hidden?', await page.evaluate(()=>document.querySelector('#replayEmpty')?.hidden));
}
console.log('requests:', frames.join(' | ') || 'none');
console.log('errors:', errs.slice(0,4).join(' || ') || 'none');
await browser.close();
