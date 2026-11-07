import { initShell } from '../ui/shell';
/* Every page except the cockpit carries the open-page counter in its header. */
import '../viewer-counter';
import { JOLPI, SITE_SEASON } from '../config';
import { flagHtml } from '../data/flags';
import { schedule } from '../data/schedule';
import {
  findLiveSession, findNextSession, formatDay, formatTime, sessionPhase,
  type RaceEvent,
} from '../services/weekend';
import {
  displayRoundName, esc, formatScheduleClock, formatSessionLong, formatWeekendRange,
  roundFlagCode, viewerTimeZoneLabel, winnerDriverHref, winnerTeamColor,
  winnerTeamHref, winnerTeamName,
} from './schedule-format';

initShell();

type WinnerInfo = {
  familyName: string;
  fullName: string;
  driverHref: string;
  team: string;
  teamHref: string;
  color: string;
};

type RawWinners = {
  MRData?: {
    RaceTable?: {
      Races?: Array<{
        round?: string;
        Results?: Array<{
          Driver?: { driverId: string; givenName: string; familyName: string };
          Constructor?: { name: string; constructorId: string };
        }>;
      }>;
    };
  };
};

const TROPHY_SVG = '<svg class="sc-trophy" width="16" height="16" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M232,60H212V48a12,12,0,0,0-12-12H56A12,12,0,0,0,44,48V60H24A20,20,0,0,0,4,80V96a44.05,44.05,0,0,0,44,44h.77A84.18,84.18,0,0,0,116,195.15V212H96a12,12,0,0,0,0,24h64a12,12,0,0,0,0-24H140V195.11c30.94-4.51,56.53-26.2,67-55.11h1a44.05,44.05,0,0,0,44-44V80A20,20,0,0,0,232,60ZM28,96V84H44v28c0,1.21,0,2.41.09,3.61A20,20,0,0,1,28,96Zm160,15.1c0,33.33-26.71,60.65-59.54,60.9A60,60,0,0,1,68,112V60H188ZM228,96a20,20,0,0,1-16.12,19.62c.08-1.5.12-3,.12-4.52V84h16Z"/></svg>';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;
const set = (id: string, text: string) => { const node = $(id); if (node) node.textContent = text; };

const winners = new Map<number, WinnerInfo>();
const openRounds = new Set<number>();

set('scTzName', viewerTimeZoneLabel());

/* Calendar subscription dropdown: button toggle, outside click, Escape. */
const calBtn = $<HTMLButtonElement>('scCalBtn');
const calPop = $('scCalPop');
function closeCalMenu(): void {
  if (!calBtn || !calPop || calPop.hidden) return;
  calPop.hidden = true;
  calBtn.setAttribute('aria-expanded', 'false');
}
calBtn?.addEventListener('click', (event) => {
  event.stopPropagation();
  if (!calPop) return;
  const open = calPop.hidden;
  calPop.hidden = !open;
  calBtn.setAttribute('aria-expanded', String(open));
});
calPop?.addEventListener('click', () => closeCalMenu());
document.addEventListener('click', (event) => {
  if (!calPop || calPop.hidden) return;
  const target = event.target as Node | null;
  if (target && (calPop.contains(target) || calBtn?.contains(target))) return;
  closeCalMenu();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeCalMenu();
});

function roundState(event: RaceEvent, now: number, nextRound: number | null, liveRound: number | null): 'live' | 'next' | 'done' | 'upcoming' {
  if (liveRound === event.round) return 'live';
  if (nextRound === event.round) return 'next';
  const race = event.sessions.find((session) => session.slug === 'race');
  if (race && now >= race.ts + 2.5 * 60 * 60 * 1000) return 'done';
  return 'upcoming';
}

function statusBadge(event: RaceEvent, state: 'live' | 'next' | 'done' | 'upcoming', now: number): string {
  if (state === 'live') {
    return '<span class="sc-badge-live"><span class="sc-live-dot" aria-hidden="true"></span>LIVE NOW</span>';
  }
  if (state === 'next') {
    const fp1 = event.sessions[0]?.ts ?? 0;
    const label = now >= fp1 - 4 * 86_400_000 ? 'THIS WEEKEND' : 'NEXT ROUND';
    return `<span class="sc-badge-live"><span class="sc-live-dot" aria-hidden="true"></span>${label}</span>`;
  }
  const winner = winners.get(event.round);
  if (winner) {
    return `<span class="sc-winner"><span class="team-bar sc-wbar" style="--team:${esc(winner.color)}"></span><span class="sc-wname">${esc(winner.familyName)}</span>${TROPHY_SVG}</span>`;
  }
  return `<span class="sc-kind">${state === 'done' ? 'Completed' : 'Grand Prix'}</span>`;
}

