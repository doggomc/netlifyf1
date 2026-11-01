import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{width:1440,height:1000} });
const errs=[];
page.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
page.on('console', m=>{ if(m.type()==='error') errs.push('console: '+m.text().slice(0,140)); });
await page.goto('https://freef1.netlify.app/replays', { waitUntil:'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(4000);
const rows = await page.locator('.rp-row').count();
console.log('live rows:', rows);
if (rows) {
  await page.locator('.rp-row').first().click();
  await page.waitForTimeout(3000);
  console.log('panel hidden:', await page.evaluate(()=>document.querySelector('#replayPlayer')?.hidden));
  console.log('frame:', await page.evaluate(()=>document.querySelector('#replayFrameBox iframe')?.src || 'none'));
  await page.locator('#replayPlayer').scrollIntoViewIfNeeded();
  await page.screenshot({path:'/tmp/live.png'});
}
console.log('errors:', errs.slice(0,5).join(' || ') || 'none');
await browser.close();
