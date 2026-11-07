import { describe, expect, it } from 'vitest';
import {
  extrapolatedRemainingMs, formatLapSeconds, mergeF1Delta,
  snapshotFromF1State, snapshotFromOpenF1, tyreCode,
} from '../src/pages/live-timing-feed';

describe('live timing feed engine', () => {
  it('merges recursive SignalR state deltas and honours _deleted keys safely', () => {
    const prev = {
      Lines: {
        '1': { Position: '2', BestLapTime: { Value: '1:11.016' }, InPit: true },
        '12': { Position: '1', BestLapTime: { Value: '1:10.763' } },
      },
      Sectors: [{ Value: '18.100' }, { Value: '35.200' }, { Value: '17.400' }],
    };
    const next = mergeF1Delta(prev, {
      Lines: {
        '1': { Position: '1', BestLapTime: { Value: '1:10.500', OverallFastest: true }, _deleted: ['InPit'] },
        '12': { Position: '2' },
      },
      Sectors: { '1': { Value: '35.050', PersonalFastest: true } },
    }) as any;

    expect(next.Lines['1'].Position).toBe('1');
    expect(next.Lines['1'].BestLapTime.Value).toBe('1:10.500');
    expect('InPit' in next.Lines['1']).toBe(false);
    expect(next.Lines['12'].BestLapTime.Value).toBe('1:10.763');
    expect(next.Sectors[1].Value).toBe('35.050');
    expect(next.Sectors[0].Value).toBe('18.100');
  });

  it('normalises an official F1 SignalR state snapshot for race and practice modes', () => {
    const state = {
      SessionInfo: {
        Name: 'Race', Type: 'Race', SessionStatus: 'Started',
        Path: '2026/2026-11-08_Brazil/2026-11-08_Race/',
        Meeting: { Name: 'São Paulo Grand Prix', Location: 'São Paulo', Circuit: { ShortName: 'Interlagos' } },
      },
      SessionStatus: { Status: 'Started' },
      TrackStatus: { Status: '4' },
      LapCount: { CurrentLap: 42, TotalLaps: 71 },
      WeatherData: { AirTemp: '22.4', TrackTemp: '36.1', Humidity: '72', WindSpeed: '3.1', Rainfall: '0' },
      DriverList: {
        '12': { FirstName: 'Andrea Kimi', LastName: 'Antonelli', Tla: 'ANT', TeamName: 'Mercedes', TeamColour: '27F4D2' },
        '1': { FirstName: 'Lando', LastName: 'Norris', Tla: 'NOR', TeamName: 'McLaren', TeamColour: 'FF8000' },
      },
      TimingAppData: {
        Lines: {
          '12': { Stints: { '0': { Compound: 'MEDIUM', TotalLaps: 18 } } },
          '1': { Stints: { '0': { Compound: 'HARD', TotalLaps: 12 } } },
        },
      },
      TimingData: {
        Lines: {
          '12': {
            Position: '1', NumberOfLaps: 42, NumberOfPitStops: 1,
            BestLapTime: { Value: '1:12.104' },
            LastLapTime: { Value: '1:12.104', OverallFastest: true },
            Sectors: { '0': { Value: '18.412', OverallFastest: true }, '1': { Value: '36.100' }, '2': { Value: '17.592' } },
          },
          '1': {
            Position: '2', GapToLeader: '+1.482', IntervalToPositionAhead: { Value: '+1.482' },
            NumberOfLaps: 42, NumberOfPitStops: 1,
            BestLapTime: { Value: '1:12.350' },
            LastLapTime: { Value: '1:12.350', PersonalFastest: true },
            Sectors: [{ Value: '18.510' }, { Value: '36.220', PersonalFastest: true }, { Value: '17.620' }],
          },
        },
      },
      RaceControlMessages: { Messages: [{ Utc: '2026-11-08T17:45:00Z', Lap: 41, Flag: 'YELLOW', Message: 'SAFETY CAR DEPLOYED' }] },
      TeamRadio: { Captures: [{ RacingNumber: '12', Utc: '2026-11-08T17:44:00Z', Path: 'TeamRadio/ANT_12.mp3' }] },
    };

    const snap = snapshotFromF1State(state);
    expect(snap).not.toBeNull();
    expect(snap!.isLive).toBe(true);
    expect(snap!.isRace).toBe(true);
    expect(snap!.track).toEqual({ label: 'Safety car', cls: 'flag-sc' });
    expect(snap!.clock).toEqual({ label: 'Lap', value: '42/71' });
    expect(snap!.rows[0].tla).toBe('ANT');
    expect(snap!.rows[0].cells[0].text).toBe('LAP 42');
    expect(snap!.rows[0].cells[3]).toEqual({ text: '1:12.104', tone: 'fastest' });
    expect(snap!.rows[0].tyre).toEqual({ code: 'M', age: '18' });
    expect(snap!.rows[1].cells[1].text).toBe('+1.482');
    expect(snap!.rows[1].cells[2]).toEqual({ text: '1:12.350', tone: 'pb' });
    expect(snap!.raceControl[0].dotCls).toBe('is-amber');
    expect(snap!.radio[0].url).toContain('TeamRadio/ANT_12.mp3');
  });

  it('normalises OpenF1 practice & qualifying bundles with purple/green sectors and tyres', () => {
    const snap = snapshotFromOpenF1({
      session: {
        session_key: 11406, meeting_key: 1299,
        session_name: 'Practice 2', session_type: 'Practice',
        date_start: '2026-11-06T19:00:00+00:00', date_end: '2026-11-06T20:00:00+00:00',
        circuit_short_name: 'Interlagos', country_name: 'Brazil', location: 'São Paulo',
      },
      drivers: [
        { driver_number: 12, name_acronym: 'ANT', first_name: 'Andrea Kimi', last_name: 'Antonelli', team_name: 'Mercedes', team_colour: '27F4D2' },
        { driver_number: 1, name_acronym: 'NOR', first_name: 'Lando', last_name: 'Norris', team_name: 'McLaren', team_colour: 'FF8000' },
      ],
      results: [
        { position: 1, driver_number: 12, number_of_laps: 37, duration: 70.763, gap_to_leader: 0, dnf: false, dns: false, dsq: false },
        { position: 2, driver_number: 1, number_of_laps: 31, duration: 71.016, gap_to_leader: 0.253, dnf: false, dns: false, dsq: false },
      ],
      laps: [
        { driver_number: 12, lap_number: 15, lap_duration: 70.763, duration_sector_1: 18.2, duration_sector_2: 35.463, duration_sector_3: 17.1 },
        { driver_number: 1, lap_number: 14, lap_duration: 71.016, duration_sector_1: 18.15, duration_sector_2: 35.666, duration_sector_3: 17.2 },
      ],
      stints: [
        { driver_number: 12, stint_number: 2, compound: 'SOFT', lap_start: 12, lap_end: 25, tyre_age_at_start: 0 },
        { driver_number: 1, stint_number: 2, compound: 'MEDIUM', lap_start: 10, lap_end: 20, tyre_age_at_start: 3 },
      ],
      weather: [{ air_temperature: 20.5, track_temperature: 35.4, humidity: 86.7, wind_speed: 2.7, rainfall: 0 }],
      raceControl: [{ date: '2026-11-06T20:00:00+00:00', flag: 'CHEQUERED', message: 'CHEQUERED FLAG' }],
      radio: [],
    }, Date.parse('2026-11-07T08:00:00Z'));

    expect(snap.isLive).toBe(false);
    expect(snap.statusText).toBe('Final classification · Practice 2');
    expect(snap.rows[0].cells[0]).toEqual({ text: '1:10.763', tone: 'fastest' });
    expect(snap.rows[1].cells[1].text).toBe('+0.253');
    expect(snap.rows[1].cells[4]).toEqual({ text: '18.150', tone: 'fastest' });
    expect(snap.rows[0].tyre).toEqual({ code: 'S', age: '14' });
    expect(snap.rows[1].tyre).toEqual({ code: 'M', age: '14' });
  });

  it('formats lap times, tyres and extrapolated clocks accurately', () => {
    expect(formatLapSeconds(70.763)).toBe('1:10.763');
    expect(formatLapSeconds(59.04)).toBe('59.040');
    expect(tyreCode('interMediate')).toBe('I');
    const rem = extrapolatedRemainingMs({
      ExtrapolatedClock: { Remaining: '00:15:30', Extrapolating: true, Utc: '2026-11-07T14:30:00Z' },
    }, Date.parse('2026-11-07T14:30:10Z'));
    expect(rem).toBe((15 * 60 + 20) * 1000);
  });
});
