/* Verifies the new 4K join-nudge in a real browser.
   Run against `npm run preview` (dist) on 4173 with the backend on 3199 pinned via FOURK_URL. */
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:4173';
const results = [];
const check = (label, pass, detail = '') => {
  results.push({ label, pass: Boolean(pass), detail });
  console.log(`  ${pass ? 'ok  ' : 'FAIL'}  ${label}${detail && !pass ? `  →  ${detail}` : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

/* The built bundle calls the production backend host, so every API route is
   mocked on that origin. No real Render or third-party request is made. */
const BACKEND = 'https://f1admin.onrender.com';
await page.route(`${BACKEND}/**`, (route) => {
  const url = route.request().url();
  if (url.includes('/api/stream/uhd')) {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ url: 'https://embdlol.st/embed/stub-id', source: 'emb-uhd' }),
    });
  }
  if (url.includes('/api/site/config')) {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ sources: { disabled: [] }, streamWindow: { active: true } }),
    });
  }
  /* Site update stream: push an open stream window, then hold the connection. */
  if (url.includes('/api/site/updates')) {
    return route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: 'event: config\ndata: {"sources":{"disabled":[]},"streamWindow":{"active":true}}\n\n',
    });
  }
  return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{}' });
});

/* The feed hosts are unreachable from the sandbox; serve a stub iframe document. */
await page.route('**embdlol.st/**', (route) => {
  const url = route.request().url();
  if (url.includes('api.embdlol.st/struct')) {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ channels: [{ id: 'stub-id', channelname: 'f1frisky' }] }),
    });
  }
  return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>4k stub</title>' });
});

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(600);

const chip = page.locator('#links button.chip', { hasText: 'F1 UHD 4K' });
const nudge = page.locator('#joinNudge');
const dontShow = page.locator('#joinNudgeDontShow');

check('the 4K chip is present and not gated', await chip.count() === 1);
check('no Superlicense panel in the page', await page.locator('#superlicenseOverlay').count() === 0);
check('nudge starts closed', !(await nudge.evaluate((el) => el.classList.contains('open'))));

/* 1. clicking the chip opens the popup instead of playing */
await chip.click();
await page.waitForTimeout(300);
check('clicking 4K opens the join nudge', await nudge.evaluate((el) => el.classList.contains('open')));
check('popup asks for joining for session alerts',
  (await page.locator('.jn-copy').innerText()).toLowerCase().includes('session alerts'));
check('popup has a Discord button', await page.locator('#joinNudgeJoin[href*="discord.gg"]').count() === 1);
check('popup has a Continue button', await page.locator('#joinNudgeContinue').count() === 1);
check('"don\'t show again" is unchecked by default', (await dontShow.isChecked()) === false);

/* 2. no network call to the 4K endpoint until Continue is pressed */
const requestedBefore = await page.evaluate(() => window.__uhdCalls || 0);
await page.locator('#joinNudgeContinue').click();
await page.waitForTimeout(250);
await page.waitForSelector('#player iframe', { timeout: 5000 }).catch(() => {});
check('Continue closes the popup', !(await nudge.evaluate((el) => el.classList.contains('open'))));
const frameSrc = await page.evaluate(() => document.querySelector('#player iframe')?.src || '');
check('Continue loads the resolved 4K feed', frameSrc.includes('embdlol.st/embed/stub-id'), frameSrc || 'no iframe');
check('4K chip becomes the active source',
  (await page.locator('#links button.chip.active').first().innerText()).includes('4K'));

/* 3. closing without continuing does not mute the popup */
await page.locator('#links button.chip', { hasText: 'Sky UHD' }).first().click();
await page.waitForTimeout(200);
await chip.click();
await page.waitForTimeout(250);
check('the nudge reappears on the next 4K click', await nudge.evaluate((el) => el.classList.contains('open')));
await page.locator('#joinNudgeClose').click();
await page.waitForTimeout(200);
check('closing the popup does not remember anything',
  (await page.evaluate(() => localStorage.getItem('freef1_4k_nudge_off'))) === null);

/* 4. ticking the opt-out and continuing silences it from then on */
await chip.click();
await page.waitForTimeout(250);
await dontShow.check();
await page.locator('#joinNudgeContinue').click();
await page.waitForTimeout(700);
check('opt-out is stored only after Continue',
  (await page.evaluate(() => localStorage.getItem('freef1_4k_nudge_off'))) === '1');

await page.locator('#links button.chip', { hasText: 'Sky UHD' }).first().click();
await page.waitForTimeout(200);
await chip.click();
await page.waitForTimeout(700);
check('with the opt-out set the 4K chip plays straight away',
  !(await nudge.evaluate((el) => el.classList.contains('open'))));
check('and still lands on the 4K feed',
  (await page.locator('#links button.chip.active').first().innerText()).includes('4K'));

/* 5. no page errors and no retired endpoints */
check('no page errors', pageErrors.length === 0, pageErrors.join(' | '));

await browser.close();
const failed = results.filter((entry) => !entry.pass);
console.log(`\n${results.length - failed.length}/${results.length} browser checks passed`);
process.exit(failed.length ? 1 : 0);
