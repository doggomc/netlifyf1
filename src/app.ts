import { setupCustomSelects } from './ui/select';
import { TEAM_LOGO, TEAM_HEX, TEAM_ALIAS, photoFor, teams } from './data/teams';
import { NO_STREAM_MESSAGES, LOADER_LINES, BLOCKED_TITLE, BLOCKED_COPY_IOS, BLOCKED_COPY, HIJACK_TITLE, HIJACK_COPY } from './data/cockpit-messages';
import { BACKEND_API, SITE_CONFIG_CACHE_KEY, SITE_SEASON, OPENF1_API, JOLPI } from './config';
import { parseSiteConfig, type SiteConfig } from './types/site-config';
import { onIdle, onVisible, lazyButton } from './services/lazy';
import { store } from './services/storage';
import { fetchWithTimeout, fetchJson, readApiFallback } from './services/api';
import { $ } from './services/dom';
import { schedule, type RaceEvent, type Session } from './data/schedule';
import { mapPool } from './services/pool';
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
const VIEWS = { home: 'viewHome', ...(PUBLIC_NEWS_ENABLED ? { news: 'viewNews' } : {}), replays: 'viewReplays', info: 'viewInfo', discord: 'viewDiscord' };
const VIEW_TITLES = { ...(PUBLIC_NEWS_ENABLED ? { news: 'News - FreeF1' } : {}), replays: 'Race Replays - FreeF1', info: 'Terms, Privacy & FAQ - FreeF1', discord: 'Discord - FreeF1' };
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

const raceDateFormat = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric'
});

const raceClockFormat = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZoneName: 'short'
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

