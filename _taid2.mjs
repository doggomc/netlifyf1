import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.route('**f1admin.onrender.com/api/site/updates', (r) => r.fulfill({ status: 200, contentType: 'text/event-stream', headers: { 'Access-Control-Allow-Origin': '*' }, body: 'event: config\ndata: {"sources":{"disabled":[]},"streamWindow":{"active":true}}\n\n' }));
await p.route('**f1admin.onrender.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"providers":{}}' }));
await p.route(/https?:\/\/(?!127\.0\.0\.1|localhost)[^/]+\/.*/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>feed</title>' }));
await p.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(2000);
await p.locator('#feedTabs button.chip', { hasText: 'Other' }).click();
await p.waitForTimeout(300);
const labels = await p.evaluate(() => [...document.querySelectorAll('#links button.chip')].map((x) => x.textContent.trim()));
console.log('other row:', labels.join(' | '));
await p.locator('#links button.chip', { hasText: 'DAZN' }).first().click();
await p.waitForTimeout(3500);
console.log(JSON.stringify(await p.evaluate(() => ({
  frame: document.querySelector('#player iframe')?.src || null,
  noStream: document.querySelector('#noStream')?.offsetParent ? document.querySelector('#noStream').textContent.replace(/\s+/g, ' ').slice(0, 100) : '',
  loader: document.querySelector('#loader')?.className,
}))));
await b.close();
