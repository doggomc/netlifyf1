import { setupCustomSelects } from './ui/select';
import { TEAM_LOGO, TEAM_HEX, TEAM_ALIAS, teams } from './data/teams';
import { NO_STREAM_MESSAGES, LOADER_LINES, BLOCKED_TITLE, BLOCKED_COPY_IOS, BLOCKED_COPY, HIJACK_TITLE, HIJACK_COPY } from './data/cockpit-messages';
import { BACKEND_API, SITE_CONFIG_CACHE_KEY, SITE_SEASON, OPENF1_API, JOLPI } from './config';
import type { ProviderHealthState, HealthDeps } from './features/provider-health';
/* A type-only import: the catalogue module itself stays in its lazy chunk. */
import type { TaifoodChannel } from './features/catalogues';
import { parseSiteConfig, type SiteConfig } from './types/site-config';
import { onIdle, onVisible, lazyButton } from './services/lazy';
import { store } from './services/storage';
import { fetchWithTimeout, fetchJson, readApiFallback } from './services/api';
import { $ } from './services/dom';
import { schedule, type RaceEvent, type Session } from './data/schedule';
import { mapPool } from './services/pool';
import type { Catalogues } from './features/catalogues';
import { staleSession } from './features/session-guard';
/* ═══════════════════════════════════════════════════════════════════════════
   FreeF1 - Formula 1 Live Companion
   Client Application Logic
   ═══════════════════════════════════════════════════════════════════════════ */

/* ═══════════════ 1. CONFIGURATION & CONSTANTS ═══════════════ */
const SITE_CONFIG_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const SITE_CONFIG_TIMEOUT_MS = 2500;
const SITE_CONFIG_FOCUS_COOLDOWN_MS = 5000;
const SITE_CONFIG_UPDATES_URL = `${BACKEND_API}/api/site/updates`;
let streamWindowState = { active: false, reason: '', startedAt: null, updatedAt: null };
let siteConfigEventSource = null;

const NAV_TIMEOUT_MS = 9000;
const NAV_SOFT_MS = 4000;

const FOLLOW_KEY = 'freef1_following';
const RADIO_RC_STORE_KEY = 'freef1_radio_rc';

const IS_IOS = /ipad|iphone|ipod/i.test(navigator.userAgent) ||
  (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

const IFRAME_ALLOW = "autoplay *; encrypted-media *; fullscreen *; picture-in-picture *";

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const liteMotion = reduceMotion || matchMedia('(max-width: 760px)').matches || navigator.connection?.saveData;
if (liteMotion) document.documentElement.classList.add('lite-motion');

const scheduleAnimationFrame = window.requestAnimationFrame?.bind(window) ||
  ((callback) => window.setTimeout(callback, 0));
const contentFadeTokens = new WeakMap();
const CONTENT_FADE_MS = 180;

function fadeSwapContent(element, render, { animate = true } = {}) {
  if (typeof render !== 'function') return;
  if (!element) {
    render();
    return;
  }

  const token = (contentFadeTokens.get(element) || 0) + 1;
  contentFadeTokens.set(element, token);
  if (!animate || reduceMotion) {
    element.classList.remove('content-fade-target', 'content-fading-out');
    render();
    return;
  }

  element.classList.add('content-fade-target', 'content-fading-out');
  window.setTimeout(() => {
    if (contentFadeTokens.get(element) !== token || !element.isConnected) return;
    render();
    scheduleAnimationFrame(() => {
      if (contentFadeTokens.get(element) === token && element.isConnected) {
        element.classList.remove('content-fading-out');
      }
    });
  }, CONTENT_FADE_MS);
}

const BLOCKED_COPY_TEXT = IS_IOS ? BLOCKED_COPY_IOS : BLOCKED_COPY;

// Keep News data and rendering intact for admins, but hide its public view until re-enabled.
const PUBLIC_NEWS_ENABLED = false;
// Replays are parked while the embedded players are unreliable; the code stays for when they return.
const PUBLIC_REPLAYS_ENABLED = false;
const VIEWS = { home: 'viewHome', ...(PUBLIC_NEWS_ENABLED ? { news: 'viewNews' } : {}), ...(PUBLIC_REPLAYS_ENABLED ? { replays: 'viewReplays' } : {}), info: 'viewInfo', discord: 'viewDiscord' };
const VIEW_TITLES = { ...(PUBLIC_NEWS_ENABLED ? { news: 'News - FreeF1' } : {}), ...(PUBLIC_REPLAYS_ENABLED ? { replays: 'Race Replays - FreeF1' } : {}), info: 'Terms, Privacy & FAQ - FreeF1', discord: 'Discord - FreeF1' };
const VIEW_SWAP_MS = reduceMotion ? 0 : 260;

const INK_LIGHT = '#fff';
const INK_DARK = '#000';
const FREEF1_MARK = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2 17.5L7.5 6.5h5.2l-2 4h4.6l-1.6 3.2H8.9l-1.7 3.8H2z" fill="#fff"/><path d="M14.5 6.5H22l-1.7 3.4h-7.5l1.7-3.4z" fill="#fff" opacity=".72"/></svg>';
/* ═══════════════ 2. SAFE STORAGE (never throws) ═══════════════ */
// Purge identifiers and count/token snapshots left by the retired visitor
// tracking implementation. New builds do not read, write, or transmit them.
['freef1_user_id', 'freef1_visitor_token', 'freef1_active_count'].forEach((key) => store.remove(key));

/* ═══════════════ 3. CORE UTILITIES & HELPERS ═══════════════ */


function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

const clockFormat = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
});

const newsDateFormat = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric'
});

const radioRcTimeFmt = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
});

function formatNewsDate(timestamp) {
  const date = new Date(Number(timestamp));
  return Number.isNaN(date.getTime()) ? '-' : newsDateFormat.format(date);
}


function fmtDob(dob) {
  if (!dob) return '-';
  const d = new Date(dob + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ageFrom(dob) {
  if (!dob) return null;
  const b = new Date(dob + 'T00:00:00Z');
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const m = now.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

function fmtPts(n) {
  return String(Math.round(Number(n || 0) * 10) / 10);
}

function hexFor(n) {
  for (const k in TEAM_HEX) {
    if ((n || '').includes(k)) return TEAM_HEX[k];
  }
  return 'var(--team)';
}

function shade(hex, p) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, (n >> 16) + p));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 255) + p));
  const b = Math.min(255, Math.max(0, (n & 255) + p));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

function luma(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
}

