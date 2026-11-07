import { initShell } from '../ui/shell';
/* Every page except the cockpit carries the open-page counter in its header. */
import '../viewer-counter';
import {
  countdownParts, findFocusEvent, findLiveSession, findNextSession,
  formatDay, formatFull, formatTime, sessionPhase, type SessionInfo,
} from '../services/weekend';

initShell();

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;
const text = (id: string, value: string) => {
  const el = $ (id);
  if (el) el.textContent = value;
};

/* ── Hero: which Grand Prix is in focus right now ───────────────────────── */

const focus = findFocusEvent();
const live = findLiveSession();
const next = findNextSession();

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string));

function wrapWords(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .map((word) => {
      /* Allow a clean break right after an explicit hyphen (e.g. "Barcelona-Catalunya") while keeping every word intact. */
      const parts = word.split(/(?<=-)/);
      return parts.map((p) => `<span class="gp-word">${escapeHtml(p)}</span>`).join('');
    })
    .join(' ');
}

/* The cockpit hero set the name in two tones: the location solid, "Grand Prix"
   outlined in the team colour. Same split here, so the two pages agree. */
function heroName(name: string): string {
  const index = name.lastIndexOf(' Grand Prix');
  if (index <= 0) return wrapWords(name);
  /* The location sits in its own span so a phone can put "Grand Prix" on the next
     line; on a wide screen the space between them keeps them on one line. */
  return `<span class="gp-place">${wrapWords(name.slice(0, index))}</span> <em>Grand Prix</em>`;
}

/* Maximize the mobile hero heading to fill the container width without ever splitting a word. */
function fitMobileHeroTitle(): void {
  const title = $('heroTitle');
  const copy = title?.parentElement;
  if (!title || !copy) return;
  if (window.innerWidth > 700) {
    title.style.fontSize = '';
    title.classList.remove('is-nowrap-place');
    return;
  }
  const avail = copy.clientWidth - 8;
  if (avail <= 0) return;
  const placeEl = title.querySelector<HTMLElement>('.gp-place');
  const emEl = title.querySelector<HTMLElement>('em');
  const words = [...title.querySelectorAll<HTMLElement>('.gp-word')];
  const REF = 48;

  title.classList.add('is-measuring');
  title.style.fontSize = `${REF}px`;
  const emW = emEl ? emEl.getBoundingClientRect().width : 0;
  const placeSingleW = placeEl ? placeEl.getBoundingClientRect().width : 0;
  const maxWordW = words.reduce((m, w) => Math.max(m, w.getBoundingClientRect().width), 0);

  const singleLinePlace = words.length <= 1 || placeSingleW <= Math.max(emW * 1.12, 1);
  const targetW = Math.max(emW, singleLinePlace ? placeSingleW : maxWordW, 1);
  const fitted = Math.max(32, Math.min(92, Math.floor((avail / targetW) * REF)));

  title.classList.remove('is-measuring');
  title.classList.toggle('is-nowrap-place', singleLinePlace);
  title.style.fontSize = `${fitted}px`;
}

if (focus) {
  const title = $('heroTitle');
  if (title) title.innerHTML = heroName(focus.name);
  text('heroRound', `Round ${focus.round} of 23`);
  text('heroVenue', `${focus.circuit} · ${focus.locality}, ${focus.country}`);
  document.title = `${focus.name} — FreeF1`;
  fitMobileHeroTitle();
  void document.fonts?.ready?.then(() => fitMobileHeroTitle());
  let fitRaf = 0;
  window.addEventListener('resize', () => {
    if (fitRaf) cancelAnimationFrame(fitRaf);
    fitRaf = requestAnimationFrame(() => {
      fitRaf = 0;
      fitMobileHeroTitle();
    });
  }, { passive: true });
}

/* ── Countdown card ─────────────────────────────────────────────────────── */

let countdownTarget: number | null = null;

