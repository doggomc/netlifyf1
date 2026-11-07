/* What the Drivers grid and a driver's profile both need: the championship table
   and the one slug rule. Kept free of season logic so the grid does not pay for
   a profile's results processing. */

import { JOLPI, SITE_SEASON } from '../config';
import { slugify } from '../data/slugs';
import { TEAM_HEX } from '../data/teams';

export { slugify };

export type DriverRef = {
  driverId: string;
  givenName: string;
  familyName: string;
  permanentNumber?: string;
  code?: string;
  nationality?: string;
  dateOfBirth?: string;
};

export type StandingRow = {
  position: string;
  positionText?: string;
  points: string;
  wins: string;
  Driver: DriverRef;
  Constructors?: Array<{ name: string; constructorId: string }>;
};

/** Anything the API sends is data, not markup. */
export const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string));

/**
 * The colour a team races in, falling back to the neutral grey for anyone the
 * roster does not know (a mid-season stand-in, say) rather than inventing a hue.
 */
export const teamColor = (name?: string) => (name && TEAM_HEX[name]) || 'var(--fg-4)';

/**
 * Constructors change their public name but not their team: the feed says
 * "RB F1 Team" where the grid and the standings say "Racing Bulls". Rows read
 * the same label a card does.
 */
const TEAM_LABEL: Record<string, string> = {
  'Red Bull': 'Red Bull Racing',
  'RB F1 Team': 'Racing Bulls',
  'Alpine F1 Team': 'Alpine',
  'Haas F1 Team': 'Haas',
  'Cadillac F1 Team': 'Cadillac',
};

export const teamName = (apiName: string) => TEAM_LABEL[apiName] ?? apiName;

/** The gap to the championship leader, as a table prints it: a dash for the leader. */
export function gapToLeader(points: string, leaderPoints: string): string {
  const gap = Number(leaderPoints) - Number(points);
  if (!Number.isFinite(gap)) return '\u2014';
  return gap > 0 ? `-${gap}` : '\u2014';
}

/** "Antonelli" on a card, "andrea-kimi-antonelli" in the URL. */
export const driverSlug = (driver: DriverRef) => slugify(`${driver.givenName} ${driver.familyName}`);

/** "Red Bull" or "Red Bull Racing" → "red-bull-racing" in /teams/<slug>/. */
export const teamSlug = (apiOrDisplayName: string) => slugify(teamName(apiOrDisplayName));

type RawStanding = { MRData?: { StandingsTable?: { StandingsLists?: Array<{ round?: string; DriverStandings?: StandingRow[] }> } } };

/** The championship, ordered. Seasonal, so it is cached for the life of the page. */
let standingsPromise: Promise<{ rows: StandingRow[]; round: string }> | null = null;

/** A plain fetch, deduped for the page's lifetime. The championship is one small
    request that every route on these two pages needs, so it deliberately does not
    drag in the localStorage response cache the cockpit's features share. */
async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json() as T;
}

export function loadStandings(): Promise<{ rows: StandingRow[]; round: string }> {
  standingsPromise ??= fetchJson<RawStanding>(`${JOLPI}/${SITE_SEASON}/driverstandings/?limit=40`)
    .then((data) => {
      const list = data?.MRData?.StandingsTable?.StandingsLists?.[0];
      const rows = list?.DriverStandings;
      if (!Array.isArray(rows) || rows.length === 0) throw new Error('Empty standings');
      return { rows, round: String(list?.round ?? '') };
    })
    .catch((error) => { standingsPromise = null; throw error; });
  return standingsPromise;
}

export function ordinal(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '\u2014';
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  return `${value}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[value % 10] ?? 'th'}`;
}
