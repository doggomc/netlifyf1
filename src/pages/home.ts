import { initShell } from '../ui/shell';
/* Every page except the cockpit carries the open-page counter in its header. */
import '../viewer-counter';
import {
  countdownParts, findFocusEvent, findLiveSession, findNextSession,
  formatDay, formatFull, formatTime, sessionPhase, sessionShortName, type SessionInfo,
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

if (focus) {
  /* The whole Grand Prix name in one line, as the cockpit hero always set it. */
  text('heroTitle', focus.name);
  text('heroRound', `Round ${focus.round} of 23`);
  text('heroVenue', `${focus.circuit} · ${focus.locality}, ${focus.country}`);
  const when = live
    ? `${live.session.name} on air now`
    : next
      ? `${next.session.name} · ${formatDay(next.session.ts)} ${formatTime(next.session.ts)}`
      : 'Season complete';
  text('heroNext', when);
  document.title = `${focus.name} — FreeF1`;
}

/* ── Countdown card ─────────────────────────────────────────────────────── */

let countdownTarget: number | null = null;

function paintNextCard(info: SessionInfo | null, liveInfo: SessionInfo | null): void {
  const gp = $('nextGrandPrix');
  const session = $('nextSession');
  const tag = $('nextTag');
  const local = $('nextLocal');

  if (liveInfo) {
    if (gp) gp.textContent = liveInfo.event.name;
    if (session) session.textContent = `${liveInfo.session.name} — on air`;
    if (tag) { tag.textContent = 'Live now'; tag.className = 'tag tag-accent'; }
    if (local) local.textContent = `Started ${formatTime(liveInfo.session.ts)}`;
    countdownTarget = null;
    paintCountdown();
    return;
  }

  if (!info) {
    if (gp) gp.textContent = 'Season complete';
    if (session) session.textContent = 'See you next year';
    if (tag) { tag.textContent = '—'; tag.className = 'tag'; }
    if (local) local.textContent = '';
    countdownTarget = null;
    paintCountdown();
    return;
  }

  if (gp) gp.textContent = info.event.name;
  if (session) session.textContent = sessionShortName(info.session.name);
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
      <span class="name">${sessionShortName(session.name)}</span>
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
    liveText.textContent = next ? sessionShortName(next.session.name) : 'Off air';
  }
}

export { tick };