function renderDrawer(
  event: RaceEvent,
  state: 'live' | 'next' | 'done' | 'upcoming',
  now: number,
  nextTs: number | null,
): string {
  const winner = winners.get(event.round);
  const isCurrent = state === 'live' || state === 'next';
  const rows = event.sessions.map((session) => {
    const phase = sessionPhase(session, now, nextTs);
    const pill = phase === 'live'
      ? '<span class="sc-sess-pill is-live">Live</span>'
      : phase === 'next'
        ? '<span class="sc-sess-pill is-next">Up next</span>'
        : phase === 'done'
          ? '<span class="sc-sess-pill is-done">Done</span>'
          : '';
    return `<li class="sc-sess-row ${phase === 'live' || phase === 'next' ? 'is-active' : ''}">
      <span class="sc-sess-name">${esc(session.name)}${pill}</span>
      <span class="sc-sess-time">${esc(formatDay(session.ts))} · <b>${esc(formatTime(session.ts))}</b></span>
    </li>`;
  }).join('');

  const winnerLine = winner
    ? `<p class="sc-drawer-winner">Race winner: <a href="${esc(winner.driverHref)}">${esc(winner.fullName)}</a> · <a href="${esc(winner.teamHref)}">${esc(winner.team)}</a></p>`
    : '';
  const actions = isCurrent
    ? `<div class="sc-drawer-links">
        <a class="sc-drawer-link is-primary" href="/cockpit.html">Watch in cockpit</a>
        <a class="sc-drawer-link" href="/live-timing.html">Live timing</a>
      </div>`
    : '';
  const foot = winnerLine || actions
    ? `<div class="sc-drawer-foot">${winnerLine}${actions}</div>`
    : '';

  return `<div class="sc-drawer-inner">
    <ul class="sc-sess-list">${rows}</ul>
    ${foot}
  </div>`;
}

let activeClockTarget: number | null = null;
let activeClockLive = false;

function paintHeroNext(now: number = Date.now()): void {
  const live = findLiveSession(now);
  const next = findNextSession(now);
  if (live) {
    activeClockLive = true;
    activeClockTarget = live.session.ts;
    set('scNextLabel', 'Live now');
    set('scNextTitle', live.session.name);
    set('scNextClock', 'Live');
    set('scNextWhen', `${displayRoundName(live.event)} · Started ${formatTime(live.session.ts)}`);
    return;
  }
  activeClockLive = false;
  if (next) {
    activeClockTarget = next.session.ts;
    set('scNextLabel', 'Next session');
    set('scNextTitle', next.session.name);
    set('scNextClock', formatScheduleClock(next.session.ts, now));
    set('scNextWhen', `${displayRoundName(next.event).replace(' Grand Prix', ' GP')} · ${formatSessionLong(next.session.ts)}`);
    return;
  }
  activeClockTarget = null;
  set('scNextLabel', `${SITE_SEASON} season`);
  set('scNextTitle', 'Season complete');
  set('scNextClock', `${schedule.length}/${schedule.length}`);
  set('scNextWhen', 'Every Grand Prix of the season has finished.');
}

