/* ═══════════════════════════════════════════════════════════════════════════
   FreeF1 - Formula 1 Live Companion
   Client Application Logic
   ═══════════════════════════════════════════════════════════════════════════ */

/* ═══════════════ 1. CONFIGURATION & CONSTANTS ═══════════════ */
const SITE_SEASON = 2026;
const BACKEND_API = 'https://f1admin.onrender.com';
const SITE_CONFIG_CACHE_KEY = 'freef1_site_config_v2';
const SITE_CONFIG_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const SITE_CONFIG_TIMEOUT_MS = 2500;
const SITE_CONFIG_FOCUS_COOLDOWN_MS = 5000;
const SITE_CONFIG_UPDATES_URL = `${BACKEND_API}/api/site/updates`;
let streamWindowState = { active: false, reason: '', startedAt: null, updatedAt: null };
let siteConfigEventSource = null;
const OPENF1_API = 'https://api.openf1.org/v1';
const JOLPI = 'https://api.jolpi.ca/ergast/f1';

const NAV_TIMEOUT_MS = 9000;
const API_TIMEOUT_MS = 10000;
const API_STALE_FALLBACK_MS = 7 * 24 * 60 * 60 * 1000;
const API_CACHE_MAX = 40;
const API_CACHE_INDEX = 'freef1_api_cache_index';

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

const BLOCKED_COPY = IS_IOS
  ? "The stream host never loaded on this network. On iPhone this is usually caused by a content blocker, Private Relay, Lockdown Mode or DNS filtering. Disable them for this site, or open the feed in its own tab."
  : "The stream host never responded on this network - the feed was blocked before it could start. Check ad-blockers, VPN or DNS filtering, or open the feed in its own tab.";

const HIJACK_TITLE = "The feed tried to send you to another site";
const HIJACK_COPY = "That was the feed's ad layer tab-swapping the player on your click - not us. Resume reloads the stream; Stay keeps whatever page the frame landed on. We will never redirect you off this site: close any extra tab it opened.";

const VIEWS = { home: 'viewHome', news: 'viewNews', info: 'viewInfo', discord: 'viewDiscord' };
const VIEW_TITLES = { news: 'News - FreeF1', info: 'Terms, Privacy & FAQ - FreeF1', discord: 'Discord - FreeF1' };
const VIEW_SWAP_MS = reduceMotion ? 0 : 260;

const INK_LIGHT = '#fff';
const INK_DARK = '#000';
const FREEF1_MARK = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2 17.5L7.5 6.5h5.2l-2 4h4.6l-1.6 3.2H8.9l-1.7 3.8H2z" fill="#fff"/><path d="M14.5 6.5H22l-1.7 3.4h-7.5l1.7-3.4z" fill="#fff" opacity=".72"/></svg>';
const TEAM_LOGO = (slug, w) => `https://media.formula1.com/image/upload/c_lfill,w_${w}/q_auto/v1740000001/common/f1/2026/${slug}/2026${slug}logowhite.webp`;

const TEAM_HEX={'McLaren':'#FF8000','Ferrari':'#DC0000','Red Bull':'#1E41FF','Mercedes':'#00D2BE',
 'Williams':'#005AFF','Aston Martin':'#006F62','Alpine F1 Team':'#FF0080','Alpine':'#FF0080',
 'Haas F1 Team':'#B6BABD','Haas':'#B6BABD','Audi':'#E62213','Sauber':'#00E701','RB F1 Team':'#6692FF','Racing Bulls':'#6692FF','Cadillac F1 Team':'#B4A07A','Cadillac':'#B4A07A'};

const TEAM_ALIAS={'rb f1 team':'racingbulls','racing bulls':'racingbulls','red bull':'redbull',
 'red bull racing':'redbull','alpine f1 team':'alpine','haas f1 team':'haas',
 'cadillac f1 team':'cadillac','aston martin':'astonmartin','sauber':'audi'};

const DRIVER_PHOTO={
  russell:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/mercedes/georus01/2026mercedesgeorus01right.webp',
  antonelli:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/mercedes/andant01/2026mercedesandant01right.webp',
  leclerc:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/ferrari/chalec01/2026ferrarichalec01right.webp',
  hamilton:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/ferrari/lewham01/2026ferrarilewham01right.webp',
  norris:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/mclaren/lannor01/2026mclarenlannor01right.webp',
  piastri:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/mclaren/oscpia01/2026mclarenoscpia01right.webp',
  verstappen:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/redbullracing/maxver01/2026redbullracingmaxver01right.webp',
  hadjar:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/redbullracing/isahad01/2026redbullracingisahad01right.webp',
  lawson:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/racingbulls/lialaw01/2026racingbullslialaw01right.webp',
  lindblad:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/racingbulls/arvlin01/2026racingbullsarvlin01right.webp',
  gasly:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/alpine/piegas01/2026alpinepiegas01right.webp',
  colapinto:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/alpine/fracol01/2026alpinefracol01right.webp',
  ocon:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/haasf1team/estoco01/2026haasf1teamestoco01right.webp',
  bearman:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/haasf1team/olibea01/2026haasf1teamolibea01right.webp',
  hulkenberg:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/audi/nichul01/2026audinichul01right.webp',
  bortoleto:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/audi/gabbor01/2026audigabbor01right.webp',
  sainz:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/williams/carsai01/2026williamscarsai01right.webp',
  albon:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/williams/alealb01/2026williamsalealb01right.webp',
  alonso:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/astonmartin/feralo01/2026astonmartinferalo01right.webp',
  stroll:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/astonmartin/lanstr01/2026astonmartinlanstr01right.webp',
  perez:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/cadillac/serper01/2026cadillacserper01right.webp',
  bottas:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/cadillac/valbot01/2026cadillacvalbot01right.webp'
};

const DRIVER_KEY={max_verstappen:'verstappen',arvid_lindblad:'lindblad',
 carlos_sainz:'sainz',kevin_magnussen:'magnussen'};
const photoFor = (id) => DRIVER_PHOTO[DRIVER_KEY[id] || id] || null;

const teams=[
 {id:'default',name:'FreeF1 Red',color:'#E10600',text:'#fff',abbr:'APX'},
 {id:'mclaren',name:'McLaren',color:'#FF8000',text:'#000',abbr:'MCL',logo:'mclaren'},
 {id:'ferrari',name:'Ferrari',color:'#DC0000',text:'#fff',abbr:'FER',logo:'ferrari'},
 {id:'redbull',name:'Red Bull Racing',color:'#1E41FF',text:'#fff',abbr:'RBR',logo:'redbullracing'},
 {id:'mercedes',name:'Mercedes',color:'#00D2BE',text:'#000',abbr:'MER',logo:'mercedes'},
 {id:'williams',name:'Williams',color:'#005AFF',text:'#fff',abbr:'WIL',logo:'williams'},
 {id:'astonmartin',name:'Aston Martin',color:'#006F62',text:'#fff',abbr:'AMR',logo:'astonmartin'},
 {id:'alpine',name:'Alpine',color:'#FF0080',text:'#fff',abbr:'ALP',logo:'alpine'},
 {id:'haas',name:'Haas',color:'#E6E6E6',text:'#000',abbr:'HAA',logo:'haasf1team'},
 {id:'audi',name:'Audi',color:'#E62213',text:'#fff',abbr:'AUD',logo:'audi'},
 {id:'cadillac',name:'Cadillac',color:'#B4A07A',text:'#000',abbr:'CAD',logo:'cadillac'},
 {id:'racingbulls',name:'Racing Bulls',color:'#6692FF',text:'#000',abbr:'RB',logo:'racingbulls'}
];

/* ═══════════════ 2. SAFE STORAGE (never throws) ═══════════════ */
const store = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch (e) {
      return this._m[k] ?? null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch (e) {
      this._m[k] = String(v);
    }
  },
  remove(k) {
    try { localStorage.removeItem(k); } catch (_) { delete this._m[k]; }
  },
  _m: {}
};

// Purge identifiers and count/token snapshots left by the retired visitor
// tracking implementation. New builds do not read, write, or transmit them.
['freef1_user_id', 'freef1_visitor_token', 'freef1_active_count'].forEach((key) => store.remove(key));

/* ═══════════════ 3. CORE UTILITIES & HELPERS ═══════════════ */
const $ = (id) => document.getElementById(id);

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
  if (isNaN(d)) return '-';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ageFrom(dob) {
  if (!dob) return null;
  const b = new Date(dob + 'T00:00:00Z');
  if (isNaN(b)) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const m = now.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

function fmtPts(n) {
  return String(Math.round(Number(n || 0) * 10) / 10);
}

function fetchWithTimeout(url, options = {}, timeoutMs = API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeout));
}

function apiCacheKey(url) {
  return `freef1_api_cache_${url}`;
}

function readApiFallback(url) {
  const key = apiCacheKey(url);
  try {
    const cached = JSON.parse(store.get(key) || 'null');
    if (!cached || Date.now() - Number(cached.savedAt) > API_STALE_FALLBACK_MS) {
      if (cached) store.remove(key);
      return null;
    }
    return cached.data || null;
  } catch (_) {
    return null;
  }
}

function saveApiResponse(url, data) {
  try {
    const key = apiCacheKey(url);
    try {
      store.set(key, JSON.stringify({ savedAt: Date.now(), data }));
    } catch (_) {
      return;
    }
    let idx = null;
    try {
      idx = JSON.parse(store.get(API_CACHE_INDEX) || 'null');
    } catch (_) {
      idx = null;
    }
    if (!Array.isArray(idx)) {
      idx = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.indexOf('freef1_api_cache_') === 0) idx.push(k);
        }
      } catch (_) {}
    }
    idx = idx.filter((k) => k !== key);
    idx.push(key);
    while (idx.length > API_CACHE_MAX) {
      const old = idx.shift();
      try {
        localStorage.removeItem(old);
      } catch (_) {}
    }
    try {
      store.set(API_CACHE_INDEX, JSON.stringify(idx));
    } catch (_) {}
  } catch (_) {}
}

const apiPromises = new Map();

function fetchJson(url) {
  if (apiPromises.has(url)) return apiPromises.get(url);
  const request = fetchWithTimeout(url, { headers: { Accept: 'application/json' } })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((data) => {
      saveApiResponse(url, data);
      return data;
    })
    .catch((error) => {
      apiPromises.delete(url);
      const fallback = readApiFallback(url);
      if (fallback) return fallback;
      throw error;
    });
  apiPromises.set(url, request);
  return request;
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
  document.body.style.overflow = on ? 'hidden' : '';
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
  if (!document.querySelector('.modal.open')) {
    lockScroll(false);
    if (lastModalFocus && typeof lastModalFocus.focus === 'function') {
      lastModalFocus.focus();
    }
    lastModalFocus = null;
  }
}

function trapModalFocus(event) {
  if (event.key !== 'Tab') return;
  const modal = document.querySelector('.modal.open');
  if (!modal) return;
  const focusable = [...modal.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not([tabindex="-1"]),[href],[tabindex]:not([tabindex="-1"]),textarea:not(:disabled)')]
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
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity .3s';
    setTimeout(() => el.remove(), 300);
  }, 4000);
}

/* ═══════════════ 5. SCHEDULE & SESSION DATA ═══════════════ */
const schedule=[
 {round:1,slug:"australia",name:"Australian Grand Prix",circuit:"Albert Park Grand Prix Circuit",locality:"Melbourne",country:"Australia",sprint:false,tz:"Australia/Melbourne",sessions:[{slug:"fp1",name:"Practice 1",start:"2026-03-06T01:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-03-06T05:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-03-07T01:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-03-07T05:00:00Z"},{slug:"race",name:"Race",start:"2026-03-08T04:00:00Z"}]},
 {round:2,slug:"china",name:"Chinese Grand Prix",circuit:"Shanghai International Circuit",locality:"Shanghai",country:"China",sprint:true,tz:"Asia/Shanghai",sessions:[{slug:"fp1",name:"Practice 1",start:"2026-03-13T03:30:00Z"},{slug:"sprint-qualifying",name:"Sprint Qualifying",start:"2026-03-13T07:30:00Z"},{slug:"sprint",name:"Sprint",start:"2026-03-14T03:00:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-03-14T07:00:00Z"},{slug:"race",name:"Race",start:"2026-03-15T07:00:00Z"}]},
 {round:3,slug:"japan",name:"Japanese Grand Prix",circuit:"Suzuka Circuit",locality:"Suzuka",country:"Japan",sprint:false,tz:"Asia/Tokyo",sessions:[{slug:"fp1",name:"Practice 1",start:"2026-03-27T02:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-03-27T06:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-03-28T02:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-03-28T06:00:00Z"},{slug:"race",name:"Race",start:"2026-03-29T05:00:00Z"}]},
 {round:4,slug:"miami",name:"Miami Grand Prix",circuit:"Miami International Autodrome",locality:"Miami",country:"USA",sprint:true,tz:"America/New_York",sessions:[{slug:"fp1",name:"Practice 1",start:"2026-05-01T16:00:00Z"},{slug:"sprint-qualifying",name:"Sprint Qualifying",start:"2026-05-01T20:30:00Z"},{slug:"sprint",name:"Sprint",start:"2026-05-02T16:00:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-05-02T20:00:00Z"},{slug:"race",name:"Race",start:"2026-05-03T20:00:00Z"}]},
 {round:5,slug:"canada",name:"Canadian Grand Prix",circuit:"Circuit Gilles Villeneuve",locality:"Montreal",country:"Canada",sprint:true,tz:"America/Toronto",sessions:[{slug:"fp1",name:"Practice 1",start:"2026-05-22T16:30:00Z"},{slug:"sprint-qualifying",name:"Sprint Qualifying",start:"2026-05-22T20:30:00Z"},{slug:"sprint",name:"Sprint",start:"2026-05-23T16:00:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-05-23T20:00:00Z"},{slug:"race",name:"Race",start:"2026-05-24T20:00:00Z"}]},
 {round:6,slug:"monaco",name:"Monaco Grand Prix",circuit:"Circuit de Monaco",locality:"Monte Carlo",country:"Monaco",sprint:false,tz:"Europe/Monaco",sessions:[{slug:"fp1",name:"Practice 1",start:"2026-06-05T11:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-06-05T15:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-06-06T10:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-06-06T14:00:00Z"},{slug:"race",name:"Race",start:"2026-06-07T13:00:00Z"}]},
 {round:7,slug:"barcelona",name:"Barcelona-Catalunya Grand Prix",circuit:"Circuit de Barcelona-Catalunya",locality:"Barcelona",country:"Spain",sprint:false,tz:"Europe/Madrid",sessions:[{slug:"fp1",name:"Practice 1",start:"2026-06-12T11:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-06-12T15:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-06-13T10:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-06-13T14:00:00Z"},{slug:"race",name:"Race",start:"2026-06-14T13:00:00Z"}]},
 {round:8,slug:"austria",name:"Austrian Grand Prix",circuit:"Red Bull Ring",locality:"Spielberg",country:"Austria",sprint:false,tz:"Europe/Vienna",sessions:[{slug:"fp1",name:"Practice 1",start:"2026-06-26T11:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-06-26T15:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-06-27T10:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-06-27T14:00:00Z"},{slug:"race",name:"Race",start:"2026-06-28T13:00:00Z"}]},
 {round:9,slug:"britain",name:"British Grand Prix",circuit:"Silverstone Circuit",locality:"Silverstone",country:"UK",sprint:true,tz:"Europe/London",sessions:[{slug:"fp1",name:"Practice 1",start:"2026-07-03T11:30:00Z"},{slug:"sprint-qualifying",name:"Sprint Qualifying",start:"2026-07-03T15:30:00Z"},{slug:"sprint",name:"Sprint",start:"2026-07-04T11:00:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-07-04T15:00:00Z"},{slug:"race",name:"Race",start:"2026-07-05T14:00:00Z"}]},
 {round:10,slug:"belgium",name:"Belgian Grand Prix",circuit:"Circuit de Spa-Francorchamps",locality:"Spa",country:"Belgium",sprint:false,tz:"Europe/Brussels",sessions:[{slug:"fp1",name:"Practice 1",start:"2026-07-17T11:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-07-17T15:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-07-18T10:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-07-18T14:00:00Z"},{slug:"race",name:"Race",start:"2026-07-19T13:00:00Z"}]},
 {round:11,slug:"hungary",name:"Hungarian Grand Prix",circuit:"Hungaroring",locality:"Budapest",country:"Hungary",sprint:false,tz:"Europe/Budapest",sessions:[{slug:"fp1",name:"Practice 1",start:"2026-07-24T11:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-07-24T15:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-07-25T10:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-07-25T14:00:00Z"},{slug:"race",name:"Race",start:"2026-07-26T13:00:00Z"}]},
 {round:12,slug:"netherlands",name:"Dutch Grand Prix",circuit:"Circuit Park Zandvoort",locality:"Zandvoort",country:"Netherlands",sprint:true,tz:"Europe/Amsterdam",sessions:[{slug:"fp1",name:"Practice 1",start:"2026-08-21T10:30:00Z"},{slug:"sprint-qualifying",name:"Sprint Qualifying",start:"2026-08-21T14:30:00Z"},{slug:"sprint",name:"Sprint",start:"2026-08-22T10:00:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-08-22T14:00:00Z"},{slug:"race",name:"Race",start:"2026-08-23T13:00:00Z"}]},
 {round:13,slug:"italy",name:"Italian Grand Prix",circuit:"Autodromo Nazionale di Monza",locality:"Monza",country:"Italy",sprint:false,tz:"Europe/Rome",sessions:[{slug:"fp1",name:"Practice 1",start:"2026-09-04T10:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-09-04T14:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-09-05T10:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-09-05T14:00:00Z"},{slug:"race",name:"Race",start:"2026-09-06T13:00:00Z"}]},
 {round:14,slug:"spain",name:"Spanish Grand Prix",circuit:"Madring",locality:"Madrid",country:"Spain",sprint:false,tz:"Europe/Madrid",sessions:[{slug:"fp1",name:"Practice 1",start:"2026-09-11T11:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-09-11T15:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-09-12T10:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-09-12T14:00:00Z"},{slug:"race",name:"Race",start:"2026-09-13T13:00:00Z"}]},
 {round:15,slug:"azerbaijan",name:"Azerbaijan Grand Prix",circuit:"Baku City Circuit",locality:"Baku",country:"Azerbaijan",sprint:false,tz:"Asia/Baku",sessions:[{slug:"fp1",name:"Practice 1",start:"2026-09-24T08:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-09-24T12:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-09-25T08:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-09-25T12:00:00Z"},{slug:"race",name:"Race",start:"2026-09-26T11:00:00Z"}]},
 {round:16,slug:"bahrain",name:"Bahrain Grand Prix",circuit:"Sepang International Circuit",locality:"Sepang",country:"Malaysia",sprint:false,tz:"Asia/Kuala_Lumpur",sessions:[{slug:"fp1",name:"Practice 1",start:"2026-10-02T04:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-10-02T08:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-10-03T04:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-10-03T08:00:00Z"},{slug:"race",name:"Race",start:"2026-10-04T07:00:00Z"}]},
 {round:17,slug:"singapore",name:"Singapore Grand Prix",circuit:"Marina Bay Street Circuit",locality:"Marina Bay",country:"Singapore",sprint:true,tz:"Asia/Singapore",sessions:[{slug:"fp1",name:"Practice 1",start:"2026-10-09T08:30:00Z"},{slug:"sprint-qualifying",name:"Sprint Qualifying",start:"2026-10-09T12:30:00Z"},{slug:"sprint",name:"Sprint",start:"2026-10-10T09:00:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-10-10T13:00:00Z"},{slug:"race",name:"Race",start:"2026-10-11T12:00:00Z"}]},
 {round:18,slug:"usa",name:"United States Grand Prix",circuit:"Circuit of the Americas",locality:"Austin",country:"USA",sprint:false,tz:"America/Chicago",sessions:[{slug:"fp1",name:"Practice 1",start:"2026-10-23T17:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-10-23T21:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-10-24T17:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-10-24T21:00:00Z"},{slug:"race",name:"Race",start:"2026-10-25T20:00:00Z"}]},
 {round:19,slug:"mexico",name:"Mexico City Grand Prix",circuit:"Autódromo Hermanos Rodríguez",locality:"Mexico City",country:"Mexico",sprint:false,tz:"America/Mexico_City",sessions:[{slug:"fp1",name:"Practice 1",start:"2026-10-30T18:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-10-30T22:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-10-31T17:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-10-31T21:00:00Z"},{slug:"race",name:"Race",start:"2026-11-01T20:00:00Z"}]},
 {round:20,slug:"brazil",name:"Brazilian Grand Prix",circuit:"Autódromo José Carlos Pace",locality:"São Paulo",country:"Brazil",sprint:false,tz:"America/Sao_Paulo",sessions:[{slug:"fp1",name:"Practice 1",start:"2026-11-06T15:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-11-06T19:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-11-07T14:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-11-07T18:00:00Z"},{slug:"race",name:"Race",start:"2026-11-08T17:00:00Z"}]},
 {round:21,slug:"lasvegas",name:"Las Vegas Grand Prix",circuit:"Las Vegas Strip Street Circuit",locality:"Las Vegas",country:"USA",sprint:false,tz:"America/Los_Angeles",sessions:[{slug:"fp1",name:"Practice 1",start:"2026-11-20T00:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-11-20T04:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-11-21T00:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-11-21T04:00:00Z"},{slug:"race",name:"Race",start:"2026-11-22T04:00:00Z"}]},
 {round:22,slug:"qatar",name:"Qatar Grand Prix",circuit:"Losail International Circuit",locality:"Lusail",country:"Qatar",sprint:false,tz:"Asia/Qatar",sessions:[{slug:"fp1",name:"Practice 1",start:"2026-11-27T13:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-11-27T17:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-11-28T14:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-11-28T18:00:00Z"},{slug:"race",name:"Race",start:"2026-11-29T16:00:00Z"}]},
 {round:23,slug:"abudhabi",name:"Abu Dhabi Grand Prix",circuit:"Yas Marina Circuit",locality:"Abu Dhabi",country:"UAE",sprint:false,tz:"Asia/Dubai",sessions:[{slug:"fp1",name:"Practice 1",start:"2026-12-04T09:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-12-04T13:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-12-05T10:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-12-05T14:00:00Z"},{slug:"race",name:"Race",start:"2026-12-06T13:00:00Z"}]}
];

