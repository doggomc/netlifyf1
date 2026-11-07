/* Season results and statistics for one constructor: wins, podiums, poles,
   1-2 finishes and per-round weekend points (race + sprint). Loaded only on
   /teams/<slug>/ so the /teams grid stays lightweight. */

import { JOLPI, SITE_SEASON } from '../config';
import { fetchJson } from '../services/api';

export type CarEntryResult = {
  driverId: string;
  code: string;
  familyName: string;
  position: string;
  positionText: string;
  grid: string;
  points: string;
  status: string;
};

export type TeamRaceRound = {
  round: string;
  raceName: string;
  circuitId: string;
  date: string;
  results: CarEntryResult[];
};

export type TeamSeason = {
  races: TeamRaceRound[];
  sprints: TeamRaceRound[];
  round: string;
};

type RawDriverResult = {
  position: string;
  positionText: string;
  grid: string;
  points: string;
  status: string;
  Driver: { driverId: string; code?: string; familyName: string };
};

type RawRace = {
  round: string;
  raceName: string;
  date: string;
  Circuit?: { circuitId?: string };
  Results?: RawDriverResult[];
  SprintResults?: RawDriverResult[];
};

type RawRacesResponse = { MRData?: { RaceTable?: { Races?: RawRace[] } } };

const cache = new Map<string, Promise<TeamSeason>>();

function mapEntries(items: RawDriverResult[] | undefined): CarEntryResult[] {
  return (items ?? []).map((item) => ({
    driverId: item.Driver?.driverId ?? '',
    code: item.Driver?.code || item.Driver?.familyName?.slice(0, 3).toUpperCase() || '—',
    familyName: item.Driver?.familyName ?? '',
    position: item.position,
    positionText: item.positionText,
    grid: item.grid,
    points: item.points,
    status: item.status,
  }));
}

function mapRaces(data: RawRacesResponse | null, kind: 'Results' | 'SprintResults'): TeamRaceRound[] {
  return (data?.MRData?.RaceTable?.Races ?? [])
    .map((race) => ({
      round: race.round,
      raceName: race.raceName,
      circuitId: race.Circuit?.circuitId ?? '',
      date: race.date,
      results: mapEntries(race[kind]),
    }))
    .sort((a, b) => Number(a.round) - Number(b.round));
}

export function loadTeamSeason(constructorId: string): Promise<TeamSeason> {
  const hit = cache.get(constructorId);
  if (hit) return hit;
  /* Two cars across 24 rounds = up to 48 result rows; limit=80 avoids default-30 truncation. */
  const racesReq = fetchJson<RawRacesResponse>(`${JOLPI}/${SITE_SEASON}/constructors/${constructorId}/results.json?limit=80`).catch(() => null);
  const sprintsReq = fetchJson<RawRacesResponse>(`${JOLPI}/${SITE_SEASON}/constructors/${constructorId}/sprint.json?limit=40`).catch(() => null);
  const promise = Promise.all([racesReq, sprintsReq]).then(([raceData, sprintData]) => {
    const races = mapRaces(raceData, 'Results');
    const sprints = mapRaces(sprintData, 'SprintResults');
    const lastRound = Math.max(0, ...races.map((r) => Number(r.round)), ...sprints.map((r) => Number(r.round)));
    return { races, sprints, round: String(lastRound) };
  }).catch((error) => { cache.delete(constructorId); throw error; });
  cache.set(constructorId, promise);
  return promise;
}

export type TeamSeasonStats = {
  rounds: number;
  wins: number;
  sprintWins: number;
  podiums: number;
  poles: number;
  oneTwos: number;
};

export function teamSeasonStats(season: TeamSeason): TeamSeasonStats {
  let wins = 0;
  let podiums = 0;
  let poles = 0;
  let oneTwos = 0;

  for (const race of season.races) {
    let hasP1 = false;
    let hasP2 = false;
    for (const car of race.results) {
      const pos = Number(car.position);
      if (car.position === '1') { wins += 1; hasP1 = true; }
      if (car.position === '2') hasP2 = true;
      if (pos >= 1 && pos <= 3) podiums += 1;
      if (car.grid === '1') poles += 1;
    }
    if (hasP1 && hasP2) oneTwos += 1;
  }

  const sprintWins = season.sprints.reduce(
    (sum, race) => sum + race.results.filter((car) => car.position === '1').length,
    0,
  );

  return {
    rounds: season.races.length,
    wins,
    sprintWins,
    podiums,
    poles,
    oneTwos,
  };
}

export function carFinishToken(car: CarEntryResult): string {
  const txt = car.positionText;
  if (txt === 'D') return `${car.code} DSQ`;
  if (txt === 'W' || txt === 'F') return `${car.code} DNS`;
  if (txt === 'R' || (car.status && !/^(Finished|\+\d+ Laps?)$/.test(car.status) && !/^\d+$/.test(txt))) {
    return `${car.code} DNF`;
  }
  if (/^\d+$/.test(txt || car.position)) return `${car.code} P${txt || car.position}`;
  return `${car.code} ${txt || car.position || '—'}`;
}

export type TeamRoundRow = {
  round: string;
  raceName: string;
  circuitId: string;
  finishes: string;
  points: number;
  won: boolean;
};

export function teamRoundRows(season: TeamSeason): TeamRoundRow[] {
  const sprintByRound = new Map<string, TeamRaceRound>(season.sprints.map((s) => [s.round, s]));
  return season.races.map((race) => {
    const ordered = [...race.results].sort((a, b) => {
      const pa = /^\d+$/.test(a.positionText) ? Number(a.position) : 999;
      const pb = /^\d+$/.test(b.positionText) ? Number(b.position) : 999;
      return pa - pb;
    });
    const finishes = ordered.map(carFinishToken).join(' · ');
    const racePts = race.results.reduce((sum, car) => sum + (Number(car.points) || 0), 0);
    const sprintPts = (sprintByRound.get(race.round)?.results ?? []).reduce((sum, car) => sum + (Number(car.points) || 0), 0);
    return {
      round: race.round,
      raceName: race.raceName,
      circuitId: race.circuitId,
      finishes,
      points: racePts + sprintPts,
      won: race.results.some((car) => car.position === '1'),
    };
  });
}
