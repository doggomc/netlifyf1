import { chromium } from 'playwright';
const cfg = { streamWindow: { active: true }, sources: { disabled: [], overrides: {
  'emb-world': { label: 'AppleTV (EMB)', url: 'https://embdlol.st/embed/01a1b0c0-571b-713d-9296-4190ba1c5918' },
  'emb-fullhd1': { label: 'Sky F1 (EMB)', url: 'https://embdlol.st/embed/01a1b0bf-37d5-70d9-8ab7-87a3b132af8b' },
  'emb-italian': { label: 'Sky F1 Italian (EMB)', url: 'embdlol.st/embed/01a1b0c2-5380-76e0-9804-dd9711c257ce' },
} } };
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0,120)));
await p.addInitScript(c => {
  localStorage.setItem('freef1_site_config_v2', JSON.stringify({ savedAt: Date.now(), config: c }));
}, cfg);
await p.goto('http://127.0.0.1:4173/#watch', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(6000);
const snap = async () => p.evaluate(() => ({
  noStream: document.getElementById('noStream')?.className + '|' + (document.getElementById('noStream')?.textContent||'').slice(0,60),
  iframes: [...document.querySelectorAll('#player iframe, .wplayer iframe')].map(f => f.src).slice(0,3),
  chips: [...document.querySelectorAll('.chip')].map(c => c.textContent.trim()).slice(0,14),
}));
console.log('FIRST', JSON.stringify(await snap()));
// click the DAZN chip whose link is custom "https://embdlol.st/?q=f1"
await p.evaluate(() => { const c=[...document.querySelectorAll('.chip')].find(x=>/Sky F1 Italian/i.test(x.textContent)); c?.click(); });
await p.waitForTimeout(5000);
console.log('ITA', JSON.stringify(await snap()));
// and the chip with a schemeless link
await p.evaluate(() => { const c=[...document.querySelectorAll('.chip')].find(x=>/AppleTV \(EMB\)/i.test(x.textContent)); c?.click(); });
await p.waitForTimeout(5000);
console.log('APPLETV', JSON.stringify(await snap()));
console.log('errs', errs.length ? errs.slice(0,2) : 'none');
await b.close();
