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
      pool carries both spellings of the event name
 10. Race Control's custom chip name and link arrive over the config stream, the custom address is
      what the chip opens, and a chip it hides disappears
 11. weelo's event feed outranks its stale status map, so an onboard it lists as live plays
 12. the multi-viewer tab sits after All: weelo chips grey until clicked (then red), always four
      boxes, never more than four streams, and leaving restores the chip row */
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
async function openPage({ embdlolChannels = [], weeloState = {}, siteConfig = null, weeloEvents = [], ppvStreams = [], taifoodChannels = [], uhdUrl = '' } = {}) {
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
        body: `event: config\ndata: ${JSON.stringify(siteConfig || { sources: { disabled: [] }, streamWindow: { active: true } })}\n\n`,
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
  /* The 4K address is resolved server-side because embdlol rotates the id per session. */
  await page.route('**/api/stream/uhd', (route) => (uhdUrl
    ? route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ url: uhdUrl, source: 'emb-uhd' }) })
    : route.fulfill({ status: 503, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'The 4K channel is not listed upstream right now.', code: 'unavailable' }) })));
  await page.route('**/api/stream/taifood', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ channels: taifoodChannels }),
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

  /* weelo's event feed: the authority for which ids are live for this race. */
  await page.route('**weelo.live/feed/events.json', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ events: weeloEvents }),
  }));
  await page.route('**api.ppv.st/api/streams', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ streams: ppvStreams }),
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
/* Exact match: 'DAZN' would otherwise hit 'DAZN (EMB)' first and test the wrong chip. The label is
   regex-escaped, because '(EMB)' as written is a capture group — it waited for 'SKY EMB'. */
