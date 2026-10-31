import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{width:1440,height:1000} });
await page.goto('https://freef1.netlify.app/replays', {waitUntil:'domcontentloaded', timeout:45000});
await page.waitForTimeout(3000);
await page.locator('.rp-row').first().click();
await page.waitForTimeout(4000);
await page.locator('#replayPlayer').scrollIntoViewIfNeeded();
await page.waitForTimeout(800);
// click the play button like a human: middle of the frame
const box = await page.locator('#replayFrameBox').boundingBox();
await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
await page.waitForTimeout(6000);
const fr = page.frames().find(f=>f.url().includes('ok.ru'));
console.log('state:', JSON.stringify(await fr.evaluate(()=>{
  const v=document.querySelector('video');
  return v ? {paused:v.paused, t:Math.round(v.currentTime), dur:Math.round(v.duration||0)} : {noVideo:true};
}).catch(e=>({err:e.message}))));
await page.screenshot({path:'/tmp/playing.png'});
await browser.close();
