/* Multi-viewer checks: the grid on demand, not "when weelo feels like it".
   weelo is dark for most of the week, so the grid is driven with ?mvtest=live — the page's own test
   hook, which only forces the state map and changes nothing about what a visitor sees.

   Run: node scripts/multiviewer-check.mjs            (dev server on :5173 or BASE=…)
        node scripts/multiviewer-check.mjs --built   (the built preview on :4173) */
import { chromium } from 'playwright';

const BUILT = process.argv.includes('--built');
const BASE = process.env.BASE || (BUILT ? 'http://127.0.0.1:4173/' : 'http://127.0.0.1:5173/');
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: Boolean(ok) });
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${ok || !detail ? '' : `  ← ${detail}`}`);
};

const browser = await chromium.launch();

/* The grid only exists when Race Control has a weelo feed enabled, so this suite makes sure of that
   first — otherwise every check below would be measuring an empty row. */
{
  const admin = await browser.newPage();
  await admin.goto((process.env.ADMIN || 'http://127.0.0.1:3000') + '/admin', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await admin.fill('#username', 'admin').catch(() => {});
  await admin.fill('#password', 'admin').catch(() => {});
  await admin.click('#loginBtn').catch(() => {});
  await admin.waitForTimeout(2500);
  const group = admin.locator('.bulk-group').filter({ has: admin.locator('.bulk-name', { hasText: /^weelo$/ }) }).first();
  await group.locator('button', { hasText: 'Enable' }).click({ timeout: 8000 }).catch(() => {});
  await admin.waitForTimeout(2000);
  await admin.close();
}

async function open(query) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error).slice(0, 140)));
  await page.goto(BASE + query, { waitUntil: 'domcontentloaded' });
  /* The grid opens 900 ms after load, and the catalogue settles after it. */
  await page.waitForFunction(() => Boolean(document.querySelector('#multiViewer')), null, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(2500);
  return { page, errors };
}

const state = (page) => page.evaluate(() => ({
  open: !document.querySelector('#multiViewer')?.hidden,
  tiles: document.querySelectorAll('.mvx-tile').length,
  live: document.querySelectorAll('.mvx-tile:not(.is-off)').length,
  off: document.querySelectorAll('.mvx-tile.is-off').length,
  frames: [...document.querySelectorAll('.mvx-tile iframe')].map((f) => f.getAttribute('src') || ''),
  labels: [...document.querySelectorAll('.mvx-tile-name')].map((e) => e.textContent.trim()),
  stageHidden: document.querySelector('.mvx-stage')?.hidden,
  library: !document.querySelector('[data-mvx-lib]')?.hidden,
  rows: [...document.querySelectorAll('.mvx-lib-row')].map((r) => r.textContent.trim()),
  parked: Boolean(document.querySelector('.player-parked')),
  count: document.querySelector('[data-mvx-count]')?.textContent,
  boxes: [...document.querySelectorAll('.mvx-tile')].map((t) => ({
    left: parseFloat(t.style.left) || 0, top: parseFloat(t.style.top) || 0,
    w: parseFloat(t.style.width) || 0, h: parseFloat(t.style.height) || 0,
  })),
  mainTiles: [...document.querySelectorAll('.mvx-tile.is-main')].map((t) => t.querySelector('.mvx-tile-name')?.textContent.trim()),
  url: location.search,
}));

/* ── 1. the button exists and only ever offers weelo ── */
{
  const { page, errors } = await open('');
  const info = await page.evaluate(() => {
    const btn = document.getElementById('mvToggle');
    const row = document.querySelector('.stage-actions');
    const btns = [...row.querySelectorAll('.btn')].filter((b) => b.offsetParent !== null);
    const box = btn.getBoundingClientRect();
    return {
      present: Boolean(btn), hidden: btn.hidden,
      sizes: btns.map((b) => `${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}`),
      sameRow: btns.some((b) => b.id === 'mvToggle'),
      grid: Boolean(document.getElementById('multiViewer')),
    };
  });
  check('the Multiview button is on the page', info.present && !info.hidden, JSON.stringify(info));
  check('it sits in the player action row with the other buttons', info.sameRow, info.sizes.join(' | '));
  check('it is the same height as its neighbours', new Set(info.sizes.map((s) => s.split('x')[1])).size === 1, info.sizes.join(' | '));
  check('the grid is not drawn until it is asked for', !info.grid);
  check('no page errors on load', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* ── 2. a ?mv=1 address opens it, and only weelo feeds are in it ── */
{
  const { page, errors } = await open('?mv=1&mvtest=live');
  const s = await state(page);
  check('?mv=1 opens the grid on load', s.open, JSON.stringify({ open: s.open }));
  check('the grid opens with three tiles', s.tiles === 3, String(s.tiles));
  check('the main player is parked with the multiview note', s.parked, String(s.parked));
  check('every tile is a weelo address', s.frames.length > 0 && s.frames.every((u) => u.startsWith('https://weellz.live/beta?stream=')), s.frames.join(' | '));
  check('the first tile is Sky Sports (weelo)', s.labels[0] === 'Sky Sports (weelo)', s.labels.join(' | '));
  check('then Drivers Track and Data Channel', s.labels.slice(1, 3).join('|') === 'Drivers Track|Data Channel', s.labels.join(' | '));
  check('the tile count badge agrees with the tiles', s.count === String(s.tiles), `${s.count} vs ${s.tiles}`);
  check('the address never advertises a non-weelo feed', !/taifood|embdlol|strmfree|cdnlivetv/.test(s.frames.join(' ')), s.frames.join(' | '));
  await page.screenshot({ path: '/tmp/mv-check-open.png' });
  await page.close();
  check('no page errors when the grid opens', errors.length === 0, errors.join(' | '));
}

/* ── 3. the library adds and removes, and the ceiling holds at nine ── */
{
  const { page, errors } = await open('?mv=1&mvtest=live');
  await page.evaluate(() => document.querySelector('[data-mvx-open-lib]').click());
  await page.waitForTimeout(500);
  let s = await state(page);
  check('the feed drawer lists all nine weelo feeds', s.rows.length === 9, s.rows.join(' | '));
  check('and nothing but weelo feeds', s.rows.every((r) => /Antonelli|Verstappen|Leclerc|Drivers Track|Data Channel|International Feed|F1 TV|Sky Sports/.test(r)), s.rows.join(' | '));

  /* Fill the grid to the ceiling, one click at a time, exactly like a visitor. */
  for (let i = 0; i < 10; i++) {
    const added = await page.evaluate(() => {
      const row = [...document.querySelectorAll('.mvx-lib-row')].find((r) => !r.disabled && !r.classList.contains('is-in'));
      if (!row) return false;
      row.click();
      return true;
    });
    if (!added) break;
    await page.waitForTimeout(350);
  }
  s = await state(page);
  check('nine feeds fill nine tiles', s.tiles === 9, String(s.tiles));
  check('the ceiling is stated, not silent', s.rows.every((r) => r.includes('in grid')), s.rows.join(' | '));
  const grid3x3 = s.boxes.length === 9
    && new Set(s.boxes.map((b) => Math.round(b.top))).size === 3
    && new Set(s.boxes.map((b) => Math.round(b.left))).size === 3;
  check('nine tiles lay out as a 3x3 grid', grid3x3, JSON.stringify(s.boxes.slice(0, 3)));
  check('every tile keeps 16:9', s.boxes.every((b) => Math.abs(b.w / b.h - 16 / 9) < 0.05), JSON.stringify(s.boxes[0]));

  /* Remove one and the layout reflows without a gap. */
  await page.evaluate(() => document.querySelector('.mvx-lib-row.is-in')?.click());
  await page.waitForTimeout(600);
  s = await state(page);
  check('removing a feed drops its tile', s.tiles === 8, String(s.tiles));
  check('no empty tile is left behind', s.live + s.off === s.tiles, JSON.stringify({ live: s.live, off: s.off, tiles: s.tiles }));
  await page.close();
  check('no page errors in the drawer pass', errors.length === 0, errors.join(' | '));
}

/* ── 4. one tile has sound, the others are muted ── */
{
  const { page, errors } = await open('?mv=1&mvtest=live');
  let s = await state(page);
  check('exactly one tile is the main tile', s.mainTiles.length === 1, s.mainTiles.join(' | '));
  check('the main tile is unmuted', s.frames[0].includes('mute=0'), s.frames[0]);
  check('every other tile is muted', s.frames.slice(1).every((u) => u.includes('mute=1')), s.frames.join(' | '));

  await page.evaluate(() => document.querySelectorAll('.mvx-tile')[2].querySelector('[data-mvx-audio]').click());
  await page.waitForTimeout(1200);
  s = await state(page);
  check('moving the sound moves the main tile', s.mainTiles[0] === s.labels[2], `${s.mainTiles} / ${s.labels[2]}`);
  check('only one tile plays sound after the move', s.frames.filter((u) => u.includes('mute=0')).length === 1, s.frames.join(' | '));

  await page.evaluate(() => document.querySelector('[data-mvx-mode="focus"]').click());
  await page.waitForTimeout(700);
  const focus = await page.evaluate(() => ({
    visible: [...document.querySelectorAll('.mvx-tile')].filter((t) => t.style.display !== 'none').length,
    mainVisible: document.querySelector('.mvx-tile.is-main')?.style.display !== 'none',
  }));
  check('focus shows the main tile alone', focus.visible === 1 && focus.mainVisible, JSON.stringify(focus));
  await page.evaluate(() => document.querySelector('[data-mvx-mode="grid"]').click());
  await page.waitForTimeout(500);
  check('grid brings every tile back', (await state(page)).tiles === 3);
  await page.screenshot({ path: '/tmp/mv-check-audio.png' });
  await page.close();
  check('no page errors in the audio pass', errors.length === 0, errors.join(' | '));
}

/* ── 5. leaving gives the player back, and the address is kept in step ── */
{
  const { page, errors } = await open('?mv=1&mvtest=live');
  await page.evaluate(() => document.querySelector('#multiViewer [data-mvx-close]').click());
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => ({
    open: !document.querySelector('#multiViewer')?.hidden,
    parked: Boolean(document.querySelector('.player-parked')),
    frames: document.querySelectorAll('#multiViewer iframe').length,
    mv: new URLSearchParams(location.search).get('mv'),
    pressed: document.getElementById('mvToggle')?.getAttribute('aria-pressed'),
  }));
  check('closing the grid hides it', !after.open && after.frames === 0, JSON.stringify(after));
  check('the player comes back unparked', !after.parked, String(after.parked));
  check('mv leaves the address when the grid closes', after.mv === null, String(after.mv));
  check('the button is no longer marked pressed', after.pressed === 'false', String(after.pressed));

  await page.evaluate(() => document.getElementById('mvToggle').click());
  await page.waitForTimeout(1500);
  const again = await page.evaluate(() => ({
    open: !document.querySelector('#multiViewer')?.hidden,
    mv: new URLSearchParams(location.search).get('mv'),
    pressed: document.getElementById('mvToggle')?.getAttribute('aria-pressed'),
  }));
  check('the button reopens the grid', again.open && again.mv === '1' && again.pressed === 'true', JSON.stringify(again));
  await page.close();
  check('no page errors in the exit pass', errors.length === 0, errors.join(' | '));
}

/* ── 6. nothing on air: no black grid, and the picker says why ──
   Forced dark (?mvtest=dark), not "whatever weelo happens to be doing at 11am": an assertion that
   passes only because the provider is down is not a test of this page. */
{
  const { page, errors } = await open('?mv=1&mvtest=dark');
  await page.waitForTimeout(1200);
  const s = await state(page);
  check('with weelo dark, no tile is drawn', s.tiles === 0, String(s.tiles));
  check('the empty stage is not shown at all', s.stageHidden === true, String(s.stageHidden));
  check('the picker opens instead of a black box', s.library, String(s.library));
  check('every feed is listed as off air', s.rows.length === 9 && s.rows.every((r) => r.includes('off air')), s.rows.join(' | '));
  check('nothing is unmuted or playing', s.frames.length === 0, s.frames.join(' | '));
  await page.screenshot({ path: '/tmp/mv-check-dark.png' });
  await page.close();
  check('no page errors in the dark pass', errors.length === 0, errors.join(' | '));
}

/* ── 7. phone: the button row and the grid fit ── */
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error).slice(0, 140)));
  await page.goto(BASE + '?mv=1&mvtest=live', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4500);
  const s = await page.evaluate(() => {
    const btn = document.getElementById('mvToggle');
    const bar = document.querySelector('.mvx-bar');
    const tiles = [...document.querySelectorAll('.mvx-tile')].map((t) => t.getBoundingClientRect());
    return {
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      btnHeight: Math.round(btn.getBoundingClientRect().height),
      btnWidth: Math.round(btn.getBoundingClientRect().width),
      rowHeight: Math.round(document.querySelector('#championshipBtn').getBoundingClientRect().height),
      barOverflow: bar.scrollWidth > bar.clientWidth + 1,
      tiles: tiles.length,
      inStage: tiles.every((t) => t.width > 60 && t.height > 30),
    };
  });
  check('the page does not scroll sideways on a phone', !s.overflow, String(s.overflow));
  check('the Multiview button matches the others on mobile', s.btnHeight === s.rowHeight, `${s.btnHeight} vs ${s.rowHeight}`);
  check('the grid toolbar does not overflow', !s.barOverflow, String(s.barOverflow));
  check('all three tiles are usable on a phone', s.tiles === 3 && s.inStage, JSON.stringify(s));
  await page.screenshot({ path: '/tmp/mv-check-mobile.png' });
  await page.close();
  check('no page errors on mobile', errors.length === 0, errors.join(' | '));
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} multi-viewer checks passed`);
if (failed.length) { console.log('FAILED:', failed.map((f) => f.name).join(' | ')); process.exit(1); }