const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const clickChipExact = (page, label) => page.locator('#links button.chip', { hasText: new RegExp(`^${escapeRe(label)}$`) }).first().click();
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
  check('the EMB channels are in the row', labels.filter((l) => l.includes('(EMB)')).length >= 3, labels.join(' | '));

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
  await clickChip(page, 'FULLHD1 (EMB)');
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
  /* All nine weelo feeds are English now (its 'Multi-audio' label means the English world feed with
     alternate commentaries), so the whole specials block is in the default tab AND in order. */
  check('English keeps every special in its own block, in order',
    (await specialLabels(page)).join('|') === 'Sky Sports (weelo)|Drivers Track|Data Channel|Kimi Antonelli|Charles Leclerc|Max Verstappen|International Feed|F1 TV (World)|F1 TV (Shows)',
    (await specialLabels(page)).join(' | '));

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
    { channelname: 'f1mexicofullhd1', id: '01a192cf-6841-755f-acfa-c694d50bf588' },
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
  check('and the English feeds are', ['FULLHD1 (EMB)', 'WORLD (EMB)', 'Sky Sports F1 UK'].every((l) => english.includes(l)), english.join(' | '));
  check('the two chips embdlol can never fill are gone', !english.includes('SKY (EMB)') && !english.includes('APPLE (EMB)'), english.join(' | '));

  await clickChip(page, 'FULLHD1 (EMB)');
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

  /* Each English chip must open the channel for ITS feed. Every one of them used to open Sky's,
     because the pool took the first feed of the same language instead of the named feed. */
  await tab(page, 'English');
  await page.waitForTimeout(400);
  await clickChip(page, 'WORLD (EMB)');
  await page.waitForTimeout(2500);
  const world = await frameSrc(page);
  check('each English feed opens its own channel, not Sky\'s', world.includes('01a192d0-450c') && !world.includes('01a192cf-6841'), world);

  /* A feed embdlol does not list has no channel anywhere: say so, never borrow another language's. */
  await tab(page, 'Other');
  await page.waitForTimeout(400);
  await clickChip(page, 'SPANISH (EMB)');
  await page.waitForTimeout(2500);
  const spanish = await frameSrc(page);
  check('a feed with no channel upstream never plays another feed', !spanish.includes('embdlol.st/embed/'), spanish);
  check('no page errors in the catalogue-naming pass', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* ── 9. taifood addresses ── */
{
  /* The relay is mocked: this pass is about the ADDRESS SHAPE, so it must not depend on which round
     the live feed happens to be publishing. Both ids are in the list, so both are offered. */
  const { page, feeds, errors } = await openPage({ weeloState: weeloUp, taifoodChannels: [
    { id: '1', name: 'DAZN F1', lang: 'spanish', status: 'online', uri: 'https://taifood-blog.asia/embed/mexico-city-grand-prix---race-31409' },
    { id: '2', name: 'Viaplay', lang: 'dutch', status: 'online', uri: 'https://taifood-blog.asia/embed/mexico-city-grand-prix---race-31413' },
  ] });
  await page.waitForTimeout(1000);
  await tab(page, 'Other');
  await page.waitForTimeout(400);
  for (const label of ['DAZN', 'Viaplay']) {
    await clickChipExact(page, label);
    await page.waitForTimeout(2600);
  }
  const asked = feeds.filter((u) => /taifood/.test(u));
  /* No quality mark: their resolver answers 200 for '…-race-31407' and 404 for every marked form. */
  check('the taifood chip asks for an address with no quality mark', asked.length > 0, asked[0] || 'none requested');
  check('the address uses --- between event and session', asked.every((u) => /---/.test(u)), asked.slice(0, 2).join(' | '));
  /* The session moves with the schedule, so assert the shape, not the session name. */
  /* The event comes from OUR schedule and the id from taifood's list, so only the shape is stable:
     '<event>---<session>-<id>'. */
  check('the address ends in the broadcaster id, nothing else', /[a-z0-9]+(-[a-z0-9]+)*---[a-z0-9]+(-[0-9]+)*-(\d{4,7})$/.test(asked[0] || ''), asked[0] || 'none');
  check('no 540p path form is ever requested', !asked.some((u) => /\/embed\/f1\//.test(u)), asked.filter((u) => /\/embed\/f1\//.test(u)).join(' | '));
  /* The chip resolves on its first address, so the second mark is proved from the source: asking for
     SD alone meant the crisp mark was never in the pool at all. */
  check('no quality mark is ever appended to a taifood address', !asked.some((u) => /-\d+(SD|SD1080pHD)$/.test(u)), asked.filter((u) => /-\d+SD/.test(u)).join(' | '));
  check('no page errors in the taifood pass', errors.length === 0, errors.join(' | '));

  /* The pool holds both spellings: the schedule says Mexico City, the alias says Mexico. Checked at
     the source, because a chip that resolves on the first address never asks for the second one and
     there is nothing to observe in the network log. The comment explaining which spelling the
     provider actually accepts sits between the two, so the window has to be wider than one screen. */
  const src = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('function taidCandidates'), src.indexOf('function taidCandidates') + 1200);
  check('the alternate event spelling is in the pool', /EVENT_ALIASES/.test(src) && /EVENT_ALIASES\[base\]/.test(fn), fn.slice(0, 120));
  await page.close();
}

/* 10. Race Control's own chip name and link, as the public tab receives them. */
{
  const { page } = await openPage({ siteConfig: {
    sources: { disabled: ['sky-sports'], overrides: { viaplay: { label: 'Viaplay RC', url: 'https://example.com/rc-feed' } } },
    streamWindow: { active: true }
  } });
  await page.waitForTimeout(3000);
  await page.locator('#feedTabs button.chip', { hasText: 'Other' }).first().click();
  await page.waitForTimeout(400);
  const labels = await page.evaluate(() => [...document.querySelectorAll('#links button.chip')].map((b) => b.textContent.trim()));
  check('the custom chip name arrives from Race Control', labels.includes('Viaplay RC'), labels.join(' | '));
  check('a chip Race Control hid is gone', !labels.includes('Sky Sports'), labels.join(' | '));
  if (labels.includes('Viaplay RC')) {
    await clickChipExact(page, 'Viaplay RC');
    await page.waitForTimeout(3000);
    const frame = await page.evaluate(() => document.querySelector('#player iframe')?.src || '');
    check('the custom link is what the chip opens', frame === 'https://example.com/rc-feed', frame || 'nothing opened');
  }
  await page.close();
}

/* ── 11. weelo's event feed is the authority for which ids are live ── */
{
  const id = 'peogcgpgbgchegacicnebgihacgffgchdhehbgahahfgogjcacieee';
  /* The status map says 'dark' while weelo's own event feed lists the id as a live stream. */
  const { page, errors } = await openPage({
    weeloState: { [id]: 'dark' },
    weeloEvents: [{ id: 'f1-2026-r19', live: true, streams: [{ label: 'Max Verstappen - Onboard', language: 'Team-radio', url: `https://weellz.live/beta?stream=${id}&r=1` }] }],
  });
  await page.waitForTimeout(2500);
  const specials = await page.evaluate(() => [...document.querySelectorAll('#links button.chip')].map((b) => ({ label: b.textContent.trim(), down: b.className.includes('is-down') })));
  const max = specials.find((c) => /Max Verstappen/.test(c.label));
  check('an onboard is playable when weelo\'s event feed lists it, even though the status map says dark', Boolean(max) && !max.down, JSON.stringify(max));
  check('no page errors in the weelo-feed pass', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* ── 12. multi-viewer ── */
{
  const ids = {
    Antonelli: 'peogcgpgbgchegaciclejgngjgacbeogehpgogfgmgmgjgjcacieee',
    Verstappen: 'peogcgpgbgchegacicnebgihacgffgchdhehbgahahfgogjcacieee',
    'Data Channel': 'gebdacefgfaciceebgehbgacdeigbgogogfgmgjcacieee',
    'Sky Sports (weelo)': 'dflgjhacdfahpgchehacbdacoekfacieee',
    International: 'jeogehfgchogbgehjgpgogbgmgacgefgfgegacicgebdjcacieee',
  };
  const { page, errors } = await openPage({
    weeloEvents: [{ id: 'f1-2026-r19', live: true, streams: Object.entries(ids).map(([label, id]) => ({ label, language: 'English', url: `https://weellz.live/beta?stream=${id}&r=1` })) }],
  });
  await page.waitForTimeout(2500);
  const tabs = await page.evaluate(() => [...document.querySelectorAll('#feedTabs button.chip')].map((b) => b.textContent.trim()));
  check('the multi-viewer tab is not offered while it is switched off', tabs.join('|') === 'English|Other|All', tabs.join(' | '));
  check('the multi-viewer markup stays out of the row', await page.evaluate(() => !document.querySelector('#links .chip-mv') && !document.querySelector('#feedTabs button.chip:last-child').textContent.includes('Multi')));
  await page.close();
}

/* The grid spec below still describes MULTIVIEWER_ENABLED = true. It is parked, not deleted: flip
   the flag in src/app.ts (and this `if (false)` to `if (true)`) to exercise it again. */
if (false) {

  await page.locator('#feedTabs button.chip', { hasText: 'Multi-viewer' }).click();
  await page.waitForSelector('#links .chip-mv', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const read = () => page.evaluate(() => ({
    picked: [...document.querySelectorAll('#links .chip-mv')].map((c) => ({ label: c.textContent.trim(), on: c.classList.contains('picked'), red: /255, 90, 95/.test(getComputedStyle(c).color) })),
    tiles: [...document.querySelectorAll('#multiViewer .mv-tile')].map((d) => d.querySelector('iframe')?.dataset.stream || 'empty'),
    grid: document.querySelector('#multiViewer .mv-grid')?.className || '',
  }));
  const initial = await read();
  check('every weelo stream is offered, none picked yet', initial.picked.length === 9 && initial.picked.every((c) => !c.on), `${initial.picked.length} chips`);
  check('the grid is always four boxes', initial.tiles.length === 4, initial.tiles.join(','));

  const click = async (label) => {
    const index = await page.evaluate((l) => [...document.querySelectorAll('#links .chip-mv')].findIndex((c) => c.textContent.trim().startsWith(l)), label);
    /* A miss here means the picker was not drawn — say so instead of blowing up the run. */
    check(`the picker offers "${label}"`, index >= 0);
    if (index < 0) return;
    await page.evaluate((i) => document.querySelectorAll('#links .chip-mv')[i].click(), index);
    await page.waitForTimeout(350);
  };
  await click('Kimi');
  const one = await read();
  check('a picked chip turns red', one.picked.find((c) => c.label.includes('Antonelli'))?.red === true, JSON.stringify(one.picked[0]));
  check('one selection fills the left/right box of the top row', /mv-one/.test(one.grid) && one.tiles[0].startsWith('peogcgpg') && one.tiles.slice(1).every((t) => t === 'empty'), `${one.grid} · ${one.tiles.join(',')}`);

  await click('Max');
  const two = await read();
  check('two selections fill the top two boxes', /mv-two/.test(two.grid) && two.tiles[0].startsWith('peogcgpg') && two.tiles[1].startsWith('peogcgpg') && two.tiles[2] === 'empty', `${two.grid} · ${two.tiles.join(',')}`);

  for (const label of ['Data Channel', 'Sky Sports', 'International']) await click(label);
  const four = await read();
  check('the grid never takes more than four streams', four.picked.filter((c) => c.on).length === 4 && four.tiles.every((t) => t !== 'empty'), `${four.picked.filter((c) => c.on).length} picked · ${four.tiles.length} tiles`);

  await page.locator('#multiViewer button', { hasText: 'Leave grid' }).click();
  await page.waitForTimeout(600);
  check('leaving the grid hides it and restores the chip row', await page.evaluate(() => document.querySelector('#multiViewer').hidden && !document.querySelector('#links .chip-mv')), 'grid still open');
  check('no page errors in the multi-viewer pass', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* ── 13. the specials block fits a phone, and each chip says what it is ── */
{
  /* `.chips` is a two-column grid on phones, so the specials block is a grid item and was confined
     to one half-width column: every chip bled off the right edge of the card on mobile. */
  const sizes = [['360', 360, 800], ['375', 375, 667], ['390', 390, 844], ['412', 412, 915]];
  for (const [name, width, height] of sizes) {
    const { page, errors } = await openPage();
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(1800);
    const fit = await page.evaluate(() => {
      const card = document.querySelector('#links').closest('.card').getBoundingClientRect();
      const row = document.querySelector('#links .special-row');
      const chips = [...document.querySelectorAll('#links .special-row .chip')];
      return {
        count: chips.length,
        overs: chips.map((c) => Math.round(c.getBoundingClientRect().right - card.right)),
        clipped: chips.filter((c) => c.scrollWidth > c.clientWidth + 1).map((c) => c.textContent.trim()),
        rowW: Math.round(row.getBoundingClientRect().width),
        cardW: Math.round(card.width),
        pageOver: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    check(`the specials block fits the card at ${name}px`, fit.overs.every((o) => o <= 1) && fit.pageOver <= 0,
      `chips over by ${Math.max(...fit.overs)}px · row ${fit.rowW}/${fit.cardW}`);
    /* Not just "does not overflow": the block must actually USE the card. Confined to one grid
       column it was 137px inside a 318px card — cramped, and the chips bled once their labels
       were wider than that column. */
    check(`the specials block spans the card at ${name}px`, fit.rowW >= fit.cardW - 60,
      `row ${fit.rowW}px inside a ${fit.cardW}px card`);
    check(`no special chip clips its label at ${name}px`, fit.clipped.length === 0, fit.clipped.join(' | '));
    check(`no page errors at ${name}px`, errors.length === 0, errors.join(' | '));
    await page.close();
  }

  /* The tag has to describe the chip: a weelo full programme is not an onboard. */
  const { page } = await openPage();
  await page.waitForTimeout(1800);
  const tagged = await page.evaluate(() => [...document.querySelectorAll('#links .special-row .chip')]
    .map((c) => [c.textContent.trim(), getComputedStyle(c, '::before').content.replace(/"/g, '')]));
  const tagOf = (label) => (tagged.find(([l]) => l === label) || [, 'missing'])[1];
  check('an onboard is tagged ONBD', tagOf('Kimi Antonelli') === 'ONBD', tagOf('Kimi Antonelli'));
  check('the data channel is tagged DATA', tagOf('Data Channel') === 'DATA', tagOf('Data Channel'));
  check('a weelo full feed is tagged FEED, not ONBD', tagOf('F1 TV (Shows)') === 'FEED', tagOf('F1 TV (Shows)'));
  await page.close();
}

/* ── 14. taifood's stale entries must never reach the player ── */
{
  /* What the relay returns while the race is on: practice 3 still listed as online, plus the race. */
  const { page, feeds, errors } = await openPage({ taifoodChannels: [
    { id: '1', name: 'Apple TV', lang: '', status: 'online', uri: 'https://taifood-blog.asia/embed/mexico-city-grand-prix---practice-3-31385' },
    { id: '2', name: 'Apple TV (F1TV)', lang: 'english', status: 'online', uri: 'https://taifood-blog.asia/embed/mexico-city-grand-prix---race-31407' },
    { id: '3', name: 'Apple TV (F1TV)', lang: 'english', status: 'online', uri: 'https://taifood-blog.asia/embed/mexico-city-grand-prix---race-31407_540p' },
  ] });
  await page.waitForTimeout(1800);
  await clickChipExact(page, 'AppleTV');
  await page.waitForTimeout(3000);
  const asked = feeds.filter((u) => /taifood/.test(u));
  check('Apple TV opens an address, not a black frame', asked.length > 0, 'nothing requested');
  /* The window is mocked as live, so the session being watched is Practice 1: 'practice-3' is a
     different session and must never be played, and the race row must not be picked over it either. */
  check('the previous session\'s address is never played', !asked.some((u) => /practice-3/.test(u)), asked.join(' | '));
  check('the watched session\'s own address is preferred', asked.some((u) => /---practice-1-/.test(u)), asked.join(' | '));
  check('no 540p address is ever offered', !asked.some((u) => /540p/.test(u)), asked.join(' | '));
  check('no page errors in the taifood staleness pass', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* ── 15. the tab bar is one row of equal buttons at every width ── */
{
  for (const [name, width, height] of [['360', 360, 800], ['390', 390, 844], ['768', 768, 1024], ['1440', 1440, 1000]]) {
    const { page } = await openPage();
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(1800);
    const m = await page.evaluate(() => {
      const tabs = [...document.querySelectorAll('#feedTabs button.chip')];
      const rects = tabs.map((t) => t.getBoundingClientRect());
      return {
        labels: tabs.map((t) => t.textContent.trim()),
        rows: new Set(rects.map((r) => Math.round(r.top))).size,
        widths: [...new Set(rects.map((r) => Math.round(r.width)))],
        heights: [...new Set(rects.map((r) => Math.round(r.height)))],
        over: Math.max(...rects.map((r) => Math.round(r.right - document.querySelector('#feedTabs').getBoundingClientRect().right))),
      };
    });
    /* All sat beneath English/Other at full width: the odd-last-chip rule meant for the broadcaster
       grid was reaching the tab bar. Same size, same row, nothing past the container. */
    check(`the tabs share one row at ${name}px`, m.rows === 1, `${m.rows} rows · ${m.labels.join('|')}`);
    check(`every tab is the same size at ${name}px`, m.widths.length === 1 && m.heights.length === 1,
      `widths ${m.widths.join('/')} · heights ${m.heights.join('/')}`);
    check(`no tab spills past the tab bar at ${name}px`, m.over <= 1, `${m.over}px over`);
    await page.close();
  }
}

/* ── 16. Sunday's real embdlol list: short codes, and the 4K row ── */
{
  /* Exactly what embdlol published at 16:17 UTC on race day: a 'sun' day prefix and the SHORT codes
     esp / ita / deu. 'esp' matched no chip at all before this round, so the live Spanish feed was
     unreachable while Sky, F1 World and the UHD row all worked. */
  const sunday = [
    { channelname: 'f1mexicofullhd1', id: '01a19792-d063-7469-ac4c-02633faa4ea4' },
    { channelname: 'f1mexicosunworld', id: '01a19792-f229-74d9-b524-4262850e94e3' },
    { channelname: 'f1mexicosunuhd', id: '01a19793-1056-7568-8b1d-3860145c4cd3' },
    { channelname: 'f1mexicosunesp', id: '01a19793-35f4-7699-9d0f-b2ac0e7f2a69' },
    { channelname: 'f1mexicosunita', id: '01a19793-4ed1-7349-9987-0437b8be76ad' },
    { channelname: 'f1mexicosundeu', id: '01a19793-6769-777d-93bd-df7d83aa6a9f' },
    { channelname: 'f1mexicosun360p', id: '01a19793-a0af-71f0-98b9-6e5fc65f9eb9' },
  ];
  const { page, errors } = await openPage({
    embdlolChannels: sunday,
    weeloState: weeloUp,
    uhdUrl: 'https://embdlol.st/embed/01a19793-1056-7568-8b1d-3860145c4cd3',
  });
  await page.waitForTimeout(1800);

  await clickChipExact(page, 'FULLHD1 (EMB)');
  await page.waitForTimeout(2600);
  const sky = await frameSrc(page);
  check("Sunday's Sky feed reaches its chip", sky.includes('01a19792-d063'), sky);

  await clickChipExact(page, 'WORLD (EMB)');
  await page.waitForTimeout(2600);
  const world = await frameSrc(page);
  check("Sunday's F1 World feed reaches its chip", world.includes('01a19792-f229'), world);

  await tab(page, 'Other');
  await page.waitForTimeout(500);
  for (const [label, id] of [['SPANISH (EMB)', '01a19793-35f4'], ['ITALIAN (EMB)', '01a19793-4ed1'], ['GERMAN (EMB)', '01a19793-6769']]) {
    await clickChipExact(page, label);
    await page.waitForTimeout(2600);
    const src = await frameSrc(page);
    check(`the short code reaches ${label}`, src.includes(id), src);
  }

  await tab(page, 'English');
  await page.waitForTimeout(500);
  await clickChipExact(page, 'F1 UHD 4K');
  await page.waitForTimeout(1200);
  /* The 4K chip offers the "session alerts" nudge once before playing; its own test suite covers
     that. Here we only care which address the player ends up on, so step through it. */
  const continueBtn = page.locator('#joinNudgeContinue');
  if (await continueBtn.isVisible().catch(() => false)) await continueBtn.click();
  await page.waitForTimeout(3000);
  const uhd = await frameSrc(page);
  check('the 4K chip plays the UHD row when one is published', uhd.includes('01a19793-1056'), uhd);
  /* The 360p row is published alongside the rest and is below the floor: it must never be offered. */
  check('the 360p row is never offered', !uhd.includes('01a19793-a0af'), uhd);
  check('no page errors in the Sunday catalogue pass', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* ── 17. the round-25 source changes, end to end ── */
{
  /* Live catalogue with THREE Sky languages in one bucket (which is how taifood publishes it) and
     the race block of ids. Everything below is asserted against that list. */
  const weeloDark = Object.fromEntries(Object.values(WEELO_IDS).map((id) => [id, 'dark']));
  const { page, feeds, errors } = await openPage({ weeloState: weeloDark, weeloEvents: [], taifoodChannels: [
    { id: '19', name: 'Sky Sports F1 HD', lang: '', status: 'online', uri: 'https://taifood-blog.asia/embed/f1/2026/mexico/race' },
    { id: '30', name: 'Sky Sports F1', lang: 'english', status: 'online', uri: 'https://taifood-blog.asia/embed/mexico-city-grand-prix---race-31408' },
    { id: '35', name: 'Sky Sport F1', lang: 'german', status: 'online', uri: 'https://taifood-blog.asia/embed/mexico-city-grand-prix---race-31410' },
    { id: '37', name: 'Sky Sport F1', lang: 'italian', status: 'online', uri: 'https://taifood-blog.asia/embed/mexico-city-grand-prix---race-31411' },
    { id: '31', name: 'Apple TV (F1TV)', lang: 'english', status: 'online', uri: 'https://taifood-blog.asia/embed/mexico-city-grand-prix---race-31407' },
  ] });
  await page.waitForTimeout(1600);

  /* The language rule: an Italian chip must lead with the Italian row and must never be handed the
     German or the English one. */
  await tab(page, 'Other');
  await page.waitForTimeout(400);
  await clickChipExact(page, 'Sky Sport Italia');
  await page.waitForTimeout(2600);
  const italia = (await frameSrc(page)).split('/embed/')[1] || '';
  /* The provider's address that names a language must be the chip's own. The '/f1/2026/…' row names
     no language at all, so it is the broadcaster's main feed and is allowed as the lead. */
  const languageRows = ['31408', '31410', '31411'];
  const italiaLangs = languageRows.filter((id) => feeds.some((u) => u.endsWith('-' + id)));
  check('Sky Sport Italia is served an address, never a black frame', Boolean(italia), italia || '(none)');
  check('Sky Sport Italia is never handed a foreign language row', !/-31410$/.test(italia) && !/-31408$/.test(italia), `${italia} | seen: ${italiaLangs.join(',')}`);
  check('Sky Sport Italia is never handed the German row', !/-31410$/.test(italia), italia);
  check('Sky Sport Italia is never handed the English row', !/-31408$/.test(italia), italia);

  await clickChipExact(page, 'Sky Sport F1 DE');
  await page.waitForTimeout(2600);
  const de = (await frameSrc(page)).split('/embed/')[1] || '';
  check('Sky Sport F1 DE is never handed the Italian or English row', !/-31411$/.test(de) && !/-31408$/.test(de), de || '(none)');

  await tab(page, 'English');
  await page.waitForTimeout(400);
  await clickChipExact(page, 'AppleTV');
  await page.waitForTimeout(2600);
  const apple = (await frameSrc(page)).split('/embed/')[1] || '';
  check('AppleTV leads with the English row, not the untagged main feed', /-31407$/.test(apple), apple || '(none)');

  /* The PPV chip must never open a wrong-sport stream. The feed below is what api.ppv.st publishes:
     American Football first (NFL Network), an F1 row after it. */
  check('the two chips embdlol can never fill are not drawn', !(await chipLabels(page)).some((l) => l === 'SKY (EMB)' || l === 'APPLE (EMB)'));

  /* weelo: off air must be visible, and clicking it must say so rather than play nothing. */
  const kimi = page.locator('#links button.chip', { hasText: 'Kimi' }).first();
  check('an off-air weelo chip is marked down', ((await kimi.getAttribute('class')) || '').includes('is-down'));
  await kimi.click();
  await page.waitForTimeout(1400);
  const notice = await page.evaluate(() => (document.querySelector('#noStream')?.textContent || '').replace(/\s+/g, ' '));
  check('and clicking it says it is not on air', /on air/i.test(notice), notice.slice(0, 70));

  /* Eleven and Nova are new chips, not new code paths: both must exist in Other. */
  await tab(page, 'Other');
  await page.waitForTimeout(400);
  const other = await chipLabels(page);
  check('the two new languages are in Other', ['Eleven Sports PL', 'Nova Sport CZ'].every((l) => other.includes(l)), other.join(' | '));
  check('no page errors in the source-change pass', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* ── 18. an empty referrer is read as a sandboxed frame by some providers ── */
{
  /* ehgembxe answers a no-referrer request with "Remove sandbox attributes on the iframe tag" and
     mounts nothing, while the same token plays when the frame sends an origin referrer. The player
     must therefore never build a frame with referrerPolicy 'no-referrer' or a sandbox attribute. */
  const { page, errors } = await openPage({ weeloState: weeloUp });
  await page.waitForTimeout(1500);
  await clickChipExact(page, 'Sky Sports F1 HD (EHG)');
  await page.waitForTimeout(2500);
  const frame = await page.evaluate(() => {
    const f = document.querySelector('#player iframe');
    return f ? { rp: f.referrerPolicy, sandbox: f.hasAttribute('sandbox'), at: (f.getAttribute('referrerpolicy') || '') } : null;
  });
  check('the EHG frame is built without a sandbox attribute', frame && frame.sandbox === false, JSON.stringify(frame));
  check('the EHG frame sends an origin referrer, never an empty one', frame && frame.rp === 'origin', JSON.stringify(frame));
  await clickChipExact(page, 'Sky HD');
  await page.waitForTimeout(2000);
  const other = await page.evaluate(() => document.querySelector('#player iframe')?.referrerPolicy || '(none)');
  check('every other chip sends an origin referrer too', other === 'origin', other);
  check('no page errors in the referrer pass', errors.length === 0, errors.join(' | '));
  await page.close();
}

await browser.close();
const failed = results.filter((entry) => !entry.pass);
console.log(`\n${results.length - failed.length}/${results.length} channel-row checks passed`);
process.exit(failed.length ? 1 : 0);