function formatRaceDateTime(timestamp) {
  const date = new Date(Number(timestamp));
  if (Number.isNaN(date.getTime())) return '-';
  return `${raceDateFormat.format(date)} · ${raceClockFormat.format(date)}`;
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

function isDateEnded(d) {
  return Boolean(d && (Date.now() - new Date(d + 'T23:59:59Z').getTime()) > 0);
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

function getStreamEastSlug(event, session) {
  return `ppv-${kebab(event?.name)}-${kebab(session?.name)}`;
}

/* The taifood embeds are addressed per round and per session:
   /embed/<event-name>---<session-name>-<provider id>. Both names are slugged the same way
   ("Mexico City Grand Prix" + "Practice 1" -> mexico-city-grand-prix---practice-1-31363),
   so each provider is just a fixed numeric id. */
function getTaidUrl(num) {
  return `https://taifood-blog.asia/embed/${kebab(currentEvent?.name)}---${kebab(currentSession?.name)}-${num}`;
}

/* taid  -> numbered taifood embed (/embed/<event>---<session>-<id>)
   ppv   -> path-scheme taifood embed (/embed/f1/<season>/<city>/<session>)
   url   -> fixed address that does not vary by round */
interface StreamSource { id: string; label: string; url?: string; suffix?: string; streamNum?: number; taid?: number; rp?: ReferrerPolicy; ppv?: boolean; embdlol?: string; gated?: boolean; }

/* ═══ embdlol ═══
   embdlol.st publishes its channel directory at https://api.embdlol.st/struct (CORS: *), each
   entry being { id: <ULID>, channelname: 'f1frisky' }. The embed is then /embed/<id>, and the
   player itself resolves the playlist with POST https://api.embdlol.st/watch {watchId:<id>},
   which returns a tokenised HLS url. Channel ids rotate, so they are resolved at runtime and
   the fallbacks below are only a safety net for when the directory call fails. */
const EMBDLOL_STRUCT = 'https://api.embdlol.st/struct';
const EMBDLOL_EMBED = 'https://embdlol.st/embed/';
const EMBDLOL_FALLBACK: Record<string, string> = {
  f1frisky: '01a18dc5-b97c-737c-96db-147ef2ac4c49',
  f1friapple: '01a18dc6-1eb0-72ed-bd95-6ed59bea9202',
  f1fridazn: '01a18dc6-afce-741b-b969-3b382841bf7f',
  f1friskyit: '01a18dc7-1542-77fd-bb59-2ef66eebd20f',
  f1friskyde: '01a18dc7-8432-703b-ac15-c045a7a9c6c3'
};
/* Channels the open feeds may use. Anything not listed here is never resolved in the browser. */
const PUBLIC_EMBDLOL = ['f1frisky', 'f1friapple', 'f1fridazn', 'f1friskyit', 'f1friskyde'];
let embdlolChannels: Record<string, string> = {};
let embdlolLoadedAt = 0;

async function loadEmbdlolChannels() {
  if (Date.now() - embdlolLoadedAt < 5 * 60_000 && Object.keys(embdlolChannels).length) return;
  try {
    const response = await fetchWithTimeout(EMBDLOL_STRUCT, { cache: 'default', headers: { Accept: 'application/json' } }, 4000);
    if (!response.ok) throw new Error(`embdlol struct ${response.status}`);
    const json = await response.json();
    const next: Record<string, string> = {};
    for (const channel of Array.isArray(json?.channels) ? json.channels : []) {
      const name = String(channel?.channelname || '').toLowerCase();
      /* Allowlist, not a blocklist: the members-only 4K channel is resolved by the server and
         must not be named or id'd anywhere in the public bundle. */
      if (PUBLIC_EMBDLOL.includes(name) && channel?.id) next[name] = String(channel.id);
    }
    if (Object.keys(next).length) {
      embdlolChannels = next;
      embdlolLoadedAt = Date.now();
    }
  } catch (_) {
    /* Directory unreachable: the fallbacks keep the feeds working. */
  }
}

function embdlolUrl(name: string) {
  const id = embdlolChannels[name] || EMBDLOL_FALLBACK[name];
  return id ? `${EMBDLOL_EMBED}${id}` : '';
}
/* Sky UHD is the main source: it is first in the row and it is what plays on load, on a
   session change and on "jump to live". If Race Control disables it, the player falls through
   to the first source that is still enabled. */
const DEFAULT_SOURCE_ID = "sky-uk";
const sources: StreamSource[]=[
 {id:"sky-uk",label:"Sky UHD",url:"https://strmfree.st/embed/racing/skyf1"},
 {id:"skyf1-1080",label:"Sky F1 1080p",url:"https://streamfree.top/embed/racing/skyf11080p"},
 {id:"emb-sky",label:"Sky F1 (EMB)",embdlol:"f1frisky"},
 {id:"emb-apple",label:"Apple TV (EMB)",embdlol:"f1friapple"},
 {id:"emb-dazn",label:"DAZN ES (EMB)",embdlol:"f1fridazn"},
 {id:"emb-italia",label:"Sky Italia (EMB)",embdlol:"f1friskyit"},
 {id:"emb-de",label:"Sky DE (EMB)",embdlol:"f1friskyde"},
 /* HEVC-only 4K and it is the single rendition in the master playlist, so any browser without
    HEVC decode shows nothing at all. Kept, named, and placed after the H.264 feeds. */
 /* Members-only: the channel id is never in the bundle, it comes from /api/discord/4k after the
    server has checked the visitor is in the Discord server. */
 {id:"emb-uhd",label:"F1 UHD 4K",gated:true},
 {id:"sky-f1-uk",label:"Sky Sports F1 UK",url:"https://cdnlivetv.tv/api/v1/channels/player/?name=Sky%20Sports%20F1%20FHD%20UK&code=&user=cdnlivetv&plan=free",rp:"unsafe-url"},
 {id:"sky-sports",label:"Sky Sports",url:"https://hakunamatata5.org/hakunamatata5.html",rp:"unsafe-url"},
 {id:"appletv",label:"AppleTV",taid:31374,rp:"unsafe-url"},
 {id:"dazn",label:"DAZN",taid:31376,rp:"unsafe-url"},
 {id:"viaplay",label:"Viaplay",taid:31380,rp:"unsafe-url"},
 {id:"sky-italia",label:"Sky Sport Italia",taid:31378,rp:"unsafe-url"},
 {id:"westream",label:"WeStream F1",url:"https://westreamf1.com/westreamf1.php"},
 {id:"wikisport",label:"WikiSport",url:"https://wikisport.info/strm/f1.php"},
 {id:"ppv",label:"F1 PPV",ppv:true,rp:"unsafe-url"},
 /* Pulled off the WikiSport player page. Note: xstream.st only serves the real player when
    the request carries a wikisport.info referrer; from this origin it answers with a
    parked-domain page. Kept here so it is one line away from working if we proxy it. */
 {id:"xstream",label:"XStream F1",url:"https://xstream.st/fslivepro.php?stream=F81"}
];



let disabledSources = new Set();
const sourceEnabled = (s) => !disabledSources.has(s.id) && (!s.gated || discordGate.verified);

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
let currentSource = sources.findIndex((s) => s.id === DEFAULT_SOURCE_ID);
let activeView = 'home';
let playerLoadToken = 0;

const buildUrl = (i) => {
  const s = sources[i];
  if (!s) return "";
  if (s.taid) return getTaidUrl(s.taid);
  if (s.ppv) return `https://taifood-blog.asia/embed/f1/${SITE_SEASON}/${currentEvent.slug}/${currentSession.slug}`;
  if (s.gated) return discordGate.url || '';
  if (s.embdlol) return embdlolUrl(s.embdlol);
  if (s.streamNum) {
    const slug = getStreamEastSlug(currentEvent, currentSession);
    return `https://embed.st/embed/admin/${slug}/${s.streamNum}`;
  }
  return s.url || (s.suffix !== undefined ? `https://embedindia.st/embed/f1/${SITE_SEASON}/${currentEvent.slug}/${currentSession.slug}${s.suffix || ""}` : "");
};

function updateHeader() {
  const parts = currentEvent.name.split(" ");
  const last = parts.slice(-2).join(" ");
  const first = parts.slice(0, -2).join(" ") || parts[0];

  const heroTitle = $("heroTitle");
  const heroTitle2 = $("heroTitle2");
  const heroSession = $("heroSession");
  const heroRound = $("heroRound");
  const stageLabel = $("stageLabel");
  const sourceLabel = $("sourceLabel");

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
  const src = sources[currentSource] || { id: "none", label: "-", suffix: "" };
  if (stageLabel) stageLabel.textContent = "freef1://live/" + currentEvent.slug + "/" + currentSession.slug + (src.suffix !== undefined ? src.suffix : "/" + src.id);
  if (sourceLabel) sourceLabel.textContent = "SOURCE · " + src.label.toUpperCase();
  if (badgeEl) badgeEl.style.display = isStreamAvailable(currentSession) ? "inline-flex" : "none";
}

/* ═══ Discord gate ═══
   discordGate mirrors /api/discord/status. The 4K chip only appears once the server says the
   visitor is a member; until then a single "Join for 4K" chip opens the invite. */
let discordGate = { configured: false, verified: false, invite: '', user: null, url: '' };

async function loadDiscordGate() {
  try {
    const response = await fetchWithTimeout(`${BACKEND_API}/api/discord/status`, { credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' } }, 6000);
    const json = await response.json();
    discordGate = { ...discordGate, ...json };
    if (json?.verified) await fetchFourKUrl();
  } catch (_) {
    discordGate = { ...discordGate, configured: false, verified: false };
  }
  renderButtons();
  return discordGate;
}

/* Only a genuine membership answer may downgrade the visitor. A timeout, a 500 or "channel not
   published" is OUR side failing, and downgrading there is what flipped a verified member back to
   the locked chip and sent them round the sign-in loop again. */
async function fetchFourKUrl() {
  try {
    const response = await fetchWithTimeout(`${BACKEND_API}/api/discord/4k`, { credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' } }, 8000);
    const json = await response.json().catch(() => ({}));
    if (response.ok) {
      discordGate = { ...discordGate, verified: true, url: String(json.url || '') };
      return discordGate.url;
    }
    if (json?.code === 'left-server' || json?.code === 'not-verified') {
      discordGate = { ...discordGate, verified: false, url: '' };
      showToast(json?.code === 'left-server'
        ? 'You are not in the Discord server any more, so 4K is locked again.'
        : 'Your Discord session expired. Sign in again to unlock 4K.', 'warning');
      return '';
    }
    /* Channel missing / server busy: stay verified, just say the feed is not up. */
    discordGate = { ...discordGate, url: '' };
    showToast(json?.error || '4K is not available right now. Try again in a moment.', 'warning');
    return '';
  } catch (_) {
    discordGate = { ...discordGate, url: '' };
    showToast('Could not reach the 4K service. Check your connection and try again.', 'warning');
    return '';
  }
}

function unlockFourK() {
  /* Full-page redirect: the OAuth handshake needs top-level navigation, and it comes back
     with ?discord=verified so we can repaint the row. */
  location.href = `${BACKEND_API}/api/discord/login`;
}

function joinDiscord() {
  if (discordGate.invite) window.open(discordGate.invite, '_blank', 'noopener');
  else location.href = '/discord';
}

/* Reports the ?discord= result of the handshake, then re-checks with the server. */
function handleDiscordReturn() {
  let status = '';
  try {
    status = new URLSearchParams(location.search).get('discord') || '';
  } catch (_) {}
  if (!status) return;
  const copy = {
    verified: ['4K unlocked. Welcome to the paddock.', 'success'],
    notmember: ['You are not in the Discord server yet, so 4K stays locked.', 'warning'],
    norole: ['You are in the server but missing the member role for 4K.', 'warning'],
    cancelled: ['Discord sign-in cancelled.', 'warning'],
    badstate: ['That sign-in link expired. Try again.', 'warning'],
    token: ['Discord rejected the sign-in. Try again.', 'warning'],
    profile: ['Discord did not return your profile. Try again.', 'warning'],
    joined: ['Added to the Discord server. 4K unlocked.', 'success'],
    joinfailed: ['Discord would not add you automatically. Use the invite, then verify again.', 'warning'],
    rate: ['Too many attempts. Give it a minute.', 'warning'],
    unavailable: ['4K unlocks are not configured yet.', 'warning'],
    error: ['Something went wrong verifying your membership.', 'warning']
  }[status];
  if (copy) showToast(copy[0], copy[1]);
  try {
    const url = new URL(location.href);
    url.searchParams.delete('discord');
    history.replaceState(null, '', url.pathname + (url.search || '') + url.hash);
  } catch (_) {}
  void loadDiscordGate().then(() => {
    if (!discordGate.verified) return;
    const index = sources.findIndex((source) => source.id === 'emb-uhd');
    if (index < 0) return;
    if (!discordGate.url) {
      /* Verified, but the stream url did not come back — leave the chip usable, say nothing
         cheerful, and let the next click retry. */
      renderButtons();
      return;
    }
    currentSource = index;
    renderButtons();
    updateHeader();
    load();
    showToast('Now playing in 4K. Heads up: it is HEVC, so Safari plays it and most desktops will not.', 'success');
  });
}

function renderButtons() {
  if (!linksEl) return;
  linksEl.innerHTML = "";
  normalizeCurrentSource();
  sources.forEach((s, i) => {
    if (s.gated && !discordGate.verified) return;
    if (!sourceEnabled(s)) return;
    const b = document.createElement("button");
    b.className = "chip" + (i === currentSource ? " active" : "");
    b.textContent = s.label;
    b.onclick = async () => {
      currentSource = i;
      if (s.gated && !discordGate.url) {
        b.setAttribute('aria-busy', 'true');
        await fetchFourKUrl();
        b.removeAttribute('aria-busy');
        if (!discordGate.url) {
          renderButtons();
          return;
        }
      }
      renderButtons();
      updateHeader();
      load();
    };
    linksEl.appendChild(b);
  });

  /* Locked 4K: a single chip that either joins the server or runs the sign-in. */
  const gatedSource = sources.find((source) => source.gated);
  if (gatedSource && discordGate.configured && !discordGate.verified) {
    const locked = document.createElement('button');
    locked.className = 'chip chip-locked';
    locked.type = 'button';
    locked.textContent = `${gatedSource.label} · Members`;
    locked.title = discordGate.invite
      ? 'Join the Discord server to unlock the 4K feed'
      : 'Sign in with Discord to unlock the 4K feed';
    locked.onclick = () => (discordGate.invite ? joinDiscord() : unlockFourK());
    linksEl.appendChild(locked);
  }
}

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
  const blocked = Boolean(opts && opts.blocked);
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

function makeStreamIframe(url, rp) {
  const f = document.createElement("iframe");
  f.src = url;
  f.allow = IFRAME_ALLOW;
  f.setAttribute('allow', IFRAME_ALLOW);
  f.allowFullscreen = true;
  f.referrerPolicy = rp || "no-referrer";
  f.title = "Live stream";
  return f;
}

function watchFrameNavigation(f, token, isSettled) {
  let navs = 0;
  f.addEventListener("load", () => {
    if (token !== playerLoadToken || !isSettled()) return;
    navs++;
    if (navs === 1) return;
    showNoStream({ blocked: true, hijack: true, keepFrame: true });
  });
}

function showStreamBlocked() {
  showNoStream({ blocked: true, text: BLOCKED_COPY });
}

function attemptSource(token, order, idx, startedAt) {
  if (token !== playerLoadToken) return;
  if (idx >= order.length) {
    showStreamBlocked();
    return;
  }
  const targetUrl = buildUrl(order[idx]);
  setLoaderText(idx === 0 ? "Establishing feed…" : "Feed unreachable - switching source…");
  const f = makeStreamIframe(targetUrl, sources[order[idx]].rp);
  let settled = false;

  const reveal = () => {
    settled = true;
    if (currentSource !== order[idx]) {
      currentSource = order[idx];
      renderButtons();
      updateHeader();
    }
    f.classList.add('loaded');
    setStreamOnScreen(true);
    requestScreenWakeLock().catch(()=>{});
    window.setTimeout(() => {
      if (token === playerLoadToken) loaderEl?.classList.add('hidden');
    }, 180);
  };

  f.onload = () => {
    if (token !== playerLoadToken || settled) return;
    if (!iframeCommitted(f)) return;
    reveal();
  };

  f.onerror = () => {
    if (token !== playerLoadToken || settled) return;
    f.remove();
    attemptSource(token, order, idx + 1, startedAt);
  };

  watchFrameNavigation(f, token, () => settled);

  window.setTimeout(() => {
    if (token !== playerLoadToken || !f.isConnected || settled) return;
    if (iframeCommitted(f)) {
      reveal();
      return;
    }
    f.remove();
    attemptSource(token, order, idx + 1, startedAt);
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
        if (token === playerLoadToken) showStreamBlocked();
      };
    } else {
      f.src = streamOverride.url;
      f.allow = IFRAME_ALLOW;
      f.setAttribute('allow', IFRAME_ALLOW);
      f.allowFullscreen = true;
      f.referrerPolicy = "no-referrer";
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
          showNoStream({ blocked: true, hijack: true, keepFrame: true });
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
        showStreamBlocked();
      }, NAV_TIMEOUT_MS);
    }
    playerEl?.appendChild(f);
    setStreamOnScreen(true);
    return;
  }

  if (!isStreamAvailable(currentSession)) {
    showNoStream();
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
    pill.className = 'stage-override-pill active';
    pill.textContent = `● Override · ${(override.type || 'custom').toUpperCase()}`;
  } else {
    const live = getCurrentLiveSession();
    pill.className = 'stage-override-pill inactive';
    pill.textContent = live ? 'Normal Stream' : 'No Live Session';
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

function applySourceConfig(payload) {
  const knownIds = new Set(sources.map((source) => source.id));
  const disabled = Array.isArray(payload?.disabled) ? payload.disabled.filter((id) => knownIds.has(String(id))) : [];
  const next = new Set(disabled.map(String));
  if (next.size === disabledSources.size && [...next].every((id) => disabledSources.has(id))) return;
  const previous = sources[currentSource];
  disabledSources = next;
  const isStillUsable = Boolean(previous) && sourceEnabled(previous);
  if (!isStillUsable) normalizeCurrentSource();
  renderButtons();
  updateHeader();
  if (!isStillUsable) load();
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
  history.replaceState({ view: route }, '', location.pathname + location.search + location.hash);
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
void loadEmbdlolChannels().then(() => renderButtons());

// Discord membership gate for the 4K feed, plus the ?discord= result of a sign-in.
void loadDiscordGate();
handleDiscordReturn();

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
  photoFor,
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
  get disabledSources() { return disabledSources; },
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

$("championshipBtn")?.addEventListener("click", () => {
  void loadChampionship().catch(() => {});
  $("standings")?.scrollIntoView({ behavior: reduceMotion ? 'instant' : 'smooth' });
});
