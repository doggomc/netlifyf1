import { describe, expect, it } from 'vitest';
import { TEAM_PROFILES, findTeamByConstructorId, findTeamBySlug } from '../src/data/team-facts';
import { teamSlug } from '../src/pages/driver-core';
import { carFinishToken, teamRoundRows, teamSeasonStats, type TeamSeason } from '../src/pages/team-season';

describe('constructor slugs and facts', () => {
  it('resolves every API constructor name to the exact Rerace URL slug', () => {
    expect(teamSlug('Mercedes')).toBe('mercedes');
    expect(teamSlug('Ferrari')).toBe('ferrari');
    expect(teamSlug('Red Bull')).toBe('red-bull-racing');
    expect(teamSlug('Red Bull Racing')).toBe('red-bull-racing');
    expect(teamSlug('McLaren')).toBe('mclaren');
    expect(teamSlug('RB F1 Team')).toBe('racing-bulls');
    expect(teamSlug('Alpine F1 Team')).toBe('alpine');
    expect(teamSlug('Haas F1 Team')).toBe('haas');
    expect(teamSlug('Audi')).toBe('audi');
    expect(teamSlug('Williams')).toBe('williams');
    expect(teamSlug('Aston Martin')).toBe('aston-martin');
    expect(teamSlug('Cadillac F1 Team')).toBe('cadillac');
  });

  it('covers all 11 2026 constructors with unique slugs and constructorIds', () => {
    expect(TEAM_PROFILES.length).toBe(11);
    expect(new Set(TEAM_PROFILES.map((t) => t.slug)).size).toBe(11);
    expect(new Set(TEAM_PROFILES.map((t) => t.constructorId)).size).toBe(11);
    expect(findTeamBySlug('red-bull-racing')?.entryName).toBe('Oracle Red Bull Racing');
    expect(findTeamByConstructorId('rb')?.name).toBe('Racing Bulls');
    expect(findTeamBySlug('nonexistent')).toBeNull();
  });
});

describe('constructor season statistics and round formatting', () => {
  const sampleSeason: TeamSeason = {
    round: '3',
    races: [
      {
        round: '1',
        raceName: 'Australian Grand Prix',
        circuitId: 'albert_park',
        date: '2026-03-08',
        results: [
          { driverId: 'russell', code: 'RUS', familyName: 'Russell', position: '1', positionText: '1', grid: '1', points: '25', status: 'Finished' },
          { driverId: 'antonelli', code: 'ANT', familyName: 'Antonelli', position: '2', positionText: '2', grid: '3', points: '18', status: 'Finished' },
        ],
      },
      {
        round: '2',
        raceName: 'Chinese Grand Prix',
        circuitId: 'shanghai',
        date: '2026-03-15',
        results: [
          { driverId: 'antonelli', code: 'ANT', familyName: 'Antonelli', position: '1', positionText: '1', grid: '1', points: '25', status: 'Finished' },
          { driverId: 'russell', code: 'RUS', familyName: 'Russell', position: '18', positionText: 'R', grid: '2', points: '0', status: 'Gearbox' },
        ],
      },
    ],
    sprints: [
      {
        round: '2',
        raceName: 'Chinese Grand Prix',
        circuitId: 'shanghai',
        date: '2026-03-14',
        results: [
          { driverId: 'antonelli', code: 'ANT', familyName: 'Antonelli', position: '1', positionText: '1', grid: '1', points: '8', status: 'Finished' },
          { driverId: 'russell', code: 'RUS', familyName: 'Russell', position: '5', positionText: '5', grid: '4', points: '4', status: 'Finished' },
        ],
      },
    ],
  };

  it('counts wins, podiums, poles, sprint wins and 1-2 finishes accurately', () => {
    expect(teamSeasonStats(sampleSeason)).toEqual({
      rounds: 2,
      wins: 2,
      sprintWins: 1,
      podiums: 3,
      poles: 2,
      oneTwos: 1,
    });
  });

  it('orders finishes by race classification and combines race + sprint weekend points', () => {
    const rows = teamRoundRows(sampleSeason);
    expect(rows).toEqual([
      { round: '1', raceName: 'Australian Grand Prix', circuitId: 'albert_park', finishes: 'RUS P1 · ANT P2', points: 43, won: true },
      { round: '2', raceName: 'Chinese Grand Prix', circuitId: 'shanghai', finishes: 'ANT P1 · RUS DNF', points: 37, won: true },
    ]);
    expect(carFinishToken({ driverId: 'x', code: 'VER', familyName: 'Verstappen', position: '20', positionText: 'D', grid: '1', points: '0', status: 'Disqualified' })).toBe('VER DSQ');
  });
});
