/* Replays, in a real browser against `npm run preview` on 4173.
   1. the list renders and a row opens the player
   2. the embed is asked to autoplay (a click should be enough, not two)
   3. a provider that refuses to embed is reported, with a direct link, instead of a blank box */
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:4173';
const results = [];
const check = (label, pass, detail = '') => {
  results.push({ label, pass: Boolean(pass), detail });
  console.log(`  ${pass ? 'ok  ' : 'FAIL'}  ${label}${detail && !pass ? `  →  ${detail}` : ''}`);
};

const browser = await chromium.launch();

async function openReplays({ blockEmbeds = false } = {}) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route(/https?:\/\/(?!127\.0\.0\.1|localhost)[^/]+\/.*/, (route) => {
    const url = route.request().url();
    if (blockEmbeds && /ok\.ru|videoembed/.test(url)) return route.abort('blockedbyclient');
    if (/ok\.ru|videoembed/.test(url)) return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>replay</title><video></video>' });
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"providers":{},"live_sources":[]}' });
  });
  await page.route('**/api/site/updates', (route) => route.fulfill({
    status: 200, contentType: 'text/event-stream', headers: { 'Access-Control-Allow-Origin': '*' },
    body: 'event: config\ndata: {"sources":{"disabled":[]},"streamWindow":{"active":true}}\n\n',
  }));
  await page.goto(`${BASE}/replays`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  return { page, errors };
}

/* ── 1 + 2 ── */
{
  const { page, errors } = await openReplays();
  const rows = await page.locator('.rp-row').count();
  check('the replay list renders', rows > 0, `${rows} rows`);
  await page.locator('.rp-row').first().click();
  await page.waitForTimeout(2500);
  const src = await page.evaluate(() => document.querySelector('#replayFrameBox iframe')?.src || '');
  check('the player opens on click', Boolean(src), src || 'no frame');
  check('the embed is asked to autoplay', /[?&]autoplay=1/.test(src), src);
  check('the frame is not lazy (it is on screen now)', await page.evaluate(() => document.querySelector('#replayFrameBox iframe')?.loading !== 'lazy'));
  check('the "no embed" notice stays hidden when it plays', await page.evaluate(() => document.querySelector('#replayEmpty')?.hidden === true));
  check('no page errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* ── 3 ── */
{
  const { page, errors } = await openReplays({ blockEmbeds: true });
  await page.locator('.rp-row').first().click();
  await page.waitForTimeout(11000);
  const shown = await page.evaluate(() => {
    const empty = document.querySelector('#replayEmpty');
    return { hidden: empty?.hidden, text: empty?.textContent || '', link: empty?.querySelector('a')?.href || '' };
  });
  check('a blocked embed is reported instead of a blank box', shown.hidden === false && /play|embed/i.test(shown.text), JSON.stringify(shown).slice(0, 110));
  check('and it offers the provider link', /^https:\/\//.test(shown.link), shown.link || 'no link');
  check('no page errors in the blocked pass', errors.length === 0, errors.join(' | '));
  await page.close();
}

await browser.close();
const failed = results.filter((entry) => !entry.pass);
console.log(`\n${results.length - failed.length}/${results.length} replay checks passed`);
process.exit(failed.length ? 1 : 0);
