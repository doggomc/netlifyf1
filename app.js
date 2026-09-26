/* ═══════════════════════════════════════════════════════════════════════════
   APEX - Formula 1 Live Companion
   Client Application Logic
   ═══════════════════════════════════════════════════════════════════════════ */

/* ═══════════════ 1. CONFIGURATION & CONSTANTS ═══════════════ */
const SITE_SEASON = 2026;
const AUTHORIZED_DOMAIN = 'freef1.netlify.app';
const AUTH_PROTECTION_ENABLED = true;

const PREVIEW_HOST = location.hostname === 'localhost' ||
  location.hostname === '127.0.0.1' ||
  location.hostname === 'f1free.onrender.com' ||
  location.hostname.endsWith('.e2b.app');

const isAuthorizedHost = (host) => {
  const h = (host || location.hostname).toLowerCase();
  return (
    h === AUTHORIZED_DOMAIN ||
    h.endsWith('.netlify.app') ||
    h === 'f1free.onrender.com' ||
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h.endsWith('.e2b.app') ||
    h.endsWith('.webcontainer.io') ||
    h.endsWith('.app.github.dev')
  );
};

const PUBLIC_API = PREVIEW_HOST ? location.origin : 'https://f1free.onrender.com';
const AUTH_API_URL = PREVIEW_HOST ? `${location.origin}/api/auth/verify` : 'https://f1free.onrender.com/api/auth/verify';
const OPENF1_API = PREVIEW_HOST ? `${location.origin}/api/openf1` : 'https://f1free.onrender.com/api/openf1';
const JOLPI = 'https://api.jolpi.ca/ergast/f1';

const NAV_TIMEOUT_MS = 9000;
const API_TIMEOUT_MS = 10000;
const API_STALE_FALLBACK_MS = 24 * 60 * 60 * 1000;
const API_CACHE_MAX = 40;
const API_CACHE_INDEX = 'freef1_api_cache_index';

const FOLLOW_KEY = 'freef1_following';
const RADIO_RC_STORE_KEY = 'freef1_radio_rc';

