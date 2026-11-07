import { describe, expect, it, vi } from 'vitest';
import { bornFacts, displayName, shortRaceName, splitName, teamLabel } from '../src/data/driver-facts';
import { NATIONALITY_FLAG } from '../src/data/driver-flags';
import { CIRCUIT_COUNTRY } from '../src/data/driver-facts';
import { portrait } from '../src/data/driver-portraits';
import { slugify } from '../src/data/slugs';
import { flagHtml } from '../src/data/flags';
import { driverSlug, esc, ordinal, teamColor } from '../src/pages/driver-core';
import { seasonStats, teammateBattle, teammateOf, type Season, type SeasonRow } from '../src/pages/driver-season';
import { schedule } from '../src/data/schedule';

const row = (over: Partial<SeasonRow>): SeasonRow => ({
  round: '1', raceName: 'Australian Grand Prix', circuitId: 'albert_park', date: '2026-03-08',
  position: '1', positionText: '1', grid: '1', points: '25', status: 'Finished', laps: '58', ...over,
});

describe('driver slugs', () => {
  it('matches the URLs the standings table already links to', () => {
    expect(slugify('Andrea Kimi Antonelli')).toBe('andrea-kimi-antonelli');
    expect(slugify('Sergio Pérez')).toBe('sergio-perez');
    expect(slugify('Nico Hülkenberg')).toBe('nico-hulkenberg');
    expect(slugify('  Max   Verstappen ')).toBe('max-verstappen');
  });
  it('is the single rule both pages use', () => {
    expect(driverSlug({ driverId: 'max_verstappen', givenName: 'Max', familyName: 'Verstappen' })).toBe('max-verstappen');
  });
});

describe('name and team presentation', () => {
  it('splits a name into the card’s two lines without losing a middle name', () => {
    expect(splitName('Andrea Kimi', 'Antonelli')).toEqual({ first: 'Andrea Kimi', last: 'Antonelli' });
    expect(displayName('Andrea  Kimi', 'Antonelli')).toBe('Andrea Kimi Antonelli');
  });
  it('uses the grid’s own constructor names', () => {
    expect(teamLabel('RB F1 Team')).toBe('Racing Bulls');
    expect(teamLabel('Alpine F1 Team')).toBe('Alpine');
    expect(teamLabel('Ferrari')).toBe('Ferrari');
  });
  it('falls back to a neutral colour for an unknown constructor', () => {
    expect(teamColor('Ferrari')).toBe('#DC0000');
    expect(teamColor('Nobody')).toBe('var(--fg-4)');
  });
});

describe('ordinals', () => {
  it('covers the teens, which are the classic off-by-one', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal))
      .toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st', '111th']);
    expect(ordinal(0)).toBe('\u2014');
    expect(ordinal(Number.NaN)).toBe('\u2014');
  });
});

describe('portraits', () => {
  it('resolves the driverIds that differ from the file keys', () => {
    expect(portrait('max_verstappen', 320)).toContain('2026redbullracingmaxver01right.webp');
    expect(portrait('arvid_lindblad', 320)).toContain('2026racingbullsarvlin01right.webp');
    expect(portrait('antonelli', 600)).toContain('w_600');
  });
  it('falls back to the CDN silhouette rather than a broken image', () => {
    const url = portrait('nobody', 320);
    expect(url).toContain('2026fallbackdriverright.webp');
    expect(url.startsWith('https://media.formula1.com/')).toBe(true);
  });
});

describe('flags and circuits', () => {
  it('serves flags from this origin, never a third party', () => {
    const html = flagHtml('it');
    expect(html).toContain('/assets/flags/it-40.png');
    expect(html).toContain('/assets/flags/it-w80.png 2x');
    expect(html).not.toContain('flagcdn');
    expect(flagHtml('')).toBe('');
  });
  it('has a flag for every nationality on the 2026 grid people search for', () => {
    for (const nationality of ['Italian', 'British', 'Dutch', 'Monegasque', 'New Zealander', 'Thai', 'Finnish']) {
      expect(NATIONALITY_FLAG[nationality], nationality).toBeTruthy();
    }
  });
  it('maps every circuit the 2026 result feed uses', () => {
    /* These are the circuit ids Jolpica returns for the 19 rounds run so far; a
       round with no flag would print a nameless GP row. */
    const raced = ['albert_park', 'shanghai', 'suzuka', 'miami', 'villeneuve', 'monaco',
      'catalunya', 'red_bull_ring', 'silverstone', 'spa', 'hungaroring', 'zandvoort',
      'monza', 'madring', 'baku', 'sepang', 'marina_bay', 'americas', 'rodriguez'];
    expect(raced.filter((id) => !CIRCUIT_COUNTRY[id])).toEqual([]);
  });
  it('maps every circuit still to come on the embedded calendar', () => {
    /* The remaining rounds, by the circuit ids the calendar names. */
    const remaining = ['interlagos', 'las_vegas', 'losail', 'yas_marina'];
    expect(remaining.filter((id) => !CIRCUIT_COUNTRY[id])).toEqual([]);
    expect(schedule.length).toBe(23);
  });
});