function srgbChan(c) {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relLuminance(r, g, b) {
  return 0.2126 * srgbChan(r) + 0.7152 * srgbChan(g) + 0.0722 * srgbChan(b);
}

function contrastRatio(l1, l2) {
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

function inkOn(color) {
  const c = String(color || '').trim();
  let r, g, b;
  if (c[0] === '#') {
    const h = c.slice(1);
    const full = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
    if (!/^[0-9a-fA-F]{6}$/.test(full)) return 'var(--team-ink)';
    const n = parseInt(full, 16);
    r = (n >> 16) & 255;
    g = (n >> 8) & 255;
    b = n & 255;
  } else {
    const nums = c.match(/-?\d+(\.\d+)?/g);
    if (!nums || nums.length < 3) return 'var(--team-ink)';
    r = Number(nums[0]);
    g = Number(nums[1]);
    b = Number(nums[2]);
  }
  const L = relLuminance(r, g, b);
  return contrastRatio(L, 0) >= contrastRatio(L, 1) ? INK_DARK : INK_LIGHT;
}

function hex2rgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = [...hex].map((char) => char + char).join('');
  const value = parseInt(hex, 16);
  return [value >> 16, (value >> 8) & 255, value & 255];
}

function lockScroll(on) {
  /* Hiding the scrollbar used to narrow the page and shift everything sideways. Pad the body
     by exactly the channel we removed so opening a modal cannot move the layout. */
  if (on) {
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (gap > 0) document.body.style.paddingRight = gap + 'px';
  } else {
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
  }
  scheduleMeasure();
}

let lastModalFocus = null;

function openModal(modal) {
  lastModalFocus = document.activeElement;
  modal.classList.add('open');
  lockScroll(true);
  requestAnimationFrame(() => {
    modal.querySelector('button:not(:disabled),select:not([tabindex="-1"])')?.focus();
  });
}

function closeModal(modal) {
  modal.classList.remove('open');
  if (!document.querySelector<HTMLElement>('.modal.open')) {
    lockScroll(false);
    if (lastModalFocus && typeof lastModalFocus.focus === 'function') {
      lastModalFocus.focus();
    }
    lastModalFocus = null;
  }
}

function trapModalFocus(event) {
  if (event.key !== 'Tab') return;
  const modal = document.querySelector<HTMLElement>('.modal.open');
  if (!modal) return;
  const focusable = [...modal.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not([tabindex="-1"]),[href],[tabindex]:not([tabindex="-1"]),textarea:not(:disabled)')]
    .filter((element) => !element.hidden && element.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function showToast(msg, type) {
  let t = document.getElementById('freef1Toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'freef1Toast';
    t.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none';
    document.body.appendChild(t);
  }
  const el = document.createElement('div');
  const colors = {
    warning: '#ffb020',
    success: '#00d57e',
    error: '#e10600',
    info: '#60a5fa'
  };
  const bg = colors[type] || colors.info;
  el.style.cssText = `background:rgba(14,16,20,.95);border:1px solid ${bg}44;border-left:3px solid ${bg};border-radius:8px;padding:10px 16px;font-family:'JetBrains Mono',monospace;font-size:.7rem;color:#f1f4f8;box-shadow:0 4px 20px rgba(0,0,0,.5);animation:fadeUp .4s ease;pointer-events:auto;max-width:320px`;
  el.textContent = msg;
  t.appendChild(el);
  window.setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity .3s';
    window.setTimeout(() => el.remove(), 300);
  }, 4000);
}

/* ═══════════════ 5. SCHEDULE & SESSION DATA ═══════════════ */
function hoursSince(s: Session) {
  if (!s || !s.ts) return Infinity;
  return (Date.now() - s.ts) / 3600000;
}

function sessionDurationHours(s: Session) {
  const key = `${s?.slug || ''} ${s?.name || ''}`.toLowerCase();
  if (/\bsprint[- ]qualif/.test(key) || key.includes('sprint-qualifying')) return 1.25;
  if (/\bsprint\b/.test(key) && !/qualif/.test(key)) return 1;
  if (/qualif/.test(key)) return 1.25;
  if (/\brace\b/.test(key)) return 5;
  return 1.25;
}

function isStreamAvailable(s: Session) {
  if (!s) return false;
  if (streamWindowState.active) return true;
  const d = hoursSince(s);
  return d >= -1 && d <= sessionDurationHours(s);
}

function isSessionEnded(s: Session) {
  if (!s) return false;
  // race overtime: keep live up to +1h after 5h window
  const extra = /\brace\b/i.test(`${s?.slug || ''} ${s?.name || ''}`) ? 1 : 0.25;
  return hoursSince(s) > sessionDurationHours(s) + extra;
}


function getCurrentLiveSession() {
  if (streamWindowState.active && currentEvent && currentSession) {
    return { event: currentEvent, session: currentSession, forced: true };
  }
  let best = null;
  let bestStart = -Infinity;
  for (const ev of schedule) {
    for (const s of ev.sessions) {
      if (!isStreamAvailable(s)) continue;
      if (s.ts >= bestStart) {
        bestStart = s.ts;
        best = { event: ev, session: s };
      }
    }
  }
  return best;
}

function pickDefault() {
  const live = getCurrentLiveSession();
  if (live) return { event: live.event, session: live.session };
  for (const ev of schedule) {
    const s = ev.sessions.find((x) => !isSessionEnded(x));
    if (s) return { event: ev, session: s };
  }
  const last = schedule.at(-1);
  return { event: last, session: last.sessions.at(-1) };
}

let cachedNextSession = null;

function getNextSession() {
  const now = Date.now();
  if (cachedNextSession && cachedNextSession.session.ts > now) return cachedNextSession;
  let next = null;
  let min = Infinity;
  for (const ev of schedule) {
    for (const s of ev.sessions) {
      const d = s.ts - now;
      if (d > 0 && d < min) {
        min = d;
        next = { event: ev, session: s };
      }
    }
  }
  cachedNextSession = next;
  return next;
}

/* ═══════════════ 6. STREAM SOURCES & PLAYER LOGIC ═══════════════ */
function kebab(value) {
  return (value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}


/* The taifood embeds are addressed per round and per session:
   /embed/<event-name>---<session-name>-<provider id>. Both names are slugged the same way
   ("Mexico City Grand Prix" + "Practice 1" -> mexico-city-grand-prix---practice-1-31363),
   so each provider is just a fixed numeric id. */
/* taifood addresses are <event>---<session>-<id>. There is NO quality mark on the address: their
   resolver answers 200 for "…-race-31407" and 404 for "…-31407SD" and "…-31407SD1080pHD". The
   "_540p" suffix is the only variant that exists, and it is below our floor, so we never ask for it.
   The event is spelled as the schedule spells it; the alias is kept as a second candidate. */
const EVENT_ALIASES = { 'mexico-city': 'mexico' };
function taidCandidates(num) {
  const base = kebab(currentEvent?.name);
  /* Schedule spelling first, alias second — whichever their resolver accepts is the one that plays.
     Verified against their own /fetch: 'mexico-city-grand-prix---race-31407' answers 200 while
     'mexico---race-31407' and 'mexico-city---race-31407' both answer 404, so the long schedule
     spelling is correct and must stay first. */
  return [base, EVENT_ALIASES[base]].filter(Boolean)
    .map((event) => `https://taifood-blog.asia/embed/${event}---${kebab(currentSession?.name)}-${num}`);
}

/* taifood answers 200 with the same ~269 KB player shell for a valid id, an id from last round and a
   nonsense id alike, so nothing in the response separates a live address from a black frame — and a
   black frame commits a document, which makes the player's failover believe it succeeded. The only
   trustworthy statement of what exists is the list taifood publishes, so a taifood address that
   names an id that list does not carry is never offered: an honest 'no link upstream' beats a chip
   that looks connected and shows nothing. */
function taifoodPublishesId(url, catalogue: Record<string, TaifoodChannel[]>): boolean {
  const num = (String(url).match(/-(\d{4,7})(?:_\d+p)?$/) || [])[1];
  if (!num) return true;                 // the path form (/embed/f1/2026/<event>/<session>) carries no id
  return Object.values(catalogue || {}).some((rows) => (rows || []).some((row) => (String(row.uri).match(/-(\d{4,7})(?:_\d+p)?$/) || [])[1] === num));
}

function taifoodUsable(url: string, source: StreamSource): boolean {
  if (!/taifood-blog\.asia\/embed\//.test(url)) return true;
  if (!cataloguesReady) return true;     // before the list answers, judge nothing
  const list = catalogues.taifood || {};
  // The PPV chip's own address comes from the PPV feed, not from the taifood channel list.
  if (source.id === 'ppv') return true;
  return taifoodPublishesId(url, list);
}

/* How well a taifood row fits a chip: 0 = the language the chip is for, 1 = an untagged row (the
   broadcaster's main feed — usable, but never preferred), -1 = another language, never offered.
   A chip names its language in taifood's own vocabulary ('italian', 'german', …) so no mapping
   table can drift; an English chip has no such name and matches on 'english'. */
function taifoodLangRank(rowLang: string | undefined, chip: StreamSource): number {
  const row = String(rowLang || '').toLowerCase();
  const wanted = String(chip.tfLang || (chip.lang === 'other' ? '' : 'english')).toLowerCase();
  if (!row) return 1;
  return row === wanted ? 0 : -1;
}

/* ═══ Link pools ═══
   A source is a POOL of links, not one address. Every entry carries the qualities it can serve so
   the player can stay at 720p or better; anything below 720p is never offered.
   addressing: 'fixed' = a stamped URL or a taifood id, 'dynamic' = a token minted per request
   (ehgembxe), never stored. */
type Addressing = 'fixed' | 'dynamic';

interface StreamLink {
  url?: string;
  taid?: number;
  ppv?: boolean;
  mark?: string;                // taifood quality suffix, e.g. 'SD1080pHD'
  provider: string;
  label?: string;               // only where it differs from the provider name
  addressing?: Addressing;      // defaults to 'fixed' (a stamped URL or a taifood id)
  quality?: number;             // omitted/ad 0 = unknown or adaptive, else vertical pixels
  rp?: ReferrerPolicy;
}

interface StreamSource {
  id: string;
  label: string;
  links: StreamLink[];
  rp?: ReferrerPolicy;
  embdlol?: string;             // catalogue channel name, when the pool is looked up
  gated?: boolean;              // the 4K chip: resolved server-side, plays through the nudge
  lang?: 'en' | 'other';        // which tab the chip belongs to
  special?: 'onboard' | 'data' | 'feed'; // drawn apart from the broadcaster chips
  weelo?: string;               // weelo stream id, when the pool is looked up there
  taifood?: string;             // chip key in taifood's per-race list ('apple', 'sky', …)
  tfLang?: string;              // taifood's own name for the commentary language, e.g. 'italian'
  /* Race Control's own view of the chip: the shipped name and pool, and the live state. */
  base?: { label: string; links: StreamLink[] };
  hidden?: boolean;
}

/* Minimum vertical resolution we will ever put on screen. */
const MIN_QUALITY = 720;

const EMBDLOL_EMBED = 'https://embdlol.st/embed/';

/* ═══ Provider catalogues ═══
   embdlol ids rotate and cdnlivetv publishes status, so both come from the lazy catalogue chunk. */
let catalogues: Catalogues = { embdlol: {}, cdnlive: {}, mirrors: {}, weelo: {}, taifood: {}, weeloEvents: {}, ppv: '' };
/* Until the catalogue has answered once, an EMB chip has NO pool. Treating "not loaded yet" as
   "nothing upstream" is what made every EMB chip look dead on a cold click. */
let cataloguesReady = false;

async function loadCatalogues(): Promise<void> {
  const { loadCatalogues: load } = await import('./features/catalogues');
  catalogues = await load({ fetchWithTimeout, backend: BACKEND_API });
  cataloguesReady = true;
}

function cdnLivePlayer(name: string): string {
  return `https://cdnlivetv.tv/api/v1/channels/player/?name=${encodeURIComponent(name)}&code=&user=cdnlivetv&plan=free`;
}

/* strmfree publishes the live mirrors of a channel at /api/v1/sources/<key>. They join the pool,
   so a mirror it starts publishing today plays without a redeploy. Under 720p is dropped. */
function mirrorLinks(key: string, quality: number): StreamLink[] {
  return (catalogues.mirrors[key] || []).filter((mirror) => mirror.quality === quality).map((mirror) => ({ provider: 'strmfree', quality, url: mirror.url }));
}

/* What plays on load and on "jump to live"; if Race Control disables it, the first enabled source. */
const DEFAULT_SOURCE_ID = "sky-uk";

/* The embdlol feeds we draw a chip for; labels and languages are keyed below. */
/* embdlol publishes ONE English F1 channel at a time, and fmexicofullhd1/3 are two names for it, so
   the 'sky' and 'apple' chips could never resolve to anything the other two do not. They were empty
   for their whole life; the ten below are the feeds embdlol actually publishes per language. */
const EMB_FEEDS = 'fullhd1,fullhd3,dazn,skyit,skyde,world,german,spanish,italian'.split(',');
/* A feed may only fall back to another feed of its own language, never to English Sky. */
const EMB_LANG: Record<string, string> = { dazn: 'es', spanish: 'es', skyit: 'it', italian: 'it', skyde: 'de', german: 'de' };

const EMB_LABELS: Record<string, string> = { skyit: 'Sky Italia', skyde: 'Sky DE' };


/* ═══ Tabs ═══
   English is what a visitor lands on: the Sky feeds, the English-speaking broadcasters and the
   specials. Other is everything whose commentary is not English, plus the unlabelled mirrors that
   have no language to promise. All shows the row exactly as it was before the tabs existed. */
let sourceTab = 'en';

/* ═══ Specials ═══
   weelo relays the onboards and the data channel: the id is the address (weelo.live/<id>/index.html
   is an HLS master playlist) and /players/state.json says whether it is up. They are drawn in their
   own block, and one that is not on air says so instead of opening a dead frame. */
/* label:stream id:kind — the id is the whole address, so it is written once. */
/* [label, weelo id, special, language, chip id]. Language comes from weelo's own event feed:
   'Multi-audio' is weelo's label for the English world feed with alternate commentaries, so it is
   still English.
   The chip id is written out, NOT derived from the stream id: those ids share their first eight
   characters, so deriving one gave every onboard the same id ('weelo-ogcgpgbg') and none of them
   was the id Race Control disables ('weelo-kimi'). A disable matched no chip and silently did
   nothing. This list is the contract with f1admin's FEED_SOURCES — keep the ids identical. */
const SPECIALS = [
  /* Broadcast feed first, then the timing feeds, then the onboards, then the rest of weelo's list.
     Every one of them is English: International Feed carries the English world commentary and was
     filed under Other only because weelo labels it 'Multi-audio'. English is the default view, so a
     language tab must never be the reason a feed is missing from it. */
  ['Sky Sports (weelo)', 'dflgjhacdfahpgchehacbdacoekfacieee', 'feed', 'en', 'weelo-skyweelo'],
  ['Drivers Track', 'gebdacefgfaciceechjgghfgchacefchbgdglgfgchjcacieee', 'onboard', 'en', 'weelo-drivers'],
  ['Data Channel', 'gebdacefgfaciceebgehbgacdeigbgogogfgmgjcacieee', 'data', 'en', 'weelo-data'],
  ['Kimi Antonelli', 'peogcgpgbgchegaciclejgngjgacbeogehpgogfgmgmgjgjcacieee', 'onboard', 'en', 'weelo-kimi'],
  ['Charles Leclerc', 'peogcgpgbgchegacicdeigbgchmgfgdhacmefgdgmgfgchdgjcacieee', 'onboard', 'en', 'weelo-charles'],
  ['Max Verstappen', 'peogcgpgbgchegacicnebgihacgffgchdhehbgahahfgogjcacieee', 'onboard', 'en', 'weelo-max'],
  ['International Feed', 'jeogehfgchogbgehjgpgogbgmgacgefgfgegacicgebdjcacieee', 'feed', 'en', 'weelo-intl'],
  ['F1 TV (World)', 'gebdacefgfacieee', 'feed', 'en', 'weelo-f1tvworld'],
  ['F1 TV (Shows)', 'gebdacefgfacicdfigpghhdhjcacieee', 'feed', 'en', 'weelo-shows']
] as const;

const SPECIAL_SOURCES: StreamSource[] = SPECIALS.map(([label, weelo, special, lang, id]): StreamSource => ({
  id,
  label,
  lang,
  special,
  weelo,
  links: [],
}));

/* ═══ The source list ═══
   Every link here was verified by probe: strmfree/streamfree pages answer 200 with a live player
   shell, cdnlivetv reports channel status, taifood ids come from the live manifests. Anything
   below 720p (taifood's _540p tier, embdlol's 720p German channel) is deliberately absent. */
const sources: StreamSource[] = [
  /* Main channel: strmfree at 1080p. Both domains of the mirror pair are listed, and the
     provider's own resolver is polled at play time for any extra live mirror it publishes. */
  { id: "sky-uk", label: "Sky HD", links: [
      { provider: 'strmfree', quality: 1080, url: "https://strmfree.st/embed/racing/skyf11080p" },
      { provider: 'strmfree', quality: 1080, url: "https://streamfree.top/embed/racing/skyf11080p" },
      { provider: 'strmfree', quality: 1080, url: "https://strmfree.st/embed/racing/skyf1" },
      { provider: 'strmfree', quality: 1080, url: "https://streamfree.top/embed/racing/skyf1?server=origin&quality=1080p&category=racing" }
  ]},
  /* The 2160p variant of the same channel, on both domains. */
  { id: "sky-uhd", label: "Sky UHD", links: [
      { provider: 'strmfree', quality: 2160, url: "https://strmfree.st/embed/racing/skyf12160p" },
      { provider: 'strmfree', quality: 2160, url: "https://streamfree.top/embed/racing/skyf12160p" }
  ]},
  /* embdlol channels. Their ids rotate, so the address is resolved from the catalogue at play
     time and the pool is replaced with every F1 channel it lists (see linkPool). */
  /* embdlol feeds: a chip names the FEED; the catalogue says which channel carries it today. */
  ...EMB_FEEDS.map((embdlol) => ({ id: `emb-${embdlol}`, label: `${EMB_LABELS[embdlol] || embdlol.toUpperCase()} (EMB)`, embdlol, lang: (EMB_LANG[embdlol] ? 'other' : 'en') as StreamSource['lang'], links: [] })),
  { id: "emb-uhd", label: "F1 UHD 4K", gated: true, links: [] },

  /* Works, but serves heavy advertising, so it sits below the EMB feeds. */
  { id: "sky-f1-uk", label: "Sky Sports F1 UK", rp: "unsafe-url", links: [
      /* The channel name is both the label and the address, so it is written once. */
      ...['Sky Sports F1 FHD UK', 'DAZN F1 FHD', 'Viaplay Sports 1 FHD UK', 'Viaplay Sports 2 FHD UK']
        .map((label) => ({ provider: 'cdnlivetv', label, quality: 1080, url: cdnLivePlayer(label) }))
  ]},

  /* ehgembxe mints a JWT per request via 302 → /play/<jwt>; the frontend asks our server for it.
     The token has a short life, so the link is re-resolved before every attempt. */
  { id: "ehgembxe", label: "Sky Sports F1 HD (EHG)", rp: "origin", links: [
      { provider: 'ehgembxe', label: 'dynamic', addressing: 'dynamic', quality: 1080, url: 'ehgembxe/f596f98r-7758' },
      { provider: 'ehgembxe', label: 'dynamic', addressing: 'dynamic', quality: 1080, url: 'ehgembxe/f596f98r-4089' },
      { provider: 'ehgembxe', label: 'dynamic', addressing: 'dynamic', quality: 1080, url: 'ehgembxe/f596f98r-5690' }
  ]},

  /* Onboards and the data channel: the specials block, right after the broadcast feeds. */
  ...SPECIAL_SOURCES,

  { id: "sky-sports", label: "Sky Sports", rp: "unsafe-url", links: [
      { provider: 'hakunamatata', url: "https://hakunamatata5.org/hakunamatata5.html" }
  ]},

  /* taifood: the event and session are in the path. 31377 is the only id flagged 720p-safe. */
  /* Ids are the RACE block of the round taifood published when this was written (31407–31415): the
     race row first, then the practice/sprint ids as the parachute. They rotate every session, so
     they are only ever a fallback — the live catalogue leads the pool and decides what exists. */
  { id: "appletv", label: "AppleTV", taifood: "apple", rp: "unsafe-url", links: [
      { provider: 'taifood', taid: 31407 },
      { provider: 'taifood', taid: 31385 }
  ]},
  { id: "dazn", tfLang: "spanish", label: "DAZN", taifood: "dazn", lang: "other", rp: "unsafe-url", links: [
      { provider: 'taifood', taid: 31409 },
      { provider: 'taifood', taid: 31387 }
  ]},
  { id: "viaplay", tfLang: "dutch", label: "Viaplay", taifood: "viaplay", lang: "other", rp: "unsafe-url", links: [
      { provider: 'taifood', taid: 31413 },
      { provider: 'taifood', taid: 31391 }
  ]},
  { id: "sky-italia", tfLang: "italian", label: "Sky Sport Italia", taifood: "sky", lang: "other", rp: "unsafe-url", links: [
      { provider: 'taifood', taid: 31411 },
      { provider: 'taifood', taid: 31389 }
  ]},
  { id: "sky-de", tfLang: "german", label: "Sky Sport F1 DE", taifood: "sky", lang: "other", rp: "unsafe-url", links: [
      { provider: 'taifood', taid: 31410 },
      { provider: 'taifood', taid: 31388 }
  ]},
  { id: "v-sport", tfLang: "swedish", label: "V Sport Motor SE", taifood: "v", lang: "other", rp: "unsafe-url", links: [
      { provider: 'taifood', taid: 31412 },
      { provider: 'taifood', taid: 31390 }
  ]},
  /* The two languages neither of the reference sites' lists had: Polish (Eleven) and Czech (Nova). */
  { id: "eleven", tfLang: "polish", label: "Eleven Sports PL", taifood: "eleven", lang: "other", rp: "unsafe-url", links: [
      { provider: 'taifood', taid: 31415 }
  ]},
  { id: "nova", tfLang: "czech", label: "Nova Sport CZ", taifood: "nova", lang: "other", rp: "unsafe-url", links: [
      { provider: 'taifood', taid: 31414 }
  ]},

  /* Three entry points, one upstream channel (/hls/stream.m3u8?ch=spn). Failover only. */
  { id: "wikisport", label: "WikiSport", links: [
      { provider: 'wikisport', url: "https://wikisport.info/strm/f1.php" },
      { provider: 'wikisport', url: "https://wikisport.info/fsl/f1s2.php" },
      { provider: 'wikisport', url: "https://wikisport.info/fsl/f1s3.php" }
  ]},

  { id: "westream", label: "WeStream F1", links: [
      { provider: 'westream', url: "https://westreamf1.com/westreamf1.php" }
  ]},

  /* Path-scheme taifood: /embed/f1/<season>/<event>/<session> */
  { id: "ppv", label: "F1 PPV", rp: "unsafe-url", links: [
      { provider: 'taifood', ppv: true }
  ]}
];

const sourceEnabled = (s) => !s.hidden;

/* ═══ Session key ═══
   Every source URL is derived from the live event + session, and the key is stamped onto feeds
   that cannot carry a session in their path. That way a browser can never reuse the previous
   session's player document, and a stale address is visible rather than silent. */
function sessionKey(event = currentEvent, session = currentSession): string {
  return `${SITE_SEASON}-${event?.slug || 'none'}-${session?.slug || 'none'}`;
}

/* Fixed-channel feeds ignore the key upstream, but a distinct address per session stops the
   iframe and any service worker from serving a cached document from the last session. */
function stampSession(url: string, key = sessionKey()): string {
  if (!url) return '';
  const hashIndex = url.indexOf('#');
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : '';
  const base = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}s=${encodeURIComponent(key)}${hash}`;
}

/* The main source, unless Race Control has switched it off - then the first enabled one. */
function preferredSourceIndex() {
  const main = sources.findIndex((s) => s.id === DEFAULT_SOURCE_ID);
  if (main >= 0 && sourceEnabled(sources[main])) return main;
  return Math.max(0, sources.findIndex(sourceEnabled));
}

function normalizeCurrentSource() {
  if (currentSource >= 0 && currentSource < sources.length && sourceEnabled(sources[currentSource])) return;
  currentSource = preferredSourceIndex();
}

const eventSelect = $("eventSelect");
const sessionSelect = $("sessionSelect");
const linksEl = $("links");
const playerEl = $("player");
const loaderEl = $("loader");
const noStreamEl = $("noStream");
const badgeEl = $("badge");
const nsActionsEl = $("nsActions");
const nsStayBtn = $("nsStayBtn");
const noStreamTitleEl = $("noStreamTitle");
const noStreamTextEl = $("noStreamText");
const clockEl = $("clock");
const countdownEl = $("countdown");
const newsFeedEl = $("newsFeed");
const newsStatusEl = $("newsStatus");

const _def = pickDefault();
let currentEvent = _def.event;
let currentSession = _def.session;
/* One fresh mint per dynamic path per load, so an expired token cannot loop. */
const freshMints = new Set<string>();

let currentSource = sources.findIndex((s) => s.id === DEFAULT_SOURCE_ID);
let activeView = 'home';
let playerLoadToken = 0;

/* Resolve a link to an absolute address for the current session, or '' when it cannot be served.
   This is the single place a source's address is decided. */
function resolveLink(link: StreamLink, key = sessionKey()): string {
  if (link.quality && link.quality < MIN_QUALITY) return '';
  if (link.taid) return taidCandidates(link.taid)[0];
  if (link.ppv) return `https://taifood-blog.asia/embed/f1/${SITE_SEASON}/${currentEvent.slug}/${currentSession.slug}`;
  /* A link Race Control typed is opened exactly as written: no session stamp on someone else's URL. */
  return link.url ? (link.provider === 'custom' ? link.url : stampSession(link.url, key)) : '';
}

/* Race Control pastes whatever the provider shows ("embdlol.st/?q=f1", no scheme and all). */
function customLink(raw: string): string {
  const u = raw.trim();
  return u ? (/^https?:\/\//i.test(u) ? u : 'https://' + u.replace(/^\/+/, '')) : '';
}

/* A pasted link plays as given: no 4K prompt, no waiting on a catalogue. */
const isCustom = (i = currentSource) => sources[i]?.links[0]?.provider === 'custom';

function linkPool(index: number): string[] {
  const source = sources[index];
  if (!source) return [];
  /* A pasted link is the feed; the catalogue below must not overwrite it. */
  const custom = source.links.find((l) => l.provider === 'custom' && l.url);
  if (custom) {
    const url = customLink(custom.url!);
    return url ? [url] : [];
  }
  if (source.gated) {
    const url = resolveLink({ provider: 'embdlol', quality: 0, url: fourKUrl });
    return url ? [url] : [];
  }
  const key = sessionKey();
  let links = source.links.slice();

  /* Published mirrors first (they are the addresses the provider itself calls live), then the
     static list, then the provider's plain channel name as a last resort. */
  if (source.id === 'sky-uk' || source.id === 'sky-uhd') {
    const wanted = source.id === 'sky-uhd' ? 2160 : 1080;
    links = [...mirrorLinks('skyf1', wanted), ...links.filter((link) => link.quality === wanted || !link.url?.includes('embed/racing/'))];
  }

  /* A weelo special has exactly one address, and only publishes it when weelo says it can play.
     'soon' still plays: it means the feed is about to come up, and the provider page waits for it. */
  if (source.weelo) return specialDown(source) ? [] : [stampSession(`https://weellz.live/beta?stream=${source.weelo}`, key)];

  if (source.embdlol) {
    /* embdlol publishes exactly the channels that exist right now, so the picker takes the id for
       THIS feed and matches nothing else. It used to take every feed sharing a language, which is
       why each English chip offered the same channel (whole block: the one English feed) and every
       Spanish/Italian/German chip offered nothing at all (no non-English feed is up). */
    /* Not loaded yet: leave the pool empty and say "waiting", never "unavailable". */
    if (!cataloguesReady) return [];
    const id = catalogues.embdlol[source.embdlol];
    links = id ? [{ provider: 'embdlol', quality: 0, url: EMBDLOL_EMBED + id }] : [];
  }

  /* Best-known link first: a catalogue saying "online" beats a probe saying "live", and anything
     reported offline sinks to the end. Ordering only — no link is ever dropped for being dead. */
  links = links.slice().sort((a, b) => linkRank(a) - linkRank(b));

  const dynamic = links.filter((link) => link.addressing === 'dynamic');

  /* A taifood chip leads with the address the provider publishes for THIS race (it changes every
     weekend), then falls back to our id candidates. Provider's own list wins, ours is the parachute.
     Addresses naming a different session are skipped: taifood leaves the previous session in its
     list marked 'online', and that address renders black rather than failing visibly. */
  /* taifood lists every language of a broadcaster under one first word ('sky' holds English,
     German and Italian), so a chip is matched on broadcaster AND language: Sky Italia must never be
     handed the German address. A missing language means 'the broadcaster's untagged feed', which is
     what the Apple TV row is. */
  const live = source.taifood
    ? (catalogues.taifood[source.taifood] || [])
        .map((c) => ({ uri: c.uri, rank: taifoodLangRank(c.lang, source) }))
        .filter((entry) => entry.rank >= 0 && !staleSession(entry.uri, currentSession?.slug))
        /* The right language first; an untagged row is the broadcaster's main feed and is only a
           parachute, so no Italian chip can start on English audio. */
        .sort((a, b) => a.rank - b.rank)
        .map((entry) => entry.uri)
    : [];
  /* The PPV chip's address comes from their own API for the race they are serving right now. */
  if (source.id === 'ppv' && catalogues.ppv) live.unshift(catalogues.ppv);
  const pool = links.filter((link) => link.addressing !== 'dynamic')
    .flatMap((link) => (link.taid ? taidCandidates(link.taid) : [resolveLink(link, key)]))
    .filter((url) => Boolean(url) && taifoodUsable(url, source));
  if (live.length) pool.unshift(...live);
  /* A dynamic link is only usable once its token is in hand. These tokens lapse and the provider
     then shows a "Link expired" page, so a stale one is refreshed before its address is offered. */
  for (const link of dynamic) {
    const ready = cachedDynamicUrl(link.url || '');
    if (ready) pool.push(stampSession(ready, key));
    else if (link.url) void resolveDynamicLink(link.url);
  }

  const good = lastGoodLink[source.id];
  return good && pool.includes(good) ? [good, ...pool.filter((url) => url !== good)] : pool;
}

/* Warm a dynamic provider's token so the chip plays on first click. */
function prefetchDynamicLinks(index: number) {
  void Promise.all(missingTokens(index).map((link) => resolveDynamicLink(link.url as string)));
}

/* The dynamic links of a chip whose token is not in hand yet. */
const missingTokens = (index: number) =>
  (sources[index]?.links || []).filter((link) => link.addressing === 'dynamic' && link.url && !cachedDynamicUrl(link.url));

/* Anything derived from the previous session is dropped here: the 4K address, resolved dynamic
   tokens and the per-source "last good link". A new session can repoint a provider completely. */
function resetSessionState() {
  fourKUrl = '';
  fourKRequest++;
  for (const key of Object.keys(lastGoodLink)) delete lastGoodLink[key];
}

/* The link that last worked for a source, so a reload does not begin by retrying a dead address.
   Cleared on session change: a new session can repoint the provider entirely. */
const lastGoodLink: Record<string, string> = {};

function rememberGoodLink(sourceId: string, url: string) {
  lastGoodLink[sourceId] = url;
}


/* ═══ Provider health ═══
   The server probes each provider (catalogue status where it exists, a real document fetch where
   it does not). This only reorders and annotates; it never removes a source, because a probe
   failing is not the same as a feed being dead. Loaded lazily so it stays out of startup JS. */
const healthState: ProviderHealthState = { providers: {}, dynamic: {} };

function healthDeps(): HealthDeps {
  return { backend: BACKEND_API, state: healthState, onChange: () => renderButtons(), fetchWithTimeout };
}

async function loadProviderHealth() {
  const module = await import('./features/provider-health');
  await module.loadProviderHealth(healthDeps());
}

/* Best-known link first: a catalogue saying "online" beats a probe saying "live". An offline
   report sinks to the end; no link is ever dropped for being dead. */
function linkRank(link: StreamLink): number {
  const catalogue = catalogues.cdnlive[link.label];
  const probe = linkHealthStatus(link);
  return catalogue === 'online' || (!catalogue && probe === 'live') ? 0 : catalogue || probe ? 2 : 1;
}

function linkHealthStatus(link: StreamLink): string {
  if (link.provider === 'cdnlivetv') return healthState.providers[`cdnlivetv:${link.label}`]?.status || '';
  const direct = healthState.providers[link.label || link.provider];
  return direct?.status || healthState.providers[link.provider]?.status || '';
}

/* Kept for the callers that only need one address (the header label, the override path). */
const buildUrl = (i) => linkPool(i)[0] || '';

function updateHeader() {
  const parts = currentEvent.name.split(" ");
  const last = parts.slice(-2).join(" ");
  const first = parts.slice(0, -2).join(" ") || parts[0];

  const heroTitle = $("heroTitle"), heroTitle2 = $("heroTitle2");
  const heroSession = $("heroSession"), heroRound = $("heroRound");
  const stageLabel = $("stageLabel"), sourceLabel = $("sourceLabel");

  if (heroTitle) heroTitle.textContent = first;
  if (heroTitle2) heroTitle2.textContent = last;
  if (activeView === 'home') {
    document.title = currentEvent.name + " - FreeF1";
    syncDocumentMeta('home');
  }
  if (heroSession) heroSession.textContent = currentSession.name + " · " + SITE_SEASON;

  const done = currentEvent.sessions.every(isSessionEnded);
  if (heroRound) {
    heroRound.textContent = `Round ${currentEvent.round} · ${currentEvent.locality}, ${currentEvent.country}` +
      (currentEvent.sprint ? " · Sprint Weekend" : "") + (done ? " · Completed" : "");
  }

  normalizeCurrentSource();
  const src = sources[currentSource] || { id: "none", label: "-" };
  if (stageLabel) stageLabel.textContent = "freef1://live/" + currentEvent.slug + "/" + currentSession.slug + "/" + src.id;
  /* The session line under the player: the same facts the hero carries, where the video is. */
  if (sourceLabel) sourceLabel.textContent = src.label;
  /* The watch head reads off the same values the hero already uses. */
  if (badgeEl) badgeEl.style.display = isStreamAvailable(currentSession) ? "inline-flex" : "none";
}

/* ═══ 4K join nudge ═══
   The 4K chip is public: there is no membership gate, no /link code and no token. Clicking it
   offers a short "joining helps with session alerts" prompt, then plays the feed. The popup can
   be silenced with its own checkbox; the feed always continues either way. */
const FOURK_NUDGE_KEY = 'freef1_4k_nudge_off';
const DISCORD_INVITE = 'https://discord.gg/KYXHCAzhN4';
const joinNudgeOverlay = document.getElementById('joinNudge');
const joinNudgeDontShow = document.getElementById('joinNudgeDontShow') as HTMLInputElement | null;

let fourKUrl = '';
let fourKRequest = 0;

const nudgeMuted = () => store.get(FOURK_NUDGE_KEY) === '1';
const setNudgeMuted = (muted: boolean) => { muted ? store.set(FOURK_NUDGE_KEY, '1') : store.remove(FOURK_NUDGE_KEY); };

/* The address is resolved server-side because the upstream channel id rotates. */
async function fetchFourKUrl(): Promise<string> {
  if (fourKUrl) return fourKUrl;
  const seq = ++fourKRequest;
  try {
    const response = await fetchWithTimeout(`${BACKEND_API}/api/stream/uhd`, { cache: 'no-store', headers: { Accept: 'application/json' } }, 9000);
    const json = await response.json().catch(() => ({}));
    if (seq !== fourKRequest) return fourKUrl;
    if (!response.ok || !json?.url) {
      showToast(json?.error || 'The 4K feed is unavailable right now.', 'warning');
      return '';
    }

    fourKUrl = String(json.url);
    return fourKUrl;
  } catch (_) {
    showToast('Could not reach the 4K service. Try again.', 'warning');
    return '';
  }
}

/* 4K is a single HEVC rendition: no decoder means a black frame. The probe is a hint, never a gate —
   the chip always tries, since TV/console browsers decode HEVC in hardware. */
let hevcSupport: boolean | null = null;
function canPlayHevc(): boolean {
  if (hevcSupport !== null) return hevcSupport;
  try {
    const video = document.createElement('video');
    hevcSupport = video.canPlayType('video/mp4; codecs="hvc1.1.6.L153.B0"') !== '' ||
                  video.canPlayType('video/mp4; codecs="hev1.1.6.L153.B0"') !== '';
  } catch (_) {
    hevcSupport = false;
  }
  return hevcSupport;
}

const HEVC_WARNING = '4K is HEVC: if the picture stays black, watch in Safari.';

function closeJoinNudge() {
  if (joinNudgeOverlay) closeModal(joinNudgeOverlay);
}

function openJoinNudge(onContinue: () => void) {
  if (!joinNudgeOverlay) { onContinue(); return; }
  if (joinNudgeDontShow) joinNudgeDontShow.checked = false;
  openModal(joinNudgeOverlay);

  const continueBtn = document.getElementById('joinNudgeContinue');
  const joinBtn = document.getElementById('joinNudgeJoin');
  const closeBtn = document.getElementById('joinNudgeClose');
  const proceed = () => {
    if (joinNudgeDontShow?.checked) setNudgeMuted(true);
    closeJoinNudge();
    onContinue();
  };

  /* Replace the handlers with fresh closures so a second click never stacks up. */
  if (continueBtn) continueBtn.onclick = proceed;
  if (closeBtn) closeBtn.onclick = () => closeJoinNudge();
  if (joinBtn) joinBtn.onclick = () => {
    window.open(DISCORD_INVITE, '_blank', 'noopener');
    proceed();
  };
  if (joinNudgeOverlay) {
    joinNudgeOverlay.onclick = (event) => {
      if (event.target === joinNudgeOverlay) closeJoinNudge();
    };
  }
}

/* Clicking the 4K chip: nudge (once a click, unless silenced) → play. */
async function playFourK() {
  const index = sources.findIndex((source) => source.gated);
  if (index < 0) return;
  const url = await fetchFourKUrl();
  if (!url) return;
  currentSource = index;
  renderButtons();
  updateHeader();
  load();
  if (!canPlayHevc()) showToast(HEVC_WARNING, 'warning');
}

/* ehgembxe mints a JWT per request (302 → /play/<jwt>), so the address cannot be stored.
   The server does the hop; the lazy module below holds the result briefly. */
async function resolveDynamicLink(path: string): Promise<string> {
  return (await import('./features/provider-health')).resolveDynamicLink(healthDeps(), path);
}

function cachedDynamicUrl(path: string): string {
  const cached = healthState.dynamic[path];
  /* Same window as the token: an ehgembxe JWT is dead after ~15-30 seconds. */
  return cached && Date.now() - cached.at < 8_000 ? cached.url : '';
}

function chooseFourK() {
  if (nudgeMuted()) { void playFourK(); return; }
  openJoinNudge(() => { void playFourK(); });
}

/* ═══ Reset ═══
   /?reset=discord forgets any legacy Discord link state; /?reset=all also drops the livery,
   saved preferences and cached API data. */
async function handleResetRequest() {
  let mode = '';
  try { mode = new URLSearchParams(location.search).get('reset') || ''; } catch (_) {}
  if (!mode) return;

  const clean = (() => {
    try {
      const url = new URL(location.href);
      url.searchParams.delete('reset');
      return url.pathname + (url.search || '') + url.hash;
    } catch (_) { return '/'; }
  })();

  try {
    if (mode === 'all') {
      Object.keys(localStorage).filter((key) => key.startsWith('freef1')).forEach((key) => localStorage.removeItem(key));
      sessionStorage.clear();
    } else {
      /* Leftover tokens from the retired Superlicense gate, plus the nudge opt-out. */
      localStorage.removeItem('freef1_dg_token');
      setNudgeMuted(false);
    }
  } catch (_) {}

  location.replace(clean);
}

/* A chip only counts as English when it says so; anything unlabelled shows under All, where no
   language is promised. */
/* An unlabelled chip is English by default; only a chip that says 'other' leaves the tab. */
const inTab = (s: StreamSource, tab = sourceTab) => tab === 'all' || (s.lang || 'en') === (tab === 'en' ? 'en' : 'other');

/* weelo says 'online' or 'soon' for a feed worth opening; 'offline' and 'dark' are not. */
/* weelo's event feed names the live ids for the current race; its status map is a stale cache that
   says 'dark' for everything. The event feed wins when it knows the id. */
const specialState = (s: StreamSource) => {
  const known = s.weelo ? catalogues.weeloEvents[s.weelo] : undefined;
  if (known) return known.live ? 'live' : 'offline';
  return (s.weelo && catalogues.weelo[s.weelo]) || '';
};
const specialDown = (s: StreamSource) => /^(offline|dark)$/.test(specialState(s));

function renderTabBar() {
  /* Language tabs only: the multi-viewer is a button beside the player, in its own lazy chunk.
     The sliding ink under the active tab is a ::before on the bar, moved by :has() in CSS. */
  const tabs = ['English', 'Other', 'All'];
  $('feedTabs')?.replaceChildren(...tabs.map((label) => {
    const b = document.createElement('button');
    /* The state value is 'en', not the label: keying off the label made English filter as Other. */
    const id = label === 'English' ? 'en' : label.toLowerCase();
    b.type = 'button';
    b.className = 'chip' + (id === sourceTab ? ' active' : '');
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(id === sourceTab));
    b.textContent = label;
    /* Switching a tab redraws the row; the player is untouched. */
    b.onclick = () => {
      sourceTab = id;
      renderButtons();
    };
    return b;
  }));
}

function renderButtons() {
  if (!linksEl) return;
  linksEl.replaceChildren();
  normalizeCurrentSource();
  renderTabBar();

  const visible = sources.map((_s, i) => i).filter((i) => sourceEnabled(sources[i]) && inTab(sources[i]));

  const chipFor = (s: StreamSource, i: number) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (i === currentSource ? " active" : "");
    if (s.gated && !canPlayHevc()) b.title = HEVC_WARNING;
    /* Specials carry weelo's own state, so a chip that cannot play never looks clickable. */
    if (s.special) {
      b.className += ` chip-special chip-${s.special}`;
      if (specialDown(s)) b.className += ' is-down', b.title = `weelo: ${specialState(s)}`;
    }
    b.textContent = s.label;
    b.onclick = async () => {
      if (specialDown(s)) return showNoStream({ title: 'Not on air', text: `${s.label} is ${specialState(s)} at weelo, so there is nothing to play yet. It comes up around each session; reload to re-check.` });
      /* The 4K chip asks once whether they want session alerts before playing. */
      if (s.gated && !isCustom(i)) return chooseFourK();
      currentSource = i;
      renderButtons();
      updateHeader();
      /* load() mints the token and opens the player in the same tick. Prefetching first would spend
         the credential before the iframe asked for it, and these tokens die in seconds. */
      load();
    };
    return b;
  };

  /* Broadcasters in row order, then the specials in their own block, so an onboard cannot be
     mistaken for another broadcaster. */
  const broadcasters = visible.filter((i) => !sources[i].special);
  const specials = visible.filter((i) => sources[i].special);
  broadcasters.forEach((i) => linksEl.appendChild(chipFor(sources[i], i)));

  if (specials.length) {
    const block = document.createElement('div');
    block.className = 'special-row';
    block.innerHTML = '<span class="special-head">Onboards &amp; data</span>';
    specials.forEach((i) => block.appendChild(chipFor(sources[i], i)));
    linksEl.appendChild(block);
  }
}

let multiviewer: Promise<any> | undefined;

/* Lazy: the grid, its button state and its own close control all live in one chunk, downloaded the
   first time somebody opens the grid (or straight away for a ?mv=1 address). */
function openMultiViewer() {
  void (multiviewer ??= import('./features/multiviewer').then((m) => m.init(featureContext))).then((m) => m?.show(true));
}

/* The same button closes the grid it opened. Once the chunk is loaded it is asked to toggle; the
   chunk decides whether there is anything to grid (Race Control can turn every weelo feed off). */
$('mvToggle')?.addEventListener('click', () => {
  if (multiviewer) void multiviewer.then((m) => m?.toggle());
  else openMultiViewer();
});

/* Theater mode: the window fills the viewport, the rail and sources step aside. Escape puts it back. */
const theaterBtn = $('theaterBtn');
const sourcesBtn = $('sourcesToggle');
const setTheater = (on: boolean) => {
  document.body.classList.toggle('theater', on);
  if (theaterBtn) theaterBtn.ariaPressed = String(on);
  /* The sources switch only exists in theater; leaving theater always brings the rail back. */
  if (sourcesBtn) sourcesBtn.hidden = !on;
  if (!on) {
    document.body.classList.remove('theater-no-sources');
    if (sourcesBtn) sourcesBtn.ariaPressed = 'true';
  }
};
if (theaterBtn) theaterBtn.onclick = () => setTheater(!document.body.classList.contains('theater'));

/* Hide the sources in theater and the window takes the whole width back. */
if (sourcesBtn) sourcesBtn.onclick = () => {
  const off = document.body.classList.toggle('theater-no-sources');
  sourcesBtn.ariaPressed = String(!off);
};
document.onkeydown = () => setTheater(false);
/* A ?mv=1 address opens the grid once the first config has landed. */
setTimeout(() => location.search.includes('mv=1') && openMultiViewer(), 900);

let nsTimer = null;
let nsPaused = false;
let nsRunning = false;

function stopNS() {
  if (nsTimer) {
    clearTimeout(nsTimer);
    nsTimer = null;
  }
  nsRunning = false;
}

function startNS() {
  stopNS();
  nsPaused = false;
  nsRunning = true;
  const t = $("noStreamTitle");
  const x = $("noStreamText");
  const msgs = NO_STREAM_MESSAGES;
  let i = 0;
  (function next() {
    if (!nsRunning) return;
    if (nsPaused) {
      nsTimer = window.setTimeout(next, 500);
      return;
    }
    if (t && x) {
      [t, x].forEach((e) => {
        e.style.opacity = "0";
        e.style.transform = "translateY(8px)";
      });
    }
    nsTimer = window.setTimeout(() => {
      if (!nsRunning) return;
      i = (i + 1) % msgs.length;
      if (t) t.textContent = msgs[i].t;
      if (x) x.textContent = msgs[i].x;
      if (t && x) {
        [t, x].forEach((e) => {
          e.style.opacity = "1";
          e.style.transform = "none";
        });
      }
      nsTimer = window.setTimeout(next, 5000);
    }, 1100);
  })();
}

noStreamEl?.addEventListener("mouseenter", () => { nsPaused = true; });
noStreamEl?.addEventListener("mouseleave", () => { nsPaused = false; });
document.addEventListener("visibilitychange", () => { nsPaused = document.hidden; });

nsActionsEl?.addEventListener("click", (e) => {
  if ((e.target as HTMLElement).id === "nsRetryBtn") {
    load();
  } else if ((e.target as HTMLElement).id === "nsNextBtn") {
    switchToNextSource();
  } else if ((e.target as HTMLElement).id === "nsStayBtn") {
    hideNoStream();
    setStreamOnScreen(true);
  }
});

function switchToNextSource() {
  const enabled = [];
  sources.forEach((s, i) => { if (sourceEnabled(s)) enabled.push(i); });
  if (enabled.length <= 1) return;
  const currIdx = enabled.indexOf(currentSource);
  const nextIdx = (currIdx + 1) % enabled.length;
  currentSource = enabled[nextIdx];
  renderButtons();
  updateHeader();
  load();
}

function showNoStream(opts: { blocked?: boolean; title?: string; text?: string; hijack?: boolean; keepFrame?: boolean } = {}) {
  /* Blocked is the default: the auto-cycling "no session" panel is the one case that opts out. */
  const blocked = opts.blocked !== false;
  const hijack = Boolean(opts && opts.hijack);
  loaderEl?.classList.add("hidden");
  noStreamEl?.classList.add("visible");
  if (nsActionsEl) nsActionsEl.hidden = !blocked;
  if (nsStayBtn) nsStayBtn.hidden = !hijack;
  setStreamOnScreen(false);
  if (!(opts && opts.keepFrame)) {
    playerEl?.querySelector("iframe")?.remove();
    playerEl?.querySelector("video")?.remove();
  }
  if (blocked) {
    stopNS();
    if (noStreamTitleEl) noStreamTitleEl.textContent = (opts && opts.title) || (hijack ? HIJACK_TITLE : BLOCKED_TITLE);
    if (noStreamTextEl) noStreamTextEl.textContent = (opts && opts.text) || (hijack ? HIJACK_COPY : BLOCKED_COPY_TEXT);
  } else {
    startNS();
  }
}

function hideNoStream() {
  noStreamEl?.classList.remove("visible");
  if (nsActionsEl) nsActionsEl.hidden = true;
  if (nsStayBtn) nsStayBtn.hidden = true;
  stopNS();
}

function setStreamOnScreen(on) {
  document.body.classList.toggle('has-stream', on);
  // keep screen awake only while a stream is actually on-screen
  if(on) requestScreenWakeLock().catch(()=>{});
  else syncScreenWakeLock();
}

// ── Keep the display awake only while the main cockpit stream is visible.
var screenWakeLock = null;
var screenWakeFallbackVideo = null;
async function requestScreenWakeLock(){
  // Native Wake Lock (Chrome/Android, Safari 16.4+)
  try{
    if('wakeLock' in navigator){
      if(screenWakeLock && !screenWakeLock.released) return true;
      screenWakeLock = await navigator.wakeLock.request('screen');
      screenWakeLock.addEventListener('release', ()=>{ screenWakeLock = null; });
      // iOS/Safari drops lock on visibility hide — re-arm handled below
      return true;
    }
  }catch(_){}
  // iOS <16.4 fallback: silent looping video tricks WebKit into keeping screen on (NoSleep)
  try{
    if(!screenWakeFallbackVideo){
      const v = document.createElement('video');
      v.setAttribute('playsinline',''); v.setAttribute('webkit-playsinline','');
      v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true;
      v.style.cssText='position:fixed;top:-10px;left:-10px;width:1px;height:1px;opacity:0.01;pointer-events:none;';
      // 1px silent mp4 — tiny data-uri so it works offline
      v.src = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAu1tZGF0AAAAsAAAAEAGAEcEBwoAAAAPhYb+ABgAAAAEABAAAAAQABAAAAAQABAAAAAQABAAAAAQABAAAAAQABAAAAAQAAAAEAAAAP8AAP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A';
      document.body.appendChild(v);
      screenWakeFallbackVideo = v;
    }
    await screenWakeFallbackVideo.play().catch(()=>{});
    return true;
  }catch(_){ return false; }
}
function releaseScreenWakeLock(){
  try{ if(screenWakeLock && !screenWakeLock.released) screenWakeLock.release().catch(()=>{}); }catch(_){}
  screenWakeLock = null;
  try{ if(screenWakeFallbackVideo) screenWakeFallbackVideo.pause(); }catch(_){}
}
function syncScreenWakeLock(){
  const want = document.body.classList.contains('has-stream');
  if(want) requestScreenWakeLock().catch(()=>{}); else releaseScreenWakeLock();
}
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState === 'visible') syncScreenWakeLock();
  else { /* Safari releases on hide — will re-request on show */ }
});
// Release events belong to the WakeLockSentinel, not navigator.wakeLock.
// Try immediately on load (will be blocked without gesture on most browsers — caught below)
// + re-try on the very first user tap/key anywhere so it IS active as soon as they interact,
// even before they hit Play. Once a stream is on, syncScreenWakeLock keeps it held.
window.setTimeout(()=>{ requestScreenWakeLock().catch(()=>{}); }, 800);
['click','touchstart','pointerdown','keydown','touchend'].forEach(ev=>{
  document.addEventListener(ev, ()=>{
    // if a stream is already on, this arms it; if not, it pre-warms so the next Play is instant
    requestScreenWakeLock().catch(()=>{});
  }, { once:true, passive:true, capture:true });
});

