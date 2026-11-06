/* Weekend maths shared by the home and schedule pages. Deliberately free of
   DOM code so it can be unit tested and so both pages agree on what "next"
   means at the same instant. */
import { schedule } from '../data/schedule';

export type RaceEvent = (typeof schedule)[number];
export type Session = RaceEvent['sessions'][number];

/** A session is treated as on air for its scheduled length; the race can run to
 *  two hours with a red flag, so everything gets the same generous window. */
const LIVE_WINDOW_MS = 2.5 * 60 * 60 * 1000;

export type SessionInfo = { event: RaceEvent; session: Session };

export function findNextSession(now: number = Date.now()): SessionInfo | null {
  for (const event of schedule) {
    for (const session of event.sessions) {
      if (session.ts + LIVE_WINDOW_MS > now) return { event, session };
    }
  }
  return null;
}

export function findLiveSession(now: number = Date.now()): SessionInfo | null {
  for (const event of schedule) {
    for (const session of event.sessions) {
      if (now >= session.ts && now < session.ts + LIVE_WINDOW_MS) return { event, session };
    }
  }
  return null;
}

export function findLastSession(now: number = Date.now()): SessionInfo | null {
  let last: SessionInfo | null = null;
  for (const event of schedule) {
    for (const session of event.sessions) {
      if (session.ts <= now) last = { event, session };
    }
  }
  return last;
}

/** The event that owns the horizon: live now, else next, else the last one run. */
export function findFocusEvent(now: number = Date.now()): RaceEvent | null {
  const live = findLiveSession(now);
  if (live) return live.event;
  const next = findNextSession(now);
  if (next) return next.event;
  return findLastSession(now)?.event ?? null;
}

export type SessionPhase = 'done' | 'live' | 'next' | 'upcoming';

export function sessionPhase(session: Session, now: number, nextTs: number | null): SessionPhase {
  if (now >= session.ts && now < session.ts + LIVE_WINDOW_MS) return 'live';
  if (now >= session.ts + LIVE_WINDOW_MS) return 'done';
  return session.ts === nextTs ? 'next' : 'upcoming';
}

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const fullFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const formatTime = (ts: number) => timeFmt.format(ts);
export const formatDay = (ts: number) => dayFmt.format(ts);
export const formatFull = (ts: number) => fullFmt.format(ts);

export function countdownParts(target: number, now: number = Date.now()) {
  const delta = Math.max(0, target - now);
  return {
    done: delta === 0,
    days: Math.floor(delta / 86_400_000),
    hours: Math.floor((delta / 3_600_000) % 24),
    minutes: Math.floor((delta / 60_000) % 60),
    seconds: Math.floor((delta / 1000) % 60),
  };
}

/** Short label used in the header pill and schedule rows. */
export function sessionShortName(name: string): string {
  return name
    .replace(/^Practice (\d)$/, 'FP$1')
    .replace('Sprint Qualifying', 'Sprint Qual')
    .replace('Qualifying', 'Quali');
}
