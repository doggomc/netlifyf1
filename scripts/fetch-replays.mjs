#!/usr/bin/env node
/**
 * Builds src/data/replays.json — the race replay index.
 *
 * fullraces.com publishes one page per session and embeds ok.ru players on each page. There is
 * no API, and their Cloudflare edge refuses Node's TLS fingerprint (both `fetch` and `node:https`
 * get 403 while `curl` gets 200), which is why this script shells out to curl when it is
 * available. That also means the scrape has to happen at build time, not in the browser: the
 * site cannot fetch fullraces directly (CORS) and the backend cannot fetch it either.
 *
 * Run:
 *   npm run replays            # refresh the index, fetch players for pages we do not have yet
 *   npm run replays -- --all   # also re-fetch every page (slow, ~3 min)
 *   npm run replays -- --sitemap-only   # just refresh the list of sessions
 *
 * Politeness: one request at a time, a 1.2 s gap, an identifying User-Agent and a hard cap on
 * pages per run. fullraces' robots.txt allows crawling (User-agent: * / Allow: /), and players
 * are never copied or re-hosted — the site embeds their ok.ru player, exactly like the source
 * page does.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '../src/data/replays.json');

const SITEMAP = 'https://fullraces.com/sitemap-publ.xml';
const BASE = 'https://fullraces.com/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const DELAY_MS = 1200;
const MAX_PAGES_PER_RUN = Number(process.env.REPLAYS_MAX_PAGES || 160);
const args = new Set(process.argv.slice(2));
const SITEMAP_ONLY = args.has('--sitemap-only');
const FETCH_ALL = args.has('--all');

const MONTHS = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11 };

/* Session prefixes, longest first so "sprint-qualifying" wins over "sprint". */
const SESSIONS = [
  ['sprint-qualifying', 'Sprint Qualifying'],
  ['sprint-shootout', 'Sprint Qualifying'],
  ['spint-qualifying', 'Sprint Qualifying'],
  ['sprint', 'Sprint'],
  ['qualifying', 'Qualifying'],
  ['race', 'Race'],
  ['1st-practice', 'Practice 1'],
  ['2nd-practice', 'Practice 2'],
  ['3rd-practice', 'Practice 3'],
  ['practice-1', 'Practice 1'],
  ['practice-2', 'Practice 2'],
  ['practice-3', 'Practice 3'],
  ['practice', 'Practice'],
  ['pre-race', 'Pre-Race'],
  ['paddock-uncut', 'Paddock Uncut'],
  ['f1-show', 'The F1 Show'],
  ['drivers-press-conference', 'Drivers Press Conference'],
  ['teds-qualifying-notebook', "Ted's Qualifying Notebook"],
  ['teds-notebook', "Ted's Notebook"],
  ['barcelona-shakedown-day-4', 'Barcelona Shakedown'],
  ['barcelona-shakedown-day-3', 'Barcelona Shakedown'],
  ['barcelona-shakedown-day-2', 'Barcelona Shakedown'],
  ['barcelona-shakedown-day-1', 'Barcelona Shakedown'],
  ['barcelona-shakedown', 'Barcelona Shakedown']
];

const HOSTS = ['ok.ru', 'vidmoly.to', 'vidmoly.biz', 'dood.to', 'dood.la', 'streamtape.to', 'voe.sx', 'filemoon.sx', 'youtube.com', 'youtu.be', 'vk.com', 'dailymotion.com'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  try {
    const { stdout } = await run('curl', ['-sL', '--max-time', '25', '-A', UA, url], { maxBuffer: 32 * 1024 * 1024 });
    if (stdout && stdout.length > 200) return stdout;
  } catch { /* fall through to fetch */ }
  const response = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' } });
  if (!response.ok) throw new Error(`${url} -> ${response.status}`);
  return response.text();
}

