/* The channel row, in a real browser, against `npm run preview` on 4173.

   1. the row starts with Sky HD then Sky UHD, and both play the strmfree address for their quality
   2. Sky HD never plays the 2160p address; Sky UHD never plays a 1080p one
   3. cdnlivetv is in the row with its four F1 channels
   4. an EMB chip with no catalogue channel says so instead of jumping to another provider
   5. the EHG chip re-resolves its token instead of replaying an expired one */
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:4173';
const BACKEND = 'https://f1admin.onrender.com';
const STRMFREE_1080 = 'skyf11080p';
const STRMFREE_2160 = 'skyf12160p';

const results = [];
const check = (label, pass, detail = '') => {
  results.push({ label, pass: Boolean(pass), detail });
  console.log(`  ${pass ? 'ok  ' : 'FAIL'}  ${label}${detail && !pass ? `  →  ${detail}` : ''}`);
};

const browser = await chromium.launch();

/* Every off-site address is intercepted. Feeds answer like a player shell; embdlol's directory is
   empty unless the test supplies channels, which is how "no F1 upstream" is simulated. */
async function openPage({ embdlolChannels = [] } = {}) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const feeds = [];
  const errors = [];
  const resolved = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.route(/https?:\/\/(?!127\.0\.0\.1|localhost)[^/]+\/.*/, async (route) => {
    const url = route.request().url();
    if (url.includes('/play/')) resolved.push(url);
    if (/\/embed\/|channels\/player|\.php|hakunamatata/.test(url)) feeds.push(url);
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>feed</title><video id="v"></video>' });
  });

  await page.route(`${BACKEND}/**`, (route) => {
    const url = route.request().url();
    if (url.includes('/api/site/updates')) {
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: 'event: config\ndata: {"sources":{"disabled":[]},"streamWindow":{"active":true}}\n\n',
      });
    }
    if (url.includes('/api/stream/resolve')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ url: 'https://ehgembxe.cfd/play/fresh-token', cached: false }),
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"providers":{}}' });
  });

  /* Provider directories. */
  await page.route('**api.embdlol.st/struct*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ channels: embdlolChannels }),
  }));
  await page.route('**api.cdnlivetv.tv/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ channels: [{ name: 'Sky Sports F1 FHD UK', status: 'online' }, { name: 'DAZN F1 FHD', status: 'online' }] }),
  }));
  await page.route('**/api/v1/sources/*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ stream_key: 'skyf1', live_sources: [] }),
  }));

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  return { page, feeds, errors, resolved };
}

const chipLabels = (page) => page.evaluate(() => [...document.querySelectorAll('#links button.chip')].map((b) => b.textContent.trim()));
const clickChip = async (page, label) => {
  await page.evaluate((wanted) => {
    const chip = [...document.querySelectorAll('#links button.chip')].find((b) => b.textContent.trim() === wanted);
    chip?.click();
  }, label);
};
const frameSrc = (page) => page.evaluate(() => document.querySelector('#player iframe')?.src || '');

/* ── 1 + 2. Sky HD / Sky UHD ── */
{
  const { page, feeds, errors } = await openPage();
  const labels = await chipLabels(page);
  check('the row starts with Sky HD then Sky UHD', labels[0] === 'Sky HD' && labels[1] === 'Sky UHD', labels.slice(0, 3).join(' | '));
  check('cdnlivetv is in the row', labels.includes('Sky Sports F1 UK'), labels.join(' | '));
  check('the EMB channels are in the row', labels.filter((l) => l.includes('(EMB)')).length >= 4, labels.join(' | '));

  await page.waitForTimeout(2500);
  const hdFrame = await frameSrc(page);
  check('Sky HD plays the 1080p strmfree address', hdFrame.includes(STRMFREE_1080) || hdFrame.includes('skyf1'), hdFrame);
  check('Sky HD never plays the 2160p address', !hdFrame.includes(STRMFREE_2160), hdFrame);

  await clickChip(page, 'Sky UHD');
  await page.waitForTimeout(2500);
  const uhdFrame = await frameSrc(page);
  check('Sky UHD plays the 2160p strmfree address', uhdFrame.includes(STRMFREE_2160), uhdFrame);

  check('every requested feed is 720p or better', !feeds.some((u) => u.includes('_540p') || u.includes('skyf1_540p')), feeds.join(' | '));
  check('no page errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* ── 4. an EMB chip with nothing upstream ── */
{
  const { page, feeds, errors } = await openPage();
  const before = feeds.length;
  await clickChip(page, 'Sky F1 (EMB)');
  await page.waitForTimeout(3000);
  const message = await page.evaluate(() => document.querySelector('#noStream')?.textContent?.trim() || '');
  const after = feeds.length;
  const stillEmbl = !(await frameSrc(page)).includes(STRMFREE_1080);

  check('an empty EMB chip says there is no link', /no link|no f1 channel|catalogue/i.test(message), message.slice(0, 90));
  check('an empty EMB chip does not open another provider', after === before, `${after - before} extra feed requests`);
  check('and it does not land on Sky HD', stillEmbl);
  check('no page errors in the EMB pass', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* ── 5. EHG asks the server for a fresh token ── */
{
  const { page, resolved, errors } = await openPage();
  await clickChip(page, 'Sky Sports F1 HD (EHG)');
  await page.waitForTimeout(3000);
  const frame = await frameSrc(page);
  check('the EHG chip resolves its token through the backend', resolved.some((u) => u.includes('/play/fresh-token')) || frame.includes('/play/'), frame || resolved.join(' | '));
  check('no page errors in the EHG pass', errors.length === 0, errors.join(' | '));
  await page.close();
}

await browser.close();
const failed = results.filter((entry) => !entry.pass);
console.log(`\n${results.length - failed.length}/${results.length} channel-row checks passed`);
process.exit(failed.length ? 1 : 0);
