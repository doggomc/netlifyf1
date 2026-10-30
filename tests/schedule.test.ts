import { describe, expect, it } from 'vitest';
import { schedule } from '../src/data/schedule';
import { mapPool } from '../src/services/pool';

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
