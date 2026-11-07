/* Season detail for one driver: every round finished, the sprints, the totals the
   stat cards print, and the teammate head-to-head. Profile-page only, so a card
   on the grid never downloads it. */

import { JOLPI, SITE_SEASON } from '../config';
import { fetchJson } from '../services/api';
import { ordinal, type DriverRef, type StandingRow } from './driver-core';

export type SeasonRow = {
  round: string;
  raceName: string;
  circuitId: string;
  date: string;
  position: string;
  positionText: string;
  grid: string;
  points: string;
  status: string;
  laps: string;
};

export type Season = {
  rows: SeasonRow[];
  sprints: SeasonRow[];
  round: string;
};

type RawResult = {
  position: string; positionText: string; grid: string; points: string;
  status: string; laps: string; Driver: { driverId: string };
};
type RawRace = {
  round: string; raceName: string; date: string;
  Circuit?: { circuitId?: string };
  Results?: RawResult[];
  SprintResults?: RawResult[];
};
type RawRaces = { MRData?: { RaceTable?: { Races?: RawRace[] } } };

/** One driver, the whole season: finishes and sprints, keyed by round. */
const seasonCache = new Map<string, Promise<Season>>();

function toRow(race: RawRace, result: RawResult): SeasonRow {
  return {
    round: race.round,
    raceName: race.raceName,
    circuitId: race.Circuit?.circuitId ?? '',
    date: race.date,
    position: result.position,
    positionText: result.positionText,
    grid: result.grid,
    points: result.points,
    status: result.status,
    laps: result.laps,
  };
}

export function loadSeason(driverId: string): Promise<Season> {
  const hit = seasonCache.get(driverId);
  if (hit) return hit;
  const results = fetchJson<RawRaces>(`${JOLPI}/${SITE_SEASON}/drivers/${driverId}/results.json`).catch(() => null);
  const sprints = fetchJson<RawRaces>(`${JOLPI}/${SITE_SEASON}/drivers/${driverId}/sprint.json`).catch(() => null);
  const promise = Promise.all([results, sprints]).then(([raceData, sprintData]) => {
    const read = (data: RawRaces | null, kind: 'Results' | 'SprintResults') =>
      (data?.MRData?.RaceTable?.Races ?? []).flatMap((race) =>
        (race[kind] ?? []).filter((result) => result.Driver?.driverId).map((result) => toRow(race, result)));
    const rows = read(raceData, 'Results').sort((a, b) => Number(a.round) - Number(b.round));
    const sprintRows = read(sprintData, 'SprintResults').sort((a, b) => Number(a.round) - Number(b.round));
    const lastRound = Math.max(0, ...rows.map((row) => Number(row.round)), ...sprintRows.map((row) => Number(row.round)));
    return { rows, sprints: sprintRows, round: String(lastRound) };
  }).catch((error) => { seasonCache.delete(driverId); throw error; });
  seasonCache.set(driverId, promise);
  return promise;
}

/** Totals for the stat cards. Counted from the results, never estimated. */
export type SeasonStats = {
  starts: number; wins: number; sprintWins: number; podiums: number;
  poles: number; bestFinish: string; bestFinishText: string;
  pointsFinishes: number;
};

export function seasonStats(season: Season): SeasonStats {
  const finished = season.rows;
  const wins = finished.filter((row) => row.position === '1').length;
  const best = finished.reduce<SeasonRow | null>((best, row) => {
    if (Number(row.position) <= 0) return best;
    return !best || Number(row.position) < Number(best.position) ? row : best;
  }, null);
  return {
    starts: finished.length,
    wins,
    sprintWins: season.sprints.filter((row) => row.position === '1').length,
    podiums: finished.filter((row) => Number(row.position) > 0 && Number(row.position) <= 3).length,
    poles: finished.filter((row) => row.grid === '1').length,
    bestFinish: best?.position ?? '\u2014',
    bestFinishText: best ? ordinal(Number(best.position)) : '\u2014',
    pointsFinishes: finished.filter((row) => Number(row.points) > 0).length,
  };
}

/**
 * The teammate is the other driver in the same constructor this season. Their
 * head-to-head is read from the two results sets, so it needs no extra request.
 */
export function teammateOf(rows: StandingRow[], driver: DriverRef): StandingRow | null {
  const mine = rows.find((row) => row.Driver.driverId === driver.driverId);
  const team = mine?.Constructors?.[0]?.name;
  if (!team) return null;
  return rows.find((row) => row.Driver.driverId !== driver.driverId && row.Constructors?.[0]?.name === team) ?? null;
}

/** Rounds both drivers finished, and who came out ahead in each. */
export function teammateBattle(mine: Season, theirs: Season): { shared: number; ahead: number; behind: number } {
  const byRound = new Map(theirs.rows.map((row) => [row.round, Number(row.position)]));
  let shared = 0, ahead = 0, behind = 0;
  for (const row of mine.rows) {
    const other = byRound.get(row.round);
    if (other === undefined) continue;
    const minePos = Number(row.position);
    if (!minePos || !other) continue;
    shared += 1;
    if (minePos < other) ahead += 1;
    else if (minePos > other) behind += 1;
  }
  return { shared, ahead, behind };
}