// Parse session timestamps once into numeric milliseconds.
schedule.forEach((event) => event.sessions.forEach((session) => {
  session.ts = Date.parse(session.start);
}));

function hoursSince(s) {
  if (!s || !s.ts) return Infinity;
  return (Date.now() - s.ts) / 3600000;
}

function sessionDurationHours(s) {
  const key = `${s?.slug || ''} ${s?.name || ''}`.toLowerCase();
  if (/\bsprint[- ]qualif/.test(key) || key.includes('sprint-qualifying')) return 1.25;
  if (/\bsprint\b/.test(key) && !/qualif/.test(key)) return 1;
  if (/qualif/.test(key)) return 1.25;
  if (/\brace\b/.test(key)) return 5;
  return 1.25;
}

function isStreamAvailable(s) {
  if (!s) return false;
  if (streamWindowState.active) return true;
  const d = hoursSince(s);
  return d >= -1 && d <= sessionDurationHours(s);
}

function isSessionEnded(s) {
  if (!s) return false;
  // race overtime: keep live up to +1h after 5h window
  const extra = /\brace\b/i.test(`${s?.slug || ''} ${s?.name || ''}`) ? 1 : 0.25;
  return hoursSince(s) > sessionDurationHours(s) + extra;
}

function isDateEnded(d) {
  return Boolean(d && (new Date() - new Date(d + 'T23:59:59Z')) > 0);
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
function getStreamEastSlug(event, session) {
  const ev = (event?.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const sess = (session?.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `ppv-${ev}-${sess}`;
}

const sources=[
 {id:"westream",label:"WeStream F1",url:"https://westreamf1.com/westreamf1.php"},
 {id:"sky-uk",label:"Sky UHD",url:"https://strmfree.st/embed/racing/skyf1"},
 {id:"f1tv",label:"F1TV",suffix:""},
 {id:"appletv",label:"AppleTV",streamNum:3},
 {id:"dazn",label:"DAZN",streamNum:5},
 {id:"wikisport",label:"WikiSport",url:"https://wikisport.info/strm/f1.php"}
];



let disabledSources = new Set();
const sourceEnabled = (s) => !disabledSources.has(s.id);

function normalizeCurrentSource() {
  if (currentSource >= 0 && currentSource < sources.length && sourceEnabled(sources[currentSource])) return;
  const first = sources.findIndex(sourceEnabled);
  if (first >= 0) currentSource = first;
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
let currentSource = 0;
let activeView = 'home';
let playerLoadToken = 0;

const buildUrl = (i) => {
  const s = sources[i];
  if (!s) return "";
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
  const src = sources[currentSource] || { label: "-", suffix: "" };
  if (stageLabel) stageLabel.textContent = "freef1://live/" + currentEvent.slug + "/" + currentSession.slug + (src.suffix !== undefined ? src.suffix : "/" + src.id);
  if (sourceLabel) sourceLabel.textContent = "SOURCE · " + src.label.toUpperCase();
  if (badgeEl) badgeEl.style.display = isStreamAvailable(currentSession) ? "inline-flex" : "none";
}

function renderButtons() {
  if (!linksEl) return;
  linksEl.innerHTML = "";
  normalizeCurrentSource();
  sources.forEach((s, i) => {
    if (!sourceEnabled(s)) return;
    const b = document.createElement("button");
    b.className = "chip" + (i === currentSource ? " active" : "");
    b.textContent = s.label;
    b.onclick = () => {
      currentSource = i;
      renderButtons();
      updateHeader();
      load();
    };
    linksEl.appendChild(b);
  });
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
  const msgs = [
    { t: "Hang tight", x: "We're working on getting this stream up for you. Check back soon!" },
    { t: "Formation lap", x: "Our crew is setting up the feed. A few more moments and you'll be good to go." },
    { t: "In the garage", x: "Getting everything ready for the best viewing experience possible." },
    { t: "Almost there", x: "Just a little more patience and you'll be watching the race in no time." },
    { t: "Stay tuned", x: "The stream will be up shortly. We appreciate your patience!" }
  ];
  let i = 0;
  (function next() {
    if (!nsRunning) return;
    if (nsPaused) {
      nsTimer = setTimeout(next, 500);
      return;
    }
    if (t && x) {
      [t, x].forEach((e) => {
        e.style.opacity = "0";
        e.style.transform = "translateY(8px)";
      });
    }
    nsTimer = setTimeout(() => {
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
      nsTimer = setTimeout(next, 5000);
    }, 1100);
  })();
}

noStreamEl?.addEventListener("mouseenter", () => { nsPaused = true; });
noStreamEl?.addEventListener("mouseleave", () => { nsPaused = false; });
document.addEventListener("visibilitychange", () => { nsPaused = document.hidden; });

nsActionsEl?.addEventListener("click", (e) => {
  if (e.target.id === "nsRetryBtn") {
    load();
  } else if (e.target.id === "nsNextBtn") {
    switchToNextSource();
  } else if (e.target.id === "nsNewTabBtn") {
    window.open(buildUrl(currentSource), "_blank", "noopener");
  } else if (e.target.id === "nsStayBtn") {
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

$("streamStartBtn")?.addEventListener("click", () => {
  updateStreamStartAffordance(false);
  load();
});

function showNoStream(opts) {
  const blocked = Boolean(opts && opts.blocked);
  const hijack = Boolean(opts && opts.hijack);
  loaderEl?.classList.add("hidden");
  noStreamEl?.classList.add("visible");
  if (nsActionsEl) nsActionsEl.hidden = !blocked;
  if (nsStayBtn) nsStayBtn.hidden = !hijack;
  setStreamOnScreen(false);
  updateStreamStartAffordance(false);
  if (!(opts && opts.keepFrame)) {
    playerEl?.querySelector("iframe")?.remove();
    playerEl?.querySelector("video")?.remove();
  }
  if (blocked) {
    stopNS();
    if (noStreamTitleEl) noStreamTitleEl.textContent = (opts && opts.title) || (hijack ? HIJACK_TITLE : "Feed blocked on this device");
    if (noStreamTextEl) noStreamTextEl.textContent = (opts && opts.text) || (hijack ? HIJACK_COPY : BLOCKED_COPY);
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
navigator.wakeLock?.addEventListener?.('release', ()=>{ /* handled per-lock */ });
// Try immediately on load (will be blocked without gesture on most browsers — caught below)
// + re-try on the very first user tap/key anywhere so it IS active as soon as they interact,
// even before they hit Play. Once a stream is on, syncScreenWakeLock keeps it held.
setTimeout(()=>{ requestScreenWakeLock().catch(()=>{}); }, 800);
['click','touchstart','pointerdown','keydown','touchend'].forEach(ev=>{
  document.addEventListener(ev, ()=>{
    // if a stream is already on, this arms it; if not, it pre-warms so the next Play is instant
    requestScreenWakeLock().catch(()=>{});
  }, { once:true, passive:true, capture:true });
});

function pageHasActivation() {
  try {
    const ua = navigator.userActivation;
    return !ua || ua.hasBeenActive === true;
  } catch (_) {
    return true;
  }
}

function updateStreamStartAffordance(feedIsUp) {
  const el = $("streamStart");
  if (!el) return;
  el.hidden = !(feedIsUp && !pageHasActivation());
}

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
    updateStreamStartAffordance(true);
    f.classList.add('loaded');
    setStreamOnScreen(true);
    requestScreenWakeLock().catch(()=>{});
    setTimeout(() => {
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

  setTimeout(() => {
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
  setLoaderText("Establishing feed…");
  updateStreamStartAffordance(false);
  playerEl?.querySelector("iframe")?.remove();
  playerEl?.querySelector("video")?.remove();

  const videoMime = streamOverride.type === 'webm' ? 'video/webm' : streamOverride.type === 'mp4' ? 'video/mp4' : '';
  if (streamOverride.active && streamOverride.url) {
    const f = document.createElement(videoMime ? 'video' : 'iframe');
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
          updateStreamStartAffordance(true);
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
        updateStreamStartAffordance(true);
        setTimeout(() => {
          if (token === playerLoadToken) loaderEl?.classList.add('hidden');
        }, 180);
      };
      {
        let settled = false;
        let navs = 0;
        const wasSettled = () => settled;
        const origLoad = f.onload;
        f.onload = (e) => {
          origLoad(e);
          if (f.style.opacity === '1') settled = true;
        };
        f.addEventListener("load", () => {
          if (token !== playerLoadToken || !wasSettled()) return;
          navs++;
          if (navs === 1) return;
          showNoStream({ blocked: true, hijack: true, keepFrame: true });
        });
      }
      setTimeout(() => {
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

function applySiteConfig(config, { fresh = false } = {}) {
  if (!config || typeof config !== 'object') return;
  if (config.streamWindow) applyStreamWindow(config.streamWindow);
  if (config.sources) applySourceConfig(config.sources);
  if (config.streamOverride || config.override) applyStreamOverride(config.streamOverride || config.override);
  if (Array.isArray(config.news)) applyNewsUpdate(config.news, fresh);
  if (fresh) applyMaintenanceMode(config.maintenance, { fresh: true });
}

let siteConfigRefreshPromise = null;
let lastSiteConfigRefreshAt = 0;

function acceptFreshSiteConfig(config) {
  if (!config || typeof config !== 'object') return false;
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
let customSelectSequence = 0;

function enhanceSelect(select) {
  if (!select || select.dataset.customEnhanced === 'true') return;
  select.dataset.customEnhanced = 'true';
  const shell = document.createElement('div');
  shell.className = 'select-shell';
  select.parentNode.insertBefore(shell, select);
  shell.appendChild(select);

  const menuId = `custom-select-menu-${++customSelectSequence}`;
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'select-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', menuId);

  const label = select.closest('.sel')?.querySelector(`label[for="${select.id}"]`);
  if (label) {
    if (!label.id) label.id = `${select.id}-label`;
    trigger.setAttribute('aria-labelledby', label.id);
  }
  trigger.innerHTML = '<span class="select-value"></span><span class="select-chevron" aria-hidden="true"></span>';

  const menu = document.createElement('div');
  menu.className = 'select-menu';
  menu.id = menuId;
  menu.setAttribute('role', 'listbox');
  menu.hidden = true;
  shell.insertBefore(trigger, select);
  shell.appendChild(menu);

  select.classList.add('native-select-source');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');

  let optionButtons = [];

  const getAvailableIndex = (start, direction) => {
    let index = start;
    while (index >= 0 && index < optionButtons.length) {
      const option = optionButtons[index];
      if (!option.disabled && !option.hidden) return index;
      index += direction;
    }
    return -1;
  };

  const close = (focusTrigger) => {
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    shell.classList.remove('is-open');
    shell.closest('.sel')?.classList.remove('is-open');
    shell.closest('.deck-box')?.classList.remove('has-open-menu');
    shell.closest('.deck')?.classList.remove('has-open-menu');
    if (focusTrigger) trigger.focus();
  };

  const sync = () => {
    const selected = select.options[select.selectedIndex];
    const value = trigger.querySelector('.select-value');
    if (value) value.textContent = selected?.textContent || 'Select an option';
    trigger.disabled = select.disabled || !select.options.length;
    menu.replaceChildren();
    optionButtons = [];
    [...select.options].forEach((option, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'select-option';
      button.textContent = option.textContent;
      button.dataset.value = option.value;
      button.dataset.index = String(index);
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', String(index === select.selectedIndex));
      button.disabled = Boolean(option.disabled);
      button.hidden = Boolean(option.hidden);
      if (option.disabled) button.classList.add('is-disabled');
      button.addEventListener('click', () => {
        if (option.disabled || option.hidden) return;
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        sync();
        close(false);
        trigger.focus();
      });
      menu.appendChild(button);
      optionButtons.push(button);
    });
  };

  const open = (direction) => {
    if (trigger.disabled) return;
    sync();
    menu.hidden = false;
    menu.classList.remove('above');
    const menuRect = menu.getBoundingClientRect();
    const shellRect = shell.getBoundingClientRect();
    if (menuRect.bottom > innerHeight - 12 && shellRect.top > menuRect.height + 12) {
      menu.classList.add('above');
    }
    trigger.setAttribute('aria-expanded', 'true');
    shell.classList.add('is-open');
    shell.closest('.sel')?.classList.add('is-open');
    shell.closest('.deck-box')?.classList.add('has-open-menu');
    shell.closest('.deck')?.classList.add('has-open-menu');
    const selectedIndex = select.selectedIndex >= 0 ? select.selectedIndex : 0;
    const step = direction || 0;
    const target = step ? getAvailableIndex(selectedIndex + step, step) : getAvailableIndex(selectedIndex, 1);
    (optionButtons[target >= 0 ? target : selectedIndex] || optionButtons[0])?.focus();
  };

  trigger.addEventListener('click', () => {
    if (menu.hidden) open(0);
    else close(false);
  });

  trigger.addEventListener('keydown', (event) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      if (menu.hidden) open(event.key === 'ArrowUp' ? -1 : 1);
      else close(false);
    }
  });

  menu.addEventListener('keydown', (event) => {
    const current = optionButtons.indexOf(document.activeElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    if (event.key === 'Tab') {
      close(true);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      document.activeElement?.click();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = getAvailableIndex(current + (event.key === 'ArrowDown' ? 1 : -1), event.key === 'ArrowDown' ? 1 : -1);
      if (next >= 0) optionButtons[next].focus();
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const next = getAvailableIndex(event.key === 'Home' ? 0 : optionButtons.length - 1, event.key === 'Home' ? 1 : -1);
      if (next >= 0) optionButtons[next].focus();
    }
  });

  select.addEventListener('change', sync);
  new MutationObserver(sync).observe(select, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['disabled', 'hidden', 'selected']
  });
  select._syncCustom = sync;
  sync();
}

function setupCustomSelects() {
  document.querySelectorAll('.sel > select').forEach(enhanceSelect);
  document.addEventListener('click', (event) => {
    document.querySelectorAll('.select-shell').forEach((shell) => {
      if (!shell.contains(event.target)) {
        const trigger = shell.querySelector('.select-trigger');
        const menu = shell.querySelector('.select-menu');
        if (trigger && menu && !menu.hidden) {
          menu.hidden = true;
          trigger.setAttribute('aria-expanded', 'false');
          shell.classList.remove('is-open');
          shell.closest('.sel')?.classList.remove('is-open');
          shell.closest('.deck-box')?.classList.remove('has-open-menu');
          shell.closest('.deck')?.classList.remove('has-open-menu');
        }
      }
    });
  });
}

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

mobileMenu?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeNav));
document.addEventListener('click', (event) => {
  if (!navEl?.contains(event.target)) closeNav();
});
addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeNav();
});

const revealEls = document.querySelectorAll('.rv');
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
let ticking = false;

function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    const y = scrollY;
    const height = innerHeight;
    const pageHeight = document.documentElement.scrollHeight;
    const breakRect = !liteMotion && breakLayer?.parentElement
      ? breakLayer.parentElement.getBoundingClientRect()
      : null;

    navEl?.classList.toggle('stuck', y > 40 || activeView !== 'home');
    if (progressEl) progressEl.style.transform = 'scaleX(' + (pageHeight > height ? y / (pageHeight - height) : 0) + ')';
    if (!liteMotion && heroLayer && y < height * 1.3) {
      heroLayer.style.transform = `translate3d(0,${y * 0.38}px,0) scale(1.06)`;
    }
    if (breakRect && breakRect.bottom > 0 && breakRect.top < height) {
      const p = (height - breakRect.top) / (height + breakRect.height);
      breakLayer.style.transform = `translate3d(0,${(p - 0.5) * 90}px,0) scale(1.1)`;
    }
    ticking = false;
  });
}

addEventListener('scroll', onScroll, { passive: true });
onScroll();
addEventListener('resize', () => {
  if (innerWidth > 900) closeNav();
}, { passive: true });

/* ═══════════════ 12. VIEWS & SPA ROUTER ═══════════════ */
let viewSwapTimer = null;

function routeFromPath(path) {
  const seg = (path || '/').replace(/^\/+|\/+$/g, '').toLowerCase();
  return seg in VIEWS ? seg : 'home';
}

function revealNow(root) {
  root.querySelectorAll('.rv').forEach((el) => el.classList.add('in'));
}

function setActiveNav(route) {
  document.querySelectorAll('.nav-links a[data-route]').forEach((a) => {
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

  viewSwapTimer = setTimeout(() => {
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
  const a = event.target.closest('a[data-route]');
  if (!a) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault();
  navigate(a.dataset.route);
});

document.addEventListener('click', (event) => {
  const a = event.target.closest('a[href^="#"]');
  if (!a || activeView === 'home') return;
  const id = a.getAttribute('href').slice(1);
  const target = document.getElementById(id);
  if (!target) return;
  event.preventDefault();
  showView('home', { push: true, scroll: false });
  setTimeout(() => target.scrollIntoView({ behavior: reduceMotion ? 'instant' : 'smooth' }), VIEW_SWAP_MS + 40);
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
document.querySelectorAll('.acc-q').forEach((btn) => {
  if (!btn.hasAttribute('aria-expanded')) btn.setAttribute('aria-expanded', 'false');
  btn.addEventListener('click', () => {
    const item = btn.parentElement;
    const a = item.querySelector('.acc-a');
    const was = item.classList.contains('active');
    item.closest('.acc-wrap')?.querySelectorAll('.acc-item').forEach((i) => {
      i.classList.remove('active');
      i.querySelector('.acc-q')?.setAttribute('aria-expanded', 'false');
      const innerA = i.querySelector('.acc-a');
      if (innerA) innerA.style.maxHeight = null;
    });
    if (!was && a) {
      item.classList.add('active');
      btn.setAttribute('aria-expanded', 'true');
      a.style.maxHeight = a.scrollHeight + 'px';
    }
  });
});

function openPanel(id) {
  document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === id));
  document.querySelectorAll('#infoTabs [role="tab"]').forEach((t) => {
    const active = t.dataset.panel === id;
    t.classList.toggle('active', active);
    t.setAttribute('aria-selected', String(active));
  });
}

document.querySelectorAll('#infoTabs [role="tab"]').forEach((t) => {
  t.addEventListener('click', () => openPanel(t.dataset.panel));
});

document.querySelectorAll('[role="tablist"]').forEach((tabList) => {
  tabList.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = [...tabList.querySelectorAll('[role="tab"]')];
    const current = tabs.indexOf(document.activeElement);
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

document.querySelectorAll('.foot-links button[data-panel]').forEach((b) => {
  b.addEventListener('click', () => {
    openPanel(b.dataset.panel);
    navigate('info');
  });
});

/* ═══════════════ 14. STANDINGS (DRIVERS & CONSTRUCTORS) ═══════════════ */
const rowsEl = $("standingsList");
const loadEl = $("standingsLoading");
let driverStandingsPromise = null;

function getDriverStandings() {
  if (!driverStandingsPromise) {
    driverStandingsPromise = fetchJson(`${JOLPI}/${SITE_SEASON}/driverstandings/`)
      .then((data) => data?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || []);
  }
  return driverStandingsPromise;
}

function renderStandings(type, list) {
  if (!rowsEl) return;
  rowsEl.innerHTML = '';
  const fragment = document.createDocumentFragment();
  list.forEach((it, i) => {
    const row = document.createElement('div');
    row.className = 'row' + (i === 0 ? ' p1' : '');
    row.style.animation = `rowIn .5s var(--ease) ${i * 24}ms both`;
    const name = type === 'drivers'
      ? `${it.Driver?.givenName || ''} ${it.Driver?.familyName || ''}`
      : (it.Constructor?.name || '');
    const sub = type === 'drivers'
      ? (it.Constructors?.[0]?.name || '')
      : `${it.wins || '0'} wins`;
    const tc = hexFor(type === 'drivers' ? it.Constructors?.[0]?.name : it.Constructor?.name);
    row.style.setProperty('--team', tc);
    row.innerHTML = `<div class="pos">${escapeHtml(it.position)}</div><div class="who"><b>${escapeHtml(name)}</b><small>${escapeHtml(sub)}</small></div><div class="pts">${escapeHtml(it.points)}<small>PTS</small></div>`;
    fragment.appendChild(row);
  });
  rowsEl.replaceChildren(fragment);
  if (loadEl) loadEl.style.display = 'none';
  rowsEl.style.opacity = '1';
}

const standingsCache = new Map();

function loadStandings(type) {
  const url = `${JOLPI}/${SITE_SEASON}/${type === 'drivers' ? 'driverstandings' : 'constructorstandings'}/?limit=30`;
  const cached = standingsCache.get(type) || readApiFallback(url);

  // If already in memory or localStorage, render instantly (0ms latency, no flicker)
  if (cached) {
    const lists = cached?.MRData?.StandingsTable?.StandingsLists?.[0];
    const list = type === 'drivers' ? lists?.DriverStandings : lists?.ConstructorStandings;
    if (list && list.length) {
      renderStandings(type, list);
    }
  } else {
    if (loadEl) {
      loadEl.style.display = 'block';
      loadEl.textContent = 'Loading standings…';
    }
    if (rowsEl) rowsEl.style.opacity = '0.35';
  }

  fetchJson(url)
    .then((data) => {
      standingsCache.set(type, data);
      const lists = data?.MRData?.StandingsTable?.StandingsLists?.[0];
      const list = type === 'drivers' ? lists?.DriverStandings : lists?.ConstructorStandings;
      if (!list || !list.length) throw new Error('Empty');
      renderStandings(type, list);
    })
    .catch(() => {
      if (!cached) {
        if (loadEl) loadEl.textContent = 'Standings unavailable right now.';
        if (rowsEl) rowsEl.style.opacity = '1';
      }
    });
}

document.querySelectorAll('#standings [role="tab"]').forEach((t) => {
  t.addEventListener('click', () => {
    document.querySelectorAll('#standings [role="tab"]').forEach((x) => {
      const active = x === t;
      x.classList.toggle('active', active);
      x.setAttribute('aria-selected', String(active));
    });
    loadStandings(t.dataset.type);
  });
});

/* ═══════════════ 15. DRIVER GRID (LIVE ORDER) ═══════════════ */
let driverEntries = [];

function renderDriverGrid(list) {
  const el = $("driverGrid");
  if (!el) return;
  if (!list || !list.length) {
    fadeSwapContent(el, () => {
      el.innerHTML = '<div class="state">Grid unavailable right now.</div>';
    });
    return;
  }
  driverEntries = list.slice();
  const renderFollowing = getFollowing();
  const fragment = document.createDocumentFragment();
  let rendered = 0;

  list.forEach((it) => {
    const d = it.Driver || {};
    const team = it.Constructors?.[0]?.name || '';
    const src = photoFor(d.driverId);
    const a = document.createElement('article');
    a.className = 'dcard' + (it.position === '1' ? ' lead' : '') + (src ? '' : ' noimg');
    const accent = hexFor(team);
    a.style.setProperty('--c', accent);
    a.style.setProperty('--c-ink', inkOn(accent));
    const label = `View ${d.givenName || ''} ${d.familyName || ''} profile`.replace(/\s+/g, ' ').trim();
    a.setAttribute('role', 'button');
    a.tabIndex = 0;
    a.setAttribute('aria-label', label);
    a.title = label;
    a.dataset.driverId = d.driverId;
    a.innerHTML = `<div class="dshade"></div><div class="dfall">${escapeHtml((d.givenName?.[0] || '') + (d.familyName?.[0] || ''))}</div>
      ${src ? `<img src="${src}" alt="${escapeHtml(`${d.givenName || ''} ${d.familyName || ''}`)}" width="440" height="587" loading="lazy" decoding="async" fetchpriority="low" referrerpolicy="no-referrer">` : ''}
      <div class="dpos">P${escapeHtml(it.position)}</div><div class="dnum">${escapeHtml(d.permanentNumber || '')}</div>
      <div class="dhint">View profile</div>
      <div class="fbadge"${renderFollowing.includes(d.driverId) ? '' : ' hidden'}>★ Following</div>
      <div class="dbody"><div class="dname"><small>${escapeHtml(d.givenName || '')}</small>${escapeHtml(d.familyName || '')}</div>
      <div class="dteam"><i></i>${escapeHtml(team)}</div><div class="dpts">${escapeHtml(it.points)} PTS · ${escapeHtml(it.wins)} WIN${it.wins === '1' ? '' : 'S'}</div></div>`;
    a.querySelector('img')?.addEventListener('error', () => a.classList.add('noimg'), { once: true });
    const open = () => openDriverProfile(d.driverId);
    a.addEventListener('click', open);
    a.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
    fragment.appendChild(a);
    rendered++;
  });
  if (rendered) {
    fadeSwapContent(el, () => el.replaceChildren(fragment));
  } else {
    fadeSwapContent(el, () => {
      el.innerHTML = '<div class="state">Grid unavailable right now.</div>';
    });
  }
}

function loadDriverGrid() {
  getDriverStandings()
    .then(renderDriverGrid)
    .catch(() => {
      const el = $("driverGrid");
      if (el) fadeSwapContent(el, () => {
        el.innerHTML = '<div class="state">Grid unavailable right now.</div>';
      });
    });
}

/* ═══════════════ 16. DRIVER PROFILE MODAL ═══════════════ */
const dOverlay = $("driverOverlay");
const dSheet = $("driverSheet");
const dProfile = $("driverProfile");
let driverProfileToken = 0;
const driverCareerCache = new Map();
const CAREER_LS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 12h client cache — Jolpi is slow (multi-page + title checks)
const CAREER_LS_PREFIX = 'freef1_career_v2_';
const careerTitleCache = new Map(); // year -> champion driverId (or null)
function readCareerLs(driverId){
  try{
    const raw = store.get(CAREER_LS_PREFIX + driverId);
    if(!raw) return null;
    const obj = JSON.parse(raw);
    if(!obj || !obj.savedAt || !obj.career) return null;
    if(Date.now() - Number(obj.savedAt) > CAREER_LS_TTL_MS) return null;
    return obj.career;
  }catch(_){ return null; }
}
function writeCareerLs(driverId, career){
  try{
    store.set(CAREER_LS_PREFIX + driverId, JSON.stringify({ savedAt: Date.now(), career }));
    // LRU trim: keep at most 20 drivers
    const keys = [];
    try{ for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k && k.indexOf(CAREER_LS_PREFIX)===0) keys.push(k); } }catch(_){}
    if(keys.length>20){
      keys.sort((a,b)=>{ try{ return JSON.parse(store.get(a)||'{}').savedAt - JSON.parse(store.get(b)||'{}').savedAt; }catch(_){ return 0; } });
      for(let i=0;i<keys.length-20;i++) try{ localStorage.removeItem(keys[i]); }catch(_){}
    }
  }catch(_){}
}

function getFollowing() {
  try {
    const list = JSON.parse(store.get(FOLLOW_KEY) || '[]');
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : [];
  } catch (_) {
    return [];
  }
}

function syncFollowBadges() {
  const following = getFollowing();
  document.querySelectorAll('.dcard[data-driver-id]').forEach((card) => {
    const badge = card.querySelector('.fbadge');
    if (badge) badge.hidden = !following.includes(card.dataset.driverId);
  });
}

function teamEntryForConstructor(name) {
  const n = String(name || '').trim().toLowerCase();
  if (TEAM_ALIAS[n]) return teams.find((t) => t.id === TEAM_ALIAS[n]) || teams[0];
  return teams.find((t) => t.id !== 'default' && (n.includes(t.name.toLowerCase()) || t.name.toLowerCase().includes(n))) || teams[0];
}

async function fetchCareerJson(url, attempts = 3) {
  let wait = 400;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchJson(url);
    } catch (err) {
      if (i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, wait));
      wait = Math.min(wait * 2, 2000);
    }
  }
}

function mapPool(items, fn, size = 4) {
  const out = new Array(items.length);
  let next = 0;
  const workers = new Array(Math.min(size, items.length)).fill(0).map(async () => {
    while (next < items.length) {
      const k = next++;
      out[k] = await fn(items[k]);
    }
  });
  return Promise.all(workers).then(() => out);
}

async function fetchAllResults(driverId) {
  const first = await fetchCareerJson(`${JOLPI}/drivers/${driverId}/results/?limit=100&offset=0`).catch(() => null);
  const rows = first?.MRData?.RaceTable?.Races || [];
  const total = Number(first?.MRData?.total || rows.length);
  if (!rows.length) return null;
  if (total <= rows.length) return rows;
  const offsets = [];
  for (let off = rows.length; off < total; off += 100) offsets.push(off);
  const pages = await mapPool(offsets, (off) =>
    fetchCareerJson(`${JOLPI}/drivers/${driverId}/results/?limit=100&offset=${off}`).catch(() => null), 6);
  for (const page of pages) {
    const batch = page?.MRData?.RaceTable?.Races || [];
    if (!batch.length) return null;
    rows.push(...batch);
  }
  return rows;
}

function getDriverCareer(driverId) {
  if (driverCareerCache.has(driverId)) return driverCareerCache.get(driverId);
  const ls = readCareerLs(driverId);
  if (ls) {
    const hit = Promise.resolve(ls);
    driverCareerCache.set(driverId, hit);
    return hit;
  }
  const job = (async () => {
    try {
      // Query Jolpica directly from the browser. Results are cached locally so
      // a Render outage has no bearing on standings or career data.
      const [raceRows, poles, seasons] = await Promise.all([
        fetchAllResults(driverId),
        fetchCareerJson(`${JOLPI}/drivers/${driverId}/qualifying/1/?limit=1`).catch(() => null),
        fetchCareerJson(`${JOLPI}/drivers/${driverId}/seasons/?limit=100`).catch(() => null)
      ]);
      const races = raceRows || [];
      if (!races.length || !poles) return null;
      let wins = 0;
      let podiums = 0;
      let points = 0;
      let seasonPodiums = 0;
      const winSeasons = new Set();
      const allSeasons = new Set();

      races.forEach((r) => {
        allSeasons.add(r.season);
        const res = r.Results?.[0];
        if (!res) return;
        points += parseFloat(res.points) || 0;
        const pos = res.position;
        if (pos === '1') {
          wins++;
          podiums++;
          winSeasons.add(r.season);
        } else if (pos === '2' || pos === '3') {
          podiums++;
        }
        if (String(r.season) === String(SITE_SEASON) && (pos === '1' || pos === '2' || pos === '3')) {
          seasonPodiums++;
        }
      });

      const seasonRows = seasons?.MRData?.SeasonTable?.Seasons || [];
      const years = seasonRows.length ? seasonRows.map((s) => s.season) : [...allSeasons].sort();
      const span = years.length > 1 ? `${years[0]}–${years[years.length - 1]}` : (years[0] || String(SITE_SEASON));

      const lastRaceStart = schedule[schedule.length - 1]?.sessions?.find((s) => s.slug === 'race')?.start;
      const seasonComplete = lastRaceStart ? Date.now() > new Date(lastRaceStart).getTime() + 2 * 36e5 : false;
      const titleSeasons = [...winSeasons].filter((y) => String(y) !== String(SITE_SEASON) || seasonComplete);
      let titles = 0;

      if (titleSeasons.length) {
        const checkTitle = async (y) => {
          if (careerTitleCache.has(y)) {
            const champ = careerTitleCache.get(y);
            return champ ? champ === driverId : false;
          }
          try {
            const d = await fetchCareerJson(`${JOLPI}/${y}/driverstandings/1/?limit=1`);
            const champ = d?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings?.[0]?.Driver?.driverId || null;
            careerTitleCache.set(y, champ);
            return champ ? champ === driverId : false;
          } catch (_) {
            return null;
          }
        };
        const checks = await mapPool(titleSeasons, checkTitle, 4);
        if (checks.includes(null)) return null;
        titles = checks.filter(Boolean).length;
      }

      const career = {
        races: races.length,
        wins,
        podiums,
        seasonPodiums,
        points: fmtPts(points),
        poles: Number(poles?.MRData?.total || 0),
        seasons: years.length || allSeasons.size,
        span,
        titles
      };
      writeCareerLs(driverId, career);
      return career;
    } catch (_) {
      return null;
    }
  })();

  driverCareerCache.set(driverId, job);
  job.then((career) => {
    if (!career) driverCareerCache.delete(driverId);
  });
  return job;
}

function openDriverProfile(driverId) {
  const entry = driverEntries.find((e) => e.Driver?.driverId === driverId);
  if (!entry || !dOverlay || !dProfile) return;
  const token = ++driverProfileToken;
  const d = entry.Driver || {};
  const team = entry.Constructors?.[0]?.name || '';
  const color = hexFor(team);
  const tEntry = teamEntryForConstructor(team);
  const photo = photoFor(d.driverId);
  const code = d.code || ((d.givenName?.[0] || '') + (d.familyName?.slice(0, 2) || '')).toUpperCase() || '-';
  const num = d.permanentNumber || '';
  const age = ageFrom(d.dateOfBirth);
  const mate = driverEntries.find((e) => e !== entry && (e.Constructors?.[0]?.name || '') === team)?.Driver;
  const mateName = mate ? `${mate.givenName || ''} ${mate.familyName || ''}`.trim() : '-';

  if (dSheet) {
    dSheet.style.setProperty('--dc', color);
    dSheet.style.setProperty('--dc-ink', inkOn(color));
  }

  const following = getFollowing().includes(d.driverId);
  dProfile.innerHTML = `
    <div class="dp-card">
      <div class="dp-shade"></div>
      <div class="dp-info">
        <div class="dp-eyebrow">Driver Profile · ${SITE_SEASON} Season</div>
        <div class="dp-name"><small>${escapeHtml(d.givenName || '')}</small>${escapeHtml(d.familyName || '')}</div>
        <div class="dp-team">${tEntry.logo ? `<img src="${TEAM_LOGO(tEntry.logo, 96)}" alt="" width="30" height="30" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}<span>${escapeHtml(team || '-')}</span></div>
        <div class="dp-pills">
          <span class="dp-pos">P${escapeHtml(entry.position)}</span>
          ${num ? `<span class="dp-pill">#${escapeHtml(num)}</span>` : ''}
          <span class="dp-pill">${escapeHtml(code)}</span>
        </div>
      </div>
      <div class="dp-photo">
        ${photo ? `<img src="${photo}" alt="${escapeHtml(`${d.givenName || ''} ${d.familyName || ''}`)}" loading="eager" decoding="async" referrerpolicy="no-referrer" onerror="this.closest('.dp-photo').classList.add('noimg')">` : ''}
        <div class="dp-fall">${escapeHtml((d.givenName?.[0] || '') + (d.familyName?.[0] || ''))}</div>
      </div>
    </div>
    <div class="dp-sec">${SITE_SEASON} Season</div>
    <div class="dp-tiles">
      <div class="dp-tile"><b>P${escapeHtml(entry.position)}</b><span>Standing</span></div>
      <div class="dp-tile"><b>${escapeHtml(entry.points)}</b><span>Points</span></div>
      <div class="dp-tile"><b>${escapeHtml(entry.wins)}</b><span>Wins</span></div>
      <div class="dp-tile"><b id="dpSeasonPod">···</b><span>Podiums</span></div>
    </div>
    <div class="dp-sec">Career</div>
    <div id="dpCareer">
      <div class="dp-tiles skel"><div class="dp-tile"></div><div class="dp-tile"></div><div class="dp-tile"></div><div class="dp-tile"></div><div class="dp-tile"></div><div class="dp-tile"></div></div>
      <div class="dp-note">Loading career telemetry…</div>
    </div>
    <div class="dp-sec">Biography</div>
    <div class="dp-bio">
      <div class="dp-fact"><small>Nationality</small><b>${escapeHtml(d.nationality || '-')}</b></div>
      <div class="dp-fact"><small>Born</small><b>${escapeHtml(fmtDob(d.dateOfBirth))}${age !== null ? ` · Age ${age}` : ''}</b></div>
      <div class="dp-fact"><small>Driver Code</small><b>${escapeHtml(code)}</b></div>
      <div class="dp-fact"><small>Race Number</small><b>${escapeHtml(num || '-')}</b></div>
      <div class="dp-fact"><small>Team</small><b>${escapeHtml(team || '-')}</b></div>
      <div class="dp-fact"><small>Teammate</small><b>${escapeHtml(mateName)}</b></div>
    </div>
    <div class="dp-actions">
      <button class="btn sm${following ? ' on' : ''}" id="dpFollow" type="button" aria-pressed="${following}">${following ? '✓ Following' : '+ Follow'}</button>
      ${tEntry.id !== 'default' ? `<button class="btn sm primary" id="dpLivery" type="button">Apply ${escapeHtml(tEntry.name)} Livery</button>` : ''}
      ${d.url ? `<a class="btn sm" href="${escapeHtml(d.url)}" target="_blank" rel="noopener">Biography ↗</a>` : ''}
    </div>`;

  $("dpFollow")?.addEventListener('click', (event) => {
    const btn = event.currentTarget;
    const on = btn.getAttribute('aria-pressed') !== 'true';
    const list = getFollowing().filter((x) => x !== d.driverId);
    if (on) list.push(d.driverId);
    store.set(FOLLOW_KEY, JSON.stringify(list));
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.textContent = on ? '✓ Following' : '+ Follow';
    syncFollowBadges();
  });

  $("dpLivery")?.addEventListener('click', () => {
    applyTeamTheme(tEntry.id);
    store.set('freef1_team', tEntry.id);
    closeModal(dOverlay);
  });

  openModal(dOverlay);

  getDriverCareer(d.driverId).then((career) => {
    if (token !== driverProfileToken) return;
    renderDriverCareer(career);
  });
}

function renderDriverCareer(career) {
  const box = $("dpCareer");
  if (!box) return;
  const pod = $("dpSeasonPod");
  if (pod) fadeSwapContent(pod, () => {
    pod.textContent = career ? career.seasonPodiums : '–';
  });

  if (!career) {
    fadeSwapContent(box, () => {
      box.innerHTML = '<div class="state">Career telemetry unavailable right now.</div>';
    });
    return;
  }

  const markup = `
    <div class="dp-tiles">
      <div class="dp-tile"><b>${career.races}</b><span>Races</span></div>
      <div class="dp-tile"><b>${career.wins}</b><span>Wins</span></div>
      <div class="dp-tile"><b>${career.podiums}</b><span>Podiums</span></div>
      <div class="dp-tile"><b>${career.poles}</b><span>Poles</span></div>
      <div class="dp-tile"><b>${escapeHtml(career.points)}</b><span>Points</span></div>
      <div class="dp-tile hl"><b>${career.titles}</b><span>Title${career.titles === 1 ? '' : 's'}</span></div>
    </div>
    <div class="dp-note">F1 ${escapeHtml(career.span)} · ${career.seasons} season${career.seasons === 1 ? '' : 's'} · Career data via Ergast</div>`;
  fadeSwapContent(box, () => {
    box.innerHTML = markup;
  });
}

$("driverClose")?.addEventListener('click', () => closeModal(dOverlay));

/* ═══════════════ 17. SHARED CLASSIFICATION & SESSION RESULTS MODAL ═══════════════ */
const PRELOADED_SESSION_RESULTS = {"15_results": [{"position": "1", "grid": "1", "laps": "51", "status": "Finished", "points": "25", "Driver": {"driverId": "russell", "code": "RUS", "givenName": "George", "familyName": "Russell"}, "Constructor": {"constructorId": "mercedes", "name": "Mercedes"}, "Time": {"millis": "5882143", "time": "1:38:02.143"}, "FastestLap": {"rank": "1", "lap": "49", "Time": {"time": "1:44.916"}}}, {"position": "2", "grid": "8", "laps": "51", "status": "Finished", "points": "18", "Driver": {"driverId": "max_verstappen", "code": "VER", "givenName": "Max", "familyName": "Verstappen"}, "Constructor": {"constructorId": "red_bull", "name": "Red Bull"}, "Time": {"millis": "5882339", "time": "+0.196"}, "FastestLap": {"rank": "2", "lap": "48", "Time": {"time": "1:44.993"}}}, {"position": "3", "grid": "4", "laps": "51", "status": "Finished", "points": "15", "Driver": {"driverId": "hadjar", "code": "HAD", "givenName": "Isack", "familyName": "Hadjar"}, "Constructor": {"constructorId": "red_bull", "name": "Red Bull"}, "Time": {"millis": "5892847", "time": "+10.704"}, "FastestLap": {"rank": "4", "lap": "49", "Time": {"time": "1:45.618"}}}, {"position": "4", "grid": "2", "laps": "51", "status": "Finished", "points": "12", "Driver": {"driverId": "leclerc", "code": "LEC", "givenName": "Charles", "familyName": "Leclerc"}, "Constructor": {"constructorId": "ferrari", "name": "Ferrari"}, "Time": {"millis": "5896279", "time": "+14.136"}, "FastestLap": {"rank": "5", "lap": "44", "Time": {"time": "1:45.784"}}}, {"position": "5", "grid": "16", "laps": "51", "status": "Finished", "points": "10", "Driver": {"driverId": "antonelli", "code": "ANT", "givenName": "Andrea Kimi", "familyName": "Antonelli"}, "Constructor": {"constructorId": "mercedes", "name": "Mercedes"}, "Time": {"millis": "5896655", "time": "+14.512"}, "FastestLap": {"rank": "3", "lap": "50", "Time": {"time": "1:45.413"}}}, {"position": "6", "grid": "6", "laps": "51", "status": "Finished", "points": "8", "Driver": {"driverId": "hamilton", "code": "HAM", "givenName": "Lewis", "familyName": "Hamilton"}, "Constructor": {"constructorId": "ferrari", "name": "Ferrari"}, "Time": {"millis": "5904525", "time": "+22.382"}, "FastestLap": {"rank": "6", "lap": "49", "Time": {"time": "1:46.170"}}}, {"position": "7", "grid": "15", "laps": "51", "status": "Finished", "points": "6", "Driver": {"driverId": "arvid_lindblad", "code": "LIN", "givenName": "Arvid", "familyName": "Lindblad"}, "Constructor": {"constructorId": "rb", "name": "RB F1 Team"}, "Time": {"millis": "5913302", "time": "+31.159"}, "FastestLap": {"rank": "10", "lap": "44", "Time": {"time": "1:46.849"}}}, {"position": "8", "grid": "13", "laps": "51", "status": "Finished", "points": "4", "Driver": {"driverId": "ocon", "code": "OCO", "givenName": "Esteban", "familyName": "Ocon"}, "Constructor": {"constructorId": "haas", "name": "Haas F1 Team"}, "Time": {"millis": "5913332", "time": "+31.189"}, "FastestLap": {"rank": "14", "lap": "44", "Time": {"time": "1:47.068"}}}, {"position": "9", "grid": "10", "laps": "51", "status": "Finished", "points": "2", "Driver": {"driverId": "bearman", "code": "BEA", "givenName": "Oliver", "familyName": "Bearman"}, "Constructor": {"constructorId": "haas", "name": "Haas F1 Team"}, "Time": {"millis": "5914072", "time": "+31.929"}, "FastestLap": {"rank": "13", "lap": "45", "Time": {"time": "1:46.978"}}}, {"position": "10", "grid": "14", "laps": "51", "status": "Finished", "points": "1", "Driver": {"driverId": "sainz", "code": "SAI", "givenName": "Carlos", "familyName": "Sainz"}, "Constructor": {"constructorId": "williams", "name": "Williams"}, "Time": {"millis": "5914559", "time": "+32.416"}, "FastestLap": {"rank": "9", "lap": "49", "Time": {"time": "1:46.737"}}}, {"position": "11", "grid": "18", "laps": "51", "status": "Finished", "points": "0", "Driver": {"driverId": "hulkenberg", "code": "HUL", "givenName": "Nico", "familyName": "H\u00fclkenberg"}, "Constructor": {"constructorId": "audi", "name": "Audi"}, "Time": {"millis": "5915374", "time": "+33.231"}, "FastestLap": {"rank": "11", "lap": "45", "Time": {"time": "1:46.850"}}}, {"position": "12", "grid": "11", "laps": "51", "status": "Finished", "points": "0", "Driver": {"driverId": "lawson", "code": "LAW", "givenName": "Liam", "familyName": "Lawson"}, "Constructor": {"constructorId": "rb", "name": "RB F1 Team"}, "Time": {"millis": "5916156", "time": "+34.013"}, "FastestLap": {"rank": "12", "lap": "46", "Time": {"time": "1:46.906"}}}, {"position": "13", "grid": "3", "laps": "51", "status": "Finished", "points": "0", "Driver": {"driverId": "piastri", "code": "PIA", "givenName": "Oscar", "familyName": "Piastri"}, "Constructor": {"constructorId": "mclaren", "name": "McLaren"}, "Time": {"millis": "5918544", "time": "+36.401"}, "FastestLap": {"rank": "8", "lap": "48", "Time": {"time": "1:46.602"}}}, {"position": "14", "grid": "20", "laps": "51", "status": "Finished", "points": "0", "Driver": {"driverId": "perez", "code": "PER", "givenName": "Sergio", "familyName": "P\u00e9rez"}, "Constructor": {"constructorId": "cadillac", "name": "Cadillac F1 Team"}, "Time": {"millis": "5923543", "time": "+41.400"}, "FastestLap": {"rank": "15", "lap": "43", "Time": {"time": "1:47.363"}}}, {"position": "15", "grid": "17", "laps": "51", "status": "Finished", "points": "0", "Driver": {"driverId": "bortoleto", "code": "BOR", "givenName": "Gabriel", "familyName": "Bortoleto"}, "Constructor": {"constructorId": "audi", "name": "Audi"}, "Time": {"millis": "5926373", "time": "+44.230"}, "FastestLap": {"rank": "7", "lap": "46", "Time": {"time": "1:46.336"}}}, {"position": "16", "grid": "19", "laps": "49", "status": "Retired", "points": "0", "Driver": {"driverId": "bottas", "code": "BOT", "givenName": "Valtteri", "familyName": "Bottas"}, "Constructor": {"constructorId": "cadillac", "name": "Cadillac F1 Team"}, "Time": {"millis": "5729837", "time": ""}, "FastestLap": {"rank": "20", "lap": "49", "Time": {"time": "1:48.852"}}}, {"position": "17", "grid": "9", "laps": "36", "status": "Retired", "points": "0", "Driver": {"driverId": "colapinto", "code": "COL", "givenName": "Franco", "familyName": "Colapinto"}, "Constructor": {"constructorId": "alpine", "name": "Alpine F1 Team"}, "FastestLap": {"rank": "19", "lap": "17", "Time": {"time": "1:48.484"}}}, {"position": "18", "grid": "7", "laps": "35", "status": "Retired", "points": "0", "Driver": {"driverId": "gasly", "code": "GAS", "givenName": "Pierre", "familyName": "Gasly"}, "Constructor": {"constructorId": "alpine", "name": "Alpine F1 Team"}, "FastestLap": {"rank": "17", "lap": "28", "Time": {"time": "1:47.822"}}}, {"position": "19", "grid": "5", "laps": "35", "status": "Retired", "points": "0", "Driver": {"driverId": "norris", "code": "NOR", "givenName": "Lando", "familyName": "Norris"}, "Constructor": {"constructorId": "mclaren", "name": "McLaren"}, "FastestLap": {"rank": "16", "lap": "28", "Time": {"time": "1:47.761"}}}, {"position": "20", "grid": "12", "laps": "29", "status": "Retired", "points": "0", "Driver": {"driverId": "albon", "code": "ALB", "givenName": "Alexander", "familyName": "Albon"}, "Constructor": {"constructorId": "williams", "name": "Williams"}, "FastestLap": {"rank": "18", "lap": "29", "Time": {"time": "1:48.443"}}}, {"position": "21", "grid": "21", "laps": "20", "status": "Retired", "points": "0", "Driver": {"driverId": "alonso", "code": "ALO", "givenName": "Fernando", "familyName": "Alonso"}, "Constructor": {"constructorId": "aston_martin", "name": "Aston Martin"}, "FastestLap": {"rank": "21", "lap": "15", "Time": {"time": "1:50.968"}}}, {"position": "22", "grid": "22", "laps": "7", "status": "Retired", "points": "0", "Driver": {"driverId": "stroll", "code": "STR", "givenName": "Lance", "familyName": "Stroll"}, "Constructor": {"constructorId": "aston_martin", "name": "Aston Martin"}, "FastestLap": {"rank": "22", "lap": "7", "Time": {"time": "1:51.723"}}}], "15_qualifying": [{"position": "1", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "russell", "code": "RUS", "givenName": "George", "familyName": "Russell"}, "Constructor": {"constructorId": "mercedes", "name": "Mercedes"}, "Q1": "1:43.615", "Q2": "1:43.462", "Q3": "1:42.526"}, {"position": "2", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "leclerc", "code": "LEC", "givenName": "Charles", "familyName": "Leclerc"}, "Constructor": {"constructorId": "ferrari", "name": "Ferrari"}, "Q1": "1:44.360", "Q2": "1:43.780", "Q3": "1:43.363"}, {"position": "3", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "piastri", "code": "PIA", "givenName": "Oscar", "familyName": "Piastri"}, "Constructor": {"constructorId": "mclaren", "name": "McLaren"}, "Q1": "1:45.014", "Q2": "1:43.814", "Q3": "1:43.364"}, {"position": "4", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "hadjar", "code": "HAD", "givenName": "Isack", "familyName": "Hadjar"}, "Constructor": {"constructorId": "red_bull", "name": "Red Bull"}, "Q1": "1:44.161", "Q2": "1:43.880", "Q3": "1:43.500"}, {"position": "5", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "norris", "code": "NOR", "givenName": "Lando", "familyName": "Norris"}, "Constructor": {"constructorId": "mclaren", "name": "McLaren"}, "Q1": "1:44.571", "Q2": "1:44.020", "Q3": "1:43.672"}, {"position": "6", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "hamilton", "code": "HAM", "givenName": "Lewis", "familyName": "Hamilton"}, "Constructor": {"constructorId": "ferrari", "name": "Ferrari"}, "Q1": "1:44.260", "Q2": "1:44.037", "Q3": "1:43.858"}, {"position": "7", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "gasly", "code": "GAS", "givenName": "Pierre", "familyName": "Gasly"}, "Constructor": {"constructorId": "alpine", "name": "Alpine F1 Team"}, "Q1": "1:44.489", "Q2": "1:44.106", "Q3": "1:44.047"}, {"position": "8", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "max_verstappen", "code": "VER", "givenName": "Max", "familyName": "Verstappen"}, "Constructor": {"constructorId": "red_bull", "name": "Red Bull"}, "Q1": "1:44.041", "Q2": "1:43.706", "Q3": "1:44.081"}, {"position": "9", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "sainz", "code": "SAI", "givenName": "Carlos", "familyName": "Sainz"}, "Constructor": {"constructorId": "williams", "name": "Williams"}, "Q1": "1:45.104", "Q2": "1:44.629", "Q3": "1:44.566"}, {"position": "10", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "colapinto", "code": "COL", "givenName": "Franco", "familyName": "Colapinto"}, "Constructor": {"constructorId": "alpine", "name": "Alpine F1 Team"}, "Q1": "1:45.106", "Q2": "1:44.683", "Q3": "1:44.963"}, {"position": "11", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "bearman", "code": "BEA", "givenName": "Oliver", "familyName": "Bearman"}, "Constructor": {"constructorId": "haas", "name": "Haas F1 Team"}, "Q1": "1:45.228", "Q2": "1:44.775"}, {"position": "12", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "lawson", "code": "LAW", "givenName": "Liam", "familyName": "Lawson"}, "Constructor": {"constructorId": "rb", "name": "RB F1 Team"}, "Q1": "1:45.535", "Q2": "1:44.860"}, {"position": "13", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "albon", "code": "ALB", "givenName": "Alexander", "familyName": "Albon"}, "Constructor": {"constructorId": "williams", "name": "Williams"}, "Q1": "1:45.031", "Q2": "1:45.001"}, {"position": "14", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "ocon", "code": "OCO", "givenName": "Esteban", "familyName": "Ocon"}, "Constructor": {"constructorId": "haas", "name": "Haas F1 Team"}, "Q1": "1:45.039", "Q2": "1:45.016"}, {"position": "15", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "arvid_lindblad", "code": "LIN", "givenName": "Arvid", "familyName": "Lindblad"}, "Constructor": {"constructorId": "rb", "name": "RB F1 Team"}, "Q1": "1:45.381", "Q2": "1:45.106"}, {"position": "16", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "antonelli", "code": "ANT", "givenName": "Andrea Kimi", "familyName": "Antonelli"}, "Constructor": {"constructorId": "mercedes", "name": "Mercedes"}, "Q1": "1:45.504", "Q2": ""}, {"position": "17", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "bortoleto", "code": "BOR", "givenName": "Gabriel", "familyName": "Bortoleto"}, "Constructor": {"constructorId": "audi", "name": "Audi"}, "Q1": "1:45.799"}, {"position": "18", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "hulkenberg", "code": "HUL", "givenName": "Nico", "familyName": "H\u00fclkenberg"}, "Constructor": {"constructorId": "audi", "name": "Audi"}, "Q1": "1:45.920"}, {"position": "19", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "alonso", "code": "ALO", "givenName": "Fernando", "familyName": "Alonso"}, "Constructor": {"constructorId": "aston_martin", "name": "Aston Martin"}, "Q1": "1:46.593"}, {"position": "20", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "perez", "code": "PER", "givenName": "Sergio", "familyName": "P\u00e9rez"}, "Constructor": {"constructorId": "cadillac", "name": "Cadillac F1 Team"}, "Q1": "1:46.658"}, {"position": "21", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "stroll", "code": "STR", "givenName": "Lance", "familyName": "Stroll"}, "Constructor": {"constructorId": "aston_martin", "name": "Aston Martin"}, "Q1": "1:47.337"}, {"position": "22", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "bottas", "code": "BOT", "givenName": "Valtteri", "familyName": "Bottas"}, "Constructor": {"constructorId": "cadillac", "name": "Cadillac F1 Team"}, "Q1": "1:48.290"}], "14_results": [{"position": "1", "grid": "2", "laps": "57", "status": "Finished", "points": "25", "Driver": {"driverId": "antonelli", "code": "ANT", "givenName": "Andrea Kimi", "familyName": "Antonelli"}, "Constructor": {"constructorId": "mercedes", "name": "Mercedes"}, "Time": {"millis": "5663754", "time": "1:34:23.754"}, "FastestLap": {"rank": "2", "lap": "57", "Time": {"time": "1:36.030"}}}, {"position": "2", "grid": "3", "laps": "57", "status": "Finished", "points": "18", "Driver": {"driverId": "max_verstappen", "code": "VER", "givenName": "Max", "familyName": "Verstappen"}, "Constructor": {"constructorId": "red_bull", "name": "Red Bull"}, "Time": {"millis": "5668105", "time": "+4.351"}, "FastestLap": {"rank": "5", "lap": "52", "Time": {"time": "1:36.760"}}}, {"position": "3", "grid": "1", "laps": "57", "status": "Finished", "points": "15", "Driver": {"driverId": "norris", "code": "NOR", "givenName": "Lando", "familyName": "Norris"}, "Constructor": {"constructorId": "mclaren", "name": "McLaren"}, "Time": {"millis": "5668843", "time": "+5.089"}, "FastestLap": {"rank": "4", "lap": "52", "Time": {"time": "1:36.680"}}}, {"position": "4", "grid": "5", "laps": "57", "status": "Finished", "points": "12", "Driver": {"driverId": "leclerc", "code": "LEC", "givenName": "Charles", "familyName": "Leclerc"}, "Constructor": {"constructorId": "ferrari", "name": "Ferrari"}, "Time": {"millis": "5692870", "time": "+29.116"}, "FastestLap": {"rank": "3", "lap": "50", "Time": {"time": "1:36.063"}}}, {"position": "5", "grid": "6", "laps": "57", "status": "Finished", "points": "10", "Driver": {"driverId": "russell", "code": "RUS", "givenName": "George", "familyName": "Russell"}, "Constructor": {"constructorId": "mercedes", "name": "Mercedes"}, "Time": {"millis": "5693583", "time": "+29.829"}, "FastestLap": {"rank": "1", "lap": "49", "Time": {"time": "1:35.587"}}}, {"position": "6", "grid": "8", "laps": "57", "status": "Finished", "points": "8", "Driver": {"driverId": "lawson", "code": "LAW", "givenName": "Liam", "familyName": "Lawson"}, "Constructor": {"constructorId": "red_bull", "name": "Red Bull"}, "Time": {"millis": "5750500", "time": "+1:26.746"}, "FastestLap": {"rank": "6", "lap": "49", "Time": {"time": "1:36.846"}}}, {"position": "7", "grid": "9", "laps": "57", "status": "Finished", "points": "6", "Driver": {"driverId": "colapinto", "code": "COL", "givenName": "Franco", "familyName": "Colapinto"}, "Constructor": {"constructorId": "alpine", "name": "Alpine F1 Team"}, "Time": {"millis": "5758035", "time": "+1:34.281"}, "FastestLap": {"rank": "9", "lap": "52", "Time": {"time": "1:37.321"}}}, {"position": "8", "grid": "7", "laps": "57", "status": "Finished", "points": "4", "Driver": {"driverId": "piastri", "code": "PIA", "givenName": "Oscar", "familyName": "Piastri"}, "Constructor": {"constructorId": "mclaren", "name": "McLaren"}, "Time": {"millis": "5759593", "time": "+1:35.839"}, "FastestLap": {"rank": "7", "lap": "48", "Time": {"time": "1:37.226"}}}, {"position": "9", "grid": "10", "laps": "56", "status": "Lapped", "points": "2", "Driver": {"driverId": "arvid_lindblad", "code": "LIN", "givenName": "Arvid", "familyName": "Lindblad"}, "Constructor": {"constructorId": "rb", "name": "RB F1 Team"}, "Time": {"millis": "5674162", "time": "+10.408"}, "FastestLap": {"rank": "14", "lap": "40", "Time": {"time": "1:38.211"}}}, {"position": "10", "grid": "11", "laps": "56", "status": "Lapped", "points": "1", "Driver": {"driverId": "hulkenberg", "code": "HUL", "givenName": "Nico", "familyName": "H\u00fclkenberg"}, "Constructor": {"constructorId": "audi", "name": "Audi"}, "Time": {"millis": "5675052", "time": "+11.298"}, "FastestLap": {"rank": "11", "lap": "50", "Time": {"time": "1:38.114"}}}, {"position": "11", "grid": "13", "laps": "56", "status": "Lapped", "points": "0", "Driver": {"driverId": "ocon", "code": "OCO", "givenName": "Esteban", "familyName": "Ocon"}, "Constructor": {"constructorId": "haas", "name": "Haas F1 Team"}, "Time": {"millis": "5678897", "time": "+15.143"}, "FastestLap": {"rank": "12", "lap": "49", "Time": {"time": "1:38.119"}}}, {"position": "12", "grid": "14", "laps": "56", "status": "Lapped", "points": "0", "Driver": {"driverId": "gasly", "code": "GAS", "givenName": "Pierre", "familyName": "Gasly"}, "Constructor": {"constructorId": "alpine", "name": "Alpine F1 Team"}, "Time": {"millis": "5689906", "time": "+26.152"}, "FastestLap": {"rank": "13", "lap": "36", "Time": {"time": "1:38.141"}}}, {"position": "13", "grid": "12", "laps": "56", "status": "Lapped", "points": "0", "Driver": {"driverId": "bortoleto", "code": "BOR", "givenName": "Gabriel", "familyName": "Bortoleto"}, "Constructor": {"constructorId": "audi", "name": "Audi"}, "Time": {"millis": "5692143", "time": "+28.389"}, "FastestLap": {"rank": "10", "lap": "50", "Time": {"time": "1:37.837"}}}, {"position": "14", "grid": "15", "laps": "56", "status": "Lapped", "points": "0", "Driver": {"driverId": "tsunoda", "code": "TSU", "givenName": "Yuki", "familyName": "Tsunoda"}, "Constructor": {"constructorId": "rb", "name": "RB F1 Team"}, "Time": {"millis": "5723917", "time": "+1:00.163"}, "FastestLap": {"rank": "15", "lap": "54", "Time": {"time": "1:38.396"}}}, {"position": "15", "grid": "16", "laps": "56", "status": "Lapped", "points": "0", "Driver": {"driverId": "albon", "code": "ALB", "givenName": "Alexander", "familyName": "Albon"}, "Constructor": {"constructorId": "williams", "name": "Williams"}, "Time": {"millis": "5749966", "time": "+1:26.212"}, "FastestLap": {"rank": "18", "lap": "47", "Time": {"time": "1:39.397"}}}, {"position": "16", "grid": "22", "laps": "56", "status": "Lapped", "points": "0", "Driver": {"driverId": "bearman", "code": "BEA", "givenName": "Oliver", "familyName": "Bearman"}, "Constructor": {"constructorId": "haas", "name": "Haas F1 Team"}, "Time": {"millis": "5753717", "time": "+1:29.963"}, "FastestLap": {"rank": "8", "lap": "45", "Time": {"time": "1:37.308"}}}, {"position": "17", "grid": "17", "laps": "55", "status": "Lapped", "points": "0", "Driver": {"driverId": "alonso", "code": "ALO", "givenName": "Fernando", "familyName": "Alonso"}, "Constructor": {"constructorId": "aston_martin", "name": "Aston Martin"}, "Time": {"millis": "5697530", "time": "+33.776"}, "FastestLap": {"rank": "16", "lap": "40", "Time": {"time": "1:39.003"}}}, {"position": "18", "grid": "19", "laps": "54", "status": "Lapped", "points": "0", "Driver": {"driverId": "bottas", "code": "BOT", "givenName": "Valtteri", "familyName": "Bottas"}, "Constructor": {"constructorId": "cadillac", "name": "Cadillac F1 Team"}, "Time": {"millis": "5713000", "time": "+49.246"}, "FastestLap": {"rank": "17", "lap": "45", "Time": {"time": "1:39.130"}}}, {"position": "19", "grid": "20", "laps": "43", "status": "Retired", "points": "0", "Driver": {"driverId": "sainz", "code": "SAI", "givenName": "Carlos", "familyName": "Sainz"}, "Constructor": {"constructorId": "williams", "name": "Williams"}, "FastestLap": {"rank": "20", "lap": "36", "Time": {"time": "1:40.195"}}}, {"position": "20", "grid": "18", "laps": "31", "status": "Retired", "points": "0", "Driver": {"driverId": "perez", "code": "PER", "givenName": "Sergio", "familyName": "P\u00e9rez"}, "Constructor": {"constructorId": "cadillac", "name": "Cadillac F1 Team"}, "FastestLap": {"rank": "21", "lap": "16", "Time": {"time": "1:41.116"}}}, {"position": "21", "grid": "21", "laps": "12", "status": "Retired", "points": "0", "Driver": {"driverId": "stroll", "code": "STR", "givenName": "Lance", "familyName": "Stroll"}, "Constructor": {"constructorId": "aston_martin", "name": "Aston Martin"}, "FastestLap": {"rank": "22", "lap": "11", "Time": {"time": "1:43.462"}}}, {"position": "22", "grid": "4", "laps": "6", "status": "Retired", "points": "0", "Driver": {"driverId": "hamilton", "code": "HAM", "givenName": "Lewis", "familyName": "Hamilton"}, "Constructor": {"constructorId": "ferrari", "name": "Ferrari"}, "FastestLap": {"rank": "19", "lap": "3", "Time": {"time": "1:39.839"}}}], "14_qualifying": [{"position": "1", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "norris", "code": "NOR", "givenName": "Lando", "familyName": "Norris"}, "Constructor": {"constructorId": "mclaren", "name": "McLaren"}, "Q1": "1:33.469", "Q2": "1:32.873", "Q3": "1:31.824"}, {"position": "2", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "antonelli", "code": "ANT", "givenName": "Andrea Kimi", "familyName": "Antonelli"}, "Constructor": {"constructorId": "mercedes", "name": "Mercedes"}, "Q1": "1:33.267", "Q2": "1:32.591", "Q3": "1:31.835"}, {"position": "3", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "max_verstappen", "code": "VER", "givenName": "Max", "familyName": "Verstappen"}, "Constructor": {"constructorId": "red_bull", "name": "Red Bull"}, "Q1": "1:33.381", "Q2": "1:32.431", "Q3": "1:31.964"}, {"position": "4", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "hamilton", "code": "HAM", "givenName": "Lewis", "familyName": "Hamilton"}, "Constructor": {"constructorId": "ferrari", "name": "Ferrari"}, "Q1": "1:33.531", "Q2": "1:32.710", "Q3": "1:32.013"}, {"position": "5", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "leclerc", "code": "LEC", "givenName": "Charles", "familyName": "Leclerc"}, "Constructor": {"constructorId": "ferrari", "name": "Ferrari"}, "Q1": "1:33.532", "Q2": "1:32.755", "Q3": "1:32.019"}, {"position": "6", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "russell", "code": "RUS", "givenName": "George", "familyName": "Russell"}, "Constructor": {"constructorId": "mercedes", "name": "Mercedes"}, "Q1": "1:33.211", "Q2": "1:32.850", "Q3": "1:32.149"}, {"position": "7", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "piastri", "code": "PIA", "givenName": "Oscar", "familyName": "Piastri"}, "Constructor": {"constructorId": "mclaren", "name": "McLaren"}, "Q1": "1:33.829", "Q2": "1:33.204", "Q3": "1:32.294"}, {"position": "8", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "lawson", "code": "LAW", "givenName": "Liam", "familyName": "Lawson"}, "Constructor": {"constructorId": "red_bull", "name": "Red Bull"}, "Q1": "1:33.310", "Q2": "1:32.780", "Q3": "1:32.316"}, {"position": "9", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "colapinto", "code": "COL", "givenName": "Franco", "familyName": "Colapinto"}, "Constructor": {"constructorId": "alpine", "name": "Alpine F1 Team"}, "Q1": "1:33.963", "Q2": "1:33.038", "Q3": "1:32.903"}, {"position": "10", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "arvid_lindblad", "code": "LIN", "givenName": "Arvid", "familyName": "Lindblad"}, "Constructor": {"constructorId": "rb", "name": "RB F1 Team"}, "Q1": "1:34.340", "Q2": "1:33.204", "Q3": "1:33.041"}, {"position": "11", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "hulkenberg", "code": "HUL", "givenName": "Nico", "familyName": "H\u00fclkenberg"}, "Constructor": {"constructorId": "audi", "name": "Audi"}, "Q1": "1:34.417", "Q2": "1:33.223"}, {"position": "12", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "bortoleto", "code": "BOR", "givenName": "Gabriel", "familyName": "Bortoleto"}, "Constructor": {"constructorId": "audi", "name": "Audi"}, "Q1": "1:33.986", "Q2": "1:33.388"}, {"position": "13", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "ocon", "code": "OCO", "givenName": "Esteban", "familyName": "Ocon"}, "Constructor": {"constructorId": "haas", "name": "Haas F1 Team"}, "Q1": "1:34.667", "Q2": "1:33.667"}, {"position": "14", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "gasly", "code": "GAS", "givenName": "Pierre", "familyName": "Gasly"}, "Constructor": {"constructorId": "alpine", "name": "Alpine F1 Team"}, "Q1": "1:34.246", "Q2": "1:33.753"}, {"position": "15", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "tsunoda", "code": "TSU", "givenName": "Yuki", "familyName": "Tsunoda"}, "Constructor": {"constructorId": "rb", "name": "RB F1 Team"}, "Q1": "1:34.311", "Q2": "1:34.084"}, {"position": "16", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "albon", "code": "ALB", "givenName": "Alexander", "familyName": "Albon"}, "Constructor": {"constructorId": "williams", "name": "Williams"}, "Q1": "1:35.307", "Q2": "1:35.532"}, {"position": "17", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "sainz", "code": "SAI", "givenName": "Carlos", "familyName": "Sainz"}, "Constructor": {"constructorId": "williams", "name": "Williams"}, "Q1": "1:35.312"}, {"position": "18", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "alonso", "code": "ALO", "givenName": "Fernando", "familyName": "Alonso"}, "Constructor": {"constructorId": "aston_martin", "name": "Aston Martin"}, "Q1": "1:35.388"}, {"position": "19", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "perez", "code": "PER", "givenName": "Sergio", "familyName": "P\u00e9rez"}, "Constructor": {"constructorId": "cadillac", "name": "Cadillac F1 Team"}, "Q1": "1:35.913"}, {"position": "20", "grid": null, "laps": null, "status": null, "points": null, "Driver": {"driverId": "bottas", "code": "BOT", "givenName": "Valtteri", "familyName": "Bottas"}, "Constructor": {"constructorId": "cadillac", "name": "Cadillac F1 Team"}, "Q1": "1:38.011"}]};

const sessionResultsCache = new Map();
if (typeof PRELOADED_SESSION_RESULTS === "object") {
  for (const [key, val] of Object.entries(PRELOADED_SESSION_RESULTS)) {
    sessionResultsCache.set(key, { results: val, rcMessages: [], at: Date.now() });
  }
}

function getAvailableResultEvents() {
  const now = Date.now();
  const pastOrCurrent = schedule.filter((ev) => {
    const firstSess = ev.sessions[0];
    return firstSess && Date.parse(firstSess.start) <= now + 2 * 3600e3;
  });
  return pastOrCurrent.length ? pastOrCurrent : [schedule[0]];
}

function getAvailableResultSessions(ev) {
  const now = Date.now();
  const list = [];

  // 1. Qualifying
  const qSess = ev.sessions.find((s) => s.slug === "qualifying");
  if (qSess && Date.parse(qSess.start) <= now + 2.5 * 3600e3) {
    list.push({ value: "qualifying", label: "Qualifying" });
  }

  // 2. Sprint (ONLY if sprint weekend and started)
  if (ev.sprint) {
    const spSess = ev.sessions.find((s) => s.slug === "sprint");
    if (spSess && Date.parse(spSess.start) <= now + 2.5 * 3600e3) {
      list.push({ value: "sprint", label: "Sprint" });
    }
  }

  // 3. Race (Classification)
  const raceSess = ev.sessions.find((s) => s.slug === "race");
  if (raceSess && Date.parse(raceSess.start) <= now + 2.5 * 3600e3) {
    list.push({ value: "results", label: "Race (Classification)" });
  }

  if (!list.length) {
    list.push({ value: "results", label: "Race (Classification)" });
  }
  return list;
}

async function fetchSessionClassification(round, sessionType = "results") {
  const cacheKey = `${round}_${sessionType}`;
  const memoryHit = sessionResultsCache.get(cacheKey);
  if (memoryHit && memoryHit.results?.length) return memoryHit.results;

  // Check localStorage
  try {
    const raw = store.get(`freef1_perf_${cacheKey}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.results) && parsed.results.length) {
        sessionResultsCache.set(cacheKey, { results: parsed.results, rcMessages: parsed.rcMessages || [], at: parsed.at });
        return parsed.results;
      }
    }
  } catch (_) {}

  // Fetch from Jolpica Ergast
  try {
    const endpoint = sessionType === "race" ? "results" : sessionType;
    const jolpicaUrl = `https://api.jolpi.ca/ergast/f1/2026/${round}/${endpoint}.json`;
    const r = await fetchWithTimeout(jolpicaUrl, { cache: "no-store" }, 5000);
    if (r.ok) {
      const data = await r.json();
      const race = data.MRData?.RaceTable?.Races?.[0];
      if (race) {
        const list = race.Results || race.QualifyingResults || race.SprintResults;
        if (Array.isArray(list) && list.length) {
          const existing = sessionResultsCache.get(cacheKey) || {};
          const entry = { ...existing, results: list, at: Date.now() };
          sessionResultsCache.set(cacheKey, entry);
          try { store.set(`freef1_perf_${cacheKey}`, JSON.stringify(entry)); } catch (_) {}
          return list;
        }
      }
    }
  } catch (_) {}
  return [];
}

// ── Session Results Modal Engine ──
const sOverlay = $("sessionsOverlay");
const sRace = $("sessionRaceSelect");
const sType = $("sessionTypeSelect");
const sLoad = $("sessionsResultsLoading");
const sRes = $("sessionsResults");
let sessionResultsRequest = 0;

function fadeInSessionContent(element) {
  if (!element) return;
  element.classList.remove("results-fade-in");
  scheduleAnimationFrame(() => {
    if (element.isConnected) element.classList.add("results-fade-in");
  });
}

function setSessionResultsLoading(isLoading) {
  if (!sLoad) return;
  if (isLoading) {
    sLoad.style.display = "block";
    fadeInSessionContent(sLoad);
  } else {
    sLoad.style.display = "none";
    sLoad.classList.remove("results-fade-in");
  }
}

function loadSeasonRaces() {
  if (!sRace) return;
  const availableEvents = getAvailableResultEvents();
  // Sort descending: latest round first (Round 15 Baku first!)
  const list = availableEvents.slice().sort((a, b) => Number(b.round) - Number(a.round));
  sRace.replaceChildren(...list.map((ev) => {
    const option = document.createElement("option");
    option.value = String(ev.round);
    option.textContent = `Round ${ev.round} · ${ev.name} (${ev.locality})`;
    return option;
  }));
  if (list.length) sRace.value = String(list[0].round);
  updateSessionTypeOptions();
  loadSessionResults();
}

function updateSessionTypeOptions() {
  if (!sRace || !sType) return;
  const round = Number(sRace.value);
  const ev = schedule.find((e) => e.round === round) || schedule[0];
  const sessions = getAvailableResultSessions(ev);

  sType.replaceChildren(...sessions.map((s) => {
    const opt = document.createElement("option");
    opt.value = s.value;
    opt.textContent = s.label;
    return opt;
  }));

  const hasCurrent = sessions.some((s) => s.value === sType.value);
  if (!hasCurrent) {
    sType.value = sessions.at(-1).value;
  }
}

async function loadSessionResults() {
  if (!sRace || !sType || !sRes) return;
  const requestId = ++sessionResultsRequest;
  const round = Number(sRace.value);
  const type = sType.value;
  if (!round) {
    setSessionResultsLoading(false);
    sRes.innerHTML = "<div class=\"state\">Select a race first.</div>";
    fadeInSessionContent(sRes);
    return;
  }

  // Instant check from cache
  const cacheKey = `${round}_${type}`;
  const cached = sessionResultsCache.get(cacheKey);
  if (cached && cached.results?.length) {
    setSessionResultsLoading(false);
    renderModalSessionResults(cached.results, type);
    return;
  }

  setSessionResultsLoading(true);
  sRes.replaceChildren();
  sRes.classList.remove("results-fade-in");

  const results = await fetchSessionClassification(round, type);
  // A fast session/race change may start another request before this one returns.
  if (requestId !== sessionResultsRequest) return;
  setSessionResultsLoading(false);

  if (!results || !results.length) {
    sRes.innerHTML = "<div class=\"state\">No results published for this session yet.</div>";
    fadeInSessionContent(sRes);
    return;
  }
  renderModalSessionResults(results, type);
}

function renderModalSessionResults(results, type) {
  if (!sRes) return;
  const isQuali = type === "qualifying";
  const fragment = document.createDocumentFragment();

  results.forEach((result) => {
    const element = document.createElement("div");
    element.className = "rrow";

    const teamName = result.Constructor?.name || "";
    const rtColor = hexFor(teamName);
    element.style.setProperty("--race-team", rtColor);
    element.style.setProperty("--race-team-ink", inkOn(rtColor));

    let time = "-";
    if (isQuali) {
      time = result.Q3 || result.Q2 || result.Q1 || "-";
    } else {
      time = result.Time?.time || result.status || "-";
      if (result.position !== "1" && result.Time?.time && !result.Time.time.startsWith("+")) {
        time = `+${result.Time.time}`;
      }
    }

    const pts = (!isQuali && result.points && Number(result.points) > 0) ? ` · +${result.points} PTS` : "";
    const driverName = `${result.Driver?.givenName || ""} ${result.Driver?.familyName || ""}`.trim();

    element.innerHTML = `
      <div class="pos">${escapeHtml(result.position || "-")}</div>
      <div class="who">
        <b>${escapeHtml(driverName)}</b>
        <small>${escapeHtml(teamName)}${pts}</small>
      </div>
      <div class="rtime mono">${escapeHtml(time)}</div>
    `;
    fragment.appendChild(element);
  });
  sRes.replaceChildren(fragment);
  fadeInSessionContent(sRes);
}

$("sessionsBtn")?.addEventListener("click", () => {
  openModal(sOverlay);
  loadSeasonRaces();
});
$("sessionsClose")?.addEventListener("click", () => closeModal(sOverlay));
sRace?.addEventListener("change", () => {
  updateSessionTypeOptions();
  loadSessionResults();
});
sType?.addEventListener("change", loadSessionResults);
$("championshipBtn")?.addEventListener("click", () => {
  document.getElementById("standings")?.scrollIntoView({ behavior: "smooth" });
});

/* ═══════════════ 18. RACE TIMES MODAL ═══════════════ */
const raceTimesOverlay = $("raceTimesOverlay");
const raceTimesList = $("raceTimesList");
const raceTimesGpSelect = $("raceTimesGp");
const raceTimesTimezone = $("raceTimesTimezone");
const RACE_TIMES_MODE_KEY = 'freef1_race_times_mode';
let raceTimesGpSlug = null;
let raceTimesMode = (() => {
  try {
    return store.get(RACE_TIMES_MODE_KEY) === 'track' ? 'track' : 'my';
  } catch (_) {
    return 'my';
  }
})();

const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local timezone';
const localTimeZoneLabel = (() => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(new Date());
  return parts.find((part) => part.type === 'timeZoneName')?.value || localTimeZone;
})();

