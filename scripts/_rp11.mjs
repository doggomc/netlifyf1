import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{width:1440,height:1000} });
await page.goto('https://freef1.netlify.app/replays', {waitUntil:'domcontentloaded', timeout:45000});
await page.waitForTimeout(3000);
await page.locator('.rp-row').first().click();
await page.waitForTimeout(3000);
await page.locator('#replayPlayer').scrollIntoViewIfNeeded();
await page.waitForTimeout(500);
const probe = await page.evaluate(()=>{
  const box = document.querySelector('#replayFrameBox').getBoundingClientRect();
  const cx = box.left + box.width/2, cy = box.top + box.height/2;
  const top = document.elementFromPoint(cx, cy);
  const empty = document.querySelector('#replayEmpty');
  const cs = getComputedStyle(empty);
  const overlay = document.elementFromPoint(box.left + 30, box.top + 30);
  return {
    topAtCenter: top ? top.tagName + '.' + (top.className||'') : 'none',
    topAtCorner: overlay ? overlay.tagName + '.' + (overlay.className||'') : 'none',
    emptyHidden: empty.hidden, emptyDisplay: cs.display, emptyPointer: cs.pointerEvents,
    emptyRect: empty.getBoundingClientRect().height
  };
});
console.log(JSON.stringify(probe, null, 1));
await browser.close();