const IS_IOS = /ipad|iphone|ipod/i.test(navigator.userAgent) ||
  (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

const IFRAME_ALLOW = "autoplay *; encrypted-media *; fullscreen *; picture-in-picture *";

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const liteMotion = reduceMotion || matchMedia('(max-width: 760px)').matches || navigator.connection?.saveData;

const BLOCKED_COPY = IS_IOS
  ? "The stream host never loaded on this network. On iPhone this is usually caused by a content blocker, Private Relay, Lockdown Mode or DNS filtering. Disable them for this site, or open the feed in its own tab."
  : "The stream host never responded on this network - the feed was blocked before it could start. Check ad-blockers, VPN or DNS filtering, or open the feed in its own tab.";

const HIJACK_TITLE = "The feed tried to send you to another site";
const HIJACK_COPY = "That was the feed's ad layer tab-swapping the player on your click - not us. Resume reloads the stream; Stay keeps whatever page the frame landed on. We will never redirect you off this site: close any extra tab it opened.";

const VIEWS = { home: 'viewHome', news: 'viewNews', info: 'viewInfo', discord: 'viewDiscord', track: 'viewTrack' };
const VIEW_TITLES = { news: 'News - APEX F1', info: 'Terms, Privacy & FAQ - APEX F1', discord: 'Discord - APEX F1', track: 'Live Track Map - APEX F1' };
const VIEW_SWAP_MS = reduceMotion ? 0 : 260;

const INK_LIGHT = '#fff';
const INK_DARK = '#000';
const APEX_MARK = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2 17.5L7.5 6.5h5.2l-2 4h4.6l-1.6 3.2H8.9l-1.7 3.8H2z" fill="#fff"/><path d="M14.5 6.5H22l-1.7 3.4h-7.5l1.7-3.4z" fill="#fff" opacity=".72"/></svg>';
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
 {id:'default',name:'Apex Red',color:'#E10600',text:'#fff',abbr:'APX'},
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
  _m: {}
};

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
      if (cached) {
        try {
          localStorage.removeItem(key);
        } catch (_) {}
      }
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
  let t = document.getElementById('apexToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'apexToast';
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

/* ═══════════════ 4. CONTENT PROTECTION & AUTH ═══════════════ */
(function installCopyProtection() {
  const editableSelector = 'input,textarea,select,[contenteditable="true"]';
  const isEditable = (target) => target instanceof Element && Boolean(target.closest(editableSelector));
  const blockSelection = (event) => {
    if (!isEditable(event.target)) event.preventDefault();
  };

  document.addEventListener('contextmenu', (event) => {
    if (!isEditable(event.target)) event.preventDefault();
  });
  document.addEventListener('selectstart', blockSelection);
  document.addEventListener('dragstart', blockSelection);
  document.addEventListener('copy', (event) => {
    if (!isEditable(event.target)) event.preventDefault();
  });
  document.addEventListener('cut', (event) => {
    if (!isEditable(event.target)) event.preventDefault();
  });
  document.addEventListener('keydown', (event) => {
    const key = (event.key || '').toLowerCase();
    const modifier = event.ctrlKey || event.metaKey;
    const blocked = key === 'f12' ||
      (modifier && ['u', 's', 'p'].includes(key)) ||
      (modifier && event.shiftKey && ['i', 'j', 'c', 'k'].includes(key));
    if (blocked && !isEditable(event.target)) {
      event.preventDefault();
      event.stopPropagation();
    }
  });
})();

function checkAuth() {
  if (!AUTH_PROTECTION_ENABLED) return;
  const host = location.hostname.toLowerCase();
  if (isAuthorizedHost(host)) return;
  fetch(AUTH_API_URL, { cache: 'no-store' })
    .then((r) => r.json())
    .then((d) => {
      if (d.authorized) return;
      showUnauthorized(d.error || 'Unauthorized access detected');
    })
    .catch(() => showUnauthorized('Unable to verify authorization.'));
}

function showUnauthorized(reason) {
  const overlay = $('authOverlay');
  if (!overlay) return;
  const codeEl = $('authErrorCode');
  if (codeEl) codeEl.textContent = 'Error: ' + reason;
  overlay.classList.add('open');
  const retryBtn = $('authRetryBtn');
  if (retryBtn) {
    retryBtn.onclick = () => {
      overlay.classList.remove('open');
      setTimeout(checkAuth, 500);
    };
  }
}

setTimeout(checkAuth, 100);

/* ═══════════════ 5. SCHEDULE & SESSION DATA ═══════════════ */
const schedule=[
 {round:1,slug:"australia",name:"Australian Grand Prix",circuit:"Albert Park Grand Prix Circuit",locality:"Melbourne",country:"Australia",sprint:false,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-03-06T01:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-03-06T05:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-03-07T01:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-03-07T05:00:00Z"},{slug:"race",name:"Race",start:"2026-03-08T04:00:00Z"}]},
 {round:2,slug:"china",name:"Chinese Grand Prix",circuit:"Shanghai International Circuit",locality:"Shanghai",country:"China",sprint:true,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-03-13T03:30:00Z"},{slug:"sprint-qualifying",name:"Sprint Qualifying",start:"2026-03-13T07:30:00Z"},{slug:"sprint",name:"Sprint",start:"2026-03-14T03:00:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-03-14T07:00:00Z"},{slug:"race",name:"Race",start:"2026-03-15T07:00:00Z"}]},
 {round:3,slug:"japan",name:"Japanese Grand Prix",circuit:"Suzuka Circuit",locality:"Suzuka",country:"Japan",sprint:false,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-03-27T02:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-03-27T06:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-03-28T02:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-03-28T06:00:00Z"},{slug:"race",name:"Race",start:"2026-03-29T05:00:00Z"}]},
 {round:4,slug:"miami",name:"Miami Grand Prix",circuit:"Miami International Autodrome",locality:"Miami",country:"USA",sprint:true,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-05-01T16:00:00Z"},{slug:"sprint-qualifying",name:"Sprint Qualifying",start:"2026-05-01T20:30:00Z"},{slug:"sprint",name:"Sprint",start:"2026-05-02T16:00:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-05-02T20:00:00Z"},{slug:"race",name:"Race",start:"2026-05-03T20:00:00Z"}]},
 {round:5,slug:"canada",name:"Canadian Grand Prix",circuit:"Circuit Gilles Villeneuve",locality:"Montreal",country:"Canada",sprint:true,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-05-22T16:30:00Z"},{slug:"sprint-qualifying",name:"Sprint Qualifying",start:"2026-05-22T20:30:00Z"},{slug:"sprint",name:"Sprint",start:"2026-05-23T16:00:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-05-23T20:00:00Z"},{slug:"race",name:"Race",start:"2026-05-24T20:00:00Z"}]},
 {round:6,slug:"monaco",name:"Monaco Grand Prix",circuit:"Circuit de Monaco",locality:"Monte Carlo",country:"Monaco",sprint:false,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-06-05T11:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-06-05T15:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-06-06T10:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-06-06T14:00:00Z"},{slug:"race",name:"Race",start:"2026-06-07T13:00:00Z"}]},
 {round:7,slug:"barcelona",name:"Barcelona Grand Prix",circuit:"Circuit de Barcelona-Catalunya",locality:"Barcelona",country:"Spain",sprint:false,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-06-12T11:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-06-12T15:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-06-13T10:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-06-13T14:00:00Z"},{slug:"race",name:"Race",start:"2026-06-14T13:00:00Z"}]},
 {round:8,slug:"austria",name:"Austrian Grand Prix",circuit:"Red Bull Ring",locality:"Spielberg",country:"Austria",sprint:false,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-06-26T11:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-06-26T15:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-06-27T10:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-06-27T14:00:00Z"},{slug:"race",name:"Race",start:"2026-06-28T13:00:00Z"}]},
 {round:9,slug:"britain",name:"British Grand Prix",circuit:"Silverstone Circuit",locality:"Silverstone",country:"UK",sprint:true,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-07-03T11:30:00Z"},{slug:"sprint-qualifying",name:"Sprint Qualifying",start:"2026-07-03T15:30:00Z"},{slug:"sprint",name:"Sprint",start:"2026-07-04T11:00:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-07-04T15:00:00Z"},{slug:"race",name:"Race",start:"2026-07-05T14:00:00Z"}]},
 {round:10,slug:"belgium",name:"Belgian Grand Prix",circuit:"Circuit de Spa-Francorchamps",locality:"Spa",country:"Belgium",sprint:false,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-07-17T11:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-07-17T15:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-07-18T10:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-07-18T14:00:00Z"},{slug:"race",name:"Race",start:"2026-07-19T13:00:00Z"}]},
 {round:11,slug:"hungary",name:"Hungarian Grand Prix",circuit:"Hungaroring",locality:"Budapest",country:"Hungary",sprint:false,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-07-24T11:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-07-24T15:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-07-25T10:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-07-25T14:00:00Z"},{slug:"race",name:"Race",start:"2026-07-26T13:00:00Z"}]},
 {round:12,slug:"netherlands",name:"Dutch Grand Prix",circuit:"Circuit Park Zandvoort",locality:"Zandvoort",country:"Netherlands",sprint:true,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-08-21T10:30:00Z"},{slug:"sprint-qualifying",name:"Sprint Qualifying",start:"2026-08-21T14:30:00Z"},{slug:"sprint",name:"Sprint",start:"2026-08-22T10:00:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-08-22T14:00:00Z"},{slug:"race",name:"Race",start:"2026-08-23T13:00:00Z"}]},
 {round:13,slug:"italy",name:"Italian Grand Prix",circuit:"Autodromo Nazionale di Monza",locality:"Monza",country:"Italy",sprint:false,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-09-04T10:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-09-04T14:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-09-05T10:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-09-05T14:00:00Z"},{slug:"race",name:"Race",start:"2026-09-06T13:00:00Z"}]},
 {round:14,slug:"spain",name:"Spanish Grand Prix",circuit:"Madring",locality:"Madrid",country:"Spain",sprint:false,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-09-11T11:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-09-11T15:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-09-12T10:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-09-12T14:00:00Z"},{slug:"race",name:"Race",start:"2026-09-13T13:00:00Z"}]},
 {round:15,slug:"azerbaijan",name:"Azerbaijan Grand Prix",circuit:"Baku City Circuit",locality:"Baku",country:"Azerbaijan",sprint:false,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-09-24T08:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-09-24T12:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-09-25T08:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-09-25T12:00:00Z"},{slug:"race",name:"Race",start:"2026-09-26T11:00:00Z"}]},
 {round:16,slug:"singapore",name:"Singapore Grand Prix",circuit:"Marina Bay Street Circuit",locality:"Marina Bay",country:"Singapore",sprint:true,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-10-09T08:30:00Z"},{slug:"sprint-qualifying",name:"Sprint Qualifying",start:"2026-10-09T12:30:00Z"},{slug:"sprint",name:"Sprint",start:"2026-10-10T09:00:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-10-10T13:00:00Z"},{slug:"race",name:"Race",start:"2026-10-11T12:00:00Z"}]},
 {round:17,slug:"usa",name:"United States Grand Prix",circuit:"Circuit of the Americas",locality:"Austin",country:"USA",sprint:false,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-10-23T17:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-10-23T21:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-10-24T17:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-10-24T21:00:00Z"},{slug:"race",name:"Race",start:"2026-10-25T20:00:00Z"}]},
 {round:18,slug:"mexico",name:"Mexico City Grand Prix",circuit:"Autódromo Hermanos Rodríguez",locality:"Mexico City",country:"Mexico",sprint:false,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-10-30T18:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-10-30T22:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-10-31T17:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-10-31T21:00:00Z"},{slug:"race",name:"Race",start:"2026-11-01T20:00:00Z"}]},
 {round:19,slug:"brazil",name:"Brazilian Grand Prix",circuit:"Autódromo José Carlos Pace",locality:"São Paulo",country:"Brazil",sprint:false,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-11-06T15:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-11-06T19:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-11-07T14:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-11-07T18:00:00Z"},{slug:"race",name:"Race",start:"2026-11-08T17:00:00Z"}]},
 {round:20,slug:"lasvegas",name:"Las Vegas Grand Prix",circuit:"Las Vegas Strip Street Circuit",locality:"Las Vegas",country:"USA",sprint:false,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-11-20T00:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-11-20T04:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-11-21T00:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-11-21T04:00:00Z"},{slug:"race",name:"Race",start:"2026-11-22T04:00:00Z"}]},
 {round:21,slug:"qatar",name:"Qatar Grand Prix",circuit:"Losail International Circuit",locality:"Lusail",country:"Qatar",sprint:false,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-11-27T13:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-11-27T17:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-11-28T14:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-11-28T18:00:00Z"},{slug:"race",name:"Race",start:"2026-11-29T16:00:00Z"}]},
 {round:22,slug:"abudhabi",name:"Abu Dhabi Grand Prix",circuit:"Yas Marina Circuit",locality:"Abu Dhabi",country:"UAE",sprint:false,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-12-04T09:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-12-04T13:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-12-05T10:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-12-05T14:00:00Z"},{slug:"race",name:"Race",start:"2026-12-06T13:00:00Z"}]}
];

// Parse session timestamps once into numeric milliseconds.
schedule.forEach((event) => event.sessions.forEach((session) => {
  session.ts = Date.parse(session.start);
}));

function hoursSince(s) {
  if (!s || !s.ts) return Infinity;
  return (Date.now() - s.ts) / 3600000;
}

function isStreamAvailable(s) {
  if (!s) return false;
  const d = hoursSince(s);
  return d >= -1 && d <= 3;
}

function isSessionEnded(s) {
  if (!s) return false;
  return hoursSince(s) > 4;
}

function isDateEnded(d) {
  return Boolean(d && (new Date() - new Date(d + 'T23:59:59Z')) > 0);
}

function getCurrentLiveSession() {
  for (const ev of schedule) {
    for (const s of ev.sessions) {
      const d = hoursSince(s);
      if (d >= -1 && d <= 3) return { event: ev, session: s };
    }
  }
  return null;
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
 {id:"sky-uk-2",label:"Sky UK 2",url:"https://videocdn-4726.website/shopping2/?channel_id=sky_sport_f1_uk",rp:"strict-origin-when-cross-origin"},
 {id:"sky-uk",label:"Sky UK",url:"https://strmfree.st/embed/racing/skyf1"},
 {id:"f1tv",label:"F1TV",suffix:""},
 {id:"sky-sports-f1",label:"Sky Sports F1",streamNum:1},
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
  if (activeView === 'home') document.title = currentEvent.name + " - APEX F1";
  if (heroSession) heroSession.textContent = currentSession.name + " · " + SITE_SEASON;

  const done = currentEvent.sessions.every(isSessionEnded);
  if (heroRound) {
    heroRound.textContent = `Round ${currentEvent.round} · ${currentEvent.locality}, ${currentEvent.country}` +
      (currentEvent.sprint ? " · Sprint Weekend" : "") + (done ? " · Completed" : "");
  }

  normalizeCurrentSource();
  const src = sources[currentSource] || { label: "-", suffix: "" };
  if (stageLabel) stageLabel.textContent = "apex://live/" + currentEvent.slug + "/" + currentSession.slug + (src.suffix !== undefined ? src.suffix : "/" + src.id);
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
      trackEvent('source', s.label);
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
}

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
    trackEvent('stream_hijack');
    showNoStream({ blocked: true, hijack: true, keepFrame: true });
  });
}

function showStreamBlocked() {
  trackEvent('stream_blocked');
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
    trackEvent('stream_ready', Math.round(performance.now() - startedAt));
    f.classList.add('loaded');
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
    trackEvent('stream_error');
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
    trackEvent('stream_timeout');
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
          trackEvent('stream_hijack');
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
        trackEvent('stream_timeout');
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
    trackEvent('nostream');
    return;
  }

  normalizeCurrentSource();
  const order = [];
  if (sourceEnabled(sources[currentSource])) order.push(currentSource);
  for (let i = 0; i < sources.length; i++) {
    if (i !== currentSource && sourceEnabled(sources[i])) order.push(i);
  }
  if (!order.length) {
    trackEvent('nostream');
    showNoStream({
      blocked: true,
      title: "Every feed is switched off",
      text: "Race control has disabled all stream sources. Nothing to play until one is re-enabled."
    });
    return;
  }
  attemptSource(token, order, 0, performance.now());
}

/* ═══════════════ 7. LIVE SITE STATE, SSE & STREAM OVERRIDE ═══════════════ */
let streamOverride = { active: false, url: null, type: null };
let lastOverrideToastKey = '';
let streamEvents = null;
let streamSseConnected = false;
let streamReconnectTimer = 0;
let streamRetryMs = 2000;

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

function applyStreamOverride(override) {
  const next = override || { active: false, url: null, type: null };
  const prevActive = streamOverride.active;
  const changed = Boolean(next.active) !== Boolean(streamOverride.active) ||
    (next.url || '') !== (streamOverride.url || '') ||
    (next.type || '') !== (streamOverride.type || '');

  streamOverride = next;
  updateOverridePill(streamOverride);
  if (!changed) return;

  const toastKey = streamOverride.active ? (streamOverride.url || '') : 'inactive';
  if (toastKey !== lastOverrideToastKey) {
    lastOverrideToastKey = toastKey;
    if (streamOverride.active && streamOverride.url) {
      showToast(`Stream override active - ${streamOverride.type || 'custom'} feed`, 'warning');
    } else if (prevActive) {
      showToast('Stream override deactivated - normal feed restored.', 'success');
    }
  }
  load();
}

function applyMaintenanceMode(state) {
  if (state?.active && location.pathname !== '/maintenance.html') {
    location.replace('/maintenance.html');
  }
}

window.__APEX_SITE_STATUS?.then((data) => applyMaintenanceMode(data?.maintenance));

function applySourceConfig(payload) {
  const disabled = Array.isArray(payload && payload.disabled) ? payload.disabled : [];
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

function initStreamOverrideSSE() {
  if (document.hidden || streamEvents) return;
  const SSE_URL = `${PUBLIC_API}/api/events`;
  try {
    const es = new EventSource(SSE_URL);
    streamEvents = es;
    const onState = (e) => {
      try {
        applyStreamOverride(JSON.parse(e.data));
      } catch (_) {}
    };
    es.addEventListener('open', () => {
      streamSseConnected = true;
      streamRetryMs = 2000;
    });
    es.addEventListener('stream_override', onState);
    es.addEventListener('stream_update', onState);
    es.addEventListener('maintenance_update', (event) => {
      try {
        applyMaintenanceMode(JSON.parse(event.data));
      } catch (_) {}
    });
    es.addEventListener('news_update', (event) => {
      try {
        applyNewsUpdate(JSON.parse(event.data), true);
      } catch (_) {}
    });
    es.addEventListener('sources_update', (event) => {
      try {
        applySourceConfig(JSON.parse(event.data));
      } catch (_) {}
    });
    es.addEventListener('experimental_update', (event) => {
      try {
        applyExperimentalUpdate(JSON.parse(event.data));
      } catch (_) {}
    });
    es.addEventListener('error', () => {
      streamSseConnected = false;
      es.close();
      if (streamEvents === es) streamEvents = null;
      clearTimeout(streamReconnectTimer);
      streamReconnectTimer = setTimeout(initStreamOverrideSSE, streamRetryMs);
      streamRetryMs = Math.min(streamRetryMs * 2, 30000);
    });
  } catch (_) {
    streamEvents = null;
    streamReconnectTimer = setTimeout(initStreamOverrideSSE, streamRetryMs);
  }
}

let streamPollTimer = 0;
let streamPollInFlight = false;
let sitePollInFlight = false;
let sourcePollInFlight = false;

async function pollSiteStatus(force = false) {
  if (document.hidden || sitePollInFlight || (!force && streamSseConnected)) return;
  sitePollInFlight = true;
  try {
    const response = await fetchWithTimeout(`${PUBLIC_API}/api/site/status`, { cache: 'no-store', credentials: 'omit' });
    if (response.ok) applyMaintenanceMode((await response.json()).maintenance);
  } catch (_) {}
  finally {
    sitePollInFlight = false;
  }
}

async function pollStreamStatus(force = false) {
  if (document.hidden || streamPollInFlight || (!force && streamSseConnected)) return;
  streamPollInFlight = true;
  try {
    const r = await fetchWithTimeout(`${PUBLIC_API}/api/stream/status`, { cache: 'no-store', credentials: 'omit' });
    if (r.ok) applyStreamOverride(await r.json());
  } catch (_) {}
  finally {
    streamPollInFlight = false;
  }
}

async function pollSourceConfig(force = false) {
  if (document.hidden || sourcePollInFlight || (!force && streamSseConnected)) return;
  sourcePollInFlight = true;
  try {
    const r = await fetchWithTimeout(`${PUBLIC_API}/api/stream/sources`, { cache: 'no-store', credentials: 'omit' });
    if (r.ok) applySourceConfig(await r.json());
  } catch (_) {}
  finally {
    sourcePollInFlight = false;
  }
}

function initStreamPolling() {
  clearInterval(streamPollTimer);
  pollStreamStatus(true);
  pollSiteStatus(true);
  pollNews(true);
  pollSourceConfig(true);
  pollExperimentalStatus(true);
  streamPollTimer = setInterval(() => {
    pollStreamStatus();
    pollSiteStatus();
    pollNews();
    pollSourceConfig();
    pollExperimentalStatus();
  }, 30000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      streamEvents?.close();
      streamEvents = null;
      streamSseConnected = false;
    } else {
      pollStreamStatus(true);
      pollSiteStatus(true);
      pollNews(true);
      pollSourceConfig(true);
      pollExperimentalStatus(true);
      initStreamOverrideSSE();
    }
  }, { passive: true });
}

/* ═══════════════ 8. VISITOR TELEMETRY & ANALYTICS ═══════════════ */
const earlyEvents = [];
let trackEvent = (type, value) => {
  if (earlyEvents.length < 12) earlyEvents.push([type, value]);
};

function initVisitorCounter() {
  const el = $("visitorCount");
  if (!el) return;
  let uid = store.get('freef1_user_id');
  if (!uid) {
    uid = 'user_' + (crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36));
    store.set('freef1_user_id', uid);
  }
  const API = PREVIEW_HOST ? location.origin : 'https://f1free.onrender.com';
  const INTERVAL = 18000;
  let timer = 0;
  let inFlight = false;
  let visitorToken = '';
  let visitorTokenExpiresAt = 0;

  const updateCount = (data) => {
    if (data && Number.isFinite(data.active)) el.textContent = String(data.active);
  };

  const refreshVisitorToken = async () => {
    const response = await fetchWithTimeout(`${API}/api/visitors/token`, {
      cache: 'no-store',
      credentials: 'omit',
      headers: { 'X-User-Id': uid }
    });
    if (!response.ok) throw new Error(`Token request failed: ${response.status}`);
    const data = await response.json();
    visitorToken = data.token || '';
    visitorTokenExpiresAt = Number(data.expiresAt) || 0;
  };

  const beat = async () => {
    clearTimeout(timer);
    if (document.hidden || inFlight) {
      timer = setTimeout(beat, INTERVAL);
      return;
    }
    inFlight = true;
    try {
      if (!visitorToken || visitorTokenExpiresAt - Date.now() < 60000) await refreshVisitorToken();
      const r = await fetchWithTimeout(`${API}/api/visitors/heartbeat?page=${encodeURIComponent(location.pathname)}`, {
        cache: 'no-store',
        credentials: 'omit',
        keepalive: true,
        headers: { 'X-Visitor-Token': visitorToken, 'X-User-Id': uid }
      });
      if (r.status === 403) {
        visitorToken = '';
        visitorTokenExpiresAt = 0;
      } else if (r.ok) {
        updateCount(await r.json());
      }
    } catch (_) {}
    finally {
      inFlight = false;
      timer = setTimeout(beat, INTERVAL);
    }
  };

  const queue = [];
  let draining = false;

  const drain = async () => {
    if (draining) return;
    draining = true;
    try {
      while (queue.length) {
        if (!visitorToken || visitorTokenExpiresAt - Date.now() < 60000) await refreshVisitorToken();
        const ev = queue.shift();
        const r = await fetchWithTimeout(`${API}/api/visitors/event`, {
          method: 'POST',
          cache: 'no-store',
          credentials: 'omit',
          keepalive: true,
          headers: { 'Content-Type': 'application/json', 'X-Visitor-Token': visitorToken, 'X-User-Id': uid },
          body: JSON.stringify(ev)
        });
        if (r.status === 403) {
          visitorToken = '';
          visitorTokenExpiresAt = 0;
          queue.unshift(ev);
          break;
        }
        if (r.status === 429) {
          queue.length = 0;
          break;
        }
      }
    } catch (_) {
      queue.length = 0;
    } finally {
      draining = false;
    }
  };

  trackEvent = (type, value) => {
    if (queue.length < 12) {
      queue.push(value === undefined ? { type } : { type, value });
      setTimeout(drain, 0);
    }
  };

  earlyEvents.splice(0).forEach(([type, value]) => trackEvent(type, value));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) beat();
  }, { passive: true });
  beat();
}

document.addEventListener('fullscreenchange', () => {
  if (document.fullscreenElement && playerEl?.contains(document.fullscreenElement)) trackEvent('fullscreen');
});
document.addEventListener('webkitfullscreenchange', () => {
  if (document.webkitFullscreenElement && playerEl?.contains(document.webkitFullscreenElement)) trackEvent('fullscreen');
});

/* ═══════════════ 9. CLOCKS & COUNTDOWN ═══════════════ */
function updateCountdown() {
  if (!countdownEl) return;
  const live = getCurrentLiveSession();
  if (live && hoursSince(live.session) >= 0) {
    const elapsed = Date.now() - live.session.ts;
    const h = Math.floor(elapsed / 3600000);
    const m = Math.floor((elapsed % 3600000) / 60000);
    const s = Math.floor((elapsed % 60000) / 1000);
    const p = (v) => String(v).padStart(2, "0");
    countdownEl.textContent = `${live.event.name} ${live.session.name} · LIVE NOW (${h > 0 ? h + ':' : ''}${p(m)}:${p(s)})`;
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
  if (tickerTrack) tickerTrack.innerHTML = html;
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
    const h = document.documentElement.scrollHeight - innerHeight;
    navEl?.classList.toggle('stuck', y > 40 || activeView !== 'home');
    if (progressEl) progressEl.style.transform = 'scaleX(' + (h > 0 ? y / h : 0) + ')';
    if (!liteMotion && heroLayer && y < innerHeight * 1.3) {
      heroLayer.style.transform = `translate3d(0,${y * 0.38}px,0) scale(1.06)`;
    }
    if (!liteMotion && breakLayer && breakLayer.parentElement) {
      const rect = breakLayer.parentElement.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < innerHeight) {
        const p = (innerHeight - rect.top) / (innerHeight + rect.height);
        breakLayer.style.transform = `translate3d(0,${(p - 0.5) * 90}px,0) scale(1.1)`;
      }
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

function showView(route, { push = true, scroll = true } = {}) {
  const next = $(VIEWS[route]);
  const prev = $(VIEWS[activeView]);
  if (!next) return;
  const changed = route !== activeView;
  if (push) {
    const url = route === 'home' ? '/' : '/' + route;
    if (location.pathname !== url) history.pushState({ view: route }, '', url);
  }
  document.title = route === 'home' ? currentEvent.name + " - APEX F1" : VIEW_TITLES[route];
  setActiveNav(route);
  closeNav();
  if (!changed) {
    if (scroll) scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  activeView = route;
  clearTimeout(viewSwapTimer);
  trackEvent('view', route === 'home' ? '/' : '/' + route);
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
    if (route === 'news') pollNews(true);
    if (route === 'track') initTrackMap();
    else if (typeof pauseTrackMap === 'function') pauseTrackMap();
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
  if (route === 'track') initTrackMap();
})();

/* ═══════════════ 13. ACCORDIONS & INFO TABS ═══════════════ */
document.querySelectorAll('.acc-q').forEach((btn) => {
  btn.addEventListener('click', () => {
    const item = btn.parentElement;
    const a = item.querySelector('.acc-a');
    const was = item.classList.contains('active');
    item.closest('.acc-wrap')?.querySelectorAll('.acc-item').forEach((i) => {
      i.classList.remove('active');
      const innerA = i.querySelector('.acc-a');
      if (innerA) innerA.style.maxHeight = null;
    });
    if (!was && a) {
      item.classList.add('active');
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

function loadStandings(type) {
  if (loadEl) {
    loadEl.style.display = 'block';
    loadEl.textContent = 'Loading standings…';
  }
  if (rowsEl) rowsEl.style.opacity = '0.35';
  const url = `${JOLPI}/${SITE_SEASON}/${type === 'drivers' ? 'driverstandings' : 'constructorstandings'}/?limit=30`;
  fetchJson(url)
    .then((data) => {
      const lists = data?.MRData?.StandingsTable?.StandingsLists?.[0];
      const list = type === 'drivers' ? lists?.DriverStandings : lists?.ConstructorStandings;
      if (!list || !list.length) throw new Error('Empty');
      renderStandings(type, list);
    })
    .catch(() => {
      if (loadEl) loadEl.textContent = 'Standings unavailable right now.';
      if (rowsEl) rowsEl.style.opacity = '1';
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
    el.innerHTML = '<div class="state">Grid unavailable right now.</div>';
    return;
  }
  driverEntries = list.slice();
  const renderFollowing = getFollowing();
  const fragment = document.createDocumentFragment();
  let rendered = 0;

  list.forEach((it, i) => {
    const d = it.Driver || {};
    const team = it.Constructors?.[0]?.name || '';
    const src = photoFor(d.driverId);
    const a = document.createElement('article');
    a.className = 'dcard' + (it.position === '1' ? ' lead' : '') + (src ? '' : ' noimg');
    const accent = hexFor(team);
    a.style.setProperty('--c', accent);
    a.style.setProperty('--c-ink', inkOn(accent));
    a.style.animationDelay = (i * 32) + 'ms';
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
  if (rendered) el.replaceChildren(fragment);
  else el.innerHTML = '<div class="state">Grid unavailable right now.</div>';
}

function loadDriverGrid() {
  getDriverStandings()
    .then(renderDriverGrid)
    .catch(() => {
      const el = $("driverGrid");
      if (el) el.innerHTML = '<div class="state">Grid unavailable right now.</div>';
    });
}

/* ═══════════════ 16. DRIVER PROFILE MODAL ═══════════════ */
const dOverlay = $("driverOverlay");
const dSheet = $("driverSheet");
const dProfile = $("driverProfile");
let driverProfileToken = 0;
const driverCareerCache = new Map();

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

async function fetchCareerJson(url, attempts = 4) {
  let wait = 800;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchJson(url);
    } catch (err) {
      if (i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, wait));
      wait = Math.min(wait * 2, 6000);
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
    fetchCareerJson(`${JOLPI}/drivers/${driverId}/results/?limit=100&offset=${off}`).catch(() => null), 3);
  for (const page of pages) {
    const batch = page?.MRData?.RaceTable?.Races || [];
    if (!batch.length) return null;
    rows.push(...batch);
  }
  return rows;
}

function getDriverCareer(driverId) {
  if (driverCareerCache.has(driverId)) return driverCareerCache.get(driverId);
  const job = (async () => {
    try {
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
          try {
            const d = await fetchCareerJson(`${JOLPI}/${y}/driverstandings/1/?limit=1`);
            const champ = d?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings?.[0]?.Driver?.driverId;
            return champ ? champ === driverId : null;
          } catch (_) {
            return null;
          }
        };
        const checks = await mapPool(titleSeasons, checkTitle, 2);
        if (checks.includes(null)) return null;
        titles = checks.filter(Boolean).length;
      }

      return {
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
    trackEvent('team', tEntry.id);
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
  if (pod) pod.textContent = career ? career.seasonPodiums : '–';
  if (!career) {
    box.innerHTML = '<div class="state">Career telemetry unavailable right now.</div>';
    return;
  }
  box.innerHTML = `
    <div class="dp-tiles">
      <div class="dp-tile"><b>${career.races}</b><span>Races</span></div>
      <div class="dp-tile"><b>${career.wins}</b><span>Wins</span></div>
      <div class="dp-tile"><b>${career.podiums}</b><span>Podiums</span></div>
      <div class="dp-tile"><b>${career.poles}</b><span>Poles</span></div>
      <div class="dp-tile"><b>${escapeHtml(career.points)}</b><span>Points</span></div>
      <div class="dp-tile hl"><b>${career.titles}</b><span>Title${career.titles === 1 ? '' : 's'}</span></div>
    </div>
    <div class="dp-note">F1 ${escapeHtml(career.span)} · ${career.seasons} season${career.seasons === 1 ? '' : 's'} · Career data via Ergast</div>`;
}

$("driverClose")?.addEventListener('click', () => closeModal(dOverlay));

/* ═══════════════ 17. SESSION RESULTS MODAL ═══════════════ */
const sOverlay = $("sessionsOverlay");
const sRace = $("sessionRaceSelect");
const sType = $("sessionTypeSelect");
const sLoad = $("sessionsResultsLoading");
const sRes = $("sessionsResults");
let seasonRaces = [];

async function loadSeasonRaces() {
  try {
    if (!seasonRaces.length) {
      const data = await fetchJson(`https://api.jolpi.ca/ergast/f1/${SITE_SEASON}.json?limit=30`);
      seasonRaces = data?.MRData?.RaceTable?.Races || [];
    }
    if (sRace) {
      sRace.innerHTML = '';
      const valid = seasonRaces.filter((race) => isDateEnded(race.date));
      const list = (valid.length ? valid : seasonRaces).slice().sort((a, b) => Number(b.round) - Number(a.round));
      const fragment = document.createDocumentFragment();
      list.forEach((race) => {
        const option = document.createElement('option');
        option.value = race.round;
        option.textContent = `R${race.round} · ${race.raceName}`;
        fragment.appendChild(option);
      });
      sRace.appendChild(fragment);
      if (list.length) sRace.value = list[0].round;
      if (!seasonRaces.length) sRace.innerHTML = '<option>No races found</option>';
    }
    updateSessionTypeOptions();
    loadSessionResults();
  } catch (_) {
    if (sRace) sRace.innerHTML = '<option>Failed to load</option>';
  }
}

function updateSessionTypeOptions() {
  if (!sRace || !sType) return;
  const rc = seasonRaces.find((r) => r.round === sRace.value);
  const sp = sType.querySelector('option[value="sprint"]');
  if (rc && rc.Sprint) {
    if (sp) {
      sp.disabled = false;
      sp.hidden = false;
    }
  } else {
    if (sp) {
      sp.hidden = true;
      sp.disabled = true;
    }
    if (sType.value === 'sprint') sType.value = 'results';
  }
}

async function loadSessionResults() {
  if (!sRace || !sType || !sRes) return;
  const round = sRace.value;
  const type = sType.value;
  if (!round) {
    sRes.innerHTML = '<div class="state">Select a race first.</div>';
    return;
  }
  if (sLoad) sLoad.style.display = 'block';
  sRes.innerHTML = '';
  try {
    const ep = ({ results: 'results', qualifying: 'qualifying', sprint: 'sprint' })[type] || 'results';
    const data = await fetchJson(`https://api.jolpi.ca/ergast/f1/${SITE_SEASON}/${round}/${ep}/`);
    if (sLoad) sLoad.style.display = 'none';
    const race = data?.MRData?.RaceTable?.Races?.[0];
    const results = type === 'qualifying' ? race?.QualifyingResults : type === 'sprint' ? race?.SprintResults : race?.Results;
    if (!results?.length) {
      sRes.innerHTML = '<div class="state">No results published for this session yet.</div>';
      return;
    }
    const fragment = document.createDocumentFragment();
    results.forEach((result, index) => {
      const element = document.createElement('div');
      element.className = 'rrow';
      element.style.animation = `rowIn .5s var(--ease) ${index * 24}ms both`;
      const rtColor = hexFor(result.Constructor?.name || '');
      element.style.setProperty('--race-team', rtColor);
      element.style.setProperty('--race-team-ink', inkOn(rtColor));
      const time = type === 'qualifying'
        ? ([result.Q3, result.Q2, result.Q1].filter(Boolean)[0] || '-')
        : (result.Time?.time || result.status || '-');
      element.innerHTML = `<div class="pos">${escapeHtml(result.position)}</div><div class="who"><b>${escapeHtml(`${result.Driver?.givenName || ''} ${result.Driver?.familyName || ''}`)}</b><small>${escapeHtml(result.Constructor?.name || '')}</small></div><div class="rtime">${escapeHtml(time)}</div>`;
      fragment.appendChild(element);
    });
    sRes.replaceChildren(fragment);
  } catch (e) {
    if (sLoad) sLoad.style.display = 'none';
    sRes.innerHTML = '<div class="state">Failed to load results.</div>';
  }
}

$("sessionsBtn")?.addEventListener('click', () => {
  openModal(sOverlay);
  loadSeasonRaces();
});
$("sessionsClose")?.addEventListener('click', () => closeModal(sOverlay));
sRace?.addEventListener('change', () => {
  updateSessionTypeOptions();
  loadSessionResults();
});
sType?.addEventListener('change', loadSessionResults);
$("championshipBtn")?.addEventListener('click', () => {
  document.getElementById('standings')?.scrollIntoView({ behavior: 'smooth' });
});

/* ═══════════════ 18. RACE TIMES MODAL ═══════════════ */
const raceTimesOverlay = $("raceTimesOverlay");
const raceTimesList = $("raceTimesList");
const raceTimesSeason = $("raceTimesSeason");
const raceTimesTimezone = $("raceTimesTimezone");
let raceTimesFilter = 'all';

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

function renderRaceTimes(filter = raceTimesFilter) {
  if (!raceTimesList) return;
  raceTimesFilter = filter;
  if (raceTimesSeason) raceTimesSeason.textContent = `SEASON ${SITE_SEASON} · LOCAL`;
  if (raceTimesTimezone) raceTimesTimezone.textContent = `Times shown in your local timezone · ${localTimeZone} (${localTimeZoneLabel})`;
  const items = schedule.map((event) => ({
    event,
    status: raceStatus(event),
    race: event.sessions.find((session) => session.slug === 'race') || event.sessions.at(-1)
  })).filter((item) => filter === 'all' || item.status === filter);

  if (!items.length) {
    raceTimesList.innerHTML = '<div class="state">No races match this filter.</div>';
    return;
  }
  raceTimesList.innerHTML = items.map(({ event, status, race }) => `<article class="race-time-item ${status}">
    <div class="race-time-top"><div class="race-time-title">R${escapeHtml(event.round)} · ${escapeHtml(event.name)}<small>${escapeHtml(event.locality)}, ${escapeHtml(event.country)}</small></div>
      <span class="race-time-status ${status}">${status}</span></div>
    <div class="race-time-race"><span>Race · ${escapeHtml(formatRaceDateTime(race?.ts))}</span></div>
    <div class="race-time-sessions">${event.sessions.map((session) => `<div class="race-time-session"><b>${escapeHtml(session.name)}</b><time datetime="${escapeHtml(new Date(session.ts).toISOString())}">${escapeHtml(formatRaceDateTime(session.ts))}</time></div>`).join('')}</div>
  </article>`).join('');
}

$("raceTimesBtn")?.addEventListener('click', () => {
  openModal(raceTimesOverlay);
  renderRaceTimes('all');
});
$("raceTimesClose")?.addEventListener('click', () => closeModal(raceTimesOverlay));
document.querySelectorAll('#raceTimesTabs [role="tab"]').forEach((tab) => tab.addEventListener('click', () => {
  document.querySelectorAll('#raceTimesTabs [role="tab"]').forEach((item) => {
    const active = item === tab;
    item.classList.toggle('active', active);
    item.setAttribute('aria-selected', String(active));
  });
  renderRaceTimes(tab.dataset.raceFilter);
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
  const queryStr = new URLSearchParams(params).toString();
  const primaryUrl = `${OPENF1_API}/${path}?${queryStr}`;
  const directUrl = `https://api.openf1.org/v1/${path}?${queryStr}`;
  const cacheKey = `${path}?${queryStr}`;

  const hit = radioRc.cache.get(cacheKey);
  if (hit && (hit.promise || Date.now() - hit.at < ttlMs)) return hit.promise || Promise.resolve(hit.data);

  const run = async () => {
    const wait = radioRc.lastRequestAt + 350 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    radioRc.lastRequestAt = Date.now();
    let r = null;

    // 1. Try primary endpoint (proxy on Render or same origin)
    try {
      r = await fetchWithTimeout(primaryUrl, { cache: 'no-store' }, 6500);
      if (!r.ok && (r.status === 404 || r.status >= 500)) {
        r = null;
      }
    } catch (_) {
      r = null;
    }

    // 2. Direct fallback to OpenF1 if primary proxy is down, sleeping, or on preview host
    if (!r) {
      try {
        r = await fetchWithTimeout(directUrl, { cache: 'no-store' }, 6500);
      } catch (_) {
        if (hit && hit.data) return hit.data;
        const e = new Error('Telemetry standby · waiting for session transmission');
        e.code = 'net';
        throw e;
      }
    }

    if (r.status === 401) {
      const e = new Error('Session live · polling telemetry feeds (every 10s)');
      e.code = 'live';
      throw e;
    }

    if (r.status === 503 || r.status === 429) {
      let code = r.status === 429 ? 'rate' : 'upstream';
      try {
        const d = await r.json();
        if (d && d.code) code = d.code;
      } catch (_) {}
      const e = new Error(code === 'live'
        ? 'Session live · polling telemetry feeds (every 10s)'
        : code === 'rate' ? 'Data feed busy · retrying' : 'Telemetry standby');
      e.code = code === 'rate' ? 'rate' : code === 'live' ? 'live' : 'up';
      throw e;
    }

    if (!r.ok) {
      if (hit && hit.data) return hit.data;
      const e = new Error(`Data server error ${r.status}`);
      e.code = 'up';
      throw e;
    }

    return r.json();
  };

  const promise = radioRc.chain.then(run, run).then((data) => {
    radioRc.cache.set(cacheKey, { data, at: Date.now() });
    return data;
  }).catch((err) => {
    radioRc.cache.delete(cacheKey);
    throw err;
  });
  radioRc.chain = promise.catch(() => {});
  radioRc.cache.set(cacheKey, { promise, at: Date.now() });
  return promise;
}

function radioRcSetStatus(text, cls) {
  if (!radioRcStatusEl) return;
  radioRcStatusEl.textContent = text;
  radioRcStatusEl.className = `radio-rc-status mono${cls ? ' ' + cls : ''}`;
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
    // Upstream unreachable or pre-season: synthesize from embedded official 2026 calendar
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

  const prefs = radioRcPrefs();
  const live = radioRc.sessions.find(radioRcIsLiveWindow);
  const latest = radioRc.sessions.at(-1);
  let target = live || latest;
  if (!live && prefs.sessionKey) {
    const remembered = radioRc.sessions.find((s) => s.session_key === prefs.sessionKey);
    if (remembered && remembered.meeting_key === latest.meeting_key) target = remembered;
  }
  if (radioRcEventSel) {
    radioRcEventSel.replaceChildren(...radioRc.meetings.map((m) => {
      const o = document.createElement('option');
      o.value = m.meeting_key;
      o.textContent = radioRcMeetingLabel(m);
      return o;
    }));
    radioRcEventSel.value = String(target.meeting_key);
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
  const pick = list.find((s) => s.session_key === preferKey) || list.at(-1);
  radioRcSessionSel.value = String(pick.session_key);
  radioRcEventSel._syncCustom?.();
  radioRcSessionSel._syncCustom?.();
  radioRcQueueSelect(pick.session_key);
}

function radioRcQueueSelect(sessionKey) {
  clearTimeout(radioRc.switchTimer);
  radioRc.switchTimer = setTimeout(() => radioRcSelectSession(sessionKey), 250);
}

async function radioRcSelectSession(sessionKey, { retry = false } = {}) {
  const session = radioRc.sessions.find((s) => s.session_key === sessionKey);
  if (!session) return;
  const token = ++radioRc.loadToken;
  clearTimeout(radioRc.refreshTimer);
  clearTimeout(radioRc.retryTimer);
  radioRc.sessionKey = sessionKey;
  radioRcSavePrefs({ sessionKey, meetingKey: session.meeting_key });
  radioRcStopAudio();

  if (radioRcRadioList) radioRcRadioList.innerHTML = '<li class="radio-rc-empty">Loading team radio…</li>';
  if (radioRcRcList) radioRcRcList.innerHTML = '<li class="radio-rc-empty">Loading race control…</li>';
  const rCount = $("radioRcRadioCount");
  const rcCount = $("radioRcRcCount");
  if (rCount) rCount.textContent = '';
  if (rcCount) rcCount.textContent = '';

  const live = radioRcIsLiveWindow(session);
  const ttl = live ? 8e3 : 6 * 3600e3;
  const label = `${session.country_name} · ${session.session_name}`;
  radioRcSetStatus(live ? `${label} · in progress` : label, live ? 'live' : '');
  let nextRefresh = 0;

  try {
    const drivers = await openf1('drivers', { session_key: sessionKey }, 6 * 3600e3);
    const radio = await openf1('team_radio', { session_key: sessionKey }, ttl);
    const rc = await openf1('race_control', { session_key: sessionKey }, ttl);
    if (token !== radioRc.loadToken) return;

    radioRc.drivers = new Map(drivers.map((d) => [d.driver_number, d]));
    radioRc.radio = radio.map((r) => ({ ...r, ts: Date.parse(r.date) })).filter((r) => r.recording_url).sort((a, b) => b.ts - a.ts);
    radioRc.rc = rc.map((r) => ({ ...r, ts: Date.parse(r.date) })).sort((a, b) => b.ts - a.ts);

    radioRcRenderRadio();
    radioRcRenderRc();

    if (live && !radio.length && !rc.length) {
      radioRcSetStatus('Session live · polling telemetry feeds (every 10s)', 'live');
      if (radioRcRadioList) radioRcRadioList.innerHTML = '<li class="radio-rc-empty">Session in progress. Team radio clips will appear here as soon as they are broadcast.</li>';
      if (radioRcRcList) radioRcRcList.innerHTML = '<li class="radio-rc-empty">Monitoring race control flags and steward messages…</li>';
      nextRefresh = 10e3;
    } else if (live) {
      nextRefresh = 8e3;
    }
  } catch (err) {
    if (token !== radioRc.loadToken) return;
    if (err.code === 'live') {
      radioRcSetStatus('Session in progress · polling telemetry feeds (every 10s)', 'live');
      if (radioRcRadioList) radioRcRadioList.innerHTML = '<li class="radio-rc-empty">Session in progress. Team radio clips will appear as soon as broadcast audio publishes.</li>';
      if (radioRcRcList) radioRcRcList.innerHTML = '<li class="radio-rc-empty">Monitoring race control messages…</li>';
      nextRefresh = 10e3;
    } else if (err.code === 'rate' && !retry) {
      radioRcSetStatus('Data feed busy · retrying in 5 s', 'warn');
      if (radioRcRadioList) radioRcRadioList.innerHTML = '<li class="radio-rc-empty">Feed is busy right now - retrying automatically…</li>';
      if (radioRcRcList) radioRcRcList.innerHTML = '<li class="radio-rc-empty"></li>';
      radioRc.retryTimer = setTimeout(() => {
        if (radioRc.open && radioRc.sessionKey === sessionKey) radioRcSelectSession(sessionKey, { retry: true });
      }, 5e3);
    } else {
      const msg = err.code === 'net' ? 'Telemetry standby · waiting for session transmission' : escapeHtml(err.message || 'Telemetry standby');
      if (radioRcRadioList) radioRcRadioList.innerHTML = `<li class="radio-rc-empty">${msg}</li>`;
      if (radioRcRcList) radioRcRcList.innerHTML = `<li class="radio-rc-empty">${msg}</li>`;
      radioRcSetStatus(err.code === 'live' ? 'Live session in progress · polling' : err.code === 'rate' ? 'Data feed busy · retrying' : 'Telemetry standby', 'warn');
    }
  }

  if (nextRefresh && radioRc.open) {
    radioRc.refreshTimer = setTimeout(() => {
      if (!document.hidden && radioRc.open && radioRc.sessionKey === sessionKey) radioRcSelectSession(sessionKey);
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

function radioRcRenderRadio() {
  const rCount = $("radioRcRadioCount");
  if (rCount) rCount.textContent = radioRc.radio.length ? `${radioRc.radio.length} clips` : '';
  if (!radioRcRadioList) return;
  if (!radioRc.radio.length) {
    radioRcRadioList.innerHTML = '<li class="radio-rc-empty">No team radio published for this session</li>';
    return;
  }
  radioRcRadioList.innerHTML = radioRc.radio.map((r, i) => {
    const d = radioRcDriver(r.driver_number);
    return `<li><button type="button" class="radio-rc-clip${radioRc.playing === r.recording_url ? ' playing' : ''}" data-idx="${i}" aria-label="Play radio from ${escapeHtml(d.name)} at ${escapeHtml(radioRcTimeFmt.format(r.ts))}">
      <span class="radio-rc-code" style="background:${d.colour}">${escapeHtml(d.code)}</span>
      <span class="radio-rc-who"><b>${escapeHtml(d.name)}</b><span>${escapeHtml(d.team)}</span></span>
      <span class="radio-rc-when">${escapeHtml(radioRcTimeFmt.format(r.ts))}</span>
      <span class="radio-rc-play" aria-hidden="true"></span></button></li>`;
  }).join('');
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

function radioRcRenderRc() {
  const rcCount = $("radioRcRcCount");
  if (rcCount) rcCount.textContent = radioRc.rc.length ? `${radioRc.rc.length} messages` : '';
  if (!radioRcRcList) return;
  if (!radioRc.rc.length) {
    radioRcRcList.innerHTML = '<li class="radio-rc-empty">No race control messages published for this session</li>';
    return;
  }
  radioRcRcList.innerHTML = radioRc.rc.map((r) => {
    const tag = radioRcTag(r);
    return `<li class="radio-rc-msg"><time datetime="${escapeHtml(new Date(r.ts).toISOString())}">${escapeHtml(radioRcTimeFmt.format(r.ts).slice(0, 5))}</time><span class="radio-rc-tag ${escapeHtml(tag)}">${escapeHtml(tag)}</span><span>${escapeHtml(r.message || '')}${r.lap_number ? `<i class="lap">L${escapeHtml(r.lap_number)}</i>` : ''}</span></li>`;
  }).join('');
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
        if (radioRcRadioList) radioRcRadioList.innerHTML = `<li class="radio-rc-empty err">${escapeHtml(err.message || 'OpenF1 unavailable')}</li>`;
        if (radioRcRcList) radioRcRcList.innerHTML = '<li class="radio-rc-empty"></li>';
      });
    } else if (radioRcIsLiveWindow(radioRc.sessions.find((s) => s.session_key === radioRc.sessionKey))) {
      radioRcSelectSession(radioRc.sessionKey);
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
    radioRcSelectSession(radioRc.sessionKey);
  }
}, { passive: true });

if (radioRcPrefs().open) {
  setTimeout(() => radioRcSetOpen(true, { animate: false, save: false }), 900);
}

/* ═══════════════ 20. NEWS FEED VIEW ═══════════════ */
let newsPollInFlight = false;

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

function applyNewsUpdate(payload, online = true) {
  renderNews(newsFromPayload(payload));
  updateNewsStatus(online);
}

async function pollNews(force = false) {
  if (!newsFeedEl || document.hidden || newsPollInFlight || (!force && streamSseConnected)) return;
  newsPollInFlight = true;
  try {
    const response = await fetchWithTimeout(`${PUBLIC_API}/api/news`, {
      cache: 'no-store',
      credentials: 'omit',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    applyNewsUpdate(await response.json(), true);
  } catch (_) {
    updateNewsStatus(false);
    if (!newsFeedEl.querySelector('.news-item')) {
      newsFeedEl.innerHTML = '<div class="state">News feed unavailable right now.</div>';
    }
  } finally {
    newsPollInFlight = false;
  }
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
  dispatchEvent(new CustomEvent('apexthemechange', { detail: { color: t.color } }));
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
    return `<div class="tbadge mark" style="background:${fill};${ring}color:${t.text}">${APEX_MARK}</div>`;
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
      trackEvent('team', t.id);
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
  const context = canvas?.getContext('2d');
  if (!context || reduceMotion) return;

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
  addEventListener('apexthemechange', (event) => {
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
initVisitorCounter();
updateOverridePill(streamOverride);

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

// SSE connection and Polling Fallback
setTimeout(initStreamOverrideSSE, 500);
setTimeout(initStreamPolling, 100);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    updateClocks();
    updateCurrentStreamButton();
  }
}, { passive: true });

/* ═══════════════ 24. EXPERIMENTAL FEATURES & LIVE 2D TRACK MAP ═══════════════ */

// ── Experimental State Handling ──
function applyExperimentalUpdate(payload) {
  const enabled = payload?.enabled !== false;
  const footExp = $('footExperimental');
  if (footExp) {
    footExp.hidden = !enabled;
    footExp.style.display = enabled ? '' : 'none';
  }
  const footGrid = document.querySelector('.foot-grid');
  if (footGrid) {
    footGrid.classList.toggle('no-experimental', !enabled);
  }
}

async function pollExperimentalStatus(force = false) {
  if (document.hidden || (!force && streamSseConnected)) return;
  try {
    const r = await fetchWithTimeout(`${PUBLIC_API}/api/experimental`, { cache: 'no-store', credentials: 'omit' });
    if (r.ok) applyExperimentalUpdate(await r.json());
  } catch (_) {}
}

// ── 2D Track Map Engine ──
const TRACK_CIRCUITS = {
  baku: {
    name: "Baku City Circuit",
    country: "Azerbaijan",
    length: "6.003 km",
    turns: 20,
    drs: 2,
    lapRecord: "1:43.009 (Charles Leclerc, 2019)",
    viewBox: "0 0 1000 600",
    path: "M 200 520 L 780 520 C 840 520 860 510 870 480 L 880 430 C 885 400 870 380 840 375 L 750 365 C 730 365 720 350 725 330 L 740 260 C 745 240 735 220 710 215 L 610 200 C 590 195 580 180 585 160 L 590 120 C 595 90 570 80 540 85 L 430 100 C 400 105 390 125 390 150 L 390 220 C 390 240 375 255 350 255 L 290 255 C 270 255 255 270 255 290 L 255 350 C 255 370 240 385 220 385 L 170 385 C 145 385 130 405 130 430 L 135 480 C 140 510 170 520 200 520 Z",
    pitPath: "M 740 534 L 210 534",
    drsSegments: [{ start: 0.05, end: 0.35, label: "DRS 1" }, { start: 0.72, end: 0.88, label: "DRS 2" }],
    turns: [
      { n: 1, x: 860, y: 505 }, { n: 2, x: 865, y: 395 }, { n: 3, x: 740, y: 355 },
      { n: 4, x: 730, y: 235 }, { n: 5, x: 605, y: 205 }, { n: 6, x: 585, y: 110 },
      { n: 7, x: 425, y: 100 }, { n: 8, x: 390, y: 190 }, { n: 12, x: 285, y: 255 },
      { n: 15, x: 230, y: 385 }, { n: 16, x: 135, y: 440 }, { n: 20, x: 200, y: 520 }
    ],
    startFinish: { x: 500, y: 520 }
  },
  monza: {
    name: "Autodromo Nazionale Monza",
    country: "Italy",
    length: "5.793 km",
    turns: 11,
    drs: 2,
    lapRecord: "1:21.046 (Rubens Barrichello, 2004)",
    viewBox: "0 0 1000 600",
    path: "M 250 490 L 820 490 C 890 490 910 450 890 400 L 830 260 C 810 210 760 180 700 180 L 450 180 C 410 180 390 160 400 130 C 410 100 390 80 350 80 L 220 80 C 170 80 140 110 140 160 L 140 310 C 140 350 160 370 190 375 L 260 385 C 290 390 300 410 290 430 L 260 470 C 245 490 230 490 250 490 Z",
    pitPath: "M 780 504 L 260 504",
    drsSegments: [{ start: 0.05, end: 0.30, label: "DRS 1" }, { start: 0.55, end: 0.72, label: "DRS 2" }],
    turns: [{ n: 1, x: 890, y: 460 }, { n: 4, x: 740, y: 180 }, { n: 6, x: 420, y: 150 }, { n: 7, x: 270, y: 80 }, { n: 8, x: 140, y: 220 }, { n: 11, x: 260, y: 440 }],
    startFinish: { x: 540, y: 490 }
  },
  silverstone: {
    name: "Silverstone Circuit",
    country: "Great Britain",
    length: "5.891 km",
    turns: 18,
    drs: 2,
    lapRecord: "1:27.097 (Max Verstappen, 2020)",
    viewBox: "0 0 1000 600",
    path: "M 520 490 L 720 490 C 760 490 780 470 770 430 L 740 350 C 730 320 750 290 780 280 L 860 260 C 890 250 895 220 870 200 L 780 130 C 750 105 710 110 680 140 L 610 210 C 580 240 540 230 520 190 L 480 120 C 460 85 410 80 370 105 L 230 190 C 190 215 180 260 210 295 L 270 355 C 290 375 290 405 270 425 L 210 480 C 180 510 210 550 250 540 L 380 510 C 420 500 470 490 520 490 Z",
    pitPath: "M 480 504 L 710 504",
    drsSegments: [{ start: 0.18, end: 0.32, label: "WELLINGTON" }, { start: 0.62, end: 0.78, label: "HANGAR" }],
    turns: [{ n: 1, x: 760, y: 460 }, { n: 3, x: 750, y: 310 }, { n: 6, x: 860, y: 180 }, { n: 9, x: 610, y: 190 }, { n: 11, x: 450, y: 90 }, { n: 15, x: 200, y: 320 }, { n: 18, x: 380, y: 510 }],
    startFinish: { x: 620, y: 490 }
  },
  spa: {
    name: "Circuit de Spa-Francorchamps",
    country: "Belgium",
    length: "7.004 km",
    turns: 19,
    drs: 2,
    lapRecord: "1:46.286 (Valtteri Bottas, 2018)",
    viewBox: "0 0 1000 600",
    path: "M 280 470 L 400 470 C 430 470 450 450 450 420 L 450 360 C 450 330 480 300 520 290 L 800 220 C 850 210 870 170 840 130 L 790 80 C 760 45 710 50 670 90 L 590 170 C 560 200 520 200 480 180 L 380 130 C 330 105 270 130 260 185 L 250 250 C 240 290 210 310 170 315 L 110 325 C 75 330 60 370 85 400 L 150 470 C 180 500 230 500 280 470 Z",
    pitPath: "M 230 482 L 390 482",
    drsSegments: [{ start: 0.10, end: 0.34, label: "KEMMEL" }, { start: 0.88, end: 0.98, label: "BLANCHIMONT" }],
    turns: [{ n: 1, x: 445, y: 450 }, { n: 3, x: 460, y: 340 }, { n: 5, x: 840, y: 170 }, { n: 8, x: 740, y: 60 }, { n: 10, x: 570, y: 185 }, { n: 12, x: 340, y: 120 }, { n: 15, x: 230, y: 280 }, { n: 18, x: 100, y: 350 }],
    startFinish: { x: 330, y: 470 }
  },
  monaco: {
    name: "Circuit de Monaco",
    country: "Monaco",
    length: "3.337 km",
    turns: 19,
    drs: 1,
    lapRecord: "1:12.909 (Lewis Hamilton, 2021)",
    viewBox: "0 0 1000 600",
    path: "M 320 510 L 620 510 C 670 510 700 480 700 430 L 700 350 C 700 310 730 280 770 270 L 840 250 C 880 240 890 200 860 170 L 780 100 C 740 60 680 70 640 110 L 580 170 C 550 200 510 200 470 180 L 390 140 C 350 120 300 140 290 185 L 270 270 C 260 310 230 330 190 335 L 140 340 C 100 345 90 390 120 420 L 200 490 C 230 515 270 510 320 510 Z",
    pitPath: "M 280 522 L 600 522",
    drsSegments: [{ start: 0.88, end: 0.12, label: "MAIN STRAIGHT" }],
    turns: [{ n: 1, x: 680, y: 480 }, { n: 3, x: 750, y: 280 }, { n: 5, x: 850, y: 210 }, { n: 6, x: 740, y: 90 }, { n: 8, x: 560, y: 185 }, { n: 10, x: 350, y: 130 }, { n: 12, x: 250, y: 280 }, { n: 15, x: 120, y: 380 }],
    startFinish: { x: 480, y: 510 }
  }
};

const TRACK_DRIVERS = [
  { id: 'norris', code: 'NOR', num: 4, name: 'Lando Norris', team: 'McLaren', color: '#FF8000', text: '#000', progress: 0.98, speed: 318, gear: 8, throttle: 98, brake: 0, drs: true, tyre: 'H', tyreLaps: 14, pit: false, pos: 1, gap: 'LEADER' },
  { id: 'leclerc', code: 'LEC', num: 16, name: 'Charles Leclerc', team: 'Ferrari', color: '#DC0000', text: '#fff', progress: 0.95, speed: 314, gear: 8, throttle: 96, brake: 0, drs: true, tyre: 'H', tyreLaps: 14, pit: false, pos: 2, gap: '+0.842' },
  { id: 'verstappen', code: 'VER', num: 1, name: 'Max Verstappen', team: 'Red Bull', color: '#1E41FF', text: '#fff', progress: 0.91, speed: 319, gear: 8, throttle: 99, brake: 0, drs: true, tyre: 'M', tyreLaps: 10, pit: false, pos: 3, gap: '+1.720' },
  { id: 'russell', code: 'RUS', num: 63, name: 'George Russell', team: 'Mercedes', color: '#00D2BE', text: '#000', progress: 0.88, speed: 312, gear: 8, throttle: 95, brake: 0, drs: true, tyre: 'H', tyreLaps: 15, pit: false, pos: 4, gap: '+3.140' },
  { id: 'hamilton', code: 'HAM', num: 44, name: 'Lewis Hamilton', team: 'Ferrari', color: '#DC0000', text: '#fff', progress: 0.84, speed: 308, gear: 8, throttle: 92, brake: 0, drs: false, tyre: 'M', tyreLaps: 12, pit: false, pos: 5, gap: '+4.890' },
  { id: 'piastri', code: 'PIA', num: 81, name: 'Oscar Piastri', team: 'McLaren', color: '#FF8000', text: '#000', progress: 0.81, speed: 315, gear: 8, throttle: 97, brake: 0, drs: true, tyre: 'H', tyreLaps: 14, pit: false, pos: 6, gap: '+6.120' },
  { id: 'antonelli', code: 'ANT', num: 12, name: 'Kimi Antonelli', team: 'Mercedes', color: '#00D2BE', text: '#000', progress: 0.77, speed: 310, gear: 8, throttle: 94, brake: 0, drs: false, tyre: 'M', tyreLaps: 11, pit: false, pos: 7, gap: '+8.450' },
  { id: 'alonso', code: 'ALO', num: 14, name: 'Fernando Alonso', team: 'Aston Martin', color: '#006F62', text: '#fff', progress: 0.73, speed: 305, gear: 7, throttle: 90, brake: 0, drs: false, tyre: 'H', tyreLaps: 16, pit: false, pos: 8, gap: '+10.210' },
  { id: 'sainz', code: 'SAI', num: 55, name: 'Carlos Sainz', team: 'Williams', color: '#005AFF', text: '#fff', progress: 0.69, speed: 304, gear: 7, throttle: 88, brake: 0, drs: false, tyre: 'M', tyreLaps: 13, pit: false, pos: 9, gap: '+12.560' },
  { id: 'albon', code: 'ALB', num: 23, name: 'Alexander Albon', team: 'Williams', color: '#005AFF', text: '#fff', progress: 0.65, speed: 302, gear: 7, throttle: 86, brake: 0, drs: false, tyre: 'H', tyreLaps: 15, pit: false, pos: 10, gap: '+14.180' },
  { id: 'gasly', code: 'GAS', num: 10, name: 'Pierre Gasly', team: 'Alpine', color: '#FF0080', text: '#fff', progress: 0.61, speed: 298, gear: 7, throttle: 85, brake: 0, drs: false, tyre: 'M', tyreLaps: 9, pit: false, pos: 11, gap: '+16.320' },
  { id: 'hadjar', code: 'HAD', num: 6, name: 'Isack Hadjar', team: 'Red Bull', color: '#1E41FF', text: '#fff', progress: 0.57, speed: 306, gear: 7, throttle: 90, brake: 0, drs: false, tyre: 'H', tyreLaps: 14, pit: false, pos: 12, gap: '+17.900' },
  { id: 'stroll', code: 'STR', num: 18, name: 'Lance Stroll', team: 'Aston Martin', color: '#006F62', text: '#fff', progress: 0.53, speed: 296, gear: 7, throttle: 82, brake: 0, drs: false, tyre: 'H', tyreLaps: 17, pit: false, pos: 13, gap: '+19.450' },
  { id: 'bearman', code: 'BEA', num: 87, name: 'Oliver Bearman', team: 'Haas', color: '#B6BABD', text: '#000', progress: 0.49, speed: 299, gear: 7, throttle: 84, brake: 0, drs: false, tyre: 'S', tyreLaps: 7, pit: false, pos: 14, gap: '+21.120' },
  { id: 'ocon', code: 'OCO', num: 31, name: 'Esteban Ocon', team: 'Haas', color: '#B6BABD', text: '#000', progress: 0.45, speed: 297, gear: 7, throttle: 83, brake: 0, drs: false, tyre: 'M', tyreLaps: 12, pit: false, pos: 15, gap: '+23.050' },
  { id: 'hulkenberg', code: 'HUL', num: 27, name: 'Nico Hülkenberg', team: 'Audi', color: '#E62213', text: '#fff', progress: 0.41, speed: 294, gear: 6, throttle: 80, brake: 0, drs: false, tyre: 'H', tyreLaps: 18, pit: false, pos: 16, gap: '+25.400' },
  { id: 'lawson', code: 'LAW', num: 30, name: 'Liam Lawson', team: 'Racing Bulls', color: '#6692FF', text: '#000', progress: 0.37, speed: 300, gear: 7, throttle: 85, brake: 0, drs: false, tyre: 'M', tyreLaps: 10, pit: false, pos: 17, gap: '+27.180' },
  { id: 'lindblad', code: 'LIN', num: 41, name: 'Arvid Lindblad', team: 'Racing Bulls', color: '#6692FF', text: '#000', progress: 0.33, speed: 295, gear: 6, throttle: 82, brake: 0, drs: false, tyre: 'H', tyreLaps: 15, pit: false, pos: 18, gap: '+29.650' },
  { id: 'colapinto', code: 'COL', num: 43, name: 'Franco Colapinto', team: 'Alpine', color: '#FF0080', text: '#fff', progress: 0.28, speed: 290, gear: 6, throttle: 78, brake: 0, drs: false, tyre: 'S', tyreLaps: 6, pit: false, pos: 19, gap: '+32.400' },
  { id: 'bortoleto', code: 'BOR', num: 5, name: 'Gabriel Bortoleto', team: 'Audi', color: '#E62213', text: '#fff', progress: 0.23, speed: 288, gear: 6, throttle: 76, brake: 0, drs: false, tyre: 'H', tyreLaps: 16, pit: false, pos: 20, gap: '+35.100' },
  { id: 'perez', code: 'PER', num: 11, name: 'Sergio Perez', team: 'Cadillac', color: '#B4A07A', text: '#000', progress: 0.18, speed: 285, gear: 6, throttle: 74, brake: 0, drs: false, tyre: 'M', tyreLaps: 14, pit: false, pos: 21, gap: '+38.500' },
  { id: 'bottas', code: 'BOT', num: 77, name: 'Valtteri Bottas', team: 'Cadillac', color: '#B4A07A', text: '#000', progress: 0.12, speed: 282, gear: 6, throttle: 72, brake: 0, drs: false, tyre: 'H', tyreLaps: 15, pit: false, pos: 22, gap: '+42.100' }
];

let trackInitialized = false;
let currentTrackCircuit = 'baku';
let focusedDriverId = 'norris';
let trackAnimFrame = null;
let lastTrackAnimTime = 0;
let trackSimulationSpeed = 1;
let trackFlagCondition = 'green';
let trackIsPaused = false;
let trackTimingInterval = null;
let trackCurrentLap = 14;
let trackTotalLaps = 51;
let trackLapTimer = 0;

function safePathLength(pathEl) {
  if (typeof pathEl?.getTotalLength === 'function') {
    try {
      const len = pathEl.getTotalLength();
      if (len > 0) return len;
    } catch (_) {}
  }
  return 2400;
}

function safePathPoint(pathEl, length, totalLength) {
  if (typeof pathEl?.getPointAtLength === 'function') {
    try {
      return pathEl.getPointAtLength(length);
    } catch (_) {}
  }
  const ratio = totalLength > 0 ? (length / totalLength) : 0;
  const angle = ratio * Math.PI * 2;
  return {
    x: 500 + Math.cos(angle) * 360,
    y: 300 + Math.sin(angle) * 190
  };
}

function initTrackMap() {
  if (trackInitialized) {
    trackIsPaused = false;
    lastTrackAnimTime = performance.now();
    cancelAnimationFrame(trackAnimFrame);
    trackAnimFrame = requestAnimationFrame(animateTrackLoop);
    return;
  }

  const svg = $('trackSvg');
  if (!svg) return;

  trackInitialized = true;
  setupTrackControls();
  loadCircuit(currentTrackCircuit);
  renderTrackLeaderboard();
  updateFocusedTelemetryCard();

  lastTrackAnimTime = performance.now();
  cancelAnimationFrame(trackAnimFrame);
  trackAnimFrame = requestAnimationFrame(animateTrackLoop);

  // Sync with live timing every 8s
  clearInterval(trackTimingInterval);
  syncLiveTiming();
  trackTimingInterval = setInterval(syncLiveTiming, 8000);
}

function pauseTrackMap() {
  trackIsPaused = true;
  cancelAnimationFrame(trackAnimFrame);
  clearInterval(trackTimingInterval);
}

function setupTrackControls() {
  const sel = $('trackCircuitSelect');
  if (sel) {
    sel.addEventListener('change', (e) => loadCircuit(e.target.value));
  }

  document.querySelectorAll('.flag-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.flag-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      trackFlagCondition = btn.dataset.flag || 'green';
      addIncidentMessage(trackFlagCondition);
    });
  });

  document.querySelectorAll('.speed-btn[data-speed]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.speed-btn[data-speed]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      trackSimulationSpeed = Number(btn.dataset.speed) || 1;
    });
  });

  const pauseBtn = $('trackPauseBtn');
  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      trackIsPaused = !trackIsPaused;
      pauseBtn.textContent = trackIsPaused ? '▶' : '⏸';
      pauseBtn.classList.toggle('active', trackIsPaused);
      if (!trackIsPaused) {
        lastTrackAnimTime = performance.now();
        trackAnimFrame = requestAnimationFrame(animateTrackLoop);
      }
    });
  }

  const clearFocusBtn = $('trackClearFocus');
  if (clearFocusBtn) {
    clearFocusBtn.addEventListener('click', () => setFocusedDriver(null));
  }

  const resetFocusBtn = $('trackResetFocusBtn');
  if (resetFocusBtn) {
    resetFocusBtn.addEventListener('click', () => setFocusedDriver(null));
  }

  const lb = $('trackLeaderboard');
  if (lb) {
    lb.addEventListener('click', (e) => {
      const row = e.target.closest('.tl-row');
      if (row?.dataset.id) setFocusedDriver(row.dataset.id);
    });
  }
}

function loadCircuit(circuitKey) {
  const circ = TRACK_CIRCUITS[circuitKey] || TRACK_CIRCUITS.baku;
  currentTrackCircuit = circuitKey;

  const sel = $('trackCircuitSelect');
  if (sel && sel.value !== circuitKey) {
    sel.value = circuitKey;
    sel._syncCustom?.();
  }

  const lengthChip = $('trackLengthChip');
  if (lengthChip) lengthChip.textContent = circ.length;
  const turnsChip = $('trackTurnsChip');
  if (turnsChip) turnsChip.textContent = `${circ.turns} Turns`;
  const drsChip = $('trackDrsChip');
  if (drsChip) drsChip.textContent = `${circ.drs} DRS Zones`;

  renderCircuitSvg(circ);
}

function renderCircuitSvg(circ) {
  const layers = $('trackLayers');
  const carsLayer = $('trackCarsLayer');
  if (!layers || !carsLayer) return;

  const NS = 'http://www.w3.org/2000/svg';
  layers.innerHTML = '';

  // Outer border glow
  const borderPath = document.createElementNS(NS, 'path');
  borderPath.setAttribute('d', circ.path);
  borderPath.setAttribute('fill', 'none');
  borderPath.setAttribute('stroke', 'rgba(255, 255, 255, 0.08)');
  borderPath.setAttribute('stroke-width', '18');
  borderPath.setAttribute('stroke-linecap', 'round');
  borderPath.setAttribute('stroke-linejoin', 'round');
  layers.appendChild(borderPath);

  // Main asphalt roadbed
  const asphalt = document.createElementNS(NS, 'path');
  asphalt.setAttribute('id', 'mainCircuitPath');
  asphalt.setAttribute('d', circ.path);
  asphalt.setAttribute('fill', 'none');
  asphalt.setAttribute('stroke', '#1c212b');
  asphalt.setAttribute('stroke-width', '12');
  asphalt.setAttribute('stroke-linecap', 'round');
  asphalt.setAttribute('stroke-linejoin', 'round');
  layers.appendChild(asphalt);

  // Pit lane path
  if (circ.pitPath) {
    const pit = document.createElementNS(NS, 'path');
    pit.setAttribute('d', circ.pitPath);
    pit.setAttribute('fill', 'none');
    pit.setAttribute('stroke', 'rgba(59, 130, 246, 0.65)');
    pit.setAttribute('stroke-width', '4');
    pit.setAttribute('stroke-dasharray', '6 4');
    layers.appendChild(pit);
  }

  // Racing line
  const racingLine = document.createElementNS(NS, 'path');
  racingLine.setAttribute('d', circ.path);
  racingLine.setAttribute('fill', 'none');
  racingLine.setAttribute('stroke', 'rgba(255, 255, 255, 0.16)');
  racingLine.setAttribute('stroke-width', '1.5');
  racingLine.setAttribute('stroke-dasharray', '8 6');
  layers.appendChild(racingLine);

  // DRS zones
  const totalLength = safePathLength(asphalt);
  if (circ.drsSegments && totalLength > 0) {
    circ.drsSegments.forEach((seg) => {
      const drsPath = document.createElementNS(NS, 'path');
      drsPath.setAttribute('d', circ.path);
      drsPath.setAttribute('fill', 'none');
      drsPath.setAttribute('stroke', '#00d57e');
      drsPath.setAttribute('stroke-width', '4');
      drsPath.setAttribute('stroke-linecap', 'round');
      const start = seg.start * totalLength;
      const len = (seg.end - seg.start) * totalLength;
      drsPath.setAttribute('stroke-dasharray', `${len} ${totalLength}`);
      drsPath.setAttribute('stroke-dashoffset', `-${start}`);
      drsPath.setAttribute('filter', 'url(#trackGlow)');
      layers.appendChild(drsPath);
    });
  }

  // Start / finish marker
  if (circ.startFinish) {
    const sf = document.createElementNS(NS, 'rect');
    sf.setAttribute('x', String(circ.startFinish.x - 3));
    sf.setAttribute('y', String(circ.startFinish.y - 10));
    sf.setAttribute('width', '6');
    sf.setAttribute('height', '20');
    sf.setAttribute('fill', '#fff');
    sf.setAttribute('rx', '1');
    layers.appendChild(sf);

    const sfLabel = document.createElementNS(NS, 'text');
    sfLabel.setAttribute('x', String(circ.startFinish.x));
    sfLabel.setAttribute('y', String(circ.startFinish.y + 22));
    sfLabel.setAttribute('text-anchor', 'middle');
    sfLabel.setAttribute('fill', 'var(--dim)');
    sfLabel.setAttribute('font-family', 'JetBrains Mono');
    sfLabel.setAttribute('font-size', '9');
    sfLabel.setAttribute('font-weight', '700');
    sfLabel.textContent = 'START / FINISH';
    layers.appendChild(sfLabel);
  }

  // Turn numbers
  if (circ.turns) {
    circ.turns.forEach((t) => {
      const g = document.createElementNS(NS, 'g');
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', String(t.x));
      c.setAttribute('cy', String(t.y));
      c.setAttribute('r', '7');
      c.setAttribute('fill', 'rgba(15, 18, 24, 0.9)');
      c.setAttribute('stroke', 'rgba(255, 255, 255, 0.18)');
      c.setAttribute('stroke-width', '1');

      const txt = document.createElementNS(NS, 'text');
      txt.setAttribute('x', String(t.x));
      txt.setAttribute('y', String(t.y + 3));
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('fill', '#8b93a1');
      txt.setAttribute('font-family', 'JetBrains Mono');
      txt.setAttribute('font-size', '8');
      txt.setAttribute('font-weight', '700');
      txt.textContent = String(t.n);

      g.appendChild(c);
      g.appendChild(txt);
      layers.appendChild(g);
    });
  }

  // Cars layer setup
  carsLayer.innerHTML = '';
  TRACK_DRIVERS.forEach((d) => {
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'car-dot-group');
    g.setAttribute('id', `carDot_${d.id}`);
    g.setAttribute('data-id', d.id);
    g.style.cursor = 'pointer';

    // Outer glow aura
    const glow = document.createElementNS(NS, 'circle');
    glow.setAttribute('r', '11');
    glow.setAttribute('fill', d.color);
    glow.setAttribute('opacity', '0.28');

    // Main team circle
    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('r', '6');
    dot.setAttribute('fill', d.color);
    dot.setAttribute('stroke', '#fff');
    dot.setAttribute('stroke-width', '1.5');

    // Inner center point
    const core = document.createElementNS(NS, 'circle');
    core.setAttribute('r', '2.5');
    core.setAttribute('fill', d.text);

    // Driver label tag
    const lbl = document.createElementNS(NS, 'text');
    lbl.setAttribute('x', '10');
    lbl.setAttribute('y', '3');
    lbl.setAttribute('fill', '#fff');
    lbl.setAttribute('font-family', 'JetBrains Mono');
    lbl.setAttribute('font-size', '8.5');
    lbl.setAttribute('font-weight', '800');
    lbl.setAttribute('filter', 'drop-shadow(0 1px 2px rgba(0,0,0,0.9))');
    lbl.textContent = d.code;

    g.appendChild(glow);
    g.appendChild(dot);
    g.appendChild(core);
    g.appendChild(lbl);

    g.addEventListener('click', (e) => {
      e.stopPropagation();
      setFocusedDriver(d.id);
    });

    carsLayer.appendChild(g);
  });
}

function setFocusedDriver(driverId) {
  focusedDriverId = driverId;
  const pill = $('trackFocusPill');
  const nameEl = $('trackFocusName');
  if (pill && nameEl) {
    if (focusedDriverId) {
      const d = TRACK_DRIVERS.find((x) => x.id === focusedDriverId);
      pill.hidden = false;
      nameEl.textContent = d ? `${d.name} (${d.code} ${d.num})` : '';
      if (d) {
        pill.style.borderColor = d.color;
        pill.style.background = `color-mix(in srgb, ${d.color} 16%, transparent)`;
      }
    } else {
      pill.hidden = true;
    }
  }

  // Update leaderboard selected row
  document.querySelectorAll('.tl-row').forEach((row) => {
    row.classList.toggle('selected', row.dataset.id === focusedDriverId);
  });

  updateFocusedTelemetryCard();
}

function updateFocusedTelemetryCard() {
  const d = TRACK_DRIVERS.find((x) => x.id === (focusedDriverId || 'norris')) || TRACK_DRIVERS[0];
  if (!d) return;

  const posEl = $('dtPos');
  if (posEl) {
    posEl.textContent = `P${d.pos}`;
    posEl.style.color = d.color || 'var(--team)';
  }
  const nameEl = $('dtName');
  if (nameEl) nameEl.textContent = d.name;
  const teamEl = $('dtTeam');
  if (teamEl) teamEl.textContent = `${d.team} Formula 1 Team`;
  const numEl = $('dtNumber');
  if (numEl) numEl.textContent = String(d.num);

  const spdEl = $('dtSpeed');
  if (spdEl) spdEl.innerHTML = `${Math.round(d.speed)} <small>km/h</small>`;
  const spdBar = $('dtSpeedBar');
  if (spdBar) spdBar.style.width = `${Math.min(100, Math.round((d.speed / 360) * 100))}%`;

  const gearEl = $('dtGear');
  if (gearEl) gearEl.textContent = String(d.gear);
  const gearBar = $('dtGearBar');
  if (gearBar) gearBar.style.width = `${Math.round((d.gear / 8) * 100)}%`;

  const thrEl = $('dtThrottle');
  if (thrEl) thrEl.style.width = `${d.throttle}%`;
  const thrVal = $('dtThrottleVal');
  if (thrVal) thrVal.textContent = `${d.throttle}%`;

  const brkEl = $('dtBrake');
  if (brkEl) brkEl.style.width = `${d.brake}%`;
  const brkVal = $('dtBrakeVal');
  if (brkVal) brkVal.textContent = `${d.brake}%`;

  const tyreEl = $('dtTyre');
  if (tyreEl) {
    const tMap = { H: 'HARD', M: 'MEDIUM', S: 'SOFT' };
    tyreEl.textContent = `${tMap[d.tyre] || 'HARD'} (${d.tyreLaps}L)`;
    tyreEl.className = `dm-v tyre-badge ${d.tyre === 'S' ? 'soft' : d.tyre === 'M' ? 'medium' : 'hard'}`;
  }

  const drsEl = $('dtDrs');
  if (drsEl) {
    drsEl.textContent = d.drs ? 'OPEN' : 'CLOSED';
    drsEl.className = `dm-v drs-badge ${d.drs ? 'active' : 'inactive'}`;
  }

  const intEl = $('dtInterval');
  if (intEl) intEl.textContent = d.gap;
}

function renderTrackLeaderboard() {
  const lb = $('trackLeaderboard');
  if (!lb) return;

  const sorted = [...TRACK_DRIVERS].sort((a, b) => a.pos - b.pos);
  lb.innerHTML = sorted.map((d) => `
    <div class="tl-row ${d.id === focusedDriverId ? 'selected' : ''}" data-id="${d.id}" role="button" tabindex="0">
      <span class="tl-pos">${d.pos}</span>
      <span class="tl-stripe" style="background:${d.color}"></span>
      <span class="tl-code">${d.code}</span>
      <span class="tl-gap">${d.gap}</span>
      <span class="tl-tyre ${d.tyre.toLowerCase()}">${d.tyre}</span>
      ${d.pit ? '<span class="tl-pit">PIT</span>' : ''}
    </div>
  `).join('');
}

function animateTrackLoop(time) {
  if (trackIsPaused) return;

  const dt = Math.min((time - lastTrackAnimTime) / 1000, 0.1);
  lastTrackAnimTime = time;

  const asphalt = $('mainCircuitPath');
  const reticleLayer = $('trackReticleLayer');
  if (!asphalt) {
    trackAnimFrame = requestAnimationFrame(animateTrackLoop);
    return;
  }

  const totalLength = safePathLength(asphalt);
  const circ = TRACK_CIRCUITS[currentTrackCircuit] || TRACK_CIRCUITS.baku;

  // Lap time factor: ~90s standard lap
  const baseLapDuration = 88;
  let flagMultiplier = 1;
  if (trackFlagCondition === 'yellow') flagMultiplier = 0.65;
  else if (trackFlagCondition === 'vsc') flagMultiplier = 0.48;
  else if (trackFlagCondition === 'sc') flagMultiplier = 0.42;
  else if (trackFlagCondition === 'red') flagMultiplier = 0.15;

  const progressDelta = (dt * trackSimulationSpeed * flagMultiplier) / baseLapDuration;

  TRACK_DRIVERS.forEach((d, i) => {
    // Stagger slightly by performance index
    const perfFactor = 1 + (22 - d.pos) * 0.003;
    d.progress = (d.progress + progressDelta * perfFactor) % 1;

    // Simulate throttle/brake/gear/speed depending on track section
    const inDrs = circ.drsSegments?.some((s) => d.progress >= s.start && d.progress <= s.end);
    d.drs = Boolean(inDrs && trackFlagCondition === 'green');

    // Turn zones vs Straights
    const isNearTurn = circ.turns?.some((t) => {
      const pt = safePathPoint(asphalt, d.progress * totalLength, totalLength);
      const dx = pt.x - t.x;
      const dy = pt.y - t.y;
      return (dx * dx + dy * dy) < 1600; // within 40px of turn apex
    });

    if (isNearTurn) {
      d.speed = Math.max(95, d.speed - dt * 280);
      d.gear = Math.max(2, Math.min(4, Math.floor(d.speed / 45)));
      d.throttle = Math.floor(15 + Math.random() * 15);
      d.brake = Math.floor(75 + Math.random() * 25);
    } else {
      const maxSpd = d.drs ? 338 : 316;
      d.speed = Math.min(maxSpd, d.speed + dt * 110);
      d.gear = Math.min(8, Math.max(6, Math.floor(d.speed / 40)));
      d.throttle = Math.floor(92 + Math.random() * 8);
      d.brake = 0;
    }

    // Update car SVG dot position
    const carGroup = $(`carDot_${d.id}`);
    if (carGroup) {
      const pt = safePathPoint(asphalt, d.progress * totalLength, totalLength);
      carGroup.setAttribute('transform', `translate(${pt.x.toFixed(1)}, ${pt.y.toFixed(1)})`);
    }
  });

  // Update focused driver's telemetry card and reticle
  const focused = TRACK_DRIVERS.find((x) => x.id === (focusedDriverId || 'norris'));
  if (focused) {
    updateFocusedTelemetryCard();
    if (reticleLayer) {
      const pt = safePathPoint(asphalt, focused.progress * totalLength, totalLength);
      const reticleColor = focused.color || 'var(--team, #e10600)';
      reticleLayer.innerHTML = `
        <g transform="translate(${pt.x.toFixed(1)}, ${pt.y.toFixed(1)})">
          <circle r="18" fill="none" stroke="${reticleColor}" stroke-width="1.5" stroke-dasharray="8 6" opacity="0.85" />
          <path d="M -22 -10 L -22 -22 L -10 -22" fill="none" stroke="${reticleColor}" stroke-width="1.5" />
          <path d="M 22 -10 L 22 -22 L 10 -22" fill="none" stroke="${reticleColor}" stroke-width="1.5" />
          <path d="M -22 10 L -22 22 L -10 22" fill="none" stroke="${reticleColor}" stroke-width="1.5" />
          <path d="M 22 10 L 22 22 L 10 22" fill="none" stroke="${reticleColor}" stroke-width="1.5" />
          <line x1="0" y1="-26" x2="0" y2="-19" stroke="${reticleColor}" stroke-width="1.5" />
          <line x1="0" y1="19" x2="0" y2="26" stroke="${reticleColor}" stroke-width="1.5" />
          <line x1="-26" y1="0" x2="-19" y2="0" stroke="${reticleColor}" stroke-width="1.5" />
          <line x1="19" y1="0" x2="26" y2="0" stroke="${reticleColor}" stroke-width="1.5" />
        </g>
      `;
    }
  }

  // Lap timer and periodic leaderboard update
  trackLapTimer += dt;
  if (trackLapTimer >= 1.2) {
    trackLapTimer = 0;
    // Calculate running gaps
    const sorted = [...TRACK_DRIVERS].sort((a, b) => b.progress - a.progress);
    sorted.forEach((d, idx) => {
      d.pos = idx + 1;
      if (idx === 0) d.gap = 'LEADER';
      else {
        const gapVal = ((sorted[0].progress - d.progress + 1) % 1) * 88;
        d.gap = `+${gapVal.toFixed(3)}s`;
      }
    });
    renderTrackLeaderboard();
  }

  trackAnimFrame = requestAnimationFrame(animateTrackLoop);
}

function addIncidentMessage(flag) {
  const feed = $('tiFeed');
  if (!feed) return;
  const timeStr = new Date().toTimeString().slice(0, 5);
  const msgs = {
    green: { tag: 'green', text: 'TRACK CLEAR — Green flag waved. DRS enabled.' },
    yellow: { tag: 'yellow', text: 'YELLOW FLAG SECTOR 2 — Incident reported, no overtaking.' },
    sc: { tag: 'sc', text: 'SAFETY CAR DEPLOYED — Pack delta enabled, pit lane open.' },
    vsc: { tag: 'sc', text: 'VIRTUAL SAFETY CAR — Reduce speed to prescribed delta.' },
    red: { tag: 'red', text: 'RED FLAG — Session suspended. All cars enter pit lane.' }
  };
  const m = msgs[flag] || msgs.green;
  const div = document.createElement('div');
  div.className = 'ti-item';
  div.innerHTML = `<span class="ti-time">${timeStr}</span><span class="ti-tag ${m.tag}">${flag.toUpperCase()}</span> ${m.text}`;
  feed.prepend(div);
  while (feed.children.length > 5) feed.lastElementChild.remove();
}

async function syncLiveTiming() {
  try {
    const res = await fetchWithTimeout(`${PUBLIC_API}/api/live/timing`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    if (!data) return;

    if (data.currentLap && data.totalLaps) {
      trackCurrentLap = data.currentLap;
      trackTotalLaps = data.totalLaps;
      const lapCounter = $('trackLapCounter');
      if (lapCounter) lapCounter.textContent = `LAP ${trackCurrentLap} / ${trackTotalLaps}`;
    }

    if (data.status && data.status !== 'Off Track') {
      const livePill = $('trackLiveStatus');
      if (livePill) livePill.textContent = `● LIVE F1 TIMING (${data.status.toUpperCase()})`;
    }

    // Match competitors if provided by ESPN
    if (Array.isArray(data.competitors) && data.competitors.length > 0) {
      data.competitors.forEach((c) => {
        const d = TRACK_DRIVERS.find((x) =>
          x.name.toLowerCase().includes((c.shortName || '').toLowerCase()) ||
          (c.name && x.name.toLowerCase().includes(c.name.toLowerCase()))
        );
        if (d && c.position) d.pos = c.position;
      });
      renderTrackLeaderboard();
      updateFocusedTelemetryCard();
    }
  } catch (_) {}
}