function raceStatus(event, now = Date.now()) {
  const race = event.sessions.find((session) => session.slug === 'race') || event.sessions.at(-1);
  const starts = event.sessions.map((session) => session.ts).filter(Number.isFinite);
  const first = Math.min(...starts);
  const last = Math.max(...starts);
  if (race && now > race.ts + 4 * 60 * 60 * 1000) return 'finished';
  if (now >= first - 60 * 60 * 1000 && now <= last + 4 * 60 * 60 * 1000) return 'current';
  return 'upcoming';
}

/* Only live-and-future weekends are selectable — finished rounds are gone. */
function raceTimesItems() {
  return schedule
    .map((event) => ({ event, status: raceStatus(event) }))
    .filter((item) => item.status !== 'finished');
}

function raceTimesDefaultSlug() {
  const items = raceTimesItems();
  const current = items.find((item) => item.status === 'current');
  return (current || items[0])?.event.slug || null;
}

function raceTimesFmt(timestamp, timeZone) {
  const date = new Date(Number(timestamp));
  const opts = timeZone ? { timeZone } : {};
  if (Number.isNaN(date.getTime())) return { day: '--', mon: '---', time: '--:--' };
  return {
    day: new Intl.DateTimeFormat('en-GB', { day: '2-digit', ...opts }).format(date),
    mon: new Intl.DateTimeFormat('en-GB', { month: 'short', ...opts }).format(date).toUpperCase(),
    time: new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, ...opts }).format(date)
  };
}

