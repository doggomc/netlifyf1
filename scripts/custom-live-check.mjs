/* Proof against Race Control's REAL config: every chip carrying a pasted link must open that link. */
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
const cfg = JSON.parse(readFileSync(new URL('../tmp-livecfg.json', import.meta.url), 'utf8'));
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
await p.addInitScript((c) => localStorage.setItem('freef1_site_config_v2', JSON.stringify({ savedAt: Date.now(), config: c })), cfg);
await p.goto('https://freef1.netlify.app/#watch', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(6000);
const wanted = Object.entries(cfg.sources.overrides);
for (const [id, o] of wanted) {
  const label = o.label;
  await p.evaluate((l) => {
    /* Non-English chips live under "All"; the row has to show them before they can be clicked. */
    const all = [...document.querySelectorAll('.chip')].find((x) => x.textContent.trim() === 'All');
    all?.click();
    const c = [...document.querySelectorAll('.chip')].find((x) => x.textContent.trim() === l);
    c?.click();
  }, label);
  await p.waitForTimeout(4000);
  const r = await p.evaluate(() => ({ src: [...document.querySelectorAll('#player iframe, .wplayer iframe')].map((f) => f.src)[0] || '', title: document.getElementById('noStreamTitle')?.textContent?.trim() || '', visible: /visible/.test(document.getElementById('noStream')?.className || '') }));
  const ok = r.src.startsWith(o.url.replace(/\/$/, '')) || r.src.startsWith(o.url);
  console.log(`${ok ? ' ok ' : 'FAIL'} ${id.padEnd(14)} ${label} → ${r.src || '(none) ' + r.title}`);
}
await b.close();