function setLoaderText(text) {
  const el = $("loaderText");
  if (el) el.textContent = text;
}

function iframeCommitted(f) {
  if (!f || !f.isConnected) return false;
  try {
    const href = f.contentWindow ? f.contentWindow.location.href : "";
    return href !== "" && href !== "about:blank";
  } catch (_) {
    return true;
  }
}

/* A provider's anti-embed check can read an EMPTY referrer as "sandboxed": ehgembxe answers
   no-referrer with "Remove sandbox attributes on the iframe tag" and mounts no player, while the
   same token plays with an origin referrer (verified in a real browser, not headless). 'origin'
   sends only our domain — enough to look embedded, and no path or query ever leaves the site. */
function makeStreamIframe(url, rp) {
  const f = document.createElement("iframe");
  f.src = url;
  f.allow = IFRAME_ALLOW;
  f.setAttribute('allow', IFRAME_ALLOW);
  f.allowFullscreen = true;
  f.referrerPolicy = rp || "origin";
  f.title = "Live stream";
  return f;
}

function watchFrameNavigation(f, token, isSettled) {
  let navs = 0;
  f.addEventListener("load", () => {
    if (token !== playerLoadToken || !isSettled()) return;
    navs++;
    if (navs === 1) return;
    showNoStream({ hijack: true, keepFrame: true });
  });
}