function renderRaceTimes() {
  if (!raceTimesList) return;

  document.querySelectorAll('#raceTimesMode [data-time-mode]').forEach((item) => {
    const active = item.dataset.timeMode === raceTimesMode;
    item.classList.toggle('active', active);
    item.setAttribute('aria-pressed', String(active));
  });

  const items = raceTimesItems();
  if (!items.length) {
    if (raceTimesGpSelect) {
      raceTimesGpSelect.innerHTML = '<option>Season complete</option>';
      raceTimesGpSelect.disabled = true;
    }
    if (raceTimesTimezone) fadeSwapContent(raceTimesTimezone, () => {
      raceTimesTimezone.textContent = 'The 2026 season is complete.';
    });
    fadeSwapContent(raceTimesList, () => {
      raceTimesList.innerHTML = '<div class="state">No upcoming Grand Prix.</div>';
    });
    return;
  }

  if (!items.some((item) => item.event.slug === raceTimesGpSlug)) raceTimesGpSlug = raceTimesDefaultSlug();
  const selected = items.find((item) => item.event.slug === raceTimesGpSlug) || items[0];
  raceTimesGpSlug = selected.event.slug;

  if (raceTimesGpSelect) {
    raceTimesGpSelect.disabled = false;
    raceTimesGpSelect.innerHTML = items.map(({ event, status }) =>
      `<option value="${escapeHtml(event.slug)}" ${event.slug === raceTimesGpSlug ? 'selected' : ''}>R${escapeHtml(event.round)} · ${escapeHtml(event.name)}${status === 'current' ? ' · race weekend' : ''}</option>`
    ).join('');
  }

  const tz = raceTimesMode === 'track' ? selected.event.tz : undefined;
  const timezoneText = raceTimesMode === 'track'
    ? `Times shown at the circuit · ${selected.event.locality} (${selected.event.tz || 'local'})`
    : `Times shown in your local timezone · ${localTimeZone} (${localTimeZoneLabel})`;
  if (raceTimesTimezone) fadeSwapContent(raceTimesTimezone, () => {
    raceTimesTimezone.textContent = timezoneText;
  });

  const now = Date.now();
  const markup = selected.event.sessions.map((session) => {
    const { day, mon, time } = raceTimesFmt(session.ts, tz);
    const past = Number.isFinite(session.ts) && session.ts + 60 * 60 * 1000 < now;
    return `<div class="rt-row${past ? ' is-past' : ''}">
      <div class="rt-date"><span class="rt-day">${escapeHtml(day)}</span><span class="rt-mon">${escapeHtml(mon)}</span></div>
      <div class="rt-name">${escapeHtml(session.name)}</div>
      <time class="rt-time" datetime="${escapeHtml(new Date(session.ts).toISOString())}">${escapeHtml(time)}</time>
    </div>`;
  }).join('');
  fadeSwapContent(raceTimesList, () => {
    raceTimesList.innerHTML = markup;
  });
}

