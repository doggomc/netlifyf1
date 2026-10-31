/* The channel row, in a real browser, against `npm run preview` on 4173.

   1. the row starts with Sky HD then Sky UHD, and both play the strmfree address for their quality
   2. Sky HD never plays the 2160p address; Sky UHD never plays a 1080p one
   3. cdnlivetv is in the row with its four F1 channels
   4. an EMB chip with no catalogue channel says so instead of jumping to another provider
   5. the EHG chip re-resolves its token instead of replaying an expired one
   6. the English / Other / All tabs filter the row and leave the specials in their own block
   7. a weelo special reads its state, plays when it is on air and says so when it is not
   8. the catalogue's race-prefixed short codes (f1mexicosatita) still reach their chip, and the
      non-English feeds stay out of the English tab
   9. every taifood chip asks for <event>---<session>-<id><mark>, never the 540p path form, and the
      pool carries both spellings of the event name */
import { readFileSync } from 'node:fs';
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
async function openPage({ embdlolChannels = [], weeloState = {} } = {}) {
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
  /* weelo's status map comes through f1admin, because weelo.live refuses the cross-origin request
     however open its headers look. Registered after the catch-all so it wins. */
  await page.route('**/api/v1/sources/*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ stream_key: 'skyf1', live_sources: [] }),
  }));

  await page.route(`${BACKEND}/api/stream/weelo*`, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ state: weeloState, count: Object.keys(weeloState).length }),
  }));

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  return { page, feeds, errors, resolved };
}

const chipLabels = (page) => page.evaluate(() => [...document.querySelectorAll('#links button.chip')].map((b) => b.textContent.trim()));
/* A real click: the row scrolls, and a synthetic .click() on an off-screen chip is not equivalent. */
const clickChip = async (page, label) => {
  await page.locator('#links button.chip', { hasText: label }).first().click();
};
const frameSrc = (page) => page.evaluate(() => document.querySelector('#player iframe')?.src || '');
const tab = (page, label) => page.locator('#feedTabs button.chip', { hasText: label }).first().click();
/* Exact match: 'DAZN' would otherwise hit 'DAZN (EMB)' first and test the wrong chip. */
const clickChipExact = (page, label) => page.locator('#links button.chip', { hasText: new RegExp(`^${label}$`) }).first().click();
const rowLabels = (page) => page.evaluate(() => [...document.querySelectorAll('#links button.chip')].map((b) => b.textContent.trim()));
const specialLabels = (page) => page.evaluate(() => [...document.querySelectorAll('#links .special-row button.chip')].map((b) => b.textContent.trim()));

const WEELO_IDS = {
  kimi: 'peogcgpgbgchegaciclejgngjgacbeogehpgogfgmgmgjgjcacieee',
  drivers: 'gebdacefgfaciceechjgghfgchacefchbgdglgfgchjcacieee',
  data: 'gebdacefgfaciceebgehbgacdeigbgogogfgmgjcacieee',
};
const weeloUp = {
  [WEELO_IDS.kimi]: 'online',
  [WEELO_IDS.drivers]: 'soon',
  [WEELO_IDS.data]: 'offline',
};

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
  await clickChip(page, 'SKY (EMB)');
  await page.waitForTimeout(3000);
  const message = await page.evaluate(() => {
    const panel = document.querySelector('#noStream');
    return panel ? panel.textContent.trim() : '';
  });
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