function attemptSource(token, order, idx, startedAt, linkIdx = 0) {
  if (token !== playerLoadToken) return;
  if (idx >= order.length) return showNoStream({ text: BLOCKED_COPY });
  const sourceIndex = order[idx];
  const pool = linkPool(sourceIndex);
  if (linkIdx >= pool.length) {
    /* A chip with nothing upstream says so instead of silently playing another provider. */
    if (!idx && sources[sourceIndex].gated) return showNoStream({ title: '4K is not upstream', text: 'embdlol is not publishing a 4K channel for this race. It appears a few hours before lights out — the UHD chip will come back on its own, nothing to reload.' });
    if (!idx && !isCustom(sourceIndex) && (sources[sourceIndex].embdlol || sources[sourceIndex].weelo)) return showNoStream({ title: 'No link upstream', text: 'This feed has no channel upstream right now.' });
    attemptSource(token, order, idx + 1, startedAt, 0);
    return;
  }

  const targetUrl = pool[linkIdx];
  setLoaderText(!idx && !linkIdx ? "Establishing feed…" : idx === order.length - 1 && linkIdx === pool.length - 1 ? "Every feed is unreachable…" : "Switching link…");

  const f = makeStreamIframe(targetUrl, sources[sourceIndex].rp);
  let settled = false;

  const reveal = () => {
    settled = true;
    if (currentSource !== sourceIndex) {
      currentSource = sourceIndex;
      renderButtons();
      updateHeader();
    }
    rememberGoodLink(sources[sourceIndex].id, targetUrl);
    f.classList.add('loaded');
    setStreamOnScreen(true);
    requestScreenWakeLock().catch(()=>{});
    window.setTimeout(() => {
      if (token === playerLoadToken) loaderEl?.classList.add('hidden');
    }, 180);
  };

  /* A minted token can die between minting and the frame's request (ehgembxe's last ~15-30s), and
     the provider answers the dead one with a 403 "Link Expired" page. That is worth ONE fresh mint,
     not a jump to another provider: the address was right, only the credential aged out. */
  const dynamicPath = (sources[sourceIndex].links || []).find((link) => link.addressing === 'dynamic' && cachedDynamicUrl(link.url || '') === targetUrl)?.url;

  const advance = (removed = true) => {
    if (token !== playerLoadToken || settled) return;
    settled = true;
    if (removed) f.remove();
    if (dynamicPath) {
      /* Drop the cached (now dead) credential so the next attempt mints a new one. */
      delete healthState.dynamic[dynamicPath];
      if (!freshMints.has(dynamicPath)) {
        freshMints.add(dynamicPath);
        attemptSource(token, order, idx, Date.now(), 0);
        return;
      }
      freshMints.delete(dynamicPath);
    }
    attemptSource(token, order, idx, startedAt, linkIdx + 1);
  };

  let loaded = false;

  f.onload = () => {
    loaded = true;
    if (iframeCommitted(f)) reveal();
  };
  f.onerror = () => advance();

  watchFrameNavigation(f, token, () => settled);

  /* A live provider answers in a second or two, so an address that has committed no document at all
     after 4s is dead and the next link is tried. A committed frame is kept even without a load
     event: ehgembxe's player runs a wasm challenge and never fires one, and discarding it there
     threw away a working feed. The 9s ceiling reveals whatever committed, else moves on. */
  window.setTimeout(() => {
    if (settled) return;
    if (!loaded && !iframeCommitted(f)) advance();
  }, NAV_SOFT_MS);
  window.setTimeout(() => {
    if (settled) return;
    if (f.isConnected && iframeCommitted(f)) reveal();
    else advance();
  }, NAV_TIMEOUT_MS);

  playerEl?.appendChild(f);
  setStreamOnScreen(true);
}