$("raceTimesBtn")?.addEventListener('click', () => {
  raceTimesGpSlug = raceTimesDefaultSlug();
  renderRaceTimes();
  openModal(raceTimesOverlay);
});
$("raceTimesClose")?.addEventListener('click', () => closeModal(raceTimesOverlay));
raceTimesGpSelect?.addEventListener('change', () => {
  raceTimesGpSlug = raceTimesGpSelect.value;
  renderRaceTimes();
});
document.querySelectorAll('#raceTimesMode [data-time-mode]').forEach((btn) => btn.addEventListener('click', () => {
  raceTimesMode = btn.dataset.timeMode === 'track' ? 'track' : 'my';
  try { store.set(RACE_TIMES_MODE_KEY, raceTimesMode); } catch (_) {}
  renderRaceTimes();
}));

/* ═══════════════ 19. TEAM RADIO & RACE CONTROL (OPENF1) ═══════════════ */
const radioRcEl = $("radioRc");
const radioRcBtn = $("radioRcBtn");
const radioRcEventSel = $("radioRcEvent");
const radioRcSessionSel = $("radioRcSession");
const radioRcStatusEl = $("radioRcStatus");
const radioRcRadioList = $("radioRcRadioList");
const radioRcRcList = $("radioRcRcList");
const radioRcAudio = $("radioRcAudio");
const radioRcPlayerEl = $("radioRcPlayer");

