import { chromium } from 'playwright';
const browser = await chromium.launch();
for (const policy of ['no-referrer', 'strict-origin-when-cross-origin', null]) {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4173/help.html',{waitUntil:'domcontentloaded'});
  await page.evaluate((pol)=>{
    const f=document.createElement('iframe');
    f.src='https://ok.ru/videoembed/16626814290604';
    f.style.cssText='width:800px;height:450px';
    if (pol) f.setAttribute('referrerpolicy', pol);
    document.body.appendChild(f);
  }, policy);
  await page.waitForTimeout(7000);
  const fr = page.frames().find(f=>f.url().includes('ok.ru'));
  const info = fr ? await fr.evaluate(()=>({ video: !!document.querySelector('video'),
    text: document.body.innerText.replace(/\s+/g,' ').slice(0,80),
    scripts: document.scripts.length })).catch(e=>({err:e.message})) : 'no frame';
  console.log(policy || 'default', '->', JSON.stringify(info));
  await page.close();
}
await browser.close();