function render(): void {
  const list = $('roundList');
  const now = Date.now();
  paintHeroNext(now);
  if (!list) return;

  const live = findLiveSession(now);
  const next = findNextSession(now);
  const nextRound = next?.event.round ?? null;
  const liveRound = live?.event.round ?? null;
  const nextTs = next?.session.ts ?? null;

  list.innerHTML = schedule.map((event) => {
    const state = roundState(event, now, nextRound, liveRound);
    const first = event.sessions[0];
    const last = event.sessions[event.sessions.length - 1];
    const dates = formatWeekendRange(first.ts, last.ts);
    const title = displayRoundName(event);
    const badge = statusBadge(event, state, now);
    const isOpen = openRounds.has(event.round);
    const cardCls = [
      'card card-hover sc-card',
      state === 'live' || state === 'next' ? 'is-next' : '',
      state === 'done' ? 'is-done' : '',
      isOpen ? 'is-open' : '',
    ].filter(Boolean).join(' ');

    return `<li class="sc-item" id="round-${event.round}">
      <article class="${cardCls}" data-round="${event.round}">
        <button type="button" class="sc-row" data-round-toggle="${event.round}" aria-expanded="${isOpen}" aria-controls="sc-drawer-${event.round}">
          <div class="sc-rnd">
            <span class="sc-rnd-label">ROUND</span>
            <span class="sc-rnd-num num">${event.round}</span>
          </div>
          <div class="sc-thumb">
            <img src="/assets/circuits/${event.round}.webp" alt="" width="144" height="81" loading="${event.round <= 6 ? 'eager' : 'lazy'}" decoding="async">
          </div>
          <div class="sc-main">
            <div class="sc-title-row">
              ${flagHtml(roundFlagCode(event.round), 'flag sc-flag')}
              <h3 class="sc-gp-name">${esc(title)}</h3>
              ${event.sprint ? '<span class="sc-lozenge sc-lozenge-sprint">Sprint</span>' : ''}
            </div>
            <p class="sc-venue"><span class="sc-mobile-rnd">Round ${event.round} · </span>${esc(event.circuit)} · ${esc(event.locality)}</p>
            <div class="sc-mobile-meta">
              <span class="sc-dates">${esc(dates)}</span>
              ${badge}
            </div>
          </div>
          <div class="sc-aside">
            <p class="sc-dates">${esc(dates)}</p>
            <div class="sc-status">${badge}</div>
          </div>
        </button>
        <div class="sc-drawer" id="sc-drawer-${event.round}" ${isOpen ? '' : 'hidden'}>
          ${renderDrawer(event, state, now, nextTs)}
        </div>
      </article>
    </li>`;
  }).join('');
}

$('roundList')?.addEventListener('click', (event) => {
  const target = event.target as HTMLElement | null;
  if (!target || target.closest('a')) return;
  const btn = target.closest<HTMLButtonElement>('[data-round-toggle]');
  if (!btn) return;
  const round = Number(btn.dataset.roundToggle);
  if (!Number.isFinite(round)) return;
  const drawer = $(`sc-drawer-${round}`);
  const card = btn.closest('.sc-card');
  const nextOpen = !openRounds.has(round);
  if (nextOpen) openRounds.add(round); else openRounds.delete(round);
  btn.setAttribute('aria-expanded', String(nextOpen));
  if (drawer) drawer.hidden = !nextOpen;
  card?.classList.toggle('is-open', nextOpen);
});

const hashMatch = location.hash.match(/^#round-(\d+)$/);
if (hashMatch) {
  const round = Number(hashMatch[1]);
  if (round >= 1 && round <= schedule.length) openRounds.add(round);
}

render();

/* Fetch completed Grand Prix winners in one request so finished cards show the
   team bar, winner surname and amber trophy without blocking initial paint. */
fetch(`${JOLPI}/${SITE_SEASON}/results/1.json?limit=30`, { headers: { accept: 'application/json' } })
  .then((res) => (res.ok ? res.json() as Promise<RawWinners> : Promise.reject(new Error(`HTTP ${res.status}`))))
  .then((data) => {
    const races = data?.MRData?.RaceTable?.Races ?? [];
    for (const race of races) {
      const round = Number(race.round);
      const top = race.Results?.[0];
      const driver = top?.Driver;
      if (!Number.isFinite(round) || !driver) continue;
      const rawTeam = top?.Constructor?.name ?? '';
      winners.set(round, {
        familyName: driver.familyName,
        fullName: `${driver.givenName} ${driver.familyName}`,
        driverHref: winnerDriverHref(driver.givenName, driver.familyName),
        team: winnerTeamName(rawTeam),
        teamHref: winnerTeamHref(rawTeam),
        color: winnerTeamColor(rawTeam),
      });
    }
    if (winners.size > 0) render();
  })
  .catch(() => { /* Static schedule remains complete if Jolpica is unreachable. */ });

/* Tick the hero countdown once per second while visible; re-render if a session
   crosses from upcoming to live or from live to done. */
let tickTimer: number | undefined;
function startTicker(): void {
  clearInterval(tickTimer);
  tickTimer = window.setInterval(() => {
    if (document.hidden) return;
    const now = Date.now();
    if (activeClockTarget !== null && !activeClockLive && now >= activeClockTarget) {
      render();
      return;
    }
    if (activeClockLive && activeClockTarget !== null && now >= activeClockTarget + 2.5 * 60 * 60 * 1000) {
      render();
      return;
    }
    if (!activeClockLive && activeClockTarget !== null) {
      set('scNextClock', formatScheduleClock(activeClockTarget, now));
    }
  }, 1000);
}
startTicker();

document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  render();
});