const radioRc = {
  meetings: [],
  sessions: [],
  drivers: new Map(),
  sessionKey: null,
  radio: [],
  rc: [],
  playing: null,
  loadToken: 0,
  refreshTimer: 0,
  retryTimer: 0,
  switchTimer: 0,
  open: false,
  cache: new Map(),
  lastRequestAt: 0,
  chain: Promise.resolve()
};

function radioRcPrefs() {
  try {
    return JSON.parse(store.get(RADIO_RC_STORE_KEY) || '{}') || {};
  } catch (e) {
    return {};
  }
}

function radioRcSavePrefs(patch) {
  store.set(RADIO_RC_STORE_KEY, JSON.stringify({ ...radioRcPrefs(), ...patch }));
}

function openf1(path, params, ttlMs) {
  const queryStr = new URLSearchParams(Object.entries(params || {}).sort(([a], [b]) => a.localeCompare(b))).toString();
  const directUrl = `${OPENF1_API}/${encodeURIComponent(path)}${queryStr ? `?${queryStr}` : ''}`;
  const cacheKey = `${path}?${queryStr}`;
  const storageKey = `freef1_of1_${cacheKey}`;
  const staleLimit = (path === 'drivers' || path === 'sessions') ? 30 * 86400_000 : 7 * 86400_000;
  let cached = radioRc.cache.get(cacheKey) || null;

  if (cached?.promise) return cached.promise;
  if (cached && Date.now() - cached.at < ttlMs) return Promise.resolve(cached.data);

  if (!cached) {
    try {
      const stored = JSON.parse(store.get(storageKey) || 'null');
      if (stored && Array.isArray(stored.data) && Number.isFinite(Number(stored.at))) {
        cached = stored;
        radioRc.cache.set(cacheKey, cached);
      }
    } catch (_) {}
  }
  if (cached && Date.now() - Number(cached.at) < ttlMs) return Promise.resolve(cached.data);

  let fetchedAt = 0;
  const run = async () => {
    const wait = radioRc.lastRequestAt + 125 - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    radioRc.lastRequestAt = Date.now();

    try {
      const response = await fetchWithTimeout(directUrl, {
        cache: 'default',
        headers: { Accept: 'application/json' }
      }, 5000);
      // OpenF1 uses 404 for a valid empty result set.
      if (response.status === 404) return [];
      if (!response.ok) {
        const error = new Error(response.status === 401
          ? 'OpenF1 is temporarily restricting live-session data'
          : response.status === 429 ? 'OpenF1 rate limit reached' : `OpenF1 returned ${response.status}`);
        error.code = response.status === 401 ? 'live' : response.status === 429 ? 'rate' : 'up';
        throw error;
      }
      const json = await response.json();
      if (json?.detail === 'No results found.') return [];
      if (!Array.isArray(json)) throw new Error('OpenF1 returned an unexpected response');
      fetchedAt = Date.now();
      return json;
    } catch (error) {
      if (cached && Date.now() - Number(cached.at) <= staleLimit) return cached.data;
      throw error;
    }
  };

  const promise = radioRc.chain.then(run, run).then((data) => {
    const at = fetchedAt || Number(cached?.at) || Date.now();
    radioRc.cache.set(cacheKey, { data, at });
    if (fetchedAt && Array.isArray(data) && data.length) {
      try {
        const encoded = JSON.stringify({ data, at });
        // Local storage is only a fallback cache; skip unusually large records.
        if (encoded.length < 250_000) store.set(storageKey, encoded);
      } catch (_) {}
    }
    return data;
  }).catch((error) => {
    if (cached) radioRc.cache.set(cacheKey, cached);
    else radioRc.cache.delete(cacheKey);
    throw error;
  });
  radioRc.chain = promise.catch(() => {});
  radioRc.cache.set(cacheKey, { promise, data: cached?.data || [], at: Number(cached?.at) || 0 });
  return promise;
}

function radioRcSetStatus(text, cls, { animate = false } = {}) {
  if (!radioRcStatusEl) return;
  fadeSwapContent(radioRcStatusEl, () => {
    radioRcStatusEl.textContent = text;
    radioRcStatusEl.classList.remove('live', 'warn');
    if (cls) radioRcStatusEl.classList.add(cls);
  }, { animate });
}

function radioRcSetListMessage(list, message, { animate = true, error = false } = {}) {
  if (!list) return;
  const className = `radio-rc-empty${error ? ' err' : ''}`;
  fadeSwapContent(list, () => {
    list.innerHTML = `<li class="${className}">${escapeHtml(message)}</li>`;
  }, { animate });
}

function radioRcIsLiveWindow(s) {
  if (!s) return false;
  const start = Date.parse(s.date_start);
  const end = Date.parse(s.date_end);
  const now = Date.now();
  return now >= start - 30 * 60e3 && now <= end + 30 * 60e3;
}

function radioRcMeetingLabel(meeting) {
  const t = Date.parse(meeting.date_start);
  const ev = schedule.find((e) => e.sessions.some((s) => Math.abs(Date.parse(s.start) - t) < 3 * 86400e3));
  return ev ? `R${ev.round} · ${ev.name}` : `${meeting.location} · ${meeting.country_name}`;
}

async function radioRcLoadSessions() {
  radioRcSetStatus('Loading sessions…');
  let sessions = [];
  try {
    sessions = await openf1('sessions', { year: SITE_SEASON }, 10 * 60e3);
  } catch (err) {
    sessions = [];
  }
  if (!Array.isArray(sessions) || !sessions.length) {
    // Upstream unreachable: synthesize from embedded official 2026 calendar
    let sKey = 11200;
    sessions = [];
    schedule.forEach((ev) => {
      ev.sessions.forEach((s) => {
        sessions.push({
          session_key: ++sKey,
          meeting_key: 1000 + ev.round,
          session_name: s.name,
          session_type: s.slug === 'race' ? 'Race' : s.slug.includes('qualifying') ? 'Qualifying' : 'Practice',
          date_start: s.start,
          date_end: s.start,
          circuit_short_name: ev.locality,
          country_name: ev.country,
          location: ev.locality,
          year: 2026
        });
      });
    });
  }
  const now = Date.now();
  radioRc.sessions = sessions
    .filter((s) => !/^Day \d/.test(s.session_name))
    .sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start));

  const meetings = new Map();
  for (const s of radioRc.sessions) {
    if (!meetings.has(s.meeting_key)) {
      meetings.set(s.meeting_key, {
        meeting_key: s.meeting_key,
        location: s.location,
        country_name: s.country_name,
        date_start: s.date_start
      });
    }
  }
  radioRc.meetings = [...meetings.values()];
  if (!radioRc.meetings.length) throw new Error('No sessions published yet this season');

  // Default to CURRENT (live) session or LAST session that took place
  const live = radioRc.sessions.find(radioRcIsLiveWindow);
  const started = radioRc.sessions.filter((s) => Date.parse(s.date_start) <= now + 30 * 60e3);
  const lastSessionOverall = started.length ? started.at(-1) : radioRc.sessions.at(-1);

  const target = live || lastSessionOverall || radioRc.sessions[0];

  if (radioRcEventSel) {
    radioRcEventSel.replaceChildren(...radioRc.meetings.map((m) => {
      const o = document.createElement('option');
      o.value = m.meeting_key;
      o.textContent = radioRcMeetingLabel(m);
      return o;
    }));
    radioRcEventSel.value = String(target.meeting_key);
    radioRcEventSel._syncCustom?.();
  }
  radioRcFillSessions(target.session_key);
}