function paintNextCard(info: SessionInfo | null, liveInfo: SessionInfo | null): void {
  const gp = $('nextGrandPrix');
  const name = $('nextSessionName');
  const session = $('nextSession');
  const tag = $('nextTag');
  const local = $('nextLocal');

  /* The card reads top to bottom as name, then session: the name is the loud line,
     the session a quiet one directly beneath it. */
  const set = (eventName: string, gpName: string, sessionName: string, live: boolean) => {
    if (name) name.textContent = eventName;
    if (gp) gp.textContent = gpName;
    if (session) {
      session.textContent = sessionName;
      session.classList.toggle('is-live', live);
    }
  };

  if (liveInfo) {
    set(liveInfo.event.name, liveInfo.event.name, `${liveInfo.session.name} — on air`, true);
    if (tag) { tag.textContent = 'Live now'; tag.className = 'tag tag-accent'; }
    if (local) local.textContent = `Started ${formatTime(liveInfo.session.ts)}`;
    countdownTarget = null;
    paintCountdown();
    return;
  }

  if (!info) {
    set('Season complete', 'Season complete', 'See you next year', false);
    if (tag) { tag.textContent = '—'; tag.className = 'tag'; }
    if (local) local.textContent = '';
    countdownTarget = null;
    paintCountdown();
    return;
  }

  set(info.event.name, info.event.name, info.session.name, false);
  if (tag) {
    tag.textContent = `Round ${info.event.round}`;
    tag.className = 'tag';
  }
  if (local) local.textContent = formatFull(info.session.ts);
  countdownTarget = info.session.ts;
  paintCountdown();
}

function paintCountdown(): void {
  const root = $('countdown');
  if (!root) return;
  const parts = countdownTarget === null
    ? { days: 0, hours: 0, minutes: 0, seconds: 0, done: true }
    : countdownParts(countdownTarget);
  const set = (unit: string, value: number | null) => {
    const el = root.querySelector<HTMLElement>(`[data-unit="${unit}"]`);
    if (!el) return;
    const label = value === null ? '--' : String(value).padStart(2, '0');
    if (el.textContent !== label) el.textContent = label;
  };
  set('d', countdownTarget === null ? null : parts.days);
  set('h', countdownTarget === null ? null : parts.hours);
  set('m', countdownTarget === null ? null : parts.minutes);
  set('s', countdownTarget === null ? null : parts.seconds);
}

paintNextCard(next, live);
const tick = setInterval(paintCountdown, 1000);
/* Stop ticking in a background tab; catch up the moment it is visible again. */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  paintCountdown();
});

/* ── This weekend's sessions ────────────────────────────────────────────── */

function paintSessionStrip(): void {
  const strip = $('sessionStrip');
  if (!strip) return;
  const event = focus;
  if (!event) { strip.innerHTML = ''; return; }

  const now = Date.now();
  const nextInfo = findNextSession(now);
  const nextTs = nextInfo?.session.ts ?? null;

  strip.innerHTML = event.sessions.map((session) => {
    const phase = sessionPhase(session, now, nextTs);
    const classes = ['session-tile', phase === 'next' ? 'next' : '', phase === 'live' ? 'live' : '', phase === 'done' ? 'done' : '']
      .filter(Boolean).join(' ');
    return `<div class="${classes}">
      <span class="name">${escapeHtml(session.name)}</span>
      <span class="when">${phase === 'live' ? 'On air' : formatTime(session.ts)}</span>
      <span class="day">${formatDay(session.ts)}</span>
    </div>`;
  }).join('');
}

paintSessionStrip();

/* Minute-level refresh: the strip changes on its own when a session ends. */
setInterval(() => {
  if (document.hidden) return;
  paintSessionStrip();
  paintNextCard(findNextSession(), findLiveSession());
}, 60_000);

/* ── Live pill ──────────────────────────────────────────────────────────── */

const badge = document.getElementById('liveBadge');
const liveText = document.getElementById('liveText');
if (badge && liveText) {
  if (live) {
    badge.classList.add('is-on');
    liveText.textContent = 'Live';
  } else {
    liveText.textContent = next ? next.session.name : 'Off air';
  }
}

export { tick };
