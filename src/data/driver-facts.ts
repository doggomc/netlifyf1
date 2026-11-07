/* Facts a profile prints that a card does not: the flag map, host countries,
   name formatting and the one derived biography input (date of birth).
   Kept apart from DRIVER_PORTRAIT so the grid page does not ship it. */

/** Team licence country, used for the flag beside the team name on a profile. */
export const TEAM_COUNTRY: Record<string, string> = {
  'McLaren': 'gb', 'Ferrari': 'it', 'Red Bull': 'at', 'Racing Bulls': 'it',
  'Mercedes': 'de', 'Williams': 'gb', 'Aston Martin': 'gb', 'Alpine F1 Team': 'fr',
  'Alpine': 'fr', 'Haas F1 Team': 'us', 'Haas': 'us', 'Audi': 'de',
  'Cadillac F1 Team': 'us', 'Cadillac': 'us', 'RB F1 Team': 'it',
};

/** The name the grid uses for a constructor, from whatever the API calls it. */
const TEAM_LABEL: Record<string, string> = {
  'Red Bull': 'Red Bull Racing',
  'RB F1 Team': 'Racing Bulls',
  'Alpine F1 Team': 'Alpine',
  'Haas F1 Team': 'Haas',
  'Cadillac F1 Team': 'Cadillac',
};

export function teamLabel(apiName: string): string {
  return TEAM_LABEL[apiName] ?? apiName;
}

/** Circuit → host country, for the flag and the short name in a results table. */
export const CIRCUIT_COUNTRY: Record<string, string> = {
  albert_park: 'au', shanghai: 'cn', suzuka: 'jp', miami: 'us', villeneuve: 'ca',
  monaco: 'mc', catalunya: 'es', red_bull_ring: 'at', silverstone: 'gb',
  spa: 'be', hungaroring: 'hu', zandvoort: 'nl', monza: 'it', madring: 'es',
  baku: 'az', sepang: 'my', marina_bay: 'sg', americas: 'us', rodriguez: 'mx',
  interlagos: 'br', las_vegas: 'us', losail: 'qa', yas_marina: 'ae', jeddah: 'sa',
  bahrain: 'bh', imola: 'it', portimao: 'pt', mugello: 'it', sochi: 'ru',
  istanbul: 'tr', nurburgring: 'de', hockenheim: 'de', ricard: 'fr',
  paul_ricard: 'fr', valencia: 'es', yeongam: 'kr', buddh: 'in',
};

/**
 * "Australian Grand Prix" → "Australian GP". A Grand Prix named after a country
 * other than the one hosting it keeps both: "Bahrain Grand Prix in Malaysia"
 * becomes "Bahrain GP · Malaysia" rather than claiming a Malaysian race with a
 * Bahraini name.
 */
export function shortRaceName(raceName: string, countryCode: string): string {
  const match = /^(.*?)\s+Grand Prix(?:\s+in\s+(.+))?$/.exec(raceName.trim());
  if (!match) return raceName;
  const [, place, host] = match;
  if (host) return `${place} GP · ${host}`;
  void countryCode;
  return `${place} GP`;
}

/** The API spells a few drivers differently from the grid's own plates. */
export function displayName(given: string, family: string): string {
  return `${given} ${family}`.replace(/\s+/g, ' ').trim();
}

/** First name(s) over surname, the card's two-line name. */
export function splitName(given: string, family: string): { first: string; last: string } {
  return { first: given.trim(), last: family.trim() };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2006-08-25" → { label: "25 Aug 2006", age: 20 } */
export function bornFacts(iso: string | undefined, now = new Date()): { label: string; age: number | null } | null {
  if (!iso) return null;
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return null;
  let age = now.getUTCFullYear() - year;
  const beforeBirthday = now.getUTCMonth() + 1 < month || (now.getUTCMonth() + 1 === month && now.getUTCDate() < day);
  if (beforeBirthday) age -= 1;
  return { label: `${day} ${MONTHS[month - 1]} ${year}`, age };
}