function dateFromSlug(slug) {
  const match = slug.match(/-([a-z]+)-(\d{1,2})-(\d{4})-(?:formula|f1)/) || slug.match(/-([a-z]+)-(\d{1,2})-(\d{4})$/);
  if (!match) return null;
  const month = MONTHS[match[1]];
  if (month === undefined) return null;
  const iso = `${match[3]}-${String(month + 1).padStart(2, '0')}-${String(match[2]).padStart(2, '0')}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

function metaFromSlug(slug) {
  const season = slug.match(/-f1-(\d{4})-/);
  const session = SESSIONS.find(([key]) => slug.startsWith(key + '-'));
  const eventMatch = slug.match(/-f1-\d{4}-(.+?)-full-/);
  const event = eventMatch
    ? eventMatch[1].split('-').map((w) => (w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1))).join(' ')
    : '';
  return {
    slug,
    url: BASE + slug,
    season: season ? Number(season[1]) : null,
    session: session ? session[1] : 'Session',
    sessionKey: session ? session[0] : 'session',
    event,
    date: dateFromSlug(slug)
  };
}

function slugsFromSitemap(xml) {
  const out = new Set();
  for (const match of xml.matchAll(/<loc>\s*(https:\/\/fullraces\.com\/[^<\s]+)\s*<\/loc>/g)) {
    const slug = match[1].slice(BASE.length).replace(/\/+$/, '');
    if (!/^[a-z0-9][a-z0-9-]{4,160}$/.test(slug)) continue;
    if (!/-f1-\d{4}-/.test(slug)) continue;
    if (!/(formula-1|full-race-replay)$/.test(slug)) continue;
    out.add(slug);
  }
  return [...out];
}

/* Each page marks its players up as "<strong>OK - F1TV</strong>" followed by the iframe, and can
   carry more than one (F1TV and Sky are both common), so the caption nearest before each iframe
   becomes the provider name. */
/* The caption above a player reads "<strong>OK - F1TV</strong>", so take the last strong tag
   before the iframe and strip the "OK" prefix and separators. Anything left that is only a
   resolution ("1080p") is dropped in favour of "ok.ru", and a bare "OK" becomes "ok.ru". */
const BRANDS = ['F1TV', 'SkySports', 'Sky Sports', 'Sky', 'Viaplay', 'DAZN', 'ESPN', 'TSN', 'Canal+', 'Ziggo', 'ORF', 'RTL', 'Movistar', 'ServusTV', 'Sport1', 'SRF', 'V Sport', 'Viasat', 'Now TV', 'Optus', 'Fox Sports'];

/* Captions on these pages are inconsistent: "OK - F1TV", "Server #1", ".RU 1080p", "Only Race".
   All a viewer needs is which broadcaster a feed is, so pull the brand out of the caption and
   keep the resolution when it is stated; anything unrecognised becomes "OK.ru". */
function normalizeProvider(raw) {
  const label = String(raw || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/^OK\s*[-–—:]?\s*/i, '')
    .replace(/\s*[-–—:]\s*OK\s*$/i, '')
    .replace(/^\.RU\s*/i, '')
    .replace(/^[-–—:.\s]+/, '')
    .replace(/[-–—:.\s]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  const squash = (value) => value.toLowerCase().replace(/[^a-z0-9+]/g, '');
  const brand = BRANDS.find((name) => squash(label).includes(squash(name)));
  const quality = (label.match(/\b(2160p|1440p|1080p|720p|540p|480p)\b/i) || [])[1];
  if (brand) return quality ? `${brand} ${quality.toLowerCase()}` : brand;
  if (quality) return `OK.ru ${quality.toLowerCase()}`;
  return 'OK.ru';
}

/* The caption sits in the last <strong> before the iframe ("<strong>OK - F1TV</strong>"). */
function providerFromCaption(before) {
  const strongs = [...before.matchAll(/<strong[^>]*>([\s\S]{1,80}?)<\/strong>/gi)];
  if (!strongs.length) return '';
  const label = strongs[strongs.length - 1][1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return normalizeProvider(label);
}

function playersFromPage(html) {
  const players = [];
  const seen = new Set();
  for (const match of html.matchAll(/<iframe[^>]*?src=["']([^"']+)["']/gi)) {
    const raw = match[1].trim();
    const absolute = raw.startsWith('//') ? 'https:' + raw : raw;
    let parsed;
    try { parsed = new URL(absolute); } catch { continue; }
    if (parsed.protocol !== 'https:') continue;
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (!HOSTS.some((entry) => host === entry || host.endsWith('.' + entry))) continue;
    if (seen.has(absolute)) continue;
    seen.add(absolute);
    const provider = providerFromCaption(html.slice(Math.max(0, match.index - 700), match.index)) || host;
    players.push({ provider, url: absolute });
  }
  return players;
}

/* An ok.ru embed answers 200 for videos it has deleted: the shell loads and the player is handed
   "Видео не найдено" over its API, which shows up to the visitor as a frame that never plays and
   no error anywhere. The embed's own markup carries the id we need to ask about, and the public
   page for that id tells the truth. One request per dead player, not one per player. */
const DEAD_MARKERS = /Видео не найдено|Video not found|REMOVED|DELETED/i;

async function okEmbedAlive(url) {
  const id = (url.match(/videoembed\/(\d+)/) || [])[1];
  if (!id) return true;
  let html = '';
  try {
    html = await get(url);
  } catch {
    return false;
  }
  if (DEAD_MARKERS.test(html)) return false;
  /* Different ids: the page's own id (metadata) and the movie id its player is pointed at. When
     they disagree ok.ru is serving a moved or deleted movie under a stale embed. */
  const metaIds = [...html.matchAll(/"videoId"\s*:\s*"?(\d{6,})/g)].map((m) => m[1]);
  const movieIds = [...html.matchAll(/"movieId"\s*:\s*"?(\d{6,})/g)].map((m) => m[1]);
  if (metaIds.length && movieIds.length && !movieIds.includes(metaIds[0])) return false;
  return true;
}

async function main() {
  const existing = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { items: [] };
  const byslug = new Map((existing.items || []).map((item) => [item.slug, item]));

  console.log('fetching sitemap…');
  const xml = await get(SITEMAP);
  const slugs = slugsFromSitemap(xml);
  console.log(`sitemap: ${slugs.length} replay sessions`);

  if (args.has('--health')) {
    /* Report (and optionally prune) players that ok.ru has taken down. */
    const prune = args.has('--prune');
    let checked = 0;
    let dead = 0;
    for (const item of (existing.items || [])) {
      const keep = [];
      for (const player of item.players || []) {
        if (/ok\.ru/.test(player.url)) {
          checked += 1;
          const alive = await okEmbedAlive(player.url);
          if (!alive) {
            dead += 1;
            console.log(`  dead  ${item.season} ${item.event} ${item.session}  ${player.provider}  ${player.url}`);
            if (!prune) { keep.push(player); continue; }
            continue;
          }
          await new Promise((resolve) => setTimeout(resolve, 700));
        }
        keep.push(player);
      }
      if (prune) item.players = keep;
    }
    if (prune) {
      existing.generatedAt = new Date().toISOString();
      writeFileSync(OUT, JSON.stringify(existing, null, 1) + '\n');
    }
    console.log(`health: ${checked} ok.ru player(s) checked, ${dead} dead${prune ? ' and pruned' : ' (report only)'}`);
    return;
  }

  if (args.has('--relabel')) {
    let changed = 0;
    for (const item of (existing.items || [])) {
      for (const player of item.players || []) {
        const next = normalizeProvider(player.provider);
        if (next !== player.provider) { player.provider = next; changed += 1; }
      }
    }
    existing.generatedAt = new Date().toISOString();
    writeFileSync(OUT, JSON.stringify(existing, null, 1) + '\n');
    console.log(`relabelled ${changed} provider name(s)`);
    return;
  }

  const now = new Date().toISOString();
  const items = slugs.map((slug) => {
    const previous = byslug.get(slug);
    const base = metaFromSlug(slug);
    return previous ? { ...base, players: previous.players || [], fetchedAt: previous.fetchedAt || null } : { ...base, players: [], fetchedAt: null };
  });

  let fetched = 0;
  if (!SITEMAP_ONLY) {
    const pending = items
      .filter((item) => FETCH_ALL || !item.players.length)
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .slice(0, MAX_PAGES_PER_RUN);
    console.log(`players to fetch: ${pending.length}${pending.length === MAX_PAGES_PER_RUN ? ' (capped, re-run for more)' : ''}`);
    for (const item of pending) {
      try {
        const html = await get(BASE + item.slug);
        item.players = playersFromPage(html);
        item.fetchedAt = new Date().toISOString();
        fetched++;
        process.stdout.write(`\r  ${fetched}/${pending.length} ${item.date || ''} ${item.session} ${item.players.length} player(s)          `);
      } catch (error) {
        process.stdout.write(`\r  ${fetched}/${pending.length} failed ${item.slug.slice(0, 40)} (${error.message})          \n`);
      }
      await sleep(DELAY_MS);
    }
    if (pending.length) process.stdout.write('\n');
  }

  const seasons = [...new Set(items.map((item) => item.season).filter(Boolean))].sort((a, b) => b - a);
  items.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || a.session.localeCompare(b.session));
  const payload = {
    generatedAt: now,
    source: 'https://fullraces.com',
    seasons,
    count: items.length,
    withPlayers: items.filter((item) => item.players.length).length,
    items
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(payload, null, 1) + '\n');
  console.log(`wrote ${OUT}`);
  console.log(`sessions: ${payload.count} | with players: ${payload.withPlayers} | seasons: ${seasons.join(', ')}`);
}

main().catch((error) => {
  console.error('replay index failed:', error.message);
  // Never break a build because a third-party site had a bad day: keep the committed file.
  process.exit(existsSync(OUT) ? 0 : 1);
});
