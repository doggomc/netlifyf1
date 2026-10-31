/* Proves the link-pool failover in a real browser, against `npm run preview` on 4173.
   No real provider is contacted: every feed address is intercepted.

   The player treats an iframe as alive once it has committed a document, so a dead address is
   simulated the way a real one dies — no `load` arrives and the frame stays on about:blank, which
   Chromium renders as "refused to connect". A dead frame is aborted with an empty body.

   1. the first link of a source is dead  → the player moves to the next link of the SAME source
   2. every link of a source is dead      → the player moves to the next SOURCE
   3. no link below 720p is ever requested
   4. links carry the session stamp */
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:4173';
const BACKEND = 'https://f1admin.onrender.com';
const results = [];
const check = (label, pass, detail = '') => {
  results.push({ label, pass: Boolean(pass), detail });
  console.log(`  ${pass ? 'ok  ' : 'FAIL'}  ${label}${detail && !pass ? `  →  ${detail}` : ''}`);
};

const browser = await chromium.launch();

/* One page with a configurable idea of which feed addresses are dead. */
async function openPage(isDead) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const feeds = [];
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  /* Every off-site address is intercepted. Registered first: Playwright matches the newest route first,
     so the backend routes below still win. */
  await page.route(/https?:\/\/(?!127\.0\.0\.1|localhost)[^/]+\/.*/, async (route) => {
    const url = route.request().url();
    if (url.includes('/embed/racing/') || url.includes('/embed/f1/')) feeds.push(url);
    if (isDead(url)) {
      /* A dead address: the provider never answers, so the frame never commits a document and the
         player's 4s tier moves on. (Aborting outright is not a fair simulation — Chromium commits
         its own error page and fires `load`, which is exactly the ambiguity this ladder exists to
         resolve.) */
      return undefined;
    }
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>feed</title>' });
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
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"providers":{}}' });
  });

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  return { page, feeds, errors };
}

const frameSrcOf = (page) => page.evaluate(() => document.querySelector('#player iframe')?.src || '');

/* Wait until the player settles on an address that satisfies `accept`, then report it. */
async function settledFrame(page, accept) {
  try {
    const handle = await page.waitForFunction(
      (source) => {
        const src = document.querySelector('#player iframe')?.src || '';
        return src && !source.some((part) => src.includes(part)) ? src : false;
      },
      accept,
      { timeout: 25000 },
    );
    return handle.jsonValue();
  } catch (_) {
    return frameSrcOf(page);
  }
}

/* ── 1. one dead link, same source must carry the session ── */
{
  const DEAD = 'strmfree.st/embed/racing/skyf11080p';   // the first link of the main channel
  const dead = (url) => url.includes(DEAD);
  const { page, feeds, errors } = await openPage(dead);

  const frameSrc = await settledFrame(page, [DEAD]);
  const tried = feeds.filter((u) => u.includes('strmfree.st') || u.includes('streamfree.top'));

  check('a source is playing despite its first link failing', frameSrc.startsWith('https://'), frameSrc || 'nothing playing');
  check('it tried more than one link', tried.length >= 2, tried.join(' | '));
  check('the dead link was tried first', tried[0]?.includes(DEAD), tried[0] || 'none');
  check('it failed over to another link of the same source', Boolean(tried[1]) && tried[1].includes('/racing/skyf'), tried[1] || 'none');
  check('the playing frame is not the dead link', !frameSrc.includes(DEAD), frameSrc);

  /* ── 3. quality floor ── */
  check('no sub-720p link was ever requested', !feeds.some((u) => u.includes('_540p')), feeds.join(' | '));

  /* ── 4. session stamp ── */
  check('links carry a session stamp', /[?&]s=/.test(frameSrc), frameSrc);
  check('no page errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* ── 2. a whole source dead, the next source must take over ── */
{
  const dead = (url) => /\/racing\/skyf1/.test(url);   // every strmfree link of the main channel
  const { page, feeds, errors } = await openPage(dead);

  const frameSrc = await settledFrame(page, ['/racing/skyf', 'sky-uk', 'skyf12160p']);
  const activeChip = await page.evaluate(() => document.querySelector('#links button.chip.active')?.textContent?.trim() || '');
  const deadTried = feeds.filter((u) => /\/racing\/skyf1/.test(u));

  check('every link of the first source was tried', deadTried.length >= 3, `${deadTried.length} of its links requested`);
  check('a later source is playing', frameSrc.startsWith('https://'), frameSrc || 'nothing playing');
  check('the source row moved with it', activeChip.length > 0, activeChip || 'no active chip');
  check('still nothing below 720p', !feeds.some((u) => u.includes('_540p')), feeds.join(' | '));
  check('no page errors in the second pass', errors.length === 0, errors.join(' | '));
  await page.close();
}

await browser.close();
const failed = results.filter((entry) => !entry.pass);
console.log(`\n${results.length - failed.length}/${results.length} failover checks passed`);
process.exit(failed.length ? 1 : 0);