describe('race names', () => {
  it('shortens to GP without losing a displaced host', () => {
    expect(shortRaceName('Australian Grand Prix', 'au')).toBe('Australian GP');
    expect(shortRaceName('Bahrain Grand Prix in Malaysia', 'my')).toBe('Bahrain GP · Malaysia');
    expect(shortRaceName('Monaco Grand Prix', 'mc')).toBe('Monaco GP');
  });
});

describe('dates of birth', () => {
  it('formats and ages against a fixed clock', () => {
    const now = new Date('2026-11-07T00:00:00Z');
    expect(bornFacts('2006-08-25', now)).toEqual({ label: '25 Aug 2006', age: 20 });
    expect(bornFacts('1985-01-07', now)).toEqual({ label: '7 Jan 1985', age: 41 });
    expect(bornFacts(undefined, now)).toBeNull();
  });
  it('does not count a birthday that has not happened yet', () => {
    expect(bornFacts('2000-12-31', new Date('2026-11-07T00:00:00Z'))?.age).toBe(25);
  });
});

describe('escaping', () => {
  it('neutralises anything the API could send', () => {
    expect(esc('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(esc(`O'Hara & "co"`)).toBe('O&#39;Hara &amp; &quot;co&quot;');
  });
});

describe('season maths', () => {
  const season: Season = {
    round: '3',
    rows: [
      row({ round: '1', position: '1', grid: '1', points: '25' }),
      row({ round: '2', position: '3', grid: '2', points: '15' }),
      row({ round: '3', position: '12', grid: '8', points: '0' }),
      row({ round: '4', position: '0', positionText: 'R', grid: '4', points: '0', status: 'Retired' }),
    ],
    sprints: [row({ round: '2', position: '1', points: '8' })],
  };
  it('counts wins, podiums, poles and starts from the results', () => {
    const stats = seasonStats(season);
    expect(stats).toMatchObject({ starts: 4, wins: 1, podiums: 2, poles: 1, pointsFinishes: 2, bestFinishText: '1st' });
    expect(stats.sprintWins).toBe(1);
  });
  it('ignores retirements when finding the best finish', () => {
    const retiredOnly: Season = { rows: [row({ position: '0', positionText: 'R' })], sprints: [], round: '1' };
    expect(seasonStats(retiredOnly).bestFinishText).toBe('\u2014');
  });
});

describe('teammate battle', () => {
  const rows = [
    { position: '1', points: '380', wins: '9', Driver: { driverId: 'antonelli', givenName: 'Andrea Kimi', familyName: 'Antonelli' }, Constructors: [{ name: 'Mercedes', constructorId: 'mercedes' }] },
    { position: '4', points: '250', wins: '3', Driver: { driverId: 'russell', givenName: 'George', familyName: 'Russell' }, Constructors: [{ name: 'Mercedes', constructorId: 'mercedes' }] },
    { position: '5', points: '245', wins: '1', Driver: { driverId: 'leclerc', givenName: 'Charles', familyName: 'Leclerc' }, Constructors: [{ name: 'Ferrari', constructorId: 'ferrari' }] },
  ];
  it('finds the other driver in the same constructor', () => {
    expect(teammateOf(rows, rows[0].Driver)?.Driver.driverId).toBe('russell');
  });
  it('returns null when a team has one entry', () => {
    expect(teammateOf(rows, rows[2].Driver)).toBeNull();
  });
  it('counts shared finishes, not rounds one of them missed', () => {
    const mine: Season = { rows: [row({ round: '1', position: '2' }), row({ round: '2', position: '1' }), row({ round: '3', position: '5' })], sprints: [], round: '3' };
    const theirs: Season = { rows: [row({ round: '1', position: '4' }), row({ round: '2', position: '3' })], sprints: [], round: '2' };
    expect(teammateBattle(mine, theirs)).toEqual({ shared: 2, ahead: 2, behind: 0 });
  });
  it('needs no network to compare', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    teammateBattle({ rows: [], sprints: [], round: '0' }, { rows: [], sprints: [], round: '0' });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
