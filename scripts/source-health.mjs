/* Live source probe: does each address actually play?
   Opens the provider page in a real (headed) browser and watches for media traffic — an HLS/DASH
   playlist or segment request is the only proof a stream exists; a 200 HTML shell proves nothing.
   Usage: node scripts/source-health.mjs            (all chips the resolver can address)
          node scripts/source-health.mjs weelo      (only labels containing "weelo") */
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://127.0.0.1:5173/';
const only = (process.argv[2] || '').toLowerCase();
const MEDIA = /(\.m3u8|\.mpd|\.ts\b|\.m4s\b|\.mp4\b|master\.txt|playlist|chunklist|index-dvr|\/hls\/|\/dash\/)/i;
const WAIT = Number(process.env.WAIT || 14000);

const { createStreamResolver } = await import('/home/user/f1admin/stream-resolver.js');
const resolver = createStreamResolver({ fetchImpl: fetch });

async function targets() {
  const chips = await resolver.chipAddresses();
  const out = [];
  for (const key of Object.keys(chips)) {
    const chip = chips[key];
    const candidate = chip.wouldUse || chip.current || (chip.addresses?.[0]?.url ?? '');
    if (!candidate || /^taifood id /.test(candidate)) continue;
    if (only && !chip.id.toLowerCase().includes(only)) continue;
    out.push({ id: chip.id, url: candidate, state: chip.state || '', online: chip.online });
  }
  return out;
}

const list = await targets();
console.log(`probing ${list.length} addresses`);

const browser = await chromium.launch({ headless: false, args: ['--autoplay-policy=no-user-gesture-required'] });
const results = [];
for (const target of list) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const media = [];
  const errors = [];
  page.on('request', (r) => { if (MEDIA.test(r.url())) media.push(r.url()); });
  page.on('response', (r) => { if (r.status() >= 400 && MEDIA.test(r.url())) errors.push(`${r.status()} ${r.url().slice(0, 80)}`); });
  let note = '';
  try {
    await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(WAIT);
    note = await page.evaluate(() => {
      const text = (document.body?.innerText || '').replace(/\s+/g, ' ').trim();
      if (/stream is offline|not (?:currently )?available|no stream|offline/i.test(text)) return 'says offline';
      return text ? text.slice(0, 70) : 'no text';
    });
  } catch (error) {
    note = `nav failed: ${String(error).slice(0, 60)}`;
  }
  const verdict = media.length ? 'PLAYS' : /offline|not (?:currently )?available/i.test(note) ? 'OFF AIR' : 'NO MEDIA';
  results.push({ id: target.id, verdict, media: media.length, first: (media[0] || '').slice(0, 90), note });
  console.log(`${verdict.padEnd(9)} ${target.id.padEnd(18)} media=${String(media.length).padEnd(3)} ${note.slice(0, 46)} ${media[0] ? media[0].slice(0, 70) : ''}`);
  await ctx.close();
}
await browser.close();

const tally = results.reduce((acc, r) => ((acc[r.verdict] = (acc[r.verdict] || 0) + 1), acc), {});
console.log('SUMMARY', JSON.stringify(tally));