function load() {
  const token = ++playerLoadToken;
  loaderEl?.classList.remove("hidden");
  hideNoStream();
  setLoaderText(LOADER_LINES[Math.floor(Math.random() * LOADER_LINES.length)]);
  playerEl?.querySelector("iframe")?.remove();
  playerEl?.querySelector("video")?.remove();

  const videoMime = streamOverride.type === 'webm' ? 'video/webm' : streamOverride.type === 'mp4' ? 'video/mp4' : '';
  if (streamOverride.active && streamOverride.url) {
    const f = document.createElement(videoMime ? 'video' : 'iframe') as HTMLVideoElement & HTMLIFrameElement;
    if (videoMime) {
      f.controls = true;
      f.autoplay = true;
      f.playsInline = true;
      f.preload = 'metadata';
      f.setAttribute('playsinline', '');
      f.setAttribute('webkit-playsinline', '');
      f.setAttribute('x5-playsinline', '');
      f.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0';
      const s = document.createElement('source');
      s.src = streamOverride.url;
      s.type = videoMime;
      f.appendChild(s);
      f.oncanplay = () => {
        if (token === playerLoadToken) {
          loaderEl?.classList.add('hidden');
        }
      };
      f.onerror = () => {
        if (token === playerLoadToken) showNoStream({ text: BLOCKED_COPY });
      };
    } else {
      f.src = streamOverride.url;
      f.allow = IFRAME_ALLOW;
      f.setAttribute('allow', IFRAME_ALLOW);
      f.allowFullscreen = true;
      /* Same rule as a source iframe: an empty referrer can be read as a sandboxed frame. */
      f.referrerPolicy = 'origin';
      f.title = "Live stream";
      f.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;opacity:0;transition:opacity .7s ease';
      f.onload = () => {
        if (token !== playerLoadToken || f.style.opacity === '1') return;
        if (!iframeCommitted(f)) return;
        f.style.opacity = '1';
        window.setTimeout(() => {
          if (token === playerLoadToken) loaderEl?.classList.add('hidden');
        }, 180);
      };
      {
        let settled = false;
        let navs = 0;
        const wasSettled = () => settled;
        const origLoad = f.onload;
        f.onload = (e) => {
          origLoad.call(f, e);
          if (f.style.opacity === '1') settled = true;
        };
        f.addEventListener("load", () => {
          if (token !== playerLoadToken || !wasSettled()) return;
          navs++;
          if (navs === 1) return;
          showNoStream({ hijack: true, keepFrame: true });
        });
      }
      window.setTimeout(() => {
        if (token !== playerLoadToken || !f.isConnected || f.style.opacity === '1') return;
        if (iframeCommitted(f)) {
          f.style.opacity = '1';
          loaderEl?.classList.add('hidden');
          return;
        }
        f.remove();
        showNoStream({ text: BLOCKED_COPY });
      }, NAV_TIMEOUT_MS);
    }
    playerEl?.appendChild(f);
    setStreamOnScreen(true);
    return;
  }

  if (!isStreamAvailable(currentSession)) {
    showNoStream({ blocked: false });
    return;
  }

  normalizeCurrentSource();
  const order = [];
  if (sourceEnabled(sources[currentSource])) order.push(currentSource);
  for (let i = 0; i < sources.length; i++) {
    if (i !== currentSource && sourceEnabled(sources[i])) order.push(i);
  }
  if (!order.length) {
    showNoStream({
      blocked: true,
      title: "Every feed is switched off",
      text: "Race control has disabled all stream sources. Nothing to play until one is re-enabled."
    });
    return;
  }
  /* An EMB chip waits for the catalogue; a pasted link never waits for anything. */
  if (!cataloguesReady && sources[currentSource]?.embdlol && !isCustom()) {
    setLoaderText('Loading channels…');
    return void loadCatalogues().then(() => token === playerLoadToken && load());
  }

  /* A dynamic provider has no address until its token is fetched, so fetch it first — otherwise the
     ladder skips the chip and plays a different provider. */
  const missing = missingTokens(currentSource);
  if (missing.length) {
    setLoaderText('Fetching a token…');
    return void Promise.all(missing.map((link) => resolveDynamicLink(link.url as string))).then((urls) => {
      if (token !== playerLoadToken) return;
      urls.some(Boolean) ? load() : attemptSource(token, order, 0, performance.now());
    });
  }
  attemptSource(token, order, 0, performance.now());
}

