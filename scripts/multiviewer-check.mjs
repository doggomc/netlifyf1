/* Multi-viewer checks: verifies the Multiviewer beta/connection popup (#mvNudge) and the
   full-viewport Rerace-style Multiviewer (Grid, Focus, Add streams drawer, audio routing,
   opt-out persistence, and mobile responsiveness).

   Run: node scripts/multiviewer-check.mjs            (dev server on :5173 or BASE=…)
        node scripts/multiviewer-check.mjs --built   (the built preview on :4173) */
import { chromium } from 'playwright';

const BUILT = process.argv.includes('--built');
const BASE = (process.env.BASE || (BUILT ? 'http://127.0.0.1:4173' : 'http://127.0.0.1:5173')).replace(/\/$/, '');
const COCKPIT = `${BASE}/cockpit.html`;
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: Boolean(ok) });
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${ok || !detail ? '' : `  ← ${detail}`}`);
};

const browser = await chromium.launch();

async function open(query = '', viewport = { width: 1440, height: 950 }) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (error) => {
    const text = String(error);
    if (/jwplayer|reading 'remove'/.test(text)) return;
    errors.push(text.slice(0, 140));
  });
  await page.route('**weellz.live/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>weellz stub</title><body style="margin:0;background:#0b0c10"></body>',
    }),
  );
  await page.goto(COCKPIT + query, { waitUntil: 'domcontentloaded' });
  if (query.includes('mv=1')) {
    await page.waitForFunction(() => Boolean(document.querySelector('#multiViewer')), null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1400);
  } else {
    await page.waitForTimeout(900);
  }
  return { page, errors };
}

const state = (page) =>
  page.evaluate(() => ({
    open: Boolean(document.querySelector('#multiViewer') && !document.querySelector('#multiViewer').hidden),
    tiles: document.querySelectorAll('.mvx-tile').length,
    live: document.querySelectorAll('.mvx-tile:not(.is-off)').length,
    off: document.querySelectorAll('.mvx-tile.is-off').length,
    frames: [...document.querySelectorAll('.mvx-tile iframe')].map((f) => f.getAttribute('src') || ''),
    labels: [...document.querySelectorAll('.mvx-tile .mvx-handle')].map((e) => e.getAttribute('data-raw-label') || e.textContent.trim()),
    titles: [...document.querySelectorAll('.mvx-tile .mvx-name-t')].map((e) => e.textContent.trim()),
    library: Boolean(document.querySelector('[data-mvx-lib]') && !document.querySelector('[data-mvx-lib]').hidden),
    rows: [...document.querySelectorAll('.mvx-lib-row')].map((r) => r.textContent.trim()),
    parked: document.getElementById('player')?.classList.contains('is-parked'),
    fullViewport: (() => {
      const pn = document.getElementById('multiViewer')?.getBoundingClientRect();
      return pn ? Math.abs(pn.width - window.innerWidth) < 2 && Math.abs(pn.height - window.innerHeight) < 2 : false;
    })(),
    count: document.querySelector('[data-mvx-count]')?.textContent?.trim(),
    boxes: [...document.querySelectorAll('.mvx-tile')].map((t) => {
      const r = t.getBoundingClientRect();
      return { left: r.left, top: r.top, w: r.width, h: r.height };
    }),
    badges: [...document.querySelectorAll('.mvx-tile .mvx-off-msg:not([hidden])')].map((e) => e.textContent.trim()).filter(Boolean),
    mainTiles: [...document.querySelectorAll('.mvx-tile.is-main')].map((t) => t.querySelector('.mvx-name-t')?.textContent.trim()),
    url: location.search,
  }));

/* ── 1. Multiview button & "Multiviewer" beta/connection popup (#mvNudge) ── */
{
  const { page, errors } = await open('?mvtest=live');
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);

  const info = await page.evaluate(() => {
    const btn = document.getElementById('mvToggle');
    const row = document.getElementById('stageActions');
    const btns = [...row.querySelectorAll('.btn')].filter((b) => b.offsetParent !== null);
    return {
      present: Boolean(btn) && !btn.hidden,
      sizes: btns.map((b) => `${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}`),
      sameRow: btns.some((b) => b.id === 'mvToggle'),
      grid: Boolean(document.getElementById('multiViewer')),
      nudgeOpen: document.getElementById('mvNudge')?.classList.contains('open'),
    };
  });
  check('the Multiview button is on the page', info.present);
  check('it sits in the player action row with the other buttons', info.sameRow, info.sizes.join(' | '));
  check('the grid is not drawn until it is asked for', !info.grid);
  check('Multiviewer popup starts closed', !info.nudgeOpen);

  await page.locator('#mvToggle').click();
  await page.waitForTimeout(250);
  const popup = await page.evaluate(() => ({
    open: document.getElementById('mvNudge')?.classList.contains('open'),
    title: document.getElementById('mvNudgeTitle')?.textContent?.trim(),
    copy: document.querySelector('#mvNudge .jn-copy')?.textContent?.toLowerCase() || '',
    hasDiscord: Boolean(document.querySelector('#mvNudgeJoin[href*="discord.gg"]')),
    hasContinue: Boolean(document.getElementById('mvNudgeContinue')),
    unchecked: document.getElementById('mvNudgeDontShow')?.checked === false,
  }));
  check('clicking Multiview opens the Multiviewer popup', popup.open);
  check('popup title is "Multiviewer"', popup.title === 'Multiviewer', popup.title);
  check('popup states beta and strong internet connection', popup.copy.includes('beta') && popup.copy.includes('strong internet connection'), popup.copy);
  check('popup has Discord + Continue + opt-out controls', popup.hasDiscord && popup.hasContinue && popup.unchecked);

  await page.locator('#mvNudgeDontShow').check();
  await page.locator('#mvNudgeContinue').click();
  await page.waitForTimeout(900);
  const opened = await state(page);
  check('Continue opens the full-viewport Multiviewer', opened.open && opened.fullViewport);
  check('opt-out is saved after Continue', (await page.evaluate(() => localStorage.getItem('freef1_mv_nudge_off'))) === '1');
  check('no page errors in popup flow', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* ── 2. ?mv=1 opens full-viewport grid with 3 feeds & audio routing ── */
{
  const { page, errors } = await open('?mv=1&mvtest=live');
  let s = await state(page);
  check('?mv=1 opens the grid on load', s.open);
  check('the grid fills the full viewport', s.fullViewport);
  check('the grid opens with three tiles', s.tiles === 3, String(s.tiles));
  check('the player underneath is parked', s.parked);
  check('every tile is a weellz.live stream address', s.frames.length === 3 && s.frames.every((u) => u.startsWith('https://weellz.live/beta?stream=')));
  check('the tile count badge reads "3 feeds"', s.count === '3 feeds', s.count);
  check('exactly one tile has audio', s.mainTiles.length === 1 && s.frames.filter((u) => u.includes('mute=0')).length === 1);

  await page.locator('[data-mvx-mode="focus"]').click();
  await page.waitForTimeout(450);
  const focus = await page.evaluate(() => ({
    big: document.querySelectorAll('.mvx-tile.is-big').length,
    small: document.querySelectorAll('.mvx-tile.is-small').length,
  }));
  check('Focus mode shows 1 big hero player and 2 small companion tiles', focus.big === 1 && focus.small === 2, JSON.stringify(focus));
  await page.locator('[data-mvx-mode="grid"]').click();
  await page.waitForTimeout(350);

  /* Open Add streams drawer and fill up to 9 tiles */
  await page.locator('[data-mvx-open-lib]').click();
  await page.waitForTimeout(400);
  s = await state(page);
  check('Add streams drawer opens and lists feeds', s.library && s.rows.length >= 9, String(s.rows.length));
  for (let i = 0; i < 10; i++) {
    const added = await page.evaluate(() => {
      const row = [...document.querySelectorAll('.mvx-lib-row')].find((r) => !r.disabled && !r.classList.contains('is-in'));
      if (!row) return false;
      row.click();
      return true;
    });
    if (!added) break;
    await page.waitForTimeout(200);
  }
  await page.locator('[data-mvx-lib-close]').click();
  await page.waitForTimeout(450);
  s = await state(page);
  check('nine feeds fill nine 16:9 tiles in a 3x3 grid', s.tiles === 9 && s.boxes.every((b) => Math.abs(b.w / b.h - 16 / 9) < 0.05));
  check('no page errors in grid/focus/library pass', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* ── 3. Mobile 390x844 layout & bottom-sheet drawer ── */
{
  const { page, errors } = await open('?mv=1&mvtest=live', { width: 390, height: 844 });
  await page.locator('[data-mvx-open-lib]').click();
  await page.waitForTimeout(400);
  const m = await page.evaluate(() => {
    const top = document.querySelector('.mvx-top');
    const lib = document.querySelector('[data-mvx-lib]').getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      topOverflow: top.scrollWidth > top.clientWidth + 1,
      sheetVisible: lib.top < window.innerHeight && Math.abs(lib.bottom - window.innerHeight) < 2,
    };
  });
  check('mobile has no horizontal overflow', !m.overflow && !m.topOverflow);
  check('mobile Add streams opens as a visible bottom sheet', m.sheetVisible, JSON.stringify(m));
  check('no page errors on mobile', errors.length === 0, errors.join(' | '));
  await page.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} multi-viewer checks passed`);
if (failed.length) {
  console.log('FAILED:', failed.map((f) => f.name).join(' | '));
  process.exit(1);
}
