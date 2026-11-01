import { describe, it, expect } from 'vitest';
import { staleSession } from '../src/features/session-guard';

describe('stale taifood entries', () => {
  const practice = 'https://taifood-blog.asia/embed/mexico-city-grand-prix---practice-3-31385';
  const race = 'https://taifood-blog.asia/embed/mexico-city-grand-prix---race-31407';
  const path = 'https://taifood-blog.asia/embed/f1/2026/mexico/race';
  it('skips an address that names another session', () => {
    expect(staleSession(practice, 'race')).toBe(true);
    expect(staleSession(race, 'practice-3')).toBe(true);
  });
  it('keeps the address for the session being watched', () => {
    expect(staleSession(race, 'race')).toBe(false);
    expect(staleSession(practice, 'practice-3')).toBe(false);
  });
  it('keeps an address that names no session at all', () => {
    expect(staleSession(path, 'race')).toBe(false);
  });
});
