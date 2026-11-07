import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { schedule } from '../src/data/schedule';
import {
  displayRoundName, formatScheduleClock, formatWeekendRange,
  ROUND_FLAGS, roundFlagCode, viewerTimeZoneLabel,
} from '../src/pages/schedule-format';
import { mapPool } from '../src/services/pool';

const ROOT = resolve(import.meta.dirname, '..');

describe('embedded calendar', () => {
  it('has ordered rounds with finite, sorted timestamps and valid timezones', () => {
    let lastRound = 0;
    for (const event of schedule) {
      expect(event.round).toBeGreaterThan(lastRound); lastRound = event.round;
      expect(event.sessions.some(session => session.slug === 'race')).toBe(true);
      new Intl.DateTimeFormat('en', { timeZone: event.tz }).format();
      let previous = 0;
      for (const session of event.sessions) { expect(session.ts).toBeGreaterThan(previous); previous = session.ts; }
    }
  });
  it('ships self-hosted circuit thumbnails, host flags, and an ICS feed for all 23 rounds', () => {
    expect(ROUND_FLAGS.length).toBe(schedule.length);
    for (const event of schedule) {
      const flag = roundFlagCode(event.round);
      expect(flag).toMatch(/^[a-z]{2}$/);
      expect(existsSync(resolve(ROOT, `assets/flags/${flag}-40.png`))).toBe(true);
      expect(existsSync(resolve(ROOT, `assets/flags/${flag}-w80.png`))).toBe(true);
      expect(existsSync(resolve(ROOT, `assets/circuits/${event.round}.webp`))).toBe(true);
    }
    const ics = readFileSync(resolve(ROOT, 'site-assets/calendar/f1.ics'), 'utf8');
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    const totalSessions = schedule.reduce((sum, ev) => sum + ev.sessions.length, 0);
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(totalSessions);
  });
  it('formats weekend date spans, countdown clocks and round names cleanly', () => {
    expect(formatWeekendRange(Date.parse('2026-03-06T01:30:00Z'), Date.parse('2026-03-08T04:00:00Z'), 'UTC')).toBe('6–8 Mar');
    expect(formatWeekendRange(Date.parse('2026-10-30T18:30:00Z'), Date.parse('2026-11-01T20:00:00Z'), 'UTC')).toBe('30 Oct – 1 Nov');
    expect(formatScheduleClock(1000, 1000)).toBe('Live');
    expect(formatScheduleClock(1000 + (5 * 3600 + 4 * 60 + 9) * 1000, 1000)).toBe('05:04:09');
    expect(formatScheduleClock(1000 + (2 * 86400 + 3 * 3600 + 15 * 60 + 2) * 1000, 1000)).toBe('2d 03:15:02');
    expect(displayRoundName({ round: 7, name: 'Barcelona-Catalunya Grand Prix', country: 'Spain' })).toBe('Barcelona Grand Prix');
    expect(displayRoundName({ round: 16, name: 'Bahrain Grand Prix', country: 'Malaysia' })).toBe('Bahrain Grand Prix in Malaysia');
    expect(viewerTimeZoneLabel('America/Sao_Paulo')).toBe('America/Sao Paulo');
  });
  it('maps concurrent work in original order', async () => {
    let active = 0, max = 0;
    const result = await mapPool([3, 2, 1], async value => {
      active++; max = Math.max(max, active);
      await Promise.resolve(); active--; return value * 2;
    }, 2);
    expect(result).toEqual([6, 4, 2]);
    expect(max).toBe(2);
  });
  it('handles an empty pool', async () => expect(await mapPool([], value => value)).toEqual([]));
});
