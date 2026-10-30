import { describe, expect, it } from 'vitest';
import { parseSiteConfig } from '../src/types/site-config';

describe('untrusted configuration', () => {
  it.each([null, 1, 'config', [], true])('rejects invalid snapshot %j', value => expect(parseSiteConfig(value)).toBeNull());
  it('preserves valid maintenance, source and force-live changes', () => {
    const value = parseSiteConfig({ maintenance: { active: true, message: 'Race Control', startedAt: 123 }, sources: { disabled: ['dazn', 12] }, streamWindow: { active: true, reason: 'Live' } });
    expect(value.maintenance.active).toBe(true);
    expect(value.sources.disabled).toEqual(['dazn']);
    expect(value.streamWindow.active).toBe(true);
  });
  it('does not treat string false as a maintenance activation', () => {
    expect(parseSiteConfig({ maintenance: { active: 'false' } })).toEqual({});
  });
  it('rejects unsafe stream overrides', () => {
    for (const url of ['javascript:alert(1)', 'http://example.com', '//example.com', 'bad']) {
      expect(parseSiteConfig({ streamOverride: { active: true, url } }).streamOverride.active).toBe(false);
    }
  });
  it('accepts the backend legacy override alias', () => {
    expect(parseSiteConfig({ override: { active: true, url: 'https://example.com/player' } }).streamOverride.url).toBe('https://example.com/player');
  });
  it('bounds text and validates timestamps', () => {
    const result = parseSiteConfig({ maintenance: { active: true, message: 'a'.repeat(1000), startedAt: 'yesterday' } });
    expect(result.maintenance.message.length).toBe(500);
    expect(result.maintenance.startedAt).toBeUndefined();
  });
});
