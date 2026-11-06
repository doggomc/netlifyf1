import { initShell } from '../ui/shell';
import {
  findLiveSession, findNextSession, formatDay, formatTime,
  sessionShortName, type Session,
} from '../services/weekend';
import { schedule } from '../data/schedule';

initShell();

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;

/* A round is "next" when it owns the next session; "done" once its race is over. */
function roundState(event: (typeof schedule)[number], now: number, nextRound: number | null, liveRound: number | null) {
  if (liveRound === event.round) return 'live';
  if (nextRound === event.round) return 'next';
  const race = event.sessions.find((session) => session.slug === 'race');
  if (race && now >= race.ts + 3 * 60 * 60 * 1000) return 'done';
  return 'upcoming';
}

function render(): void {
  const list = $('roundList');
  const status = $('scheduleStatus');
  if (!list) return;

  const now = Date.now();
  const next = findNextSession(now);
  const live = findLiveSession(now);
  const nextRound = next?.event.round ?? null;
  const liveRound = live?.event.round ?? null;

  list.innerHTML = schedule.map((event) => {
    const state = roundState(event, now, nextRound, liveRound);
    const race = event.sessions.find((session) => session.slug === 'race') ?? event.sessions[event.sessions.length - 1];
    const classes = ['round', state === 'next' ? 'is-next' : '', state === 'done' ? 'is-done' : '']
      .filter(Boolean).join(' ');
    const label = state === 'live'
      ? 'On air'
      : state === 'next'
        ? `Next · ${sessionShortName(next?.session.name ?? 'Session')}`
        : formatDay(race.ts);

    return `<article class="${classes}" data-round="${event.round}">
      <span class="r-num">${String(event.round).padStart(2, '0')}</span>
      <div>
        <div class="r-name">${event.name}${event.sprint ? '<span class="sprint-tag">Sprint</span>' : ''}</div>
        <div class="r-venue">${event.circuit} · ${event.locality}, ${event.country}</div>
      </div>
      <div class="r-when">
        <b>${state === 'live' ? 'On air' : formatTime(race?.ts ?? event.sessions[0].ts)}</b>
        ${label}
      </div>
    </article>`;
  }).join('');

  if (status) {
    status.textContent = live
      ? `Round ${live.event.round} on air`
      : next
        ? `Round ${next.event.round} up next`
        : 'Season complete';
  }
}

render();

/* Re-render when a session boundary passes, and whenever the tab wakes up. */
let timer: number | undefined;
function scheduleRefresh(): void {
  clearTimeout(timer);
  const upcoming = schedule
    .flatMap((event) => event.sessions.map((session: Session) => session.ts))
    .filter((ts) => ts > Date.now())
    .sort((a, b) => a - b)[0];
  if (!upcoming) return;
  /* Never schedule further ahead than a minute at a time so a laptop waking from
     sleep does not render hours-old "on air" state. */
  timer = setTimeout(() => { render(); scheduleRefresh(); }, Math.min(Math.max(upcoming - Date.now(), 1000), 60_000)) as unknown as number;
}
scheduleRefresh();

document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  render();
  scheduleRefresh();
});