function radioRcFillSessions(preferKey) {
  if (!radioRcEventSel || !radioRcSessionSel) return;
  const mk = Number(radioRcEventSel.value);
  const list = radioRc.sessions.filter((s) => s.meeting_key === mk);
  radioRcSessionSel.replaceChildren(...list.map((s) => {
    const o = document.createElement('option');
    o.value = s.session_key;
    o.textContent = s.session_name;
    return o;
  }));

  const now = Date.now();
  const startedInMeeting = list.filter((s) => Date.parse(s.date_start) <= now + 30 * 60e3);
  const lastSessionInMeeting = startedInMeeting.length ? startedInMeeting.at(-1) : list.at(-1);

  const pick = (preferKey && list.find((s) => s.session_key === preferKey)) || lastSessionInMeeting || list.at(-1);
  radioRcSessionSel.value = String(pick.session_key);
  radioRcEventSel._syncCustom?.();
  radioRcSessionSel._syncCustom?.();
  radioRcQueueSelect(pick.session_key);
}

function radioRcQueueSelect(sessionKey) {
  clearTimeout(radioRc.switchTimer);
  radioRc.switchTimer = setTimeout(() => radioRcSelectSession(sessionKey), 250);
}

async function radioRcSelectSession(sessionKey, { retry = false, animate = true } = {}) {
  const session = radioRc.sessions.find((s) => s.session_key === sessionKey);
  if (!session) return;
  const token = ++radioRc.loadToken;
  clearTimeout(radioRc.refreshTimer);
  clearTimeout(radioRc.retryTimer);
  radioRc.sessionKey = sessionKey;
  radioRcSavePrefs({ sessionKey, meetingKey: session.meeting_key });
  radioRcStopAudio();

  radioRcSetListMessage(radioRcRadioList, 'Loading team radio…', { animate });
  radioRcSetListMessage(radioRcRcList, 'Loading race control…', { animate });
  const rCount = $("radioRcRadioCount");
  const rcCount = $("radioRcRcCount");
  if (rCount) fadeSwapContent(rCount, () => { rCount.textContent = ''; }, { animate });
  if (rcCount) fadeSwapContent(rcCount, () => { rcCount.textContent = ''; }, { animate });

  const live = radioRcIsLiveWindow(session);
  const ttl = live ? 8e3 : 6 * 3600e3;
  const label = `${session.country_name} · ${session.session_name}`;
  radioRcSetStatus(live ? `${label} · in progress` : label, live ? 'live' : '', { animate });
  let nextRefresh = 0;

  try {
    const [rawDrivers, rawRadio, rawRc] = await Promise.all([
      openf1('drivers', { session_key: sessionKey }, 6 * 3600e3),
      openf1('team_radio', { session_key: sessionKey }, ttl),
      openf1('race_control', { session_key: sessionKey }, ttl)
    ]);
    if (token !== radioRc.loadToken) return;

    const drivers = Array.isArray(rawDrivers) ? rawDrivers : [];
    const radio = Array.isArray(rawRadio) ? rawRadio : [];
    const rc = Array.isArray(rawRc) ? rawRc : [];

    radioRc.drivers = new Map(drivers.map((d) => [d.driver_number, d]));
    radioRc.radio = radio.map((r) => ({ ...r, ts: Date.parse(r.date) })).filter((r) => r.recording_url).sort((a, b) => b.ts - a.ts);
    radioRc.rc = rc.map((r) => ({ ...r, ts: Date.parse(r.date) })).sort((a, b) => b.ts - a.ts);

    const noRadioOrRc = !radioRc.radio.length && !radioRc.rc.length;
    radioRcRenderRadio({
      animate,
      emptyText: noRadioOrRc
        ? live
          ? 'Session in progress. Team radio clips will appear here as soon as they are broadcast.'
          : 'No team radio recorded for this session.'
        : 'No team radio published for this session'
    });
    radioRcRenderRc({
      animate,
      emptyText: noRadioOrRc
        ? live
          ? 'Monitoring race control flags and steward messages…'
          : 'No race control messages for this session.'
        : 'No race control messages published for this session'
    });

    if (noRadioOrRc) {
      if (live) {
        radioRcSetStatus('Session live · polling telemetry feeds (every 10s)', 'live', { animate });
        nextRefresh = 10e3;
      } else {
        radioRcSetStatus(label, '', { animate });
      }
    } else if (live) {
      nextRefresh = 8e3;
    }
  } catch (err) {
    if (token !== radioRc.loadToken) return;
    if (err.code === 'live') {
      radioRcSetStatus('Session in progress · polling telemetry feeds (every 10s)', 'live', { animate });
      radioRcSetListMessage(radioRcRadioList, 'Session in progress. Team radio clips will appear as soon as broadcast audio publishes.', { animate });
      radioRcSetListMessage(radioRcRcList, 'Monitoring race control messages…', { animate });
      nextRefresh = 10e3;
    } else if (err.code === 'rate' && !retry) {
      radioRcSetStatus('Data feed busy · retrying in 5 s', 'warn', { animate });
      radioRcSetListMessage(radioRcRadioList, 'Feed is busy right now - retrying automatically…', { animate });
      radioRcSetListMessage(radioRcRcList, '', { animate });
      radioRc.retryTimer = setTimeout(() => {
        if (radioRc.open && radioRc.sessionKey === sessionKey) radioRcSelectSession(sessionKey, { retry: true });
      }, 5e3);
    } else {
      const msg = err.code === 'net' ? 'Telemetry standby · waiting for session transmission' : (err.message || 'Telemetry standby');
      radioRcSetListMessage(radioRcRadioList, msg, { animate });
      radioRcSetListMessage(radioRcRcList, msg, { animate });
      radioRcSetStatus(err.code === 'live' ? 'Live session in progress · polling' : err.code === 'rate' ? 'Data feed busy · retrying' : 'Telemetry standby', 'warn', { animate });
    }
  }

  if (nextRefresh && radioRc.open) {
    radioRc.refreshTimer = setTimeout(() => {
      if (!document.hidden && radioRc.open && radioRc.sessionKey === sessionKey) radioRcSelectSession(sessionKey, { animate: false });
    }, nextRefresh);
  }
}

function radioRcDriver(n) {
  const d = radioRc.drivers.get(n);
  const hex = /^[0-9a-f]{6}$/i.test(d?.team_colour || '') ? `#${d.team_colour}` : '#555';
  return {
    code: d?.name_acronym || `#${n}`,
    name: d?.full_name || d?.broadcast_name || `Car ${n}`,
    team: d?.team_name || '',
    colour: hex
  };
}

function radioRcRenderRadio({ animate = true, emptyText = 'No team radio published for this session' } = {}) {
  const rCount = $("radioRcRadioCount");
  if (rCount) fadeSwapContent(rCount, () => {
    rCount.textContent = radioRc.radio.length ? `${radioRc.radio.length} clips` : '';
  }, { animate });
  if (!radioRcRadioList) return;
  if (!radioRc.radio.length) {
    radioRcSetListMessage(radioRcRadioList, emptyText, { animate });
    return;
  }
  const markup = radioRc.radio.map((r, i) => {
    const d = radioRcDriver(r.driver_number);
    return `<li><button type="button" class="radio-rc-clip${radioRc.playing === r.recording_url ? ' playing' : ''}" data-idx="${i}" aria-label="Play radio from ${escapeHtml(d.name)} at ${escapeHtml(radioRcTimeFmt.format(r.ts))}">
      <span class="radio-rc-code" style="background:${d.colour}">${escapeHtml(d.code)}</span>
      <span class="radio-rc-who"><b>${escapeHtml(d.name)}</b><span>${escapeHtml(d.team)}</span></span>
      <span class="radio-rc-when">${escapeHtml(radioRcTimeFmt.format(r.ts))}</span>
      <span class="radio-rc-play" aria-hidden="true"></span></button></li>`;
  }).join('');
  fadeSwapContent(radioRcRadioList, () => {
    radioRcRadioList.innerHTML = markup;
  }, { animate });
}

function radioRcTag(r) {
  const m = r.message || '';
  if (r.category === 'SafetyCar') return /VSC|VIRTUAL/.test(m) ? 'VSC' : 'SC';
  if (/^RED FLAG/.test(m) || /ABORTED/.test(m)) return 'RED';
  if (r.flag) return r.flag.replace(/\s+/g, '');
  if (r.category === 'Drs') return 'DRS';
  if (r.category === 'SessionStatus') return 'SESSION';
  return 'FIA';
}

function radioRcRenderRc({ animate = true, emptyText = 'No race control messages published for this session' } = {}) {
  const rcCount = $("radioRcRcCount");
  if (rcCount) fadeSwapContent(rcCount, () => {
    rcCount.textContent = radioRc.rc.length ? `${radioRc.rc.length} messages` : '';
  }, { animate });
  if (!radioRcRcList) return;
  if (!radioRc.rc.length) {
    radioRcSetListMessage(radioRcRcList, emptyText, { animate });
    return;
  }
  const markup = radioRc.rc.map((r) => {
    const tag = radioRcTag(r);
    return `<li class="radio-rc-msg"><time datetime="${escapeHtml(new Date(r.ts).toISOString())}">${escapeHtml(radioRcTimeFmt.format(r.ts).slice(0, 5))}</time><span class="radio-rc-tag ${escapeHtml(tag)}">${escapeHtml(tag)}</span><span>${escapeHtml(r.message || '')}${r.lap_number ? `<i class="lap">L${escapeHtml(r.lap_number)}</i>` : ''}</span></li>`;
  }).join('');
  fadeSwapContent(radioRcRcList, () => {
    radioRcRcList.innerHTML = markup;
  }, { animate });
}

function radioRcStopAudio() {
  if (!radioRcAudio) return;
  radioRcAudio.pause();
  radioRcAudio.removeAttribute('src');
  radioRcAudio.load();
  radioRc.playing = null;
  if (radioRcPlayerEl) {
    radioRcPlayerEl.hidden = true;
    radioRcPlayerEl.classList.remove('paused');
  }
  radioRcRadioList?.querySelectorAll('.playing').forEach((el) => el.classList.remove('playing'));
}

function radioRcPlay(clip) {
  if (!radioRcAudio) return;
  const d = radioRcDriver(clip.driver_number);
  if (radioRc.playing === clip.recording_url) {
    if (radioRcAudio.paused) {
      radioRcAudio.play().catch(() => {});
      radioRcPlayerEl?.classList.remove('paused');
    } else {
      radioRcAudio.pause();
      radioRcPlayerEl?.classList.add('paused');
    }
    return;
  }
  radioRc.playing = clip.recording_url;
  if (radioRcPlayerEl) {
    radioRcPlayerEl.hidden = false;
    radioRcPlayerEl.classList.remove('paused');
  }
  const pCode = $("radioRcPlayerCode");
  const pName = $("radioRcPlayerName");
  const pTime = $("radioRcPlayerTime");
  if (pCode) {
    pCode.textContent = d.code;
    pCode.style.background = d.colour;
  }
  if (pName) pName.textContent = `${d.name} · ${d.team}`;
  if (pTime) pTime.textContent = `${radioRcTimeFmt.format(clip.ts)} · loading…`;
  radioRcRadioList?.querySelectorAll('.radio-rc-clip').forEach((el) => {
    el.classList.toggle('playing', radioRc.radio[Number(el.dataset.idx)]?.recording_url === clip.recording_url);
  });
  radioRcAudio.src = clip.recording_url;
  radioRcAudio.play().catch(() => {});
}

radioRcAudio?.addEventListener('loadedmetadata', () => {
  if (radioRc.playing) {
    const clip = radioRc.radio.find((r) => r.recording_url === radioRc.playing);
    const pTime = $("radioRcPlayerTime");
    if (clip && pTime) pTime.textContent = `${radioRcTimeFmt.format(clip.ts)} · ${Math.round(radioRcAudio.duration || 0)} s`;
  }
});

radioRcAudio?.addEventListener('ended', () => {
  radioRcPlayerEl?.classList.add('paused');
  radioRcRadioList?.querySelectorAll('.playing').forEach((el) => el.classList.remove('playing'));
});

radioRcAudio?.addEventListener('error', () => {
  if (!radioRc.playing) return;
  const btn = [...(radioRcRadioList?.querySelectorAll('.radio-rc-clip') || [])].find((el) => radioRc.radio[Number(el.dataset.idx)]?.recording_url === radioRc.playing);
  if (btn) {
    btn.classList.remove('playing');
    btn.classList.add('failed');
  }
  const pTime = $("radioRcPlayerTime");
  if (pTime) pTime.textContent = 'Could not load this clip from F1’s audio server';
  radioRcPlayerEl?.classList.add('paused');
  showToast('This radio clip could not be loaded from F1’s audio server.', 'warning');
  radioRc.playing = null;
});

radioRcRadioList?.addEventListener('click', (event) => {
  const btn = event.target.closest('.radio-rc-clip');
  if (!btn) return;
  const clip = radioRc.radio[Number(btn.dataset.idx)];
  if (clip) radioRcPlay(clip);
});

function radioRcSetOpen(open, { animate = true, save = true } = {}) {
  radioRc.open = open;
  radioRcBtn?.setAttribute('aria-expanded', String(open));
  radioRcBtn?.classList.toggle('active', open);
  if (save) radioRcSavePrefs({ open });
  if (open) {
    radioRcEl?.classList.toggle('no-anim', !animate);
    if (radioRcEl) radioRcEl.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      radioRcEl?.classList.add('open');
      setTimeout(() => {
        if (radioRc.open) radioRcEl?.classList.add('settled');
      }, animate ? 600 : 0);
    }));
    if (!radioRc.meetings.length) {
      radioRcLoadSessions().catch((err) => {
        radioRcSetStatus(err.code === 'rate'
          ? 'OpenF1 is busy · try again in a minute'
          : err.code === 'live'
            ? 'OpenF1 free tier locked while a session is live'
            : (err.message || 'OpenF1 unavailable'), 'warn');
        radioRcSetListMessage(radioRcRadioList, err.message || 'OpenF1 unavailable', { error: true });
        radioRcSetListMessage(radioRcRcList, '');
      });
    } else if (radioRcIsLiveWindow(radioRc.sessions.find((s) => s.session_key === radioRc.sessionKey))) {
      radioRcSelectSession(radioRc.sessionKey, { animate: false });
    }
  } else {
    clearTimeout(radioRc.refreshTimer);
    clearTimeout(radioRc.retryTimer);
    radioRcEl?.classList.remove('open', 'settled');
    radioRcStopAudio();
    const finish = () => {
      if (!radioRc.open && radioRcEl) radioRcEl.hidden = true;
    };
    if (animate) setTimeout(finish, 560);
    else finish();
  }
}

radioRcBtn?.addEventListener('click', () => {
  radioRcSetOpen(!radioRc.open);
  if (!radioRc.open) return;
  setTimeout(() => radioRcEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
});

$("radioRcClose")?.addEventListener('click', () => {
  radioRcSetOpen(false);
  radioRcBtn?.focus();
});

radioRcEventSel?.addEventListener('change', () => radioRcFillSessions(null));
radioRcSessionSel?.addEventListener('change', () => radioRcQueueSelect(Number(radioRcSessionSel.value)));

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearTimeout(radioRc.refreshTimer);
  } else if (radioRc.open && radioRcIsLiveWindow(radioRc.sessions.find((s) => s.session_key === radioRc.sessionKey))) {
    radioRcSelectSession(radioRc.sessionKey, { animate: false });
  }
}, { passive: true });

if (radioRcPrefs().open) {
  setTimeout(() => radioRcSetOpen(true, { animate: false, save: false }), 900);
}

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
  currentSource = 0;
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
  currentSource = 0;
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
  currentSource = 0;
  updateHeader();
  renderButtons();
  load();
});

/* ═══════════════ 21. TEAM LIVERY SYSTEM ═══════════════ */
const tOverlay = $("teamSelectOverlay");
const tGrid = $("teamGrid");

function applyTeamTheme(id) {
  const t = teams.find((x) => x.id === id) || teams[0];
  const rs = document.documentElement.style;
  rs.setProperty('--team', t.color);
  rs.setProperty('--team-2', shade(t.color, 36));
  rs.setProperty('--team-ink', inkOn(t.color));
  rs.setProperty('--red-glow', t.color + '70');
  document.querySelectorAll('.tcard').forEach((c) => c.classList.toggle('on', c.dataset.team === id));
  dispatchEvent(new CustomEvent('freef1themechange', { detail: { color: t.color } }));
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
    c.querySelector('.tbadge img')?.addEventListener('error', (event) => {
      const badge = event.target.parentElement;
      badge.classList.remove('has-logo');
      event.target.remove();
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
}

$("teamSelectBtn")?.addEventListener('click', () => {
  openModal(tOverlay);
  renderTeamGrid();
  applyTeamTheme(store.get('freef1_team') || 'default');
});
$("teamSelectClose")?.addEventListener('click', () => closeModal(tOverlay));

[sOverlay, raceTimesOverlay, tOverlay, dOverlay].forEach((m) => {
  m?.addEventListener('click', (e) => {
    if (e.target === m) closeModal(m);
  });
});

addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.querySelector('.modal.open');
    if (modal) closeModal(modal);
    return;
  }
  trapModalFocus(e);
});