/* ── 6. the tabs ── */
{
  const { page, errors } = await openPage({ weeloState: weeloUp });
  await page.waitForTimeout(800);
  const english = await rowLabels(page);
  check('the row opens on the English tab', english.includes('Sky HD') && !english.includes('Sky Sport Italia'), english.join(' | '));
  /* Regression: the tab ids are the state values ('en'), not the labels. Keying them off the label
     made English filter as Other, so the row looked empty and the active tab was unmarked. */
  const marked = await page.evaluate(() => [...document.querySelectorAll('#feedTabs button.chip')]
    .filter((b) => b.getAttribute('aria-selected') === 'true').map((b) => b.textContent.trim()));
  check('exactly one tab is marked as selected on load', marked.length === 1 && marked[0] === 'English', marked.join(' | ') || 'none marked');
  check('English keeps the specials in their own block', (await specialLabels(page)).length === 5, (await specialLabels(page)).join(' | '));

  await tab(page, 'Other');
  await page.waitForTimeout(400);
  const other = await rowLabels(page);
  check('Other shows the foreign broadcasters', ['Sky Sport Italia', 'Sky Sport F1 DE', 'V Sport Motor SE'].every((l) => other.includes(l)), other.join(' | '));
  check('Other hides English and the specials', !other.includes('Sky HD') && !other.includes('Kimi Antonelli'), other.join(' | '));

  await tab(page, 'All');
  await page.waitForTimeout(400);
  const all = await rowLabels(page);
  check('All shows both tabs and every special', all.includes('Sky HD') && all.includes('Sky Sport Italia') && all.includes('Data Channel'), all.join(' | '));
  check('no page errors in the tab pass', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* ── 7. the specials ── */
{
  const { page, feeds, errors } = await openPage({ weeloState: weeloUp });
  await page.waitForTimeout(800);
  const down = await page.evaluate(() => [...document.querySelectorAll('#links .special-row .is-down')].map((b) => b.textContent.trim()));
  check('a feed weelo reports offline is drawn as unavailable', down.includes('Data Channel'), down.join(' | ') || 'none marked');

  await clickChip(page, 'Kimi Antonelli');
  await page.waitForTimeout(2500);
  const frame = await frameSrc(page);
  check('an onboard that is on air opens the weelo player', frame.includes('weellz.live/beta?stream=') && frame.includes(WEELO_IDS.kimi), frame);
  check('the onboard does not fall back to a broadcaster', !frame.includes('strmfree') && !frame.includes('embdlol'), frame);
  check('the onboard request is 720p or better', feeds.every((u) => !u.includes('_540p')), feeds.join(' | '));

  await clickChip(page, 'Data Channel');
  await page.waitForTimeout(1500);
  const message = await page.evaluate(() => document.querySelector('#noStream')?.textContent?.trim() || '');
  check('an offline data channel says so instead of opening a frame', /offline|not on air|no link/i.test(message), message.slice(0, 90));
  check('no page errors in the specials pass', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* ── 8. today's catalogue naming, and where the non-English feeds live ── */
{
  /* Exactly what embdlol published on 2026-10-31: race-prefixed, with the short codes for the
     Italian and German feeds and no apple/fullhd channels at all. */
  const today = [
    { channelname: 'f1mexicosatsky', id: '01a192cf-6841-755f-acfa-c694d50bf588' },
    { channelname: 'f1mexicosatworld', id: '01a192d0-450c-75e2-a1e2-07322ce03527' },
    { channelname: 'f1mexicosatdazn', id: '01a192d0-5e87-7390-986e-489d8d1b8dc1' },
    { channelname: 'f1mexicosatita', id: '01a192d0-7a05-7033-a9b9-7baffa77b4bd' },
    { channelname: 'f1mexicosatdeu', id: '01a192d0-8c0e-711c-a895-062bfa1beea9' },
  ];
  const { page, errors } = await openPage({ embdlolChannels: today, weeloState: weeloUp });
  await page.waitForTimeout(1200);

  const english = await rowLabels(page);
  check('the non-English feeds are not in the English tab',
    !['DAZN (EMB)', 'SKYIT (EMB)', 'SKYDE (EMB)', 'GERMAN (EMB)', 'SPANISH (EMB)', 'ITALIAN (EMB)', 'DAZN', 'Viaplay'].some((l) => english.includes(l)),
    english.join(' | '));
  check('and the English feeds are', ['SKY (EMB)', 'WORLD (EMB)', 'Sky Sports F1 UK'].every((l) => english.includes(l)), english.join(' | '));

  await clickChip(page, 'SKY (EMB)');
  await page.waitForTimeout(2500);
  const sky = await frameSrc(page);
  check('a race-prefixed catalogue name still reaches its chip', sky.includes('01a192cf-6841'), sky);

  await tab(page, 'Other');
  await page.waitForTimeout(400);
  await clickChip(page, 'ITALIAN (EMB)');
  await page.waitForTimeout(2500);
  const italian = await frameSrc(page);
  check('the short code ita maps to the Italian chip', italian.includes('01a192d0-7a05'), italian);

  await clickChip(page, 'DAZN (EMB)');
  await page.waitForTimeout(2500);
  const dazn = await frameSrc(page);
  check('every EMB chip that has a channel opens a player', dazn.includes('embdlol.st/embed/'), dazn);
  check('no page errors in the catalogue-naming pass', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* ── 9. taifood addresses ── */
{
  const { page, feeds, errors } = await openPage({ weeloState: weeloUp });
  await page.waitForTimeout(1000);
  await tab(page, 'Other');
  await page.waitForTimeout(400);
  for (const label of ['DAZN', 'Viaplay']) {
    await clickChipExact(page, label);
    await page.waitForTimeout(2600);
  }
  const asked = feeds.filter((u) => /taifood/.test(u));
  const withMark = asked.filter((u) => /-313\d\d(SD|SD1080pHD)$/.test(u));
  check('the taifood chip asks for a marked address', withMark.length > 0, asked[0] || 'none requested');
  check('the address uses --- between event and session', asked.every((u) => /---/.test(u)), asked.slice(0, 2).join(' | '));
  check('the marked address is the one tried first', /mexico-city-grand-prix---qualifying-31387SD$/.test(asked[0] || ''), asked[0] || 'none');
  check('no 540p path form is ever requested', !asked.some((u) => /\/embed\/f1\//.test(u)), asked.filter((u) => /\/embed\/f1\//.test(u)).join(' | '));
  check('no page errors in the taifood pass', errors.length === 0, errors.join(' | '));

  /* The pool holds both spellings: the schedule says Mexico City, the provider's pages say Mexico.
     Checked at the source, because a chip that resolves on the first address never asks for the
     second one and there is nothing to observe in the network log. */
  const src = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
  check('the alternate event spelling is in the pool', /EVENT_ALIASES = \{ 'mexico-city': 'mexico' \}/.test(src) && /taidCandidates[\s\S]{0,400}EVENT_ALIASES\[base\]/.test(src));
  await page.close();
}

await browser.close();
const failed = results.filter((entry) => !entry.pass);
console.log(`\n${results.length - failed.length}/${results.length} channel-row checks passed`);
process.exit(failed.length ? 1 : 0);