/* ═══════════════ 7. OPTIONAL RACE-CONTROL SNAPSHOT ═══════════════ */
/* Playback feeds and motorsport data are fetched directly by the browser.
   Race Control supplies compact config snapshots over a push-only update
   stream; if Render is unavailable the site continues with local defaults and
   its last saved snapshot. No visitor analytics, heartbeat, or polling. */
let streamOverride = { active: false, url: null, type: null };
let lastOverrideToastKey = '';

function updateOverridePill(override) {
  const pill = document.getElementById('overridePill');
  if (!pill) return;
  if (override && override.active) {
    pill.className = 'wplayer-live active';
    pill.textContent = `● Override · ${(override.type || 'custom').toUpperCase()}`;
  } else {
    const live = getCurrentLiveSession();
    pill.className = 'wplayer-live';
    pill.textContent = live ? 'Live' : 'No live session';
  }
}

function safeHttpsUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' ? url.href : null;
  } catch (_) {
    return null;
  }
}

function applyStreamOverride(override) {
  const url = safeHttpsUrl(override?.url);
  const next = {
    active: Boolean(override?.active && url),
    url,
    type: String(override?.type || 'custom').slice(0, 12)
  };
  const prevActive = streamOverride.active;
  const changed = next.active !== streamOverride.active || next.url !== streamOverride.url || next.type !== streamOverride.type;
  streamOverride = next;
  updateOverridePill(streamOverride);
  if (!changed) return;

  const toastKey = streamOverride.active ? `${streamOverride.type}:${streamOverride.url}` : 'inactive';
  if (toastKey !== lastOverrideToastKey) {
    lastOverrideToastKey = toastKey;
    if (streamOverride.active) showToast(`Race Control override active · ${streamOverride.type}`, 'warning');
    else if (prevActive) showToast('Race Control override ended · normal feed restored.', 'success');
  }
  load();
}

function applyStreamWindow(payload) {
  const active = payload?.active === true;
  const next = {
    active,
    reason: active ? String(payload?.reason || '').slice(0, 120) : '',
    startedAt: active ? Number(payload?.startedAt) || Date.now() : null,
    updatedAt: Number(payload?.updatedAt) || null
  };
  const activeChanged = next.active !== streamWindowState.active;
  const detailsChanged = activeChanged || next.reason !== streamWindowState.reason || next.startedAt !== streamWindowState.startedAt;
  if (!detailsChanged) return;
  streamWindowState = next;
  updateHeader();
  updateCurrentStreamButton();
  if (activeChanged && !streamOverride.active) load();
}

function applyMaintenanceMode(state, { fresh = false } = {}) {
  // Cached state may be stale while Race Control is offline; only a live
  // snapshot can redirect a public session into maintenance.
  if (fresh && state?.active && location.pathname !== '/maintenance.html') {
    location.replace('/maintenance.html');
  }
}

/* Names, links and visibility live in features/chips.ts, fetched on the first snapshot. */
function applySourceConfig(payload) {
  void import('./features/chips').then(({ applySourceConfig: apply }) => apply(payload, {
    sources,
    current: () => currentSource,
    usable: (source) => Boolean(source) && sourceEnabled(source),
    normalize: normalizeCurrentSource,
    render: () => { renderButtons(); updateHeader(); },
    reload: load
  }));
}

function applySiteConfig(input: unknown, { fresh = false } = {}) {
  const config = parseSiteConfig(input);
  if (!config) return;
  if (config.streamWindow) applyStreamWindow(config.streamWindow);
  if (config.sources) applySourceConfig(config.sources);
  if (config.streamOverride) applyStreamOverride(config.streamOverride);
  if (PUBLIC_NEWS_ENABLED && Array.isArray(config.news)) applyNewsUpdate(config.news, fresh);
  if (fresh) applyMaintenanceMode(config.maintenance, { fresh: true });
}

let siteConfigRefreshPromise = null;
let lastSiteConfigRefreshAt = 0;

function acceptFreshSiteConfig(input: unknown) {
  const config = parseSiteConfig(input);
  if (!config) return false;
  const saved = { savedAt: Date.now(), config };
  try { store.set(SITE_CONFIG_CACHE_KEY, JSON.stringify(saved)); } catch (_) {}
  applySiteConfig(config, { fresh: true });
  return true;
}

async function refreshSiteConfig({ force = false } = {}) {
  if (siteConfigRefreshPromise) return siteConfigRefreshPromise;
  const now = Date.now();
  if (!force && now - lastSiteConfigRefreshAt < SITE_CONFIG_FOCUS_COOLDOWN_MS) return false;
  lastSiteConfigRefreshAt = now;

  const pending = (async () => {
    try {
      const response = await fetchWithTimeout(`${BACKEND_API}/api/site/config`, {
        cache: 'no-cache',
        credentials: 'omit',
        headers: { Accept: 'application/json' }
      }, SITE_CONFIG_TIMEOUT_MS);
      if (!response.ok) throw new Error(`Race Control returned ${response.status}`);
      acceptFreshSiteConfig(await response.json());
      return true;
    } catch (_) {
      // The site remains usable from its local/default data when the optional
      // Race Control service is offline; this fallback does not poll.
      updateNewsStatus(false);
      return false;
    }
  })();

  siteConfigRefreshPromise = pending;
  try {
    return await pending;
  } finally {
    if (siteConfigRefreshPromise === pending) siteConfigRefreshPromise = null;
  }
}

function connectSiteConfigEvents() {
  if (document.hidden || siteConfigEventSource) return;
  if (typeof window.EventSource !== 'function') {
    void refreshSiteConfig({ force: true });
    return;
  }

  try {
    const stream = new window.EventSource(SITE_CONFIG_UPDATES_URL);
    siteConfigEventSource = stream;
    stream.addEventListener('config', (event) => {
      try {
        acceptFreshSiteConfig(JSON.parse(event.data));
      } catch (_) {
        updateNewsStatus(false);
      }
    });
    stream.addEventListener('error', () => {
      // EventSource performs its own bounded reconnect. No heartbeat or
      // application-level polling is added while Race Control is unavailable.
      updateNewsStatus(false);
    });
  } catch (_) {
    siteConfigEventSource = null;
    void refreshSiteConfig({ force: true });
  }
}

function bootstrapSiteConfig() {
  let cached = null;
  try {
    const saved = JSON.parse(store.get(SITE_CONFIG_CACHE_KEY) || 'null');
    if (saved?.config && Number.isFinite(Number(saved.savedAt)) && Date.now() - Number(saved.savedAt) <= SITE_CONFIG_CACHE_MAX_AGE_MS) cached = saved;
  } catch (_) {}

  // Paint a local snapshot immediately, then use a single config-only stream
  // for the authoritative snapshot and subsequent Race Control edits.
  if (cached) applySiteConfig(cached.config, { fresh: false });
  connectSiteConfigEvents();
}

function refreshSiteConfigOnReturn() {
  if (document.hidden) return;
  if (typeof window.EventSource === 'function') connectSiteConfigEvents();
  else void refreshSiteConfig();
}

document.addEventListener('visibilitychange', refreshSiteConfigOnReturn, { passive: true });
window.addEventListener('focus', refreshSiteConfigOnReturn, { passive: true });
window.addEventListener('online', refreshSiteConfigOnReturn, { passive: true });

/* ═══════════════ 9. CLOCKS & COUNTDOWN ═══════════════ */
function updateCountdown() {
  if (!countdownEl) return;
  const live = getCurrentLiveSession();
  if (live && (live.forced || hoursSince(live.session) >= 0)) {
    const startedAt = live.forced ? (streamWindowState.startedAt || Date.now()) : live.session.ts;
    const elapsed = Math.max(0, Date.now() - startedAt);
    const h = Math.floor(elapsed / 3600000);
    const m = Math.floor((elapsed % 3600000) / 60000);
    const s = Math.floor((elapsed % 60000) / 1000);
    const p = (v) => String(v).padStart(2, "0");
    countdownEl.textContent = `${live.event.name} ${live.session.name} · ${live.forced ? 'FORCED LIVE' : 'LIVE NOW'} (${h > 0 ? h + ':' : ''}${p(m)}:${p(s)})`;
    return;
  }
  const n = getNextSession();
  if (!n) {
    countdownEl.textContent = "No upcoming session";
    return;
  }
  const diff = n.session.ts - Date.now();
  if (diff <= 0) {
    countdownEl.textContent = `${n.event.name} ${n.session.name} · Lights out!`;
    return;
  }
  const T = Math.floor(diff / 1000);
  const d = Math.floor(T / 86400);
  const h = Math.floor((T % 86400) / 3600);
  const m = Math.floor((T % 3600) / 60);
  const s = T % 60;
  const p = (v) => String(v).padStart(2, "0");
  countdownEl.textContent = `${n.event.name} ${n.session.name} · ${d > 0 ? d + "d " : ""}${p(h)}:${p(m)}:${p(s)}`;
}

function updateClocks() {
  if (document.hidden) return;
  if (clockEl) clockEl.textContent = clockFormat.format(Date.now());
  updateCountdown();
}

/* ═══════════════ 10. CUSTOM ACCESSIBLE SELECT COMPONENTS ═══════════════ */
function populate() {
  if (!eventSelect) return;
  eventSelect.innerHTML = "";
  schedule.forEach((ev) => {
    const o = document.createElement("option");
    o.value = ev.slug;
    const done = ev.sessions.every(isSessionEnded);
    o.disabled = done;
    o.textContent = `R${ev.round} · ${ev.name}` + (done ? " (finished)" : "");
    if (ev.slug === currentEvent.slug) o.selected = true;
    eventSelect.appendChild(o);
  });
  updateSessions();
  updateCurrentStreamButton();
}

function updateSessions() {
  if (!sessionSelect) return;
  sessionSelect.innerHTML = "";
  currentEvent.sessions.forEach((s) => {
    const o = document.createElement("option");
    o.value = s.slug;
    o.textContent = s.name;
    if (s.slug === currentSession.slug) o.selected = true;
    if (isSessionEnded(s)) {
      o.disabled = true;
      o.textContent = s.name + " (ended)";
    }
    sessionSelect.appendChild(o);
  });
}

/* ═══════════════ 11. TICKER & SCROLL EFFECTS ═══════════════ */
(function initTicker() {
  const items = [
    "Live multi-source switching",
    "Zero ads · privacy-first",
    "Championship telemetry",
    "Session results archive",
    "12 team liveries",
    "Built for race weekends",
    "Every practice, quali & race"
  ];
  const html = [...items, ...items].map((t) => `<span>${t}</span>`).join("");
  const tickerTrack = $("tickerTrack");
  if (!tickerTrack) return;
  tickerTrack.innerHTML = html;
  // CSS handles the transform-only loop and reduced-motion behavior, avoiding
  // a per-frame JavaScript layout read.
})();

const navEl = $('nav');
const navToggle = $('navToggle');
const mobileMenu = $('mobileMenu');

function closeNav() {
  mobileMenu?.classList.remove('open');
  navToggle?.setAttribute('aria-expanded', 'false');
  navToggle?.setAttribute('aria-label', 'Open navigation');
}

navToggle?.addEventListener('click', () => {
  const open = !mobileMenu?.classList.contains('open');
  mobileMenu?.classList.toggle('open', open);
  navToggle.setAttribute('aria-expanded', String(open));
  navToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
});

mobileMenu?.querySelectorAll<HTMLElement>('a').forEach((link) => link.addEventListener('click', closeNav));
document.addEventListener('click', (event) => {
  if (!navEl?.contains(event.target as Node)) closeNav();
});
addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeNav();
});

const revealEls = document.querySelectorAll<HTMLElement>('.rv');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });
  revealEls.forEach((element) => io.observe(element));
} else {
  revealEls.forEach((element) => element.classList.add('in'));
}

