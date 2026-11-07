import { describe, expect, it } from 'vitest';
import { parseSiteConfig } from '../src/types/site-config';
import { outageMarkup, resolvePageCategory } from '../src/features/page-gate';

describe('untrusted configuration', () => {
  it.each([null, 1, 'config', [], true])('rejects invalid snapshot %j', value => expect(parseSiteConfig(value)).toBeNull());
  it('preserves valid maintenance, page-control, source and force-live changes', () => {
    const value = parseSiteConfig({
      maintenance: { active: true, message: 'Race Control', startedAt: 123 },
      pages: { disabled: ['Standings', 'drivers', 'home', 'unknown', 42], updatedAt: 456 },
      sources: { disabled: ['dazn', 12] },
      streamWindow: { active: true, reason: 'Live' }
    });
    expect(value.maintenance.active).toBe(true);
    expect(value.pages.disabled).toEqual(['standings', 'drivers']);
    expect(value.pages.updatedAt).toBe(456);
    expect(value.sources.disabled).toEqual(['dazn']);
    expect(value.streamWindow.active).toBe(true);
  });
  it('maps page attributes and routes to controllable categories while keeping Home exempt', () => {
    expect(resolvePageCategory('home', '/')).toBeNull();
    expect(resolvePageCategory('standings', '/standings.html')).toBe('standings');
    expect(resolvePageCategory('driver', '/drivers/max-verstappen/')).toBe('drivers');
    expect(resolvePageCategory('team', '/teams/ferrari/')).toBe('teams');
    expect(resolvePageCategory('live-timing', '/live-timing.html')).toBe('live-timing');
    expect(resolvePageCategory(undefined, '/help.html')).toBe('help');
  });
  it('builds Partial Outage markup with Home and Discord actions', () => {
    const html = outageMarkup('standings');
    expect(html).toContain('Partial Outage');
    expect(html).toContain("This page isn't available right now.");
    expect(html).toContain('Standings · Temporarily offline');
    expect(html).toContain('href="/"');
    expect(html).toContain('<span>Home</span>');
    expect(html).toContain('href="https://discord.gg/KYXHCAzhN4"');
    expect(html).toContain('<span>Discord</span>');
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