/* ═══════════════ 22. SPEED-LINE CANVAS ═══════════════ */
(function initSpeedCanvas() {
  const canvas = $("speedCanvas");
  if (!canvas || liteMotion) return;
  const context = canvas.getContext('2d');
  if (!context) return;

  let width = 0;
  let height = 0;
  let parts = [];
  let rgb = [225, 6, 0];
  let resizeTimer = 0;
  let running = false;
  let lastFrame = 0;

  const targetFps = innerWidth < 768 || navigator.hardwareConcurrency <= 4 ? 30 : 45;
  const frameInterval = 1000 / targetFps;

  function readAccent(color) {
    rgb = hex2rgb(color || getComputedStyle(document.documentElement).getPropertyValue('--team').trim() || '#E10600');
  }

  function makeSprite(part) {
    const sprite = document.createElement('canvas');
    const spriteContext = sprite.getContext('2d');
    sprite.width = Math.ceil(part.len) + 2;
    sprite.height = Math.max(3, Math.ceil(part.w) + 2);
    const gradient = spriteContext.createLinearGradient(0, 0, sprite.width, 0);
    gradient.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
    gradient.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${part.a})`);
    spriteContext.strokeStyle = gradient;
    spriteContext.lineWidth = part.w;
    spriteContext.lineCap = 'round';
    spriteContext.beginPath();
    spriteContext.moveTo(1, sprite.height / 2);
    spriteContext.lineTo(sprite.width - 1, sprite.height / 2);
    spriteContext.stroke();
    return sprite;
  }

  function makePart() {
    const part = {
      x: Math.random() * width,
      y: Math.random() * height,
      len: Math.random() * 90 + 20,
      sp: Math.random() * 1.6 + 0.35,
      a: Math.random() * 0.28 + 0.05,
      w: Math.random() * 1.3 + 0.25
    };
    part.sprite = makeSprite(part);
    return part;
  }

  function build() {
    const count = width < 768 ? 26 : 56;
    parts = Array.from({ length: count }, makePart);
  }

  function size() {
    width = canvas.width = Math.max(1, innerWidth);
    height = canvas.height = Math.max(1, innerHeight);
    readAccent();
    build();
  }

  function tick(now) {
    if (document.hidden) {
      running = false;
      return;
    }
    running = true;
    const elapsed = now - lastFrame;
    if (elapsed < frameInterval) {
      requestAnimationFrame(tick);
      return;
    }
    const speed = Math.min(2, elapsed / (1000 / 60));
    lastFrame = now - (elapsed % frameInterval);
    context.clearRect(0, 0, width, height);
    parts.forEach((part) => {
      part.x += part.sp * 2.4 * speed;
      if (part.x - part.len > width) {
        part.x = -part.len;
        part.y = Math.random() * height;
      }
      context.drawImage(part.sprite, Math.round(part.x - part.len), Math.round(part.y - part.sprite.height / 2));
    });
    requestAnimationFrame(tick);
  }

  function start() {
    if (!running && !document.hidden) {
      running = true;
      lastFrame = performance.now();
      requestAnimationFrame(tick);
    }
  }

  size();
  start();
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(size, 140);
  }, { passive: true });
  addEventListener('visibilitychange', start, { passive: true });
  addEventListener('freef1themechange', (event) => {
    readAccent(event.detail?.color);
    parts.forEach((part) => {
      part.sprite = makeSprite(part);
    });
  });
})();

/* ═══════════════ 23. APPLICATION INITIALIZATION ═══════════════ */
// Apply stored team livery
applyTeamTheme(store.get('freef1_team') || 'default');

// Initial controls & player setup
populate();
updateHeader();
renderButtons();
load();
setupCustomSelects();
updateClocks();
updateOverridePill(streamOverride);
bootstrapSiteConfig();

// Defer non-critical data loading
const loadChampionshipData = () => {
  loadStandings('drivers');
  loadDriverGrid();
};

if ('requestIdleCallback' in window) {
  requestIdleCallback(loadChampionshipData, { timeout: 1600 });
} else {
  setTimeout(loadChampionshipData, 700);
}

// Background intervals
setInterval(() => {
  if (!document.hidden) updateClocks();
}, 1000);

setInterval(() => {
  if (!document.hidden) updateCurrentStreamButton();
}, 60000);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    updateClocks();
    updateCurrentStreamButton();
  }
}, { passive: true });

/* ═══════════════ DIAGNOSTICS — Copy Diagnostics button in footer ═══════════════ */
function diagParseUA(ua){
  ua = String(ua||'');
  let browser='Unknown', bver='-', os='Unknown', over='-', device='Desktop';
  if(/Edg\//.test(ua)){ browser='Edge'; const m=ua.match(/Edg\/([\d.]+)/); bver=m?m[1]:'-'; }
  else if(/OPR\/|Opera/.test(ua)){ browser='Opera'; const m=ua.match(/(?:OPR|Opera)\/([\d.]+)/); bver=m?m[1]:'-'; }
  else if(/Chrome\//.test(ua) && !/Chromium|Edg/.test(ua)){ browser='Chrome'; const m=ua.match(/Chrome\/([\d.]+)/); bver=m?m[1]:'-'; }
  else if(/Firefox\//.test(ua)){ browser='Firefox'; const m=ua.match(/Firefox\/([\d.]+)/); bver=m?m[1]:'-'; }
  else if(/Safari\//.test(ua) && !/Chrome/.test(ua)){ browser='Safari'; const m=ua.match(/Version\/([\d.]+)/); bver=m?m[1]:'-'; }
  else if(/Brave/.test(ua)){ browser='Brave'; bver='-'; }
  if(/Windows NT ([\d.]+)/.test(ua)){ os='Windows'; const m=ua.match(/Windows NT ([\d.]+)/); over=m?m[1]:'-'; const map={'10.0':'10/11','6.3':'8.1','6.2':'8','6.1':'7'}; over=map[over]||over; }
  else if(/Mac OS X ([\d_]+)/.test(ua)){ os='macOS'; const m=ua.match(/Mac OS X ([\d_]+)/); over=m?m[1].replace(/_/g,'.'):'-'; }
  else if(/Android ([\d.]+)/.test(ua)){ os='Android'; const m=ua.match(/Android ([\d.]+)/); over=m?m[1]:'-'; }
  else if(/iPhone|iPad|iPod/.test(ua)){ os='iOS'; const m=ua.match(/OS ([\d_]+)/); over=m?m[1].replace(/_/g,'.'):'-'; }
  else if(/Linux/.test(ua)) os='Linux';
  else if(/CrOS/.test(ua)) os='Chrome OS';
  if(/Mobile|iPhone|Android.*Mobile/.test(ua)) device='Mobile';
  else if(/Tablet|iPad/.test(ua)) device='Tablet';
  else device='Desktop';
  return {browser, bver, os, over, device, ua};
}
async function diagPing(url, label){
  const t0 = performance.now();
  const cleanUrl = String(url||'');
  if(!cleanUrl) return {label, url: cleanUrl, ok:false, status:'-', ms:0, error:'no url'};
  // Try HEAD first (405 on some hosts like strmfree — we treat that as alive and retry GET)
  try{
    const ctrl = new AbortController();
    const to = setTimeout(()=>ctrl.abort(), 5000);
    const r = await fetch(cleanUrl, { method:'HEAD', mode:'cors', credentials:'omit', cache:'no-store', redirect:'follow', signal: ctrl.signal, headers:{'Accept':'*/*'} });
    clearTimeout(to);
    const ms = Math.round(performance.now()-t0);
    // HEAD 405 on strmfree is expected — actually alive
    if(r.status===405) return {label, url: cleanUrl, ok:true, status:'405', ms, error:''};
    return {label, url: cleanUrl, ok: r.ok, status: String(r.status), ms, error: r.ok?'':'HTTP '+r.status};
  }catch(e){
    const msg = String(e && e.message || e);
    // CORS block shows as TypeError Failed to fetch — stream may still be alive via iframe
    if(/Failed to fetch|Load failed|NetworkError|CORS|aborted/i.test(msg)){
      // Retry GET no-cors to see if network at least reachable (opaque)
      try{
        const ctrl2 = new AbortController();
        const to2 = setTimeout(()=>ctrl2.abort(), 4000);
        const r2 = await fetch(cleanUrl, { method:'GET', mode:'no-cors', cache:'no-store', redirect:'follow', signal: ctrl2.signal });
        clearTimeout(to2);
        const ms2 = Math.round(performance.now()-t0);
        // opaque = 0 but no network error = reachable, likely 200 behind CORS
        if(r2.type==='opaque') return {label, url: cleanUrl, ok:true, status:'opaque', ms: ms2, error:''};
        return {label, url: cleanUrl, ok:false, status:'0', ms: ms2, error: msg};
      }catch(e2){
        const ms2 = Math.round(performance.now()-t0);
        const short = /Failed to fetch|Load failed|NetworkError/i.test(msg) && /Failed to fetch|Load failed|NetworkError/i.test(String(e2.message||e2)) ? 'fetch blocked' : (msg + ' | ' + String(e2.message||e2)).slice(0,40);
        return {label, url: cleanUrl, ok:false, status:'-', ms: ms2, error: short};
      }
    }
    const ms = Math.round(performance.now()-t0);
    return {label, url: cleanUrl, ok:false, status:'-', ms, error: msg};
  }
}
function diagIframePing(url, label){
  return new Promise((resolve)=>{
    const t0 = performance.now();
    const cleanUrl = String(url||'');
    if(!cleanUrl) return resolve({label, url: cleanUrl, ok:false, status:'-', ms:0, error:'no url'});
    // Use hidden iframe to test if device can actually load the embed (fetch is CORS-blocked, iframe is not)
    let done=false;
    let to=null;
    const finish=(ok,status,err)=>{
      if(done) return;
      done=true;
      clearTimeout(to);
      try{ iframe.remove(); }catch(_){}
      const ms=Math.round(performance.now()-t0);
      resolve({label, url: cleanUrl, ok, status, ms, error: err||''});
    };
    const iframe=document.createElement('iframe');
    // Match live player attributes so adblock sees same as real embed
    iframe.referrerPolicy='no-referrer';
    iframe.setAttribute('allow','autoplay *; encrypted-media *; fullscreen *; picture-in-picture *');
    // No sandbox — matches live cockpit (sandbox breaks streams)
    iframe.style.cssText='position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;border:0;';
    // onload = host reachable (even if player shows spinner, iframe HTML loaded)
    iframe.onload=()=>finish(true,'iframe ok','');
    iframe.onerror=()=>finish(false,'iframe blocked','');
    // Timeout = blocked on device (DNS / adblock / network)
    to=setTimeout(()=>finish(false,'timeout',''), 6000);
    try{
      iframe.src=cleanUrl;
      document.body.appendChild(iframe);
    }catch(e){
      finish(false,'-', String(e).slice(0,60));
    }
  });
}
function diagBool(v){ return v ? 'yes' : 'no'; }
async function buildDiagnosticsReport(){
  const now = new Date();
  const du = diagParseUA(navigator.userAgent||'');
  const conn = navigator.connection || {};
  const tz = (()=>{ try{ return Intl.DateTimeFormat().resolvedOptions().timeZone||'-'; }catch(_){ return '-'; }})();
  const lang = navigator.language || '-';
  const scr = window.screen || {};
  // site state — guard for early load
  let curEv='-', curSess='-', curSrc='-', curUrl='-', active='-';
  let avail='-', disabled='-', build='-';
  let iframeInfo='-';
  let hasStream = document.body.classList.contains('has-stream');
  try{ curEv = (typeof currentEvent!=='undefined' && currentEvent) ? (currentEvent.name + ' R' + currentEvent.round + ' ('+currentEvent.slug+')') : '-'; }catch(_){}
  try{ curSess = (typeof currentSession!=='undefined' && currentSession) ? (currentSession.name + ' ('+currentSession.slug+')') : '-'; }catch(_){}
  try{ const s=(typeof sources!=='undefined' && typeof currentSource!=='undefined') ? sources[currentSource] : null; curSrc = s ? (s.label + ' ['+s.id+']') : '-'; curUrl = '(hidden)'; }catch(_){}
  try{ active = (typeof activeView!=='undefined'?activeView:'-'); }catch(_){}
  try{ avail = (typeof isStreamAvailable==='function' && typeof currentSession!=='undefined') ? String(isStreamAvailable(currentSession)) : '-'; }catch(_){}
  try{ disabled = (typeof disabledSources!=='undefined' ? [...disabledSources].join(', ')||'(none)' : '-'); }catch(_){}
  try{ const el = document.querySelector('#player iframe'); if(el){ iframeInfo = 'sandbox=' + (el.getAttribute('sandbox')||'(none)') + ' | allow='+(el.getAttribute('allow')||'-').slice(0,80) + ' | loaded='+el.classList.contains('loaded') + ' | hasIframe=yes'; } else iframeInfo='(no iframe in DOM)'; }catch(_){}
  // storage / permissions
  let lsOk='-', wakeOk='-';
  try{ localStorage.setItem('__diag','1'); localStorage.removeItem('__diag'); lsOk='yes'; }catch(_){ lsOk='no ('+String(_).slice(0,60)+')'; }
  try{ wakeOk = ('wakeLock' in navigator) ? 'yes' : 'no'; }catch(_){ wakeOk='no'; }
  // ping site APIs + streams internally, but NEVER expose stream URLs in the report (hidden)
  const pingTargets = [];
  // add stream URLs internally (hidden from report)
  try{
    if(typeof sources!=='undefined') sources.forEach(s=>{
      let u='-'; try{ u = (typeof buildUrl==='function' ? buildUrl(sources.indexOf(s)) : (s.url||'')); }catch(_){ u=s.url||''; }
      if(u && u.startsWith('http')) pingTargets.push({label: 'Stream '+s.label+' ['+s.id+']', url: u, hideUrl:true});
    });
  }catch(_){}
  pingTargets.push({label:'Race Control config (optional)', url: `${BACKEND_API}/api/site/config`, hideUrl:false});
  let pingResults='(no targets)';
  let out = [];
  try{
    // use mapPool if exists
    const poolFn = (typeof mapPool==='function' ? (items,fn)=>mapPool(items,fn,4) : (items,fn)=>Promise.all(items.map(fn)));
    const outRaw = await poolFn(pingTargets, t=> t.label.startsWith('Stream ') ? diagIframePing(t.url, t.label) : diagPing(t.url, t.label));
    out = outRaw.map((r,i)=>({...r, hideUrl: !!pingTargets[i].hideUrl}));
    pingResults = out.map(r=>{
      const flag = r.ok ? 'OK' : 'FAIL';
      const isStream = r.label.startsWith('Stream ');
      const urlPart = (r.hideUrl || isStream) ? '' : ` | ${r.url}`;
      // keep error inline, short — kept compact for a single Discord message
      const err = r.error ? ` — ${String(r.error).slice(0,70)}` : '';
      return `[${flag}] ${r.status} ${r.ms}ms | ${r.label}${urlPart}${err}`;
    }).join('\n');
  }catch(_){ pingResults='ping failed: '+String(_).slice(0,300); }

  // Discord-ready, ordered, compact (<1900 chars so it fits one Discord message)
  const gen = now.toISOString().slice(0,19).replace('T',' ') + ' UTC';
  const hostLine = `${location.host}${location.pathname}`;
  const uaShort = (du.ua||'').slice(0,120) + ((du.ua||'').length>120?'…':'');
  // Build ordered sections
  const sys = `${du.browser} ${du.bver} • ${du.os} ${du.over} • ${du.device} • ${innerWidth}x${innerHeight} DPR${devicePixelRatio} • TZ ${tz} • ${lang}`;
  const site = `${curEv} • ${curSess} • ${curSrc} • has-stream ${diagBool(hasStream)}`;
  // pingResults is already built as lines like "  [OK] 200 120ms | Stream WeStream [westream]" — convert to Discord ANSI
  const pingLines = String(pingResults||'').split('\n').filter(Boolean).map(l=>{
    // l is "  [OK] 200 120ms | Stream WeStream [westream]" or API line
    const isOk = l.includes('[OK]');
    const isFail = l.includes('[FAIL]');
    if(!isOk && !isFail) return l;
    // Use ansi colors inside code block: green for OK, red for FAIL, gray for meta
    const color = isOk ? '\u001b[0;32m' : '\u001b[0;31m';
    const reset = '\u001b[0m';
    // strip the leading "  [OK] " and keep rest
    const rest = l.replace(/^\s*\[(?:OK|FAIL)\]\s*/, '');
    const icon = isOk ? '✔' : '✘';
    return `${color}${icon} ${rest}${reset}`;
  }).join('\n');
  // Main report — outside code block for header, inside ansi for network
  const report = [
    `**FreeF1 Diagnostics** • ${gen} • ${hostLine}`,
    `> **System** • ${sys}`,
    `> **Site** • ${site}`,
    `> UA: \`${uaShort}\``,
    `> Iframe: \`${String(iframeInfo).slice(0,110)}\` • Disabled: \`${String(disabled).slice(0,80)||'(none)'}\``,
    '',
    '```ansi',
    pingLines || '\u001b[0;90mno pings\u001b[0m',
    '```',
    `*Send only to certified FreeF1 Discord devs. Generated ${gen} • ${location.href}*`
  ].join('\n');
  // Fallback if >1900 chars — keep ALL streams but strip error details to fit
  if(report.length > 1900){
    const compactPings = out.map(r=>{
      const flag = r.ok ? 'OK' : 'FAIL';
      return `[${flag}] ${r.status} | ${r.label}`;
    }).join('\n');
    const compact = [
      `**FreeF1 Diagnostics** • ${gen} • ${hostLine}`,
      `> **System** • ${sys.slice(0,90)}`,
      `> **Site** • ${site.slice(0,90)}`,
      '```ansi',
      String(compactPings).split('\n').map(l=>{
        const isOk = l.includes('[OK]');
        const color = isOk ? '\u001b[0;32m' : '\u001b[0;31m';
        return `${color}${isOk?'✔':'✘'} ${l.replace(/^\s*\[(?:OK|FAIL)\]\s*/,'')}\u001b[0m`;
      }).join('\n'),
      '```',
      `*Compact — full in console (F12). ${location.href}*`
    ].join('\n');
    if(compact.length < 1900) return compact;
    // last resort: truncate but warn
    return compact.slice(0,1880)+'\n```';
  }
  return report;
}
function showDiagCaution(){
  const o=document.getElementById('diagCautionOverlay');
  if(!o) return;
  o.hidden=false;
  // force reflow for transition if CSS uses .open
  void o.offsetWidth;
  o.classList.add('open');
  document.body.style.overflow='hidden';
  // focus dismiss for a11y
  setTimeout(()=>document.getElementById('diagCautionDismiss')?.focus(), 0);
}
function hideDiagCaution(){
  const o=document.getElementById('diagCautionOverlay');
  if(!o) return;
  o.hidden=true;
  o.classList.remove('open');
  document.body.style.overflow='';
}
async function handleCopyDiagnostics(){
  const btn = document.getElementById('copyDiagnosticsBtn');
  const orig = btn ? btn.textContent : '';
  if(btn){ btn.disabled=true; btn.textContent='Collecting…'; }
  try{
    showToast('Collecting diagnostics — checking feeds & APIs…', 'info');
    const report = await buildDiagnosticsReport();
    let copied=false;
    try{ await navigator.clipboard.writeText(report); copied=true; }catch(_){
      const ta=document.createElement('textarea');
      ta.value=report; ta.style.cssText='position:fixed;top:-1000px;left:-1000px;opacity:0';
      document.body.appendChild(ta); ta.focus(); ta.select();
      try{ copied=document.execCommand('copy'); }catch(_){}
      ta.remove();
    }
    if(copied) showToast('Diagnostics copied — paste to @doggo', 'success');
    else { showToast('Copy failed — report printed to console', 'error'); console.log(report); }
    console.log('%c'+report, 'font:11px/1.4 monospace; white-space:pre;');
    // show caution after copy
    showDiagCaution();
  }catch(e){
    showToast('Diagnostics failed: '+String(e).slice(0,80), 'error');
    console.error(e);
  }finally{
    if(btn){ btn.textContent=orig; btn.disabled=false; }
  }
}
document.getElementById('copyDiagnosticsBtn')?.addEventListener('click', handleCopyDiagnostics);
document.getElementById('diagCautionClose')?.addEventListener('click', hideDiagCaution);
document.getElementById('diagCautionDismiss')?.addEventListener('click', hideDiagCaution);
document.getElementById('diagCautionOverlay')?.addEventListener('click', (e)=>{ if(e.target && e.target.id==='diagCautionOverlay') hideDiagCaution(); });
document.addEventListener('keydown', (e)=>{ if(e.key==='Escape'){ const o=document.getElementById('diagCautionOverlay'); if(o && !o.hidden) hideDiagCaution(); }});
document.getElementById('diagCautionDiscord')?.addEventListener('click', ()=>{ hideDiagCaution(); });