const progressEl = $('progress');
const heroLayer = $('heroLayer');
const breakLayer = $('breakLayer');

/* Scroll metrics are cached, not measured.
   The previous version called document.documentElement.scrollHeight and
   getBoundingClientRect() inside every animation frame, which forces the browser to finish
   layout before it can answer - the classic cause of a hitch while scrolling. Page height and
   the break section's offset are now recomputed only when the document actually changes size
   (resize, route swap, content arriving), and every style write is skipped when unchanged. */
let pageHeight = 0;
let breakTop = 0;
let breakHeight = 0;
let lastProgress = -1;
let lastHeroY = -1;
let lastBreakY = -1;
let lastStuck = null;
let ticking = false;
let measureScheduled = false;

function measureLayout() {
  pageHeight = document.documentElement.scrollHeight;
  const breakHost = !liteMotion ? breakLayer?.parentElement : null;
  if (breakHost) {
    const rect = breakHost.getBoundingClientRect();
    breakTop = rect.top + scrollY;
    breakHeight = rect.height;
  } else {
    breakTop = 0;
    breakHeight = 0;
  }
}

function scheduleMeasure() {
  if (measureScheduled) return;
  measureScheduled = true;
  requestAnimationFrame(() => {
    measureScheduled = false;
    measureLayout();
    paintScroll();
  });
}

function paintScroll() {
  const y = scrollY;
  const height = innerHeight;
  const stuck = y > 40 || activeView !== 'home';
  if (stuck !== lastStuck) {
    navEl?.classList.toggle('stuck', stuck);
    lastStuck = stuck;
  }
  if (progressEl) {
    const progress = pageHeight > height ? Math.min(1, Math.max(0, y / (pageHeight - height))) : 0;
    if (progress !== lastProgress) {
      progressEl.style.transform = 'scaleX(' + progress + ')';
      lastProgress = progress;
    }
  }
  if (!liteMotion && heroLayer && y < height * 1.3) {
    if (y !== lastHeroY) {
      heroLayer.style.transform = `translate3d(0,${y * 0.38}px,0) scale(1.06)`;
      lastHeroY = y;
    }
  }
  if (breakHeight && !liteMotion) {
    const top = breakTop - y;
    if (top < height && top + breakHeight > 0) {
      const p = (height - top) / (height + breakHeight);
      const offset = Math.round((p - 0.5) * 90);
      if (offset !== lastBreakY) {
        breakLayer.style.transform = `translate3d(0,${offset}px,0) scale(1.1)`;
        lastBreakY = offset;
      }
    }
  }
}

function onScroll() {
  if (ticking || document.hidden) return;
  ticking = true;
  requestAnimationFrame(() => {
    paintScroll();
    ticking = false;
  });
}

addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', () => {
  if (innerWidth > 900) closeNav();
  scheduleMeasure();
}, { passive: true });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) scheduleMeasure();
});

/* Content arrives after load (grids, standings, news) and route swaps change page height, so
   re-measure when the body actually resizes instead of on every frame. */
if ('ResizeObserver' in window) {
  new ResizeObserver(scheduleMeasure).observe(document.body);
} else {
  addEventListener('load', scheduleMeasure, { once: true });
}
measureLayout();
paintScroll();

/* ═══════════════ 12. VIEWS & SPA ROUTER ═══════════════ */
let viewSwapTimer = null;

function routeFromPath(path) {
  const seg = (path || '/').replace(/^\/+|\/+$/g, '').toLowerCase();
  return seg in VIEWS ? seg : 'home';
}

function revealNow(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('.rv').forEach((el) => el.classList.add('in'));
}

function setActiveNav(route) {
  document.querySelectorAll<HTMLElement>('.nav-links a[data-route]').forEach((a) => {
    a.classList.toggle('current', a.dataset.route === route);
  });
  document.body.dataset.view = route;
}

function syncDocumentMeta(route) {
  const path = route === 'home' ? '/' : '/' + route;
  const url = 'https://freef1.netlify.app' + path;
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute('href', url);
  const ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.setAttribute('content', url);
  const ogTitle = document.querySelector('meta[property="og:title"]');
  const title = route === 'home' ? currentEvent.name + ' - FreeF1' : (VIEW_TITLES[route] || document.title);
  if (ogTitle) ogTitle.setAttribute('content', title);
}

function showView(route, { push = true, scroll = true } = {}) {
  const next = $(VIEWS[route]);
  const prev = $(VIEWS[activeView]);
  if (!next) return;
  const changed = route !== activeView;
  if (push) {
    const url = route === 'home' ? '/' : '/' + route;
    if (location.pathname !== url) history.pushState({ view: route }, '', url);
  }
  if (route === 'replays') loadReplays();
  document.title = route === 'home' ? currentEvent.name + " - FreeF1" : VIEW_TITLES[route];
  syncDocumentMeta(route);
  setActiveNav(route);
  closeNav();
  if (!changed) {
    if (scroll) scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  activeView = route;
  clearTimeout(viewSwapTimer);
  document.body.classList.add('view-swapping');
  prev?.classList.add('is-leaving');
  prev?.classList.remove('is-active');

  viewSwapTimer = window.setTimeout(() => {
    if (prev) {
      prev.hidden = true;
      prev.classList.remove('is-leaving');
    }
    next.hidden = false;
    if (scroll) scrollTo({ top: 0, behavior: 'instant' });
    void next.offsetWidth;
    next.classList.add('is-active');
    if (route !== 'home') revealNow(next);
    document.body.classList.remove('view-swapping');
    onScroll();
  }, VIEW_SWAP_MS);
}

function navigate(route) {
  showView(route, { push: true, scroll: true });
}

document.addEventListener('click', (event) => {
  const a = (event.target as HTMLElement).closest<HTMLElement>('a[data-route]');
  if (!a) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault();
  navigate(a.dataset.route);
});

document.addEventListener('click', (event) => {
  const a = (event.target as HTMLElement).closest<HTMLElement>('a[href^="#"]');
  if (!a || activeView === 'home') return;
  const id = a.getAttribute('href').slice(1);
  const target = document.getElementById(id);
  if (!target) return;
  event.preventDefault();
  showView('home', { push: true, scroll: false });
  window.setTimeout(() => target.scrollIntoView({ behavior: reduceMotion ? 'instant' : 'smooth' }), VIEW_SWAP_MS + 40);
});

addEventListener('popstate', () => showView(routeFromPath(location.pathname), { push: false, scroll: true }));

(function initView() {
  const route = routeFromPath(location.pathname);
  /* A parked view (/replays) or any unknown path resolves to home; drop the dead URL too. */
  const stray = route === 'home' && location.pathname.replace(/\/+$/, '') !== '';
  history.replaceState({ view: route }, '', stray ? '/' : location.pathname + location.search + location.hash);
  if (route === 'home') {
    setActiveNav('home');
    syncDocumentMeta('home');
    return;
  }
  const next = $(VIEWS[route]);
  const home = $(VIEWS.home);
  if (home) {
    home.hidden = true;
    home.classList.remove('is-active');
  }
  if (next) {
    next.hidden = false;
    next.classList.add('is-active');
  }
  activeView = route;
  if (next) revealNow(next);
  setActiveNav(route);
  document.title = VIEW_TITLES[route];
  syncDocumentMeta(route);
})();

/* ═══════════════ 13. ACCORDIONS & INFO TABS ═══════════════ */
/* Opening a row is now a class toggle. The height animation lives in CSS (grid-template-rows),
   so no scrollHeight is read and nothing has to be written inline. */
document.querySelectorAll<HTMLElement>('.acc-q').forEach((btn) => {
  if (!btn.hasAttribute('aria-expanded')) btn.setAttribute('aria-expanded', 'false');
  btn.addEventListener('click', () => {
    const item = btn.parentElement;
    const was = item?.classList.contains('active');
    item?.closest('.acc-wrap')?.querySelectorAll<HTMLElement>('.acc-item').forEach((i) => {
      i.classList.remove('active');
      i.querySelector<HTMLElement>('.acc-q')?.setAttribute('aria-expanded', 'false');
    });
    if (item && !was) {
      item.classList.add('active');
      btn.setAttribute('aria-expanded', 'true');
    }
    scheduleMeasure();
  });
});

function openPanel(id) {
  document.querySelectorAll<HTMLElement>('.panel').forEach((p) => p.classList.toggle('active', p.id === id));
  document.querySelectorAll<HTMLElement>('#infoTabs [role="tab"]').forEach((t) => {
    const active = t.dataset.panel === id;
    t.classList.toggle('active', active);
    t.setAttribute('aria-selected', String(active));
  });
}

document.querySelectorAll<HTMLElement>('#infoTabs [role="tab"]').forEach((t) => {
  t.addEventListener('click', () => openPanel(t.dataset.panel));
});

document.querySelectorAll<HTMLElement>('[role="tablist"]').forEach((tabList) => {
  tabList.addEventListener('keydown', (event: KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = [...tabList.querySelectorAll<HTMLElement>('[role="tab"]')];
    const current = tabs.indexOf(document.activeElement as HTMLElement);
    if (current < 0) return;
    event.preventDefault();
    const next = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? tabs.length - 1
        : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].focus();
  });
});

document.querySelectorAll<HTMLElement>('.foot-links button[data-panel]').forEach((b) => {
  b.addEventListener('click', () => {
    openPanel(b.dataset.panel);
    navigate('info');
  });
});

/* ═══════════════ 20. NEWS FEED VIEW ═══════════════ */

function newsFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload?.news) ? payload.news : Array.isArray(payload?.items) ? payload.items : [];
}

function updateNewsStatus(online) {
  if (!newsStatusEl) return;
  newsStatusEl.textContent = online ? 'NEWS · LIVE' : 'NEWS · OFFLINE';
  newsStatusEl.classList.toggle('is-live', online);
  newsStatusEl.classList.toggle('is-offline', !online);
}

function renderNews(items) {
  if (!newsFeedEl) return;
  const list = newsFromPayload(items).filter((item) => item && item.title && item.body).slice(0, 8);
  if (!list.length) {
    newsFeedEl.innerHTML = '<div class="state">No news updates yet. Check back soon.</div>';
    return;
  }
  const fragment = document.createDocumentFragment();
  list.forEach((item, index) => {
    const article = document.createElement('article');
    article.className = 'news-item';
    article.style.animation = `fadeUp .55s var(--ease) ${index * 55}ms both`;
    article.innerHTML = `<div class="news-meta"><span class="news-tag">${escapeHtml(item.tag || 'Race Control')}</span><time class="news-date" datetime="${escapeHtml(new Date(Number(item.createdAt) || Date.now()).toISOString())}">${escapeHtml(formatNewsDate(item.createdAt))}</time></div>
      <h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p>`;
    fragment.appendChild(article);
  });
  newsFeedEl.replaceChildren(fragment);
}

let lastNewsSignature = null;
function applyNewsUpdate(payload, online = true) {
  const list = newsFromPayload(payload).filter((item) => item && item.title && item.body).slice(0, 8);
  const signature = JSON.stringify(list.map((item) => [
    String(item.id || ''), String(item.title), String(item.body), String(item.tag || ''),
    Number(item.createdAt) || null, Number(item.updatedAt) || null
  ]));
  // A Force Live, source, or maintenance edit also carries the public news
  // array. Leave the existing DOM untouched unless its visible content changed.
  if (signature !== lastNewsSignature) {
    renderNews(list);
    lastNewsSignature = signature;
  }
  updateNewsStatus(online);
}

function updateCurrentStreamButton() {
  const live = getCurrentLiveSession();
  const btn = $("currentStreamBtn");
  const lbl = btn?.querySelector("span");
  if (!btn || !lbl) return;
  if (live) {
    btn.removeAttribute("aria-disabled");
    lbl.textContent = `Live now · ${live.session.name}`;
  } else {
    btn.setAttribute("aria-disabled", "true");
    lbl.textContent = "No live session";
  }
  if (!streamOverride.active) updateOverridePill(streamOverride);
}

$("currentStreamBtn")?.addEventListener("click", () => {
  const live = getCurrentLiveSession();
  if (!live) return;
  currentEvent = live.event;
  currentSession = live.session;
  resetSessionState();
  currentSource = preferredSourceIndex();
  updateSessions();
  updateHeader();
  renderButtons();
  load();
  updateCurrentStreamButton();
  document.getElementById('watch')?.scrollIntoView({ behavior: 'smooth' });
});

eventSelect?.addEventListener("change", () => {
  const ev = schedule.find((e) => e.slug === eventSelect.value);
  if (!ev || ev.sessions.every(isSessionEnded)) return;
  currentEvent = ev;
  currentSession = ev.sessions.find((s) => !isSessionEnded(s)) || ev.sessions[0];
  resetSessionState();
  currentSource = preferredSourceIndex();
  updateSessions();
  updateHeader();
  renderButtons();
  load();
  updateCurrentStreamButton();
});

sessionSelect?.addEventListener("change", () => {
  const s = currentEvent.sessions.find((s) => s.slug === sessionSelect.value);
  if (!s || isSessionEnded(s)) return;
  currentSession = s;
  resetSessionState();
  currentSource = preferredSourceIndex();
  updateHeader();
  renderButtons();
  load();
});

/* ═══════════════ 21. TEAM LIVERY SYSTEM ═══════════════ */
const tOverlay = $("teamSelectOverlay");
const tGrid = $("teamGrid");

