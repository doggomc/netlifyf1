/* Pure formatting helpers for /schedule, kept free of DOM access so unit tests
   can verify date ranges, countdown clocks and round naming deterministically,
   and kept independent of driver-core so neither /drivers nor /schedule pulls
   championship-table or theme-catalogue code it does not use. */

import { slugify } from '../data/slugs';

export const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string));

const TEAM_COLOR: Record<string, string> = {
  McLaren: '#FF8000',
  Ferrari: '#DC0000',
  'Red Bull': '#1E41FF',
  Mercedes: '#00D2BE',
  Williams: '#005AFF',
  'Aston Martin': '#006F62',
  'Alpine F1 Team': '#FF0080',
  Alpine: '#FF0080',
  'Haas F1 Team': '#B6BABD',
  Haas: '#B6BABD',
  Audi: '#E62213',
  Sauber: '#00E701',
  'RB F1 Team': '#6692FF',
  'Racing Bulls': '#6692FF',
  'Cadillac F1 Team': '#B4A07A',
  Cadillac: '#B4A07A',
};

const TEAM_LABEL: Record<string, string> = {
  'Red Bull': 'Red Bull Racing',
  'RB F1 Team': 'Racing Bulls',
  'Alpine F1 Team': 'Alpine',
  'Haas F1 Team': 'Haas',
  'Cadillac F1 Team': 'Cadillac',
};

export const winnerTeamName = (apiName: string) => TEAM_LABEL[apiName] ?? apiName;
export const winnerTeamColor = (apiName?: string) => (apiName && TEAM_COLOR[apiName]) || 'var(--fg-4)';
export const winnerDriverHref = (givenName: string, familyName: string) => `/drivers/${slugify(`${givenName} ${familyName}`)}/`;
export const winnerTeamHref = (apiName: string) => `/teams/${slugify(winnerTeamName(apiName))}/`;

export const ROUND_FLAGS = [
  'au', 'cn', 'jp', 'us', 'ca', 'mc', 'es', 'at', 'gb', 'be', 'hu', 'nl',
  'it', 'es', 'az', 'my', 'sg', 'us', 'mx', 'br', 'us', 'qa', 'ae',
] as const;

export function roundFlagCode(round: number): string {
  return ROUND_FLAGS[round - 1] ?? '';
}

export function displayRoundName(event: { round: number; name: string; country: string }): string {
  if (event.name === 'Barcelona-Catalunya Grand Prix') return 'Barcelona Grand Prix';
  if (event.round === 16 && event.country === 'Malaysia' && event.name === 'Bahrain Grand Prix') {
    return 'Bahrain Grand Prix in Malaysia';
  }
  return event.name;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export function formatScheduleClock(targetTs: number, now: number = Date.now()): string {
  const delta = Math.max(0, Math.floor((targetTs - now) / 1000));
  if (delta <= 0) return 'Live';
  const days = Math.floor(delta / 86400);
  const hours = Math.floor((delta % 86400) / 3600);
  const minutes = Math.floor((delta % 3600) / 60);
  const seconds = delta % 60;
  const hms = `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
  return days > 0 ? `${days}d ${hms}` : hms;
}

export function formatWeekendRange(firstTs: number, lastTs: number, timeZone?: string): string {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(timeZone ? { timeZone } : {}),
  });
  const partsOf = (ts: number) => {
    const parts = fmt.formatToParts(ts);
    const day = parts.find((p) => p.type === 'day')?.value ?? '';
    const month = parts.find((p) => p.type === 'month')?.value ?? '';
    return { day, month };
  };
  const a = partsOf(firstTs);
  const b = partsOf(lastTs);
  if (a.month === b.month) {
    return a.day === b.day ? `${a.day} ${a.month}` : `${a.day}\u2013${b.day} ${b.month}`;
  }
  return `${a.day} ${a.month} \u2013 ${b.day} ${b.month}`;
}

export function formatSessionLong(ts: number, timeZone?: string): string {
  const opts = timeZone ? { timeZone } : {};
  const dayPart = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...opts,
  }).format(ts);
  const timePart = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    ...opts,
  }).format(ts);
  return `${dayPart} at ${timePart}`;
}

export function viewerTimeZoneLabel(tz?: string): string {
  const raw = tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  return raw ? raw.replace(/_/g, ' ') : 'your time zone';
}