/* ═══ Custom livery ═══
   Stored as freef1_team = 'custom' plus the chosen hex in freef1_team_color, so a custom
   shade survives reloads the same way a team does. Any #rgb / #rrggbb is accepted; a 3-digit
   code is expanded so the whole app gets a value CSS can mix. */
const CUSTOM_TEAM_ID = 'custom';
const CUSTOM_COLOR_KEY = 'freef1_team_color';
const CUSTOM_DEFAULT = '#E10600';

function normaliseHex(value) {
  const raw = String(value || '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(raw)) return '#' + raw.split('').map((c) => c + c).join('').toUpperCase();
  if (/^[0-9a-f]{6}$/i.test(raw)) return '#' + raw.toUpperCase();
  return null;
}

function customColor() {
  return normaliseHex(store.get(CUSTOM_COLOR_KEY)) || CUSTOM_DEFAULT;
}

function applyCustomColor(hex, { persist = true } = {}) {
  const clean = normaliseHex(hex);
  if (!clean) return false;
  if (persist) {
    store.set(CUSTOM_COLOR_KEY, clean);
    store.set('freef1_team', CUSTOM_TEAM_ID);
  }
  applyTeamTheme(CUSTOM_TEAM_ID, clean);
  paintCustomCard();
  syncColorInputs(clean);
  return true;
}

/* Keep the picker and the hex field showing the colour that is actually applied. Skipped while
   the field has focus so it does not fight somebody mid-type. */
function syncColorInputs(hex: string) {
  const picker = $('liveryColorPicker');
  const field = $('liveryColorHex');
  if (picker) picker.value = hex;
  if (field && document.activeElement !== field) {
    field.value = hex;
    field.classList.remove('is-invalid');
  }
}

/* Repaint just the "Own colour" swatch card — used while the picker is being dragged, so the
   card never lags behind the value the cockpit is already showing. */
function paintCustomCard() {
  const hex = customColor();
  const card = tGrid?.querySelector<HTMLElement>(`.tcard[data-team="${CUSTOM_TEAM_ID}"]`);
  if (!card) return;
  card.style.setProperty('--tc', hex);
  const badge = card.querySelector<HTMLElement>('.tbadge');
  if (badge) {
    badge.style.background = `linear-gradient(140deg,${hex},${shade(hex, -50)})`;
    badge.style.color = inkOn(hex);
  }
}

function paintTheme(color) {
  const rs = document.documentElement.style;
  rs.setProperty('--team', color);
  rs.setProperty('--team-2', shade(color, 36));
  rs.setProperty('--team-ink', inkOn(color));
  rs.setProperty('--red-glow', color + '70');
  dispatchEvent(new CustomEvent('freef1themechange', { detail: { color } }));
}

function applyTeamTheme(id, overrideColor?: string) {
  if (id === CUSTOM_TEAM_ID) {
    paintTheme(overrideColor || customColor());
  } else {
    const t = teams.find((x) => x.id === id) || teams[0];
    paintTheme(t.color);
  }
  document.querySelectorAll<HTMLElement>('.tcard').forEach((c) => c.classList.toggle('on', c.dataset.team === id));
}

function teamBadge(t) {
  const light = luma(t.color) > 0.7;
  const fill = light
    ? 'linear-gradient(140deg,#1c1e24,#0b0c0f)'
    : `linear-gradient(140deg,${t.color},${shade(t.color, -50)})`;
  const ring = light
    ? `box-shadow:inset 0 0 0 1.5px ${t.color},0 8px 20px -8px rgba(0,0,0,.8);`
    : '';
  if (!t.logo) {
    return `<div class="tbadge mark" style="background:${fill};${ring}color:${t.text}">${FREEF1_MARK}</div>`;
  }
  const s1 = TEAM_LOGO(t.logo, 48);
  const s2 = TEAM_LOGO(t.logo, 96);
  return `<div class="tbadge has-logo" style="background:${fill};${ring}color:${light ? '#fff' : t.text}">
    <img src="${s1}" srcset="${s1} 1x, ${s2} 2x" width="48" height="48" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">
    <span class="tabbr" aria-hidden="true">${t.abbr}</span></div>`;
}

function renderTeamGrid() {
  if (!tGrid) return;
  tGrid.innerHTML = '';
  teams.forEach((t) => {
    const c = document.createElement('div');
    c.className = 'tcard';
    c.dataset.team = t.id;
    c.setAttribute('role', 'button');
    c.tabIndex = 0;
    c.setAttribute('aria-label', `Choose ${t.name} livery`);
    c.style.setProperty('--tc', t.color);
    c.innerHTML = `${teamBadge(t)}<div class="tname">${t.name}</div><div class="tick">✓</div>`;
    c.querySelector<HTMLElement>('.tbadge img')?.addEventListener('error', (event) => {
      const badge = (event.target as HTMLElement).parentElement;
      badge.classList.remove('has-logo');
      (event.target as HTMLElement).remove();
    }, { once: true });
    const choose = () => {
      applyTeamTheme(t.id);
      store.set('freef1_team', t.id);
    };
    c.addEventListener('click', choose);
    c.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        choose();
      }
    });
    tGrid.appendChild(c);
  });

  /* Own-colour card sits last and mirrors the team cards, so choosing it feels identical. */
  const hex = customColor();
  const custom = document.createElement('div');
  custom.className = 'tcard tcard-custom';
  custom.dataset.team = CUSTOM_TEAM_ID;
  custom.setAttribute('role', 'button');
  custom.tabIndex = 0;
  custom.setAttribute('aria-label', 'Use your own livery colour');
  custom.style.setProperty('--tc', hex);
  custom.innerHTML = `<div class="tbadge mark" style="background:linear-gradient(140deg,${hex},${shade(hex, -50)});color:${inkOn(hex)}">${FREEF1_MARK}</div>` +
    '<div class="tname">Own colour</div><div class="tick">✓</div>';
  const chooseCustom = () => {
    applyCustomColor(customColor());
    syncLiveryInputs();
  };
  custom.addEventListener('click', chooseCustom);
  custom.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      chooseCustom();
    }
  });
  tGrid.appendChild(custom);
}

/* ═══ Custom livery controls ═══ */
const liveryPicker = $('liveryColorPicker');
const liveryHex = $('liveryColorHex');
const liveryApply = $('liveryColorApply');
const liverySwatches = $('liverySwatches');
const LIVERY_SWATCHES = ['#E10600', '#00D2BE', '#1E41FF', '#FF8000', '#B4A07A', '#C6FF00', '#FF0080', '#F5F6F7'];

function syncLiveryInputs() {
  const hex = customColor();
  if (liveryPicker) liveryPicker.value = hex;
  if (liveryHex && document.activeElement !== liveryHex) liveryHex.value = hex;
  if (liveryHex) liveryHex.classList.remove('is-invalid');
  paintCustomCard();
  document.querySelectorAll<HTMLElement>('.tcard').forEach((c) => c.classList.toggle('on', c.dataset.team === store.get('freef1_team')));
}

if (liverySwatches) {
  LIVERY_SWATCHES.forEach((value) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'lc-swatch';
    dot.style.setProperty('--sw', value);
    dot.setAttribute('aria-label', `Use ${value}`);
    dot.addEventListener('click', () => applyCustomColor(value));
    liverySwatches.appendChild(dot);
  });
}

liveryPicker?.addEventListener('input', () => {
  /* Live preview while dragging the picker; committed on change. */
  if (liveryHex) liveryHex.value = liveryPicker.value.toUpperCase();
  applyTeamTheme(CUSTOM_TEAM_ID, liveryPicker.value);
  paintCustomCard();
});
liveryPicker?.addEventListener('change', () => applyCustomColor(liveryPicker.value));

liveryHex?.addEventListener('input', () => {
  const clean = normaliseHex(liveryHex.value);
  liveryHex.classList.toggle('is-invalid', !clean && liveryHex.value.trim().length > 1);
  if (clean) { applyTeamTheme(CUSTOM_TEAM_ID, clean); paintCustomCard(); }
});
const commitHex = () => {
  const clean = normaliseHex(liveryHex?.value);
  if (clean) applyCustomColor(clean);
  else syncLiveryInputs();
};
liveryHex?.addEventListener('change', commitHex);
liveryHex?.addEventListener('blur', commitHex);
liveryHex?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    commitHex();
  }
});
liveryApply?.addEventListener('click', () => {
  const clean = normaliseHex(liveryHex?.value) || customColor();
  applyCustomColor(clean);
  if (liveryPicker) liveryPicker.value = clean;
  if (liveryHex) liveryHex.value = clean;
});

$("teamSelectBtn")?.addEventListener('click', () => {
  openModal(tOverlay);
  renderTeamGrid();
  applyTeamTheme(store.get('freef1_team') || 'default');
  syncLiveryInputs();
});
$("teamSelectClose")?.addEventListener('click', () => closeModal(tOverlay));

[$("sessionsOverlay"), $("raceTimesOverlay"), tOverlay, $("driverOverlay")].forEach((m) => {
  m?.addEventListener('click', (e) => {
    if (e.target === m) closeModal(m);
  });
});

addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.querySelector<HTMLElement>('.modal.open');
    if (modal) closeModal(modal);
    return;
  }
  trapModalFocus(e);
});

/* ═══════════════ 23. APPLICATION INITIALIZATION ═══════════════ */
// Apply stored team livery
applyTeamTheme(store.get('freef1_team') || 'default');

// Resolve the embdlol channel directory before the feed row is built (falls back if it fails).
void loadCatalogues().then(() => {
  renderButtons();
  /* No prefetch for token providers: their address dies in seconds, so warming it at load time is
     the same as burning it. It is minted on click instead. */
});
void loadProviderHealth();
window.setInterval(() => {
  if (!document.hidden) void loadProviderHealth();
}, 5 * 60_000);

// The 4K address is resolved on first click; nothing here talks to Discord.
void handleResetRequest();

// Initial controls & player setup
populate();
updateHeader();
renderButtons();
load();
setupCustomSelects();
updateClocks();
updateOverridePill(streamOverride);
bootstrapSiteConfig();
// Background intervals
window.setInterval(() => {
  if (!document.hidden) updateClocks();
}, 1000);

window.setInterval(() => {
  if (!document.hidden) updateCurrentStreamButton();
}, 60000);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    updateClocks();
    updateCurrentStreamButton();
  }
}, { passive: true });


// Read-only feature dependencies; mutable values are live getters, not stale snapshots.
export const featureContext = {
  fetchJson,
  JOLPI,
  SITE_SEASON,
  hexFor,
  escapeHtml,
  readApiFallback,
  fadeSwapContent,
  inkOn,
  store,
  FOLLOW_KEY,
  TEAM_ALIAS,
  teams,
  mapPool,
  schedule,
  fmtPts,
  ageFrom,
  TEAM_LOGO,
  fmtDob,
  applyTeamTheme,
  closeModal,
  openModal,
  fetchWithTimeout,
  scheduleAnimationFrame,
  RADIO_RC_STORE_KEY,
  OPENF1_API,
  radioRcTimeFmt,
  showToast,
  liteMotion,
  hex2rgb,
  get currentEvent() { return currentEvent; },
  get currentSession() { return currentSession; },
  sources,
  get currentSource() { return currentSource; },
  get activeView() { return activeView; },
  isStreamAvailable,
  get disabledSources() { return new Set(sources.filter((s) => s.hidden).map((s) => s.id)); },
  specialState,
  renderButtons,
  isSpecialDown: specialDown,
  buildUrl,
  BACKEND_API,
};
export type FeatureContext = typeof featureContext;

// Each optional feature is downloaded and evaluated at most once.
let championship: Promise<void> | undefined;
const loadChampionship = () => championship ??= import('./features/championship').then(({ init }) => {
  const feature = init(featureContext);
  feature.loadStandings('drivers');
  feature.loadDriverGrid();
}).catch(error => { championship = undefined; showToast('Championship data could not load. Try again.', 'error'); throw error; });
onVisible(['grid', 'standings'], loadChampionship);
/* Replays are a separate, lazily-loaded chunk: the index is ~40 KB gzipped and only matters to
   someone who opens the view. */
let replaysLoaded = false;
function loadReplays() {
  if (replaysLoaded) return;
  replaysLoaded = true;
  void import('./features/replays').then((m) => m.init(featureContext)).catch(() => { replaysLoaded = false; });
}
if (routeFromPath(location.pathname) === 'replays') loadReplays();
lazyButton('sessionsBtn', () => import('./features/results').then(m => m.init(featureContext)));
lazyButton('raceTimesBtn', () => import('./features/race-times').then(m => m.init(featureContext)));
const loadRadio = (() => {
  let task: Promise<unknown> | undefined;
  return () => task ??= import('./features/radio').then(m => m.init(featureContext)).catch(error => { task = undefined; throw error; });
})();
lazyButton('radioRcBtn', loadRadio);
try { if (JSON.parse(store.get(RADIO_RC_STORE_KEY) || '{}').open) onIdle(() => loadRadio()); } catch { /* invalid preferences */ }
lazyButton('copyDiagnosticsBtn', () => import('./features/diagnostics').then(m => m.init(featureContext)));
if (!liteMotion) onIdle(() => import('./features/canvas').then(m => m.init(featureContext)));

/* Championship sits in the rail, not beside the stream window. */
$("standingsBtn")?.addEventListener("click", () => {
  void loadChampionship().catch(() => {});
  $("standings")?.scrollIntoView({ behavior: reduceMotion ? 'instant' : 'smooth' });
});
